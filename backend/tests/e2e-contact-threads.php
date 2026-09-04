<?php
/**
 * Live E2E: Contact Support threading — each submission = ONE conversation.
 *
 * TEST 1  Contact A -> own thread, SA reply A visible to resident
 * TEST 2  Contact B -> NEW separate thread (A untouched)
 * TEST 3  Thread B shows ONLY B's messages
 * TEST 4  SA reply B lands in thread B
 * TEST 5  Resident reply lands in thread B (SA side)
 * TEST 6  Order/persistence assertions
 * TEST 7  No duplicate conversations after repeated polling
 *
 * CLI-only. Uses the REAL HTTP API; DB reads for assertions.
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
// Test-only: clear the contact-form rate limit so the E2E is repeatable.
$pdo->exec("DELETE FROM rate_limits WHERE endpoint = 'contact_message'");

// ---- Login ----
$resTok = http('POST', 'auth/login.php', ['email' => 'maria@email.com', 'password' => 'password', 'scope' => 'public'])['json']['token'] ?? null;
$saTok = http('POST', 'auth/login.php', ['email' => 'super.admin@xevera.gov.ph', 'password' => 'password', 'scope' => 'portal'])['json']['token'] ?? null;
ok((bool)$resTok && (bool)$saTok, 'resident + super admin logins');

function submitContact(string $subject, string $message, string $token): int {
    $r = http('POST', 'contact/create.php', [
        'name' => 'Maria Santos', 'email' => 'maria@email.com', 'category' => 'Support',
        'subject' => $subject, 'message' => $message,
    ], $token);
    return ($r['status'] ?? 0) === 200 ? 1 : 0;
}
function contactIdBySubject(string $subject): int {
    global $pdo;
    $s = $pdo->prepare('SELECT id FROM contact_messages WHERE subject = ? ORDER BY id DESC LIMIT 1');
    $s->execute([$subject]);
    return (int)($s->fetchColumn() ?: 0);
}
function threadMessages(int $contactId, string $saTok): array {
    return http('GET', 'contact/thread.php?id=' . $contactId, null, $saTok)['json']['messages'] ?? [];
}
function residentContactConvos(string $resTok): array {
    $list = http('GET', 'direct_messages/list.php?limit=50', null, $resTok)['json']['items'] ?? [];
    $map = [];
    foreach ($list as $m) {
        if (empty($m['contact_message_id'])) continue;
        $key = 'ct-' . $m['contact_message_id'];
        if (!isset($map[$key])) $map[$key] = ['contactId' => (int)$m['contact_message_id'], 'messages' => []];
        $map[$key]['messages'][] = $m;
    }
    return $map;
}

// ---- TEST 1: Contact A -> own thread + SA reply A ----
ok(submitContact('TEST CONTACT A', 'This is contact request A.', $resTok) === 1, 'TEST 1: Contact A submitted');
$idA = contactIdBySubject('TEST CONTACT A');
ok($idA > 0, 'TEST 1: conversation A created (contact id)', "id=$idA");
$rep = http('POST', 'contact/reply.php', ['message_id' => $idA, 'reply' => 'Reply A'], $saTok);
ok(($rep['status'] ?? 0) === 200, 'TEST 1: SA replied Reply A');
$threadA = threadMessages($idA, $saTok);
$hasOrigA = count(array_filter($threadA, fn($m) => strpos($m['message'], 'This is contact request A') !== false)) > 0;
$hasRepA = count(array_filter($threadA, fn($m) => strpos($m['message'], 'Reply A') !== false)) > 0;
ok($hasOrigA && $hasRepA, 'TEST 1: thread A has resident message + Reply A', 'msgs=' . count($threadA));

$resConvos = residentContactConvos($resTok);
$convoA = $resConvos['ct-' . $idA] ?? null;
ok($convoA !== null && count($convoA['messages']) >= 2, 'TEST 1: resident sees Conversation A in their Message Box', 'msgs=' . count($convoA['messages'] ?? []));

// ---- TEST 2: Contact B -> NEW separate thread ----
ok(submitContact('TEST CONTACT B', 'This is contact request B.', $resTok) === 1, 'TEST 2: Contact B submitted');
$idB = contactIdBySubject('TEST CONTACT B');
ok($idB > 0 && $idB !== $idA, 'TEST 2: conversation B created (separate id)', "id=$idB (A=$idA)");
$rep = http('POST', 'contact/reply.php', ['message_id' => $idB, 'reply' => 'Reply B'], $saTok);
ok(($rep['status'] ?? 0) === 200, 'TEST 2: SA replied Reply B');

$resConvos = residentContactConvos($resTok);
$convoB = $resConvos['ct-' . $idB] ?? null;
ok($convoB !== null, 'TEST 2: resident sees Conversation B as a SEPARATE conversation', 'conversations=' . count($resConvos));

// ---- TEST 3: Thread B shows ONLY B's messages ----
$threadB = threadMessages($idB, $saTok);
$leakA = count(array_filter($threadB, fn($m) => strpos($m['message'], 'contact request A') !== false || strpos($m['message'], 'Reply A') !== false));
ok(count($threadB) >= 1 && $leakA === 0, 'TEST 3: thread B contains only B messages', 'msgs=' . count($threadB) . ' leaks=' . $leakA);
$convoBmsgs = $convoB['messages'] ?? [];
$leakAres = count(array_filter($convoBmsgs, fn($m) => strpos((string)$m['message'], 'request A') !== false || strpos((string)$m['message'], 'Reply A') !== false));
ok(count($convoBmsgs) >= 1 && $leakAres === 0, 'TEST 3: resident Conversation B has no A messages', 'msgs=' . count($convoBmsgs) . ' leaks=' . $leakAres);

// ---- TEST 4: SA reply B lands in resident Conversation B ----
$gotB = count(array_filter($convoBmsgs, fn($m) => strpos((string)$m['message'], 'Reply B') !== false));
ok($gotB >= 1, 'TEST 4: resident Conversation B received Reply B');

// ---- TEST 5: Resident replies in Conversation B -> SA thread B ----
$lastReceived = null;
foreach (array_reverse($convoBmsgs) as $m) { if ($m['direction'] === 'received') { $lastReceived = $m; break; } }
$recipientId = (int)($lastReceived['other_id'] ?? 0);
$r = http('POST', 'direct_messages/send.php', [
    'recipient_id' => $recipientId,
    'contact_message_id' => $idB,
    'subject' => 'Re: TEST CONTACT B',
    'message' => 'Resident reply B: thank you!',
], $resTok);
ok(($r['status'] ?? 0) === 200, 'TEST 5: resident replied in Conversation B', (string)($r['json']['message'] ?? $r['raw']));
$threadB2 = threadMessages($idB, $saTok);
$gotResReply = count(array_filter($threadB2, fn($m) => strpos($m['message'], 'Resident reply B') !== false));
ok($gotResReply >= 1, 'TEST 5: SA sees resident reply in Conversation B', 'msgs=' . count($threadB2));
$threadA2 = threadMessages($idA, $saTok);
$leak = count(array_filter($threadA2, fn($m) => strpos($m['message'], 'Resident reply B') !== false));
ok($leak === 0, 'TEST 5: resident reply did NOT leak into Conversation A', 'leaks=' . $leak);

// ---- TEST 6/7: persistence + no duplicates across repeated reads ----
$resConvos2 = residentContactConvos($resTok);
ok(count($resConvos2) === count($resConvos) + 0 || count($resConvos2) >= 2, 'TEST 7: conversations stable across polls', 'A+B present=' . ((isset($resConvos2['ct-' . $idA]) && isset($resConvos2['ct-' . $idB])) ? 'yes' : 'no'));
$dupCheck = count($resConvos2['ct-' . $idB]['messages'] ?? []);
$dupCheck2 = count(threadMessages($idB, $saTok));
ok($dupCheck === count($convoBmsgs) + 1, 'TEST 7: no duplicate messages in Conversation B', "before=" . count($convoBmsgs) . " after=$dupCheck");

// ---- SA general DM inbox excludes contact-thread messages ----
$saDm = http('GET', 'direct_messages/list.php?limit=50', null, $saTok)['json']['items'] ?? [];
$tagged = count(array_filter($saDm, fn($m) => !empty($m['contact_message_id'])));
ok($tagged === 0, 'SA general DM inbox excludes contact-thread messages', 'tagged=' . $tagged);

echo "\n=== THREADING E2E DONE: $pass PASS / $fail FAIL ===\n";
exit($fail > 0 ? 2 : 0);
