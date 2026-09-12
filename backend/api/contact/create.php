<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../middleware/ratelimit.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$phone = trim($input['phone'] ?? '');
$category = trim($input['category'] ?? '');
$subject = trim($input['subject'] ?? '');
$message = trim($input['message'] ?? '');

if ($name === '' || $email === '' || $message === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Name, email, and message are required.']);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email is required.']);
    exit;
}
if ($phone !== '' && !preg_match('/^09\d{9}$/', $phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Phone number must be 11 digits starting with 09.']);
    exit;
}

require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'contact.create');

/*
 * Link the submission to the resident's account when they are logged in.
 * The user id is derived EXCLUSIVELY from the validated Bearer token -
 * never from the request body. Anonymous submissions keep user_id NULL.
 */
require_once __DIR__ . '/../middleware/token.php';
$linkedUserId = null;
$payload = token_payload();
if ($payload && ($payload['scope'] ?? '') !== '2fa_pending' && ($payload['role'] ?? '') === 'Resident') {
    $linkedUserId = (int) $payload['user_id'];
}

$stmt = $pdo->prepare('INSERT INTO contact_messages (name, email, phone, category, subject, message, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$name, $email, $phone, $category, $subject, $message, $linkedUserId]);

/*
 * Real-time notification: alert every active Admin, Super Admin, and Staff so the
 * Message Box badge and the notification bell pick this up immediately.
 */
try {
    $staff = $pdo->query("SELECT id FROM users WHERE role IN ('Admin', 'Super Admin', 'Staff') AND status = 'Active'")->fetchAll(PDO::FETCH_COLUMN);
    $notifText = 'New contact support message from ' . $name . ($subject !== '' ? ': ' . $subject : '');
    $ins = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
    foreach ($staff as $staffId) {
        $ins->execute([(int) $staffId, 'contact', mb_substr($notifText, 0, 500)]);
    }
} catch (PDOException $e) { /* notification is best-effort; never block submission */ }

echo json_encode(['success' => true, 'message' => 'Your message has been submitted successfully.']);