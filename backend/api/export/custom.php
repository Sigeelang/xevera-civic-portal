<?php
/**
 * Flexible export endpoint for the Super Admin "Export Reports" page.
 *
 * GET params:
 *   report   : all | summary | by_category | by_status | staff_assignment |
 *              resolution | response_time | resident_activity
 *   format   : xlsx (default) | pdf
 *   from,to  : Y-m-d date range on r.created_at
 *   status   : exact status or 'All'
 *   category : exact category or 'All'
 *   assigned : user id or 'All'
 *   location : partial location match
 *
 * PDF: A4 PORTRAIT official Xevera civic report using the shared
 * branded design system (pdf_style.php).
 */

ini_set('display_errors', '0');
error_reporting(E_ALL);
while (ob_get_level() > 0) { ob_end_clean(); }
ob_start();

if (function_exists('opcache_invalidate')) { @opcache_invalidate(__FILE__); }

require_once __DIR__ . '/../config/cors.php';
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$currentUser = requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/pdf_style.php';

function pctText($val, int $total): string {
    return $total > 0 ? round(((int)$val / $total) * 100, 1) . '%' : '0%';
}

function pdfSubCustom(string $text, int $max): string {
    if (mb_strlen($text) <= $max) { return $text; }
    return mb_substr($text, 0, $max - 1) . '…';
}


$report  = $_GET['report'] ?? 'all';
$format  = ($_GET['format'] ?? 'xlsx') === 'pdf' ? 'pdf' : 'xlsx';
$from    = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : null;
$to      = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : null;
$status  = $_GET['status'] ?? 'All';
$category = $_GET['category'] ?? 'All';
$assigned = $_GET['assigned'] ?? 'All';
$location = trim($_GET['location'] ?? '');

$where = [];
$params = [];

if ($from) { $where[] = 'r.created_at >= ?'; $params[] = $from . ' 00:00:00'; }
if ($to) { $where[] = 'r.created_at <= ?'; $params[] = $to . ' 23:59:59'; }
if ($status !== 'All' && $status !== '') { $where[] = 'r.status = ?'; $params[] = $status; }
if ($category !== 'All' && $category !== '') { $where[] = 'r.category = ?'; $params[] = $category; }
if ($assigned !== 'All' && $assigned !== '' && ctype_digit($assigned)) { $where[] = 'r.assigned_to = ?'; $params[] = (int)$assigned; }
if ($location !== '') { $where[] = 'r.location LIKE ?'; $params[] = '%' . $location . '%'; }

// Resolution / response-time exports focus on completed work.
if ($report === 'resolution' || $report === 'response_time') {
    $where[] = "r.status IN ('Resolved','Closed')";
}
$whereClause = $where ? 'WHERE ' . implode(' AND ', $where) : '';

function log_export(PDO $pdo, int $userId, string $detail): void {
    try {
        $s = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
        $s->execute([$userId, 'export_reports', 'export', $detail]);
    } catch (PDOException $e) { /* best-effort */ }
}

/* ---------- labels ---------- */
$reportTitles = [
    'all' => 'All Civic Reports',
    'summary' => 'Report Summary',
    'by_category' => 'Reports by Category',
    'by_status' => 'Reports by Status',
    'staff_assignment' => 'Staff Assignment Report',
    'resolution' => 'Resolution Report',
    'response_time' => 'Response Time Report',
    'resident_activity' => 'Resident Report Activity',
];
$reportTitle = $reportTitles[$report] ?? 'Report';
$statusLabel = $status;
$categoryLabel = $category;
$staffLabel = $assigned === 'All' ? 'All Staff' : 'User #' . $assigned;
$locationLabel = $location !== '' ? '"' . $location . '"' : 'All Locations';
$dateRangeText = ($from ?: 'Beginning') . ' - ' . ($to ?: date('Y-m-d'));

/* ---------- build dataset ---------- */

