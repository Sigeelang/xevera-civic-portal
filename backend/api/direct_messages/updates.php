<?php
/**
 * Lightweight incremental updates for the Message Boxes.
 *
 * GET direct_messages/updates.php?after_id=<last seen message id>
 *
 * Returns only messages visible to the current user that are NEWER than
 * after_id, plus the caller's total unread count (and the contact-form
 * unread count for Staff/Admin/Super Admin so their Message Box can
 * discover new public submissions without a full refresh).
 *
 * The database/API remains the source of truth - clients poll this
 * endpoint purely as a UI discovery mechanism.
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
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$userId = (int)$user['user_id'];
$afterId = max(0, (int)($_GET['after_id'] ?? 0));
$limit = min(50, max(1, (int)($_GET['limit'] ?? 50)));

/*
 * Contact-Support thread messages are excluded from the general feed for
 * Staff/Admin/Super Admin (they surface via the contact thread instead);
 * residents receive them and split them into per-submission conversations
 * client-side by contact_message_id.
 */
$isResident = ($user['role'] ?? '') === 'Resident';
$threadFilter = $isResident ? '' : ' AND dm.contact_message_id IS NULL';

$stmt = $pdo->prepare("
    SELECT dm.id, dm.sender_id, dm.recipient_id, dm.report_id, dm.subject, dm.message, dm.image_path, dm.is_read, dm.read_at, dm.created_at, dm.contact_message_id,
        s.name AS sender_name, s.role AS sender_role,
        r.name AS recipient_name, r.role AS recipient_role
    FROM direct_messages dm
    JOIN users s ON dm.sender_id = s.id
    JOIN users r ON dm.recipient_id = r.id
    WHERE (dm.sender_id = ? OR dm.recipient_id = ?) AND dm.id > ?$threadFilter
    ORDER BY dm.id ASC
    LIMIT $limit
");
$stmt->execute([$userId, $userId, $afterId]);
$rows = $stmt->fetchAll();

$unreadSql = $isResident
    ? 'SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND is_read = 0'
    : 'SELECT COUNT(*) FROM direct_messages WHERE recipient_id = ? AND is_read = 0 AND contact_message_id IS NULL';
$stmt = $pdo->prepare($unreadSql);
$stmt->execute([$userId]);
$unread = (int)$stmt->fetchColumn();

$contactUnread = null;
if (in_array($user['role'] ?? '', ['Staff', 'Admin', 'Super Admin'], true)) {
    try {
        $contactUnread = (int)$pdo->query("SELECT COUNT(*) FROM contact_messages WHERE status = 'new'")->fetchColumn();
    } catch (PDOException $e) { /* table may not exist on older schemas */ }
}

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
            'image' => !empty($m['image_path']) ? (string)$m['image_path'] : null,
            'report_id' => $m['report_id'] ? (int)$m['report_id'] : null,
            'contact_message_id' => $m['contact_message_id'] ? (int)$m['contact_message_id'] : null,
            'is_read' => (int)$m['is_read'],
            'read_at' => $m['read_at'] ?: null,
            'created_at' => $m['created_at'],
        ];
    }, $rows),
    'unread' => $unread,
    'contact_unread' => $contactUnread,
]);
