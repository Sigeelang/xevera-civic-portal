<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireRole(['Staff', 'Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'contact.reply');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$messageId = (int)($input['message_id'] ?? 0);
$reply = trim($input['reply'] ?? '');

if (!$messageId || $reply === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Message ID and reply are required.']);
    exit;
}

$reply = mb_substr($reply, 0, 1500);

// Pull the resident's email (and name) so we can notify them of the reply.
$msg = $pdo->prepare('SELECT id, email, name, subject, message, created_at, user_id FROM contact_messages WHERE id = ?');
$msg->execute([$messageId]);
$contact = $msg->fetch();
if (!$contact) {
    http_response_code(404);
    echo json_encode(['error' => 'Message not found.']);
    exit;
}

$stmt = $pdo->prepare('INSERT INTO contact_message_replies (message_id, user_id, reply) VALUES (?, ?, ?)');
$stmt->execute([$messageId, (int)($user['user_id'] ?? 0), $reply]);

// Email the resident when notification email is enabled.
require_once __DIR__ . '/../config/mailer.php';
if ($contact['email']) {
    xevera_maybe_notify(
        $contact['email'],
        'Reply to your message - ' . ($contact['name'] ?: ''),
        "Hi " . ($contact['name'] ?: 'there') . ",\n\nThe Xevera civic desk has replied to your message:\n\n" . $reply . "\n\n— Xevera Portal"
    );
}

/*
 * Mirror the conversation into the resident's Message Box as direct
 * messages, so staff responses appear in-app and not only via email.
 * Only for submissions linked to a resident account (user_id set at
 * creation from the validated token).
 *
 * On the FIRST staff reply the resident's ORIGINAL contact message is
 * also mirrored (backdated to its submission time), so both Message
 * Boxes show the complete thread:
 *
 *   Resident: <original contact message>   (read)
 *   Staff:    <reply>                      (unread for resident)
 *
 * Duplicate guards prevent re-mirroring when the same reply is retried.
 */
if (!empty($contact['user_id'])) {
    $residentId = (int)$contact['user_id'];
    $staffId = (int)($user['user_id'] ?? 0);
    $threadSubject = mb_substr('Re: ' . ($contact['subject'] ?: 'Your contact message'), 0, 190);

    // A. Mirror the resident's original contact message. Scoped to the
    //    concern itself (contact_message_id), NOT the staff pair, so a
    //    second manager replying to the same concern never mirrors a
    //    duplicate copy of the original into the resident's thread.
    $origDup = $pdo->prepare('SELECT COUNT(*) FROM direct_messages WHERE contact_message_id = ? AND sender_id = ? AND message = ?');
    $origDup->execute([$messageId, $residentId, $contact['message']]);
    if ((int)$origDup->fetchColumn() === 0) {
        $orig = $pdo->prepare('INSERT INTO direct_messages (sender_id, recipient_id, subject, message, is_read, created_at, contact_message_id) VALUES (?, ?, ?, ?, 1, ?, ?)');
        $orig->execute([
            $residentId,
            $staffId,
            mb_substr((string)$contact['subject'], 0, 190),
            $contact['message'],
            $contact['created_at'],
            $messageId,
        ]);
    }

    // B. Mirror the staff reply (unread for the resident). created_at is
    //    left to the MySQL column default so the whole bridged thread
    //    shares ONE clock (the mirrored original carries the contact's
    //    MySQL timestamp). Duplicate guard is scoped to this thread's
    //    lifetime: an identical reply created AFTER the contact submission
    //    is considered a retry.
    $dup = $pdo->prepare('SELECT COUNT(*) FROM direct_messages WHERE sender_id = ? AND recipient_id = ? AND message = ? AND created_at > ?');
    $dup->execute([$staffId, $residentId, $reply, $contact['created_at']]);
    if ((int)$dup->fetchColumn() === 0) {
        $dm = $pdo->prepare('INSERT INTO direct_messages (sender_id, recipient_id, subject, message, is_read, contact_message_id) VALUES (?, ?, ?, ?, 0, ?)');
        $dm->execute([$staffId, $residentId, $threadSubject, $reply, $messageId]);

        $notifText = 'New reply from ' . ($user['name'] ?? 'the Xevera team') . ': ' . ($contact['subject'] ?: 'Your contact message');
        $notif = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
        $notif->execute([$residentId, 'direct_message', mb_substr($notifText, 0, 500)]);
    }
}

/*
 * Shared concern inbox: a Contact Support submission belongs to the whole
 * management team, not the individual who happens to answer first. Alert
 * every other active Admin/Super Admin (not Staff, who have no Contact
 * tab) so the team sees the reply regardless of who handled it. Without
 * this, a concern answered by the Super Admin is invisible to the Admin
 * (and vice versa) until someone manually opens the Contact tab.
 */
try {
    $replierId = (int)($user['user_id'] ?? 0);
    $team = $pdo->query("SELECT id FROM users WHERE role IN ('Admin', 'Super Admin') AND status = 'Active'")->fetchAll(PDO::FETCH_COLUMN);
    $teamText = 'Concern reply from ' . ($user['name'] ?? 'the team') . ': ' . ($contact['subject'] ?: ($contact['name'] ?: 'a resident'));
    $tn = $pdo->prepare('INSERT INTO notifications (user_id, report_id, type, message, is_read) VALUES (?, NULL, ?, ?, 0)');
    foreach ($team as $tid) {
        if ((int)$tid === $replierId) continue;
        $tn->execute([(int)$tid, 'contact', mb_substr($teamText, 0, 500)]);
    }
} catch (PDOException $e) { /* notification is best-effort */ }

echo json_encode(['success' => true, 'message' => 'Reply added.']);