$headers = [];
$rows = [];
$dateCols = [];

switch ($report) {
    case 'summary':
        $headers = ['Status', 'Count'];
        $widths = [24, 12];
        $stmt = $pdo->prepare("SELECT r.status, COUNT(*) AS c FROM reports r $whereClause GROUP BY r.status ORDER BY c DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['status'], (int)$r['c']]; }
        break;

    case 'by_category':
        $headers = ['Category', 'Count'];
        $widths = [26, 12];
        $stmt = $pdo->prepare("SELECT r.category, COUNT(*) AS c FROM reports r $whereClause GROUP BY r.category ORDER BY c DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['category'], (int)$r['c']]; }
        break;

    case 'by_status':
        $headers = ['Status', 'Count'];
        $widths = [24, 12];
        $stmt = $pdo->prepare("SELECT r.status, COUNT(*) AS c FROM reports r $whereClause GROUP BY r.status ORDER BY c DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['status'], (int)$r['c']]; }
        break;

    case 'staff_assignment':
        $headers = ['Staff', 'Assigned Reports', 'Resolved'];
        $widths = [26, 18, 14];
        $stmt = $pdo->prepare("
            SELECT u.name,
                   SUM(r.assigned_to IS NOT NULL) AS assigned,
                   SUM(r.status IN ('Resolved','Closed')) AS resolved
            FROM users u
            LEFT JOIN reports r ON r.assigned_to = u.id $whereClause" .
            ($whereClause ? ' AND' : ' WHERE') . " u.role IN ('Staff','Admin')
            GROUP BY u.id, u.name HAVING assigned > 0 ORDER BY assigned DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['name'], (int)$r['assigned'], (int)$r['resolved']]; }
        break;

    case 'response_time':
        $headers = ['Report ID', 'Title', 'Date Submitted', 'Date Completed', 'Days Open'];
        $widths = [20, 30, 20, 20, 12];
        $dateCols = [2, 3];
        $stmt = $pdo->prepare("
            SELECT r.ref_id, r.title, r.created_at,
                   COALESCE(r.resolved_at, CASE WHEN r.status IN ('Resolved','Closed') THEN r.updated_at END) AS completed_at,
                   DATEDIFF(COALESCE(r.resolved_at, CASE WHEN r.status IN ('Resolved','Closed') THEN r.updated_at END, NOW()), r.created_at) AS days_open
            FROM reports r $whereClause ORDER BY days_open DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [$r['ref_id'], $r['title'], $r['created_at'],
                       $r['completed_at'] ?? '-', (int)$r['days_open']];
        }
        break;

    case 'resident_activity':
        $headers = ['Reporter', 'Reports Submitted', 'First Submission', 'Latest Submission'];
        $widths = [22, 18, 20, 20];
        $dateCols = [2, 3];
        $stmt = $pdo->prepare("
            SELECT COALESCE(NULLIF(r.reporter_name,''),'Anonymous') AS reporter,
                   COUNT(*) AS c,
                   MIN(r.created_at) AS first_sub,
                   MAX(r.created_at) AS last_sub
            FROM reports r $whereClause GROUP BY reporter ORDER BY c DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) { $rows[] = [$r['reporter'], (int)$r['c'], $r['first_sub'], $r['last_sub']]; }
        break;

    default: // 'all'
        $report = 'all';
        $headers = ['Report ID', 'Title', 'Category', 'Location', 'Status', 'Priority', 'Reporter', 'Assigned To', 'Date Submitted'];
        $widths = [20, 30, 24, 27, 17, 11, 22, 23, 20];
        $dateCols = [8];
        $stmt = $pdo->prepare("
            SELECT r.ref_id, r.title, r.category, r.location, r.status, r.priority, r.reporter_name, r.created_at,
                   COALESCE(u.name, '-') AS assigned_name
            FROM reports r LEFT JOIN users u ON r.assigned_to = u.id
            $whereClause ORDER BY r.created_at DESC");
        $stmt->execute($params);
        foreach ($stmt->fetchAll() as $r) {
            $rows[] = [$r['ref_id'], $r['title'], $r['category'], $r['location'], $r['status'],
                       $r['priority'] ?? '-', $r['reporter_name'] ?? 'Anonymous', $r['assigned_name'],
                       $r['created_at']];
        }
        break;
}

$rowsCount = count($rows);

/* Filtered statistics */
function count_rows_filtered(PDO $pdo, array $params, array $where, ?string $statusOverride = null): int {
    $clause = $where;
    if ($statusOverride !== null) {
        $clause[] = 'r.status = ?';
        $params = array_merge($params, [$statusOverride]);
    }
    $sql = 'SELECT COUNT(*) FROM reports r' . ($clause ? ' WHERE ' . implode(' AND ', $clause) : '');
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return (int)$stmt->fetchColumn();
}

$statusList = ['Pending', 'Verified', 'Assigned', 'In Progress', 'Resolved', 'Rejected', 'Closed'];
$statTotal = count_rows_filtered($pdo, $params, $where);
$statByStatus = [];
foreach ($statusList as $sl) {
    $statByStatus[$sl] = ($status !== 'All' && $status !== '')
        ? ($status === $sl ? $statTotal : 0)
        : count_rows_filtered($pdo, $params, $where, $sl);
}

/* Category breakdown (filtered set) */
$stmt = $pdo->prepare("SELECT COALESCE(NULLIF(r.category,''),'Uncategorized') AS cat, COUNT(*) AS c
    FROM reports r $whereClause GROUP BY cat ORDER BY c DESC");
$stmt->execute($params);
$categoryRows = $stmt->fetchAll();

/* Staff performance (filtered set) */
$stmt = $pdo->prepare("SELECT u.name AS name,
        COUNT(r.id) AS assigned,
        SUM(CASE WHEN r.status IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN r.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN r.status NOT IN ('Resolved','Closed') THEN 1 ELSE 0 END) AS pending
    FROM reports r JOIN users u ON r.assigned_to = u.id
    $whereClause AND r.assigned_to IS NOT NULL GROUP BY u.id ORDER BY assigned DESC LIMIT 15");
$stmt->execute($params);
$staffPerfRows = $stmt->fetchAll();

/* Recent-reports table data */
$stmt = $pdo->prepare("
    SELECT r.ref_id, r.category, r.location, r.status, r.priority, r.created_at,
           COALESCE(NULLIF(r.reporter_name,''),'Anonymous') AS reporter,
           COALESCE(u.name, '-') AS assigned_name
    FROM reports r LEFT JOIN users u ON r.assigned_to = u.id
    $whereClause ORDER BY r.created_at DESC LIMIT 400");
$stmt->execute($params);
$recentRows = array_map(function ($r) {
    return [
        'ref' => $r['ref_id'],
        'category' => $r['category'],
        'location' => $r['location'],
        'status' => $r['status'],
        'priority' => $r['priority'] ?? '-',
        'reporter' => $r['reporter'],
        'assigned_name' => $r['assigned_name'],
        'created_at' => $r['created_at'],
        'date' => date('M j, Y g:i A', strtotime($r['created_at'])),
    ];
}, $stmt->fetchAll());

log_export($pdo, (int)$currentUser['user_id'], ucfirst($report) . " export ($format, {$rowsCount} rows)");

$safeName = preg_replace('/[^A-Za-z0-9]+/', '_', ucfirst($report));
$filename = strtolower($safeName) . '_export_' . date('Ymd');

/* ==================== PDF OUTPUT ==================== */

if ($format === 'pdf') {

    $W = 595; $H = 842; $MX = 35; $CW = $W - 2 * $MX;

    /* ---- Page state ---- */
    $pages = [];
    $ops = null;
    $y = 0;
    $pageNum = 0;

    $newPage = function () use (&$ops, &$y, &$pages, &$pageNum, $W, $H) {
        if ($ops !== null) { $pages[] = implode("\n", $ops); }
        $pageNum++;
        $ops = [];
        $y = $H - 40;
        pdf_top_band($ops, $W, $H);
    };

    $sectionBand = function ($text) use (&$ops, &$y, $MX, $CW) {
        pdf_section_band($ops, $MX, $CW, $y, $text);
    };

    /* ---- Start page 1 ---- */
    $newPage();
    $y = $H - 20;

    /* Letterhead */
    pdf_logo($ops, $MX, $y + 10, 54);
    $tx = $MX + 66;
    pdf_text($ops, $tx, $y - 18, 'XEVERA SUBDIVISION', 'F2', 15, '0.043 0.306 0.635');
    pdf_text($ops, $tx, $y - 31, 'CIVIC REPORTING PLATFORM', 'F2', 8.5, '0.090 0.412 0.761');
    pdf_text($ops, $tx, $y - 42, 'Xevera Subdivision, Brgy. San Rafael, Angeles City', 'F1', 7.5, '0.357 0.396 0.467');
    pdf_right_text($ops, $W - $MX, $y - 18, 'EXPORT REPORTS', 'F2', 13, '0.043 0.306 0.635');
    pdf_right_text($ops, $W - $MX, $y - 31, 'Comprehensive System Report', 'F1', 8.5, '0.357 0.396 0.467');
    pdf_right_text($ops, $W - $MX, $y - 42, 'Generated on: ' . date('F j, Y h:i A'), 'F1', 7.5, '0.357 0.396 0.467');
    $y -= 56;
    pdf_line($ops, $MX, $y, $W - $MX, $y, '0.788 0.863 0.961', 0.8);
    $y -= 12;

    /* Date-range badge */
    $ops[] = '0.043 0.306 0.635 rg ' . $MX . ' ' . ($y - 22) . ' 300 22 re f';
    pdf_text($ops, $MX + 8, $y - 16, 'Date Range: ' . $dateRangeText, 'F2', 8.5, '1 1 1');
    $y -= 34;

    /* Section: OVERVIEW SUMMARY */
    $sectionBand('Overview Summary');
    $y -= 8;

    /* Statistic cards (5 across) — icon types are vector keys, never Unicode */
    $cards = [
        ['Total Reports', (string)$statTotal, '100% of total', '0.090 0.412 0.761', '0.918 0.953 1', 'doc'],
        ['Resolved', (string)($statByStatus['Resolved'] ?? 0), pctText($statByStatus['Resolved'] ?? 0, max(1, $statTotal)), '0.086 0.627 0.365', '0.910 0.969 0.937', 'check'],
        ['In Progress', (string)($statByStatus['In Progress'] ?? 0), pctText($statByStatus['In Progress'] ?? 0, max(1, $statTotal)), '0.090 0.412 0.761', '0.918 0.953 1', 'refresh'],
        ['Pending', (string)($statByStatus['Pending'] ?? 0), pctText($statByStatus['Pending'] ?? 0, max(1, $statTotal)), '0.961 0.620 0.043', '1 0.961 0.867', 'clock'],
        ['Rejected', (string)($statByStatus['Rejected'] ?? 0), pctText($statByStatus['Rejected'] ?? 0, max(1, $statTotal)), '0.863 0.149 0.149', '0.992 0.925 0.925', 'x'],
    ];
    $y = pdf_stat_cards($ops, $MX, $CW, $y, $cards);

    /* ---- SECTION: REPORTS BY CATEGORY (table with TOTAL row) ---- */

    $sectionBand('Reports by Category');
    $y -= 6;

    $catHeaders = ['Category', 'Reports', 'Percentage'];
    $catFracs   = [0.46, 0.18, 0.36];
    $catRows = [];
    foreach ($categoryRows as $cr) {
        $pct = round(((int)$cr['c'] / max(1, $rowsCount)) * 100, 1);
        $catRows[] = [pdfSubCustom((string)$cr['cat'], 30), (string)((int)$cr['c']), $pct . '%'];
    }
    $catRows[] = ['TOTAL', (string)$rowsCount, '100%'];

    pdf_table($ops, $MX, $CW, $y, $catHeaders, $catFracs, $catRows, ['boldLast' => true]);
    $y -= 12;

    /* ---- SECTION: STAFF PERFORMANCE (auto page-break) ---- */

    $staffPerfNeeded = 26 + 15 + count($staffPerfRows) * 14 + 24;
    if ($y - $staffPerfNeeded < 55) { $newPage(); }

    $sectionBand('Staff Performance');
    $y -= 6;

    $perfHeaders = ['Staff Name', 'Assigned', 'Resolved', 'In Progress', 'Pending', 'Resolution Rate'];
    $perfFracs   = [0.28, 0.14, 0.13, 0.15, 0.12, 0.18];
    $perfRowsOut = [];
    foreach ($staffPerfRows as $sr) {
        $rate = ((int)$sr['assigned'] > 0) ? round(((int)$sr['resolved'] / (int)$sr['assigned']) * 100, 1) : 0.0;
        $perfRowsOut[] = [
            pdfSubCustom((string)$sr['name'], 28),
            (string)((int)$sr['assigned']),
            (string)((int)$sr['resolved']),
            (string)((int)($sr['in_progress'] ?? 0)),
            (string)((int)($sr['pending'] ?? 0)),
            $rate . '%',
        ];
    }

    pdf_table($ops, $MX, $CW, $y, $perfHeaders, $perfFracs, $perfRowsOut);
    $y -= 12;

    /* ---- SECTION: RECENT REPORTS (paginated table) ---- */

    $sectionBand('Recent Reports');
    $y -= 6;

    $recHeaders = ['#', 'Report ID', 'Date Submitted', 'Category', 'Status', 'Assigned Staff'];
    $recFracs   = [0.05, 0.15, 0.17, 0.21, 0.16, 0.26];

    $recXs = []; $recW = []; $acc = 0;
    foreach ($recFracs as $f) {
        $w = $CW * $f;
        $recXs[] = $MX + $acc;
        $recW[] = $w;
        $acc += $w;
    }

    $drawRecHeader = function () use (&$ops, &$y, $MX, $CW, $recXs, $recHeaders) {
        pdf_fill_rect($ops, $MX, $y - 16, $CW, 16, '0.918 0.953 1');
        pdf_stroke_rect($ops, $MX, $y - 16, $CW, 16, '0.788 0.863 0.961', 0.5);
        foreach ($recHeaders as $i => $h) {
            pdf_text($ops, $recXs[$i] + 3, $y - 11.5, strtoupper($h), 'F2', 7, '0.043 0.306 0.635');
        }
        $y -= 16;
    };

    $drawRecHeader();

    foreach ($recentRows as $ri => $rr) {
        if ($y < 70) {
            pdf_footer($ops, $W, $pageNum, max(1, $pageNum));
            $newPage();
            $drawRecHeader();
        }

        if ($ri % 2 === 1) {
            pdf_fill_rect($ops, $MX, $y - 15, $CW, 15, '0.961 0.976 1');
        }

        list($stBg, $stFg) = pdf_status_colors($rr['status']);
        pdf_fill_rect($ops, $recXs[4], $y - 13, $recW[4] - 8, 12, $stBg);
        pdf_text($ops, $recXs[4] + ($recW[4] - 8) / 2 - pdf_text_width(strtoupper($rr['status']), 6) / 2, $y - 10, strtoupper($rr['status']), 'F2', 6, $stFg);

        pdf_text($ops, $recXs[0] + 3, $y - 10.5, (string)($ri + 1), 'F1', 7.5, '0.09 0.125 0.20');
        pdf_text($ops, $recXs[1] + 3, $y - 10.5, (string)$rr['ref'], 'F1', 7.5, '0.09 0.125 0.20');
        pdf_text($ops, $recXs[2] + 3, $y - 10.5, date('M j, Y', strtotime($rr['created_at'])), 'F1', 7.5, '0.09 0.125 0.20');
        pdf_text($ops, $recXs[3] + 3, $y - 10.5, pdfSubCustom((string)$rr['category'], 22), 'F1', 7.5, '0.09 0.125 0.20');
        pdf_text($ops, $recXs[5] + 3, $y - 10.5, substr((string)($rr['assigned_name'] ?: '-'), 0, 24), 'F1', 7.5, '0.09 0.125 0.20');

        pdf_line($ops, $MX, $y - 15, $MX + $CW, $y - 15, '0.93 0.94 0.96', 0.4);
        $y -= 15;
    }

    pdf_footer($ops, $W, $pageNum, max(1, $pageNum));

    /* ---- Assemble PDF ---- */
    if ($ops !== null) { $pages[] = implode("\n", $ops); }
    $pageCount = count($pages);

    $pdf = "%PDF-1.4\n";
    $offsets = [];
    $objNum = 0;

    $addObj = function ($content) use (&$pdf, &$offsets, &$objNum) {
        $objNum++;
        $offsets[$objNum] = strlen($pdf);
        $pdf .= "{$objNum} 0 obj\n{$content}\nendobj\n";
        return $objNum;
    };

    // Reserve: 1=Catalog 2=Pages
    $pageObjIds = [];
    for ($i = 0; $i < $pageCount; $i++) { $pageObjIds[] = 3 + $i * 2; }
    $fontF1Id = 3 + $pageCount * 2;
    $fontF2Id = $fontF1Id + 1;

    $addObj('<< /Type /Catalog /Pages 2 0 R >>');
    $kids = implode(' ', array_map(fn($id) => "$id 0 R", $pageObjIds));
    $addObj("<< /Type /Pages /Kids [$kids] /Count $pageCount >>");

    foreach ($pages as $pi => $stream) {
        $contentId = $pageObjIds[$pi] + 1;
        $addObj("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $W $H] /Resources << /Font << /F1 $fontF1Id 0 R /F2 $fontF2Id 0 R >> >> /Contents $contentId 0 R >>");
        $streamTxt = $stream; // binary-safe
        $addObj("<< /Length " . strlen($streamTxt) . " >>\nstream\n" . $streamTxt . "\nendstream");
    }
    $addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    $addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

    $xrefPos = strlen($pdf);
    $total = $objNum + 1;
    $pdf .= "xref\n0 $total\n0000000000 65535 f \n";
    for ($i = 1; $i <= $objNum; $i++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
    }
    $pdf .= "trailer\n<< /Size $total /Root 1 0 R >>\nstartxref\n$xrefPos\n%%EOF";

    while (ob_get_level() > 0) { ob_end_clean(); }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '.pdf"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
    exit;
}

/* ==================== XLSX OUTPUT ==================== */

require_once __DIR__ . '/xlsx_writer.php';

$xlsx = new XeveraXlsx('Export');
if ($headers) { $xlsx->setHeaders($headers, $widths); }
$xlsx->setTitle(
    'XEVERA SUBDIVISION - CIVIC REPORTING PLATFORM',
    ucfirst($report) . ' Export | Generated: ' . date('F j, Y g:i A')
);
$statusColIdx = array_search('Status', array_map('strval', $headers), true);
if ($statusColIdx !== false) { $xlsx->setStatusColumn((int)$statusColIdx); }
if (!empty($dateCols)) { $xlsx->setDateColumns($dateCols); }
foreach ($rows as $row) { $xlsx->addRow($row); }

while (ob_get_level() > 0) { ob_end_clean(); }

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '.xlsx"');
echo $xlsx->render();
