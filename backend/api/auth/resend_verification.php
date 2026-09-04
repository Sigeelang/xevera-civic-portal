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

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/mailer.php';

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');

if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'A valid email address is required.']);
    exit;
}

$stmt = $pdo->prepare('SELECT id, name, email, email_verified FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user) {
    // Do not reveal whether the account exists.
    echo json_encode(['message' => 'If an account exists for that email, a verification link has been sent.']);
    exit;
}

if ((int)$user['email_verified'] === 1) {
    echo json_encode(['message' => 'This email address is already verified.']);
    exit;
}

$token = bin2hex(random_bytes(32));
$expires = date('Y-m-d H:i:s', time() + 86400); // 24 hours

$stmt = $pdo->prepare('UPDATE users SET verify_token = ?, verify_token_expires = ? WHERE id = ?');
$stmt->execute([$token, $expires, $user['id']]);

$base = rtrim((string)(getenv('APP_URL') ?: ''), '/');
if (!$base) {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && preg_match('#^https?://#i', $origin)) $base = rtrim($origin, '/');
}
if (!$base) $base = 'http://localhost:5173';

$link = $base . '/xevera-portal/verify/' . $token;
$siteName = getenv('APP_NAME') ?: 'Xevera Portal';
$body = "Hello " . ($user['name'] ?: 'there') . ",\n\n"
    . "Welcome to " . $siteName . "! Please confirm your email address by opening the link below.\n\n"
    . $link . "\n\n"
    . "The link expires in 24 hours. If you didn't create an account, you can ignore this email.\n";

/*
 * Always attempt real delivery - the mailer fails closed when SMTP is
 * not configured. Never return the verification token to the browser.
 */
$sent = xevera_mail($user['email'], 'Verify your email', $body);

if (!$sent) {
    http_response_code(500);
    echo json_encode(['error' => 'Unable to send verification code.']);
    exit;
}

echo json_encode([
    'message' => 'A verification link has been sent to your email.',
]);
