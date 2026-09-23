<?php
/*
 * Conversation preferences (archive / mute) for the Message Box row menu.
 *
 * GET  -> {prefs: {conversation_key: {archived, muted}}}
 * POST -> {conversation_key, archived?, muted?} upserts the caller's row.
 * Keys: dm-<user_id> (1-on-1) or ct-<contact_message_id> (support thread).
 */
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$userId = (int)$user['user_id'];

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->prepare('SELECT conversation_key, archived, muted FROM conversation_prefs WHERE user_id = ?');
    $stmt->execute([$userId]);
    $prefs = [];
    foreach ($stmt->fetchAll() as $r) {
        $prefs[$r['conversation_key']] = ['archived' => (int)$r['archived'] === 1, 'muted' => (int)$r['muted'] === 1];
    }
    echo json_encode(['prefs' => $prefs]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

xevera_write_rate_limit($pdo, 'messages.prefs');

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) { $input = $_POST; }

$key = trim((string)($input['conversation_key'] ?? ''));
if (!preg_match('/^(dm|ct)-\d+$/', $key)) {
    http_response_code(400);
    echo json_encode(['error' => 'Conversation is required.']);
    exit;
}

$archived = array_key_exists('archived', $input) ? (!empty($input['archived']) ? 1 : 0) : null;
$muted = array_key_exists('muted', $input) ? (!empty($input['muted']) ? 1 : 0) : null;

if ($archived === null && $muted === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Nothing to update.']);
    exit;
}

// Partial updates keep the untouched flag: read existing row first.
$cur = $pdo->prepare('SELECT archived, muted FROM conversation_prefs WHERE user_id = ? AND conversation_key = ?');
$cur->execute([$userId, $key]);
$old = $cur->fetch();
$finalArchived = $archived ?? (int)($old['archived'] ?? 0);
$finalMuted = $muted ?? (int)($old['muted'] ?? 0);

$stmt = $pdo->prepare('INSERT INTO conversation_prefs (user_id, conversation_key, archived, muted) VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE archived = VALUES(archived), muted = VALUES(muted), updated_at = NOW()');
$stmt->execute([$userId, $key, $finalArchived, $finalMuted]);

echo json_encode(['message' => 'Preference saved.', 'conversation_key' => $key, 'archived' => $finalArchived === 1, 'muted' => $finalMuted === 1]);
