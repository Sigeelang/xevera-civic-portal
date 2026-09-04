<?php
/**
 * Message thread for ONE Contact Support submission.
 *
 * GET contact/thread.php?id=<contact_messages.id>   (Staff/Admin/Super Admin)
 *
 * Returns the original submission plus every direct message tagged with
 * that contact_message_id (staff replies and resident replies),
 * chronologically ascending. The resident owner is the only resident
 * party; scoping is enforced by the contact_messages record itself.
 */
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$contactId = (int)($_GET['id'] ?? 0);
if ($contactId <= 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Contact ID is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, user_id, name, email, phone, category, subject, message, status, workflow_status, created_at FROM contact_messages WHERE id = ?');
$stmt->execute([$contactId]);
$contact = $stmt->fetch();
if (!$contact) {
    http_response_code(404);
    echo json_encode(['error' => 'Contact message not found.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, name, role FROM users WHERE id = ?');
$stmt->execute([$contact['user_id']]);
$owner = $stmt->fetch();
$ownerName = $owner['name'] ?: ($contact['name'] ?: 'Anonymous');

$stmt = $pdo->prepare("
    SELECT dm.id, dm.sender_id, dm.recipient_id, dm.subject, dm.message, dm.is_read, dm.created_at,
        s.name AS sender_name, s.role AS sender_role
    FROM direct_messages dm
    JOIN users s ON dm.sender_id = s.id
    WHERE dm.contact_message_id = ?
    ORDER BY dm.created_at ASC, dm.id ASC
");
$stmt->execute([$contactId]);
$messages = array_map(function ($m) use ($user) {
    $mine = (int)$m['sender_id'] === (int)$user['user_id'];
    return [
        'id' => (int)$m['id'],
        'direction' => $mine ? 'sent' : 'received',
        'sender_name' => $m['sender_name'],
        'sender_role' => $m['sender_role'],
        'subject' => $m['subject'],
        'message' => $m['message'],
        'is_read' => (int)$m['is_read'],
        'created_at' => $m['created_at'],
    ];
}, $stmt->fetchAll());

echo json_encode([
    'contact' => [
        'id' => (int)$contact['id'],
        'name' => $ownerName,
        'email' => $contact['email'],
        'phone' => $contact['phone'] ?? '',
        'category' => $contact['category'],
        'subject' => $contact['subject'],
        'message' => $contact['message'],
        'status' => $contact['status'],
        'workflow_status' => $contact['workflow_status'] ?? 'New',
        'created_at' => $contact['created_at'],
        'linked' => (int)($contact['user_id'] ?? 0) > 0,
        'owner_id' => (int)($contact['user_id'] ?? 0),
    ],
    'owner_name' => $ownerName,
    'messages' => $messages,
]);
