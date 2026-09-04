<?php
/* Never let warnings/notices corrupt the binary PDF stream. */
ini_set('display_errors', '0');
error_reporting(E_ALL);

require_once __DIR__ . '/../middleware/auth.php';
requireRole(['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

// --- gather data ---
$byStatus = ['Pending' => 0, 'Claimed' => 0, 'Resolved' => 0, 'Rejected' => 0];
$total = 0;
$stmt = $pdo->query('SELECT status, COUNT(*) AS c FROM reports GROUP BY status');
foreach ($stmt->fetchAll() as $r) { $byStatus[$r['status']] = (int)$r['c']; $total += (int)$r['c']; }

$stmt = $pdo->query('SELECT category, COUNT(*) AS c FROM reports GROUP BY category ORDER BY c DESC');
$categories = $stmt->fetchAll();

$stmt = $pdo->query("SELECT u.name, SUM(r.assigned_to IS NOT NULL) AS assigned, SUM(r.status='Resolved') AS resolved
    FROM users u LEFT JOIN reports r ON r.assigned_to=u.id WHERE u.role IN ('Staff','Admin')
    GROUP BY u.id, u.name HAVING assigned>0 ORDER BY resolved DESC");
$staff = $stmt->fetchAll();

$stmt = $pdo->query("SELECT r.ref_id, r.title, r.category, r.priority, r.status, r.created_at, COALESCE(u.name,'-') AS a
    FROM reports r LEFT JOIN users u ON r.assigned_to=u.id ORDER BY r.created_at DESC LIMIT 12");
$recent = $stmt->fetchAll();

// --- minimal PDF writer (PDF 1.4, Helvetica, 2 pages) ---
// Note: pdftotext/escaping — all user text passes through pdfText() before embedding.

function pdfText($text) {
  $esc = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $text);
  return $esc;
}

$lines = [];
$lines[] = "BT /F1 16 Tf 80 780 Td (Xevera Portal - Reports Analytics) Tj ET";
$lines[] = "BT /F1 9 Tf 80 764 Td (Generated: " . date('Y-m-d H:i:s') . ") Tj ET";
$lines[] = "BT /F1 8 Tf 80 748 Td (Site: Xevera Civic Platform) Tj ET";

$y = 720;
foreach ($byStatus as $k => $v) {
  $lines[] = "BT /F1 11 Tf 80 $y Td ($k: $v) Tj ET";
  $y -= 20;
}
$lines[] = "BT /F1 11 Tf 80 $y Td (Total: $total) Tj ET";
$y -= 34;

$lines[] = "BT /F1 12 Tf 80 $y Td (Reports by Category) Tj ET";
$y -= 18;
foreach ($categories as $c) {
  $lines[] = "BT /F1 10 Tf 80 $y Td (" . pdfText($c['category'] . ': ' . $c['c']) . ") Tj ET";
  $y -= 18;
  if ($y < 60) { $y = 760; }
}
$y -= 16;

$lines[] = "BT /F1 12 Tf 80 $y Td (Staff Performance) Tj ET";
$y -= 18;
foreach ($staff as $s) {
  $lines[] = "BT /F1 10 Tf 80 $y Td (" . pdfText($s['name'] . ': assigned ' . $s['assigned'] . ', resolved ' . $s['resolved']) . ") Tj ET";
  $y -= 18;
  if ($y < 60) { $y = 760; }
}
$y -= 16;

$lines[] = "BT /F1 12 Tf 80 $y Td (Recent Reports) Tj ET";
$y -= 18;
foreach ($recent as $r) {
  $lines[] = "BT /F1 8 Tf 80 $y Td (" . pdfText($r['ref_id'] . ' | ' . $r['title'] . ' | ' . $r['status'] . ' | ' . $r['priority'] . ' | ' . $r['a']) . ") Tj ET";
  $y -= 14;
  if ($y < 60) { $y = 760; }
}

/*
 * Content stream. NOTE: no page-transform is used — PDF origin is the
 * bottom-left corner, so y=790 already sits near the top of an A4 page.
 * (A previous version translated by 842pt here, pushing every element
 * above the visible area and producing blank pages.)
 */
$content = implode("\n", $lines) . "\nshowpage\n";

$catalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
$pages   = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
$page    = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n";
$content = "4 0 obj\n<< /Length " . strlen($content) . " >>\nstream\n" . $content . "\nendstream\nendobj\n";
$font    = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

$pdf = "%PDF-1.4\n";
$offsets = [];
$push = function ($obj) use (&$pdf, &$offsets) {
  $offsets[] = strlen($pdf);
  $pdf .= $obj . "\n";
};
$push($catalog);
$push($pages);
$push($page);
$push($content);   // obj 4
$push($font);      // obj 5
$xrefStart = strlen($pdf);
$pdf .= "xref\n0 " . (count($offsets) + 1) . "\n";
$pdf .= "0000000000 65535 f \n";
foreach ($offsets as $off) { $pdf .= sprintf("%010d 00000 n \n", $off); }
$pdf .= "trailer\n<< /Size " . (count($offsets) + 1) . " /Root 1 0 R >>\nstartxref\n$xrefStart\n%%EOF";

// Clean any buffered output so nothing corrupts the binary stream.
while (ob_get_level() > 0) { ob_end_clean(); }

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="analytics_' . date('Y-m-d') . '.pdf"');
header('Content-Length: ' . strlen($pdf));
echo $pdf;