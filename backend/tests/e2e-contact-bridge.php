<?php
/**
 * Live E2E: Contact Support -> Super Admin reply -> resident Message Box.
 * CLI-only. Exercises the REAL HTTP API (not direct DB writes) for all
 * actions; DB is read only for assertions.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit('Not found'); }

require_once __DIR__ . '/../api/config/env.php';

$base = 'http://127.0.0.1:8000/api';
$pass = 0; $fail = 0;
function ok(bool $cond, string $name, string $detail = '') {
    global $pass, $fail;
    if ($cond) { $pass++; echo "  PASS  $name" . ($detail ? "  ($detail)" : '') . "\n"; }
    else { $fail++; echo "  FAIL  $name  ->  $detail\n"; }
}

function http(string $method, string $path, ?array $body = null, ?string $token = null): array {
    $ch = curl_init($GLOBALS['base'] . '/' . $path);
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = 'Authorization: Bearer ' . $token;
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => (int)$status, 'json' => json_decode((string)$raw, true), 'raw' => (string)$raw];
}

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;dbname=%s', getenv('DB_HOST') ?: 'localhost', getenv('DB_PORT') ?: '3306', getenv('DB_NAME') ?: 'xevera_civic'),
    getenv('DB_USER') ?: 'root', (string) getenv('DB_PASS'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

// ---- 1. Resident logs in and submits Contact Support (authenticated) ----
// Test-only: clear the contact-form rate limit so the E2E is repeatable.
$pdo->exec("DELETE FROM rate_limits WHERE endpoint = 'contact_message'");

$login = http('POST', 'auth/login.php', ['email' => 'maria@email.com', 'password' => 'password', 'scope' => 'public']);
$resTok = $login['json']['token'] ?? null;
ok((bool)$resTok, 'resident login');

$sub = http('POST', 'contact/create.php', [
    'name' => 'Maria Santos', 'email' => 'maria@email.com', 'category' => 'Support',
    'subject' => 'TST E2E Bridge', 'message' => 'E2E: please help with my concern.',
], $resTok);
ok(($sub['status'] ?? 0) === 200, 'resident submits Contact Support (authenticated)', (string)($sub['json']['message'] ?? $sub['raw']));

$row = $pdo->query("SELECT id, user_id, created_at FROM contact_messages WHERE subject = 'TST E2E Bridge' ORDER BY id DESC LIMIT 1")->fetch();
$cid = (int)($row['id'] ?? 0);
$linkedUid = (int)($row['user_id'] ?? 0);
$cCreated = (string)($row['created_at'] ?? '');
ok($cid > 0 && $linkedUid > 0, 'submission linked to resident user_id', "contact id=$cid user_id=$linkedUid");

// ---- 2. Super Admin opens + replies in the Message Box ----
$saLogin = http('POST', 'auth/login.php', ['email' => 'super.admin@xevera.gov.ph', 'password' => 'password', 'scope' => 'portal']);
$saTok = $saLogin['json']['token'] ?? null;
ok((bool)$saTok, 'super admin login (2FA off)');

http('POST', 'contact/read.php', ['id' => $cid], $saTok);
$rep = http('POST', 'contact/reply.php', ['message_id' => $cid, 'reply' => 'E2E bridge reply: we are on it.'], $saTok);
ok(($rep['status'] ?? 0) === 200, 'SA replies in Message Box', (string)($rep['json']['message'] ?? $rep['raw']));

// ---- 3. Reply mirrored into resident's Message Box: original + reply ----
// (scoped to THIS contact via its exact created_at stamp)
$resList = http('GET', 'direct_messages/list.php?limit=20', null, $resTok);
$items = $resList['json']['items'] ?? [];

// A. The resident's ORIGINAL contact message mirrored (from resident, read)
$orig = array_values(array_filter($items, fn($m) =>
    $m['direction'] === 'sent'
    && strpos((string)$m['message'], 'please help with my concern') !== false
    && (string)$m['created_at'] === $cCreated));
ok(count($orig) === 1, 'original contact message mirrored into thread (from resident, read)', 'found=' . count($orig) . ' read=' . (isset($orig[0]) ? var_export($orig[0]['is_read'], true) : '-'));

// B. The SA reply mirrored (to resident, unread, newer than the original)
$bridged = array_values(array_filter($items, fn($m) =>
    $m['direction'] === 'received'
    && strpos((string)$m['message'], 'we are on it') !== false
    && strcmp((string)$m['created_at'], $cCreated) > 0));
ok(count($bridged) === 1, 'SA reply mirrored into resident Message Box as DM', 'found=' . count($bridged));
$dm = $bridged[0] ?? null;
ok((bool)$dm && (int)$dm['is_read'] === 0, 'bridged DM is unread for resident');

// C. Chronological order: original before reply
if ($orig && $dm) {
    ok(strcmp((string)$orig[0]['created_at'], (string)$dm['created_at']) < 0, 'chronological order: original before reply',
        $orig[0]['created_at'] . ' vs ' . $dm['created_at']);
} else {
    ok(false, 'chronological order check (missing messages)');
}

// ---- 4. Retry the same reply -> no duplicate DM ----
http('POST', 'contact/reply.php', ['message_id' => $cid, 'reply' => 'E2E bridge reply: we are on it.'], $saTok);
$resList2 = http('GET', 'direct_messages/list.php?limit=20', null, $resTok);
$bridged2 = array_values(array_filter($resList2['json']['items'] ?? [], fn($m) =>
    $m['direction'] === 'received'
    && strpos((string)$m['message'], 'we are on it') !== false
    && strcmp((string)$m['created_at'], $cCreated) > 0));
$orig2 = array_values(array_filter($resList2['json']['items'] ?? [], fn($m) =>
    $m['direction'] === 'sent'
    && strpos((string)$m['message'], 'please help with my concern') !== false
    && (string)$m['created_at'] === $cCreated));
ok(count($bridged2) === 1, 'retried reply does NOT duplicate the DM', 'found=' . count($bridged2));
ok(count($orig2) === 1, 'original message not re-mirrored', 'found=' . count($orig2));

// ---- 5. SA thread shows the actual reply text via contact/replies.php ----
$replies = http('GET', 'contact/replies.php?id=' . $cid, null, $saTok);
$hasText = false;
foreach (($replies['json'] ?? []) as $r) { if (strpos((string)$r['reply'], 'we are on it') !== false) $hasText = true; }
ok($hasText, 'SA contact thread exposes actual reply text (not just a placeholder)');

// ---- 5. Resident replies in their Message Box -> lands in SA box ----
$saId = (int)($dm['other_id'] ?? 0);
$resReply = http('POST', 'direct_messages/send.php', [
    'recipient_id' => $saId, 'subject' => 'Re: TST E2E Bridge', 'message' => 'E2E: thank you, one more question please.',
], $resTok);
ok(($resReply['status'] ?? 0) === 200, 'resident replies in their Message Box', (string)($resReply['json']['message'] ?? $resReply['raw']));

$saList = http('GET', 'direct_messages/list.php?limit=20', null, $saTok);
$saGot = array_values(array_filter($saList['json']['items'] ?? [], fn($m) => strpos((string)$m['message'], 'one more question') !== false));
ok(count($saGot) >= 1, 'resident reply lands in SA Message Box', 'from=' . ($saGot[0]['other_name'] ?? '?'));

echo "\n=== E2E DONE: $pass PASS / $fail FAIL ===\n";
exit($fail > 0 ? 2 : 0);
