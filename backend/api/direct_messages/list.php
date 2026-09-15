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
$role = (string)($user['role'] ?? '');
$isResident = $role === 'Resident';
$isManager = in_array($role, ['Admin', 'Super Admin'], true);

/*
 * Contact-Support thread messages (contact_message_id set) belong to
 * their own per-submission conversations:
 *   - Staff/Admin/Super Admin read them through the contact thread
 *     (contact/thread.php) and the ☎ contact entries - excluded here so
 *     they never merge into a resident's general DM conversation.
 *   - Residents receive them here; their Message Box splits them into
 *     separate conversations client-side by contact_message_id.
 *
 * SCOPE:
 *   - Resident : only their own conversations.
 *   - Admin/Super Admin : the shared management inbox. Every conversation
 *     with a resident is returned - not just the ones this manager started
 *     - so whichever manager replies first, the others can still see and
 *     continue the thread in the Message Box.
 *   - Staff : strictly their own conversations (Admin/Super Admin only).
 */
if ($isResident) {
    $where = '(dm.sender_id = ? OR dm.recipient_id = ?)';
} elseif ($isManager) {
    $where = "dm.contact_message_id IS NULL AND (dm.sender_id = ? OR dm.recipient_id = ? OR s.role = 'Resident' OR r.role = 'Resident')";
} else {
    $where = 'dm.contact_message_id IS NULL AND (dm.sender_id = ? OR dm.recipient_id = ?)';
}
$params = [$userId, $userId];

$unreadSql = $isResident
    ? 'SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND is_read = 0'
    : "SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND is_read = 0 AND contact_message_id IS NULL";
$stmt = $pdo->prepare($unreadSql);
$stmt->execute([$userId]);
$unread = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT dm.id, dm.sender_id, dm.recipient_id, dm.report_id, dm.subject, dm.message, dm.is_read, dm.read_at, dm.created_at, dm.contact_message_id,
        s.name AS sender_name, s.role AS sender_role,
        r.name AS recipient_name, r.role AS recipient_role
    FROM direct_messages dm
    JOIN users s ON dm.sender_id = s.id
    JOIN users r ON dm.recipient_id = r.id
    WHERE $where
    ORDER BY dm.created_at DESC
    LIMIT $limit
");
$stmt->execute($params);
$rows = $stmt->fetchAll();

$isResidentRole = function ($roleName): bool {
    return (string)$roleName === 'Resident';
};

echo json_encode([
    'items' => array_map(function ($m) use ($userId, $isManager, $isResidentRole) {
        $sentByMe = (int)$m['sender_id'] === $userId;
        $addressedToMe = (int)$m['recipient_id'] === $userId;

        $senderIsResident = $isResidentRole($m['sender_role']);
        $recipientIsResident = $isResidentRole($m['recipient_role']);

        /*
         * Managers always group by the RESIDENT party so a resident has a
         * single thread in every manager's Message Box, no matter which
         * manager sent or received a given message.
         */
        if ($isManager && ($senderIsResident || $recipientIsResident)) {
            $otherId = $senderIsResident ? (int)$m['sender_id'] : (int)$m['recipient_id'];
            $otherName = $senderIsResident ? $m['sender_name'] : $m['recipient_name'];
            $otherRole = 'Resident';
        } else {
            $otherId = $addressedToMe ? (int)$m['sender_id'] : (int)$m['recipient_id'];
            $otherName = $addressedToMe ? $m['sender_name'] : $m['recipient_name'];
            $otherRole = $addressedToMe ? $m['sender_role'] : $m['recipient_role'];
        }

        return [
            'id' => (int)$m['id'],
            'direction' => $sentByMe ? 'sent' : 'received',
            'sender_id' => (int)$m['sender_id'],
            'sender_name' => $m['sender_name'],
            'sender_role' => $m['sender_role'],
            'other_id' => $otherId,
            'other_name' => $otherName,
            'other_role' => $otherRole,
            'subject' => $m['subject'],
            'message' => $m['message'],
            'report_id' => $m['report_id'] ? (int)$m['report_id'] : null,
            'contact_message_id' => $m['contact_message_id'] ? (int)$m['contact_message_id'] : null,
            'is_read' => $addressedToMe ? (int)$m['is_read'] === 1 : true,
            'read_at' => $m['read_at'] ?: null,
            'date' => (new DateTime($m['created_at'], new DateTimeZone('Asia/Manila')))->format('M j, Y g:i A'),
            'created_at' => $m['created_at'],
        ];
    }, $rows),
    'unread' => $unread,
    'total' => count($rows),
]);
