<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/token.php';

$payload = token_payload();
if (!$payload || !in_array($payload['role'] ?? '', ['Admin', 'Super Admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized.']);
    exit;
}

$user = $payload;

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && ($action === 'list' || $action === '')) {
    $status = $_GET['status'] ?? '';
    $search = $_GET['search'] ?? '';
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;

    $where = "u.role = 'Resident'";
    $params = [];

    if ($status && in_array($status, ['Pending Verification', 'Residency Verified', 'Residency Verification Rejected'])) {
        $where .= " AND u.residency_status = ?";
        $params[] = $status;
    }

    if ($search) {
        $where .= " AND (u.name LIKE ? OR u.email LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM users u WHERE $where");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    $stmt = $pdo->prepare("SELECT u.id, u.name, u.email, u.residency_proof, u.residency_status, u.rejection_reason, u.verified_by, u.verified_at, u.created_at,
        admin.name AS verified_by_name
        FROM users u
        LEFT JOIN users admin ON u.verified_by = admin.id
        WHERE $where
        ORDER BY FIELD(u.residency_status, 'Pending Verification', 'Residency Verification Rejected', 'Residency Verified'), u.created_at DESC
        LIMIT $perPage OFFSET $offset");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    echo json_encode([
        'data' => $rows,
        'total' => $total,
        'page' => $page,
        'per_page' => $perPage,
        'pages' => (int) ceil($total / $perPage),
    ]);
    exit;
}

if ($method === 'GET' && $action === 'preview') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing user ID.']); exit; }

    $stmt = $pdo->prepare("SELECT residency_proof, residency_status FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || !$row['residency_proof']) {
        http_response_code(404);
        echo json_encode(['error' => 'No proof document found.']);
        exit;
    }

    $file = __DIR__ . '/../../uploads/residency/' . $row['residency_proof'];
    if (!file_exists($file)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found on server.']);
        exit;
    }

    $mime = mime_content_type($file);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($file));
    header('Content-Disposition: inline; filename="' . $row['residency_proof'] . '"');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

if ($method === 'POST' && $action === 'download') {
    $id = (int)($_POST['id'] ?? 0);
    if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing user ID.']); exit; }

    $stmt = $pdo->prepare("SELECT residency_proof FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row || !$row['residency_proof']) {
        http_response_code(404);
        echo json_encode(['error' => 'No proof document found.']);
        exit;
    }

    $file = __DIR__ . '/../../uploads/residency/' . $row['residency_proof'];
    if (!file_exists($file)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found on server.']);
        exit;
    }

    $mime = mime_content_type($file);
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($file));
    header('Content-Disposition: attachment; filename="' . $row['residency_proof'] . '"');
    header('X-Content-Type-Options: nosniff');
    readfile($file);
    exit;
}

if ($method === 'POST' && ($action === 'approve' || $action === 'reject')) {
    $input = json_decode(file_get_contents('php://input'), true);
    $userId = (int)($input['user_id'] ?? 0);
    $reason = trim($input['reason'] ?? '');

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing user ID.']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, name, email, residency_status FROM users WHERE id = ? AND role = 'Resident'");
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['error' => 'Resident not found.']);
        exit;
    }

    $newStatus = $action === 'approve' ? 'Residency Verified' : 'Residency Verification Rejected';
    $adminId = $payload['user_id'];

    $update = $pdo->prepare("UPDATE users SET residency_status = ?, rejection_reason = ?, verified_by = ?, verified_at = NOW(), status = IF(? = 'Residency Verified', 'Active', status) WHERE id = ?");
    $update->execute([$newStatus, $action === 'reject' ? $reason : null, $adminId, $newStatus, $userId]);

    $log = $pdo->prepare("INSERT INTO residency_verifications (user_id, admin_id, status, rejection_reason) VALUES (?, ?, ?, ?)");
    $log->execute([$userId, $adminId, $newStatus, $action === 'reject' ? $reason : null]);

    /*
     * Approval / rejection email + in-app notification. Strictly
     * non-fatal: the admin decision above is already committed, so a
     * mail failure must never roll it back or error the request.
     */
    $emailSent = false;
    try {
        require_once __DIR__ . '/../config/mailer.php';
        $residentName = trim($row['name'] ?? '') !== '' ? $row['name'] : 'Resident';
        $residentEmail = trim($row['email'] ?? '');
        if ($action === 'approve') {
            $subject = 'Your Xevera account has been approved';
            $text = "Hi $residentName,\n\nGood news! Your Xevera Civic Reporting System registration has been reviewed and approved by an administrator.\n\nYou can now sign in with your email and password to start reporting concerns and tracking updates.\n\n- Xevera Civic Portal";
            $html = "<p>Hi " . htmlspecialchars($residentName) . ",</p><p><strong>Good news!</strong> Your Xevera Civic Reporting System registration has been reviewed and approved by an administrator.</p><p>You can now sign in with your email and password to start reporting concerns and tracking updates.</p><p>- Xevera Civic Portal</p>";
            $notifMsg = 'Your Xevera registration has been approved. You can now sign in.';
            $notifType = 'registration_approved';
        } else {
            $subject = 'Update on your Xevera registration';
            $reasonText = $reason !== '' ? $reason : 'No reason was provided.';
            $text = "Hi $residentName,\n\nAn administrator has reviewed your Xevera registration and could not approve it at this time.\n\nReason: $reasonText\n\nYou may register again with corrected information.\n\n- Xevera Civic Portal";
            $html = "<p>Hi " . htmlspecialchars($residentName) . ",</p><p>An administrator has reviewed your Xevera registration and could not approve it at this time.</p><p>Reason: " . htmlspecialchars($reasonText) . "</p><p>You may register again with corrected information.</p><p>- Xevera Civic Portal</p>";
            $notifMsg = 'Your Xevera registration was not approved. ' . $reasonText;
            $notifType = 'registration_rejected';
        }
        if ($residentEmail !== '' && filter_var($residentEmail, FILTER_VALIDATE_EMAIL)) {
            $emailSent = (bool)xevera_mail($residentEmail, $subject, $text, $html);
        }
        $pdo->prepare("INSERT INTO notifications (user_id, type, message, report_id) VALUES (?, ?, ?, NULL)")->execute([$userId, $notifType, $notifMsg]);
    } catch (Throwable $e) { /* notification/email must never break the decision */ }

    echo json_encode([
        'success' => true,
        'status' => $newStatus,
        'message' => $action === 'approve' ? 'Residency approved.' : 'Residency rejected.',
        'email_sent' => $emailSent,
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid action.']);
