<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin', 'Resident']);
xevera_write_rate_limit($pdo, 'messages.send');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$senderId = (int)$user['user_id'];
$recipientId = (int)($input['recipient_id'] ?? 0);
$subject = trim($input['subject'] ?? '');
$message = trim($input['message'] ?? '');
$reportId = isset($input['report_id']) && $input['report_id'] !== '' ? (int)$input['report_id'] : null;
/*
 * Optional Contact Support thread linkage: when present, the message
 * belongs to that specific contact conversation (NOT the general DM
 * inbox). Validated below - senders may only post into their own thread.
 */
$contactMessageId = isset($input['contact_message_id']) && $input['contact_message_id'] !== '' ? (int)$input['contact_message_id'] : null;

if ($recipientId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Select a recipient.']);
    exit;
}
if ($recipientId === $senderId) {
    http_response_code(400);
    echo json_encode(['error' => 'You cannot send a message to yourself.']);
    exit;
}
if ($message === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Message is required.']);
    exit;
}
if (mb_strlen($message) > 4000) {
    http_response_code(400);
    echo json_encode(['error' => 'Message is too long (max 4000 characters).']);
    exit;
}

// Validate linked report exists.
if ($reportId !== null) {
    $stmt = $pdo->prepare('SELECT id FROM reports WHERE id = ?');
    $stmt->execute([$reportId]);
    if (!$stmt->fetch()) {
        http_response_code(400);
        echo json_encode(['error' => 'Linked report does not exist.']);
        exit;
    }
}

$stmt = $pdo->prepare("SELECT id, role FROM users WHERE id = ? AND status = 'Active'");
$stmt->execute([$recipientId]);
$recipient = $stmt->fetch();
if (!$recipient) {
    http_response_code(400);
    echo json_encode(['error' => 'Selected recipient is not an active account.']);
    exit;
}

$senderRole = $user['role'] ?? '';
$recipientRole = $recipient['role'] ?? '';
/*
 * Messaging policy:
 *   - Residents may only message management (Admin/Super Admin).
 *   - Staff may only message managers (Admin/Super Admin) - staff cannot
 *     start conversations with other staff or with residents.
 *   - Admin/Super Admin may message anyone.
 * Contact Support thread replies (contact_message_id set) are governed
 * by their own participation check below and are exempt here.
 */
if ($contactMessageId === null && $senderRole === 'Resident' && !in_array($recipientRole, ['Admin', 'Super Admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Residents can only message administrators.']);
    exit;
}
if ($contactMessageId === null && $senderRole === 'Staff' && !in_array($recipientRole, ['Admin', 'Super Admin'], true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Staff can only exchange messages with Admin or Super Admin.']);
    exit;
}

/*
 * Contact-thread replies: validate the sender participates in that
 * specific Contact Support conversation (owner resident or any
 * Staff/Admin/Super Admin), and that the recipient is the other party.
 */
if ($contactMessageId !== null) {
    require_once __DIR__ . '/../config/database.php';
    $cStmt = $pdo->prepare('SELECT id, user_id FROM contact_messages WHERE id = ?');
    $cStmt->execute([$contactMessageId]);
    $contact = $cStmt->fetch();
    if (!$contact) {
        http_response_code(400);
        echo json_encode(['error' => 'Contact conversation not found.']);
        exit;
    }
    $isOwner = (int)$contact['user_id'] === $senderId;
    $isTeam = in_array($user['role'] ?? '', ['Staff', 'Admin', 'Super Admin'], true);
    if (!$isOwner && !$isTeam) {
        http_response_code(403);
        echo json_encode(['error' => 'You cannot reply to this conversation.']);
        exit;
    }
    $expectedOther = $isOwner
        ? (int)$recipientId // resident replies to the team member they are talking to
        : (int)$contact['user_id']; // staff replies always go to the resident owner
    if ($recipientId !== $expectedOther) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid recipient for this contact conversation.']);
        exit;
    }
}

$stmt = $pdo->prepare('INSERT INTO direct_messages (sender_id, recipient_id, report_id, subject, message, contact_message_id) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$senderId, $recipientId, $reportId, mb_substr($subject, 0, 190), $message, $contactMessageId]);

/*
 * Resident reply inside a Contact Support thread: flag the submission as
 * unread again so the Super Admin's Message Box surfaces the new reply.
 */
if ($contactMessageId !== null && ($user['role'] ?? '') === 'Resident') {
    try {
        $pdo->prepare("UPDATE contact_messages SET status = 'new' WHERE id = ?")->execute([$contactMessageId]);
    } catch (PDOException $e) { /* best-effort */ }
}

$notifText = 'New direct message from ' . ($user['name'] ?? 'a staff member') . ($subject !== '' ? ': ' . $subject : '');
$stmt = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, ?, ?, ?, 0)');
$stmt->execute([$recipientId, $reportId, 'direct_message', mb_substr($notifText, 0, 500)]);

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$senderId, 'direct_message', 'user', $recipientId, mb_substr($subject, 0, 120)]);

echo json_encode(['success' => true, 'message' => 'Message sent.']);
