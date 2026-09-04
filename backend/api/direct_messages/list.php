<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin', 'Resident']);

require_once __DIR__ . '/../config/database.php';

$userId = (int)$user['user_id'];
$limit = min(100, max(1, (int)($_GET['limit'] ?? 50)));

/*
 * Contact-Support thread messages (contact_message_id set) belong to
 * their own per-submission conversations:
 *   - Staff/Admin/Super Admin read them through the contact thread
 *     (contact/thread.php) and the ☎ contact entries - excluded here so
 *     they never merge into a resident's general DM conversation.
 *   - Residents receive them here; their Message Box splits them into
 *     separate conversations client-side by contact_message_id.
 */
$isResident = ($user['role'] ?? '') === 'Resident';
$threadFilter = $isResident ? '' : ' AND dm.contact_message_id IS NULL';

$unreadSql = $isResident
    ? 'SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND is_read = 0'
    : "SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND is_read = 0 AND contact_message_id IS NULL";
$stmt = $pdo->prepare($unreadSql);
$stmt->execute([$userId]);
$unread = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT dm.id, dm.sender_id, dm.recipient_id, dm.report_id, dm.subject, dm.message, dm.is_read, dm.created_at, dm.contact_message_id,
        s.name AS sender_name, s.role AS sender_role,
        r.name AS recipient_name, r.role AS recipient_role
    FROM direct_messages dm
    JOIN users s ON dm.sender_id = s.id
    JOIN users r ON dm.recipient_id = r.id
    WHERE (dm.sender_id = ? OR dm.recipient_id = ?)$threadFilter
    ORDER BY dm.created_at DESC
    LIMIT $limit
");
$stmt->execute([$userId, $userId]);
$rows = $stmt->fetchAll();

echo json_encode([
    'items' => array_map(function ($m) use ($userId) {
        $received = (int)$m['recipient_id'] === $userId;
        return [
            'id' => (int)$m['id'],
            'direction' => $received ? 'received' : 'sent',
            'other_id' => $received ? (int)$m['sender_id'] : (int)$m['recipient_id'],
            'other_name' => $received ? $m['sender_name'] : $m['recipient_name'],
            'other_role' => $received ? $m['sender_role'] : $m['recipient_role'],
            'subject' => $m['subject'],
            'message' => $m['message'],
            'report_id' => $m['report_id'] ? (int)$m['report_id'] : null,
            'contact_message_id' => $m['contact_message_id'] ? (int)$m['contact_message_id'] : null,
    'is_read' => $received ? (int)$m['is_read'] === 1 : true,
            'date' => (new DateTime($m['created_at'], new DateTimeZone('Asia/Manila')))->format('M j, Y g:i A'),
            'created_at' => $m['created_at'],
        ];
    }, $rows),
    'unread' => $unread,
    'total' => count($rows),
]);
