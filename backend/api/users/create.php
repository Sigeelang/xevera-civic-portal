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
$currentUser = requirePermission('users', ['Super Admin']);
xevera_write_rate_limit($pdo, 'users.create');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$username = trim($input['username'] ?? '');
$email = strtolower(trim($input['email'] ?? ''));
$phone = trim($input['phone'] ?? '');
$status = ($input['status'] ?? 'Active') === 'Inactive' ? 'Inactive' : 'Active';
// Temporary initial password (the resident/staff replaces it at first login).
$password = $input['password'] ?? bin2hex(random_bytes(16));
// Default: force a password change on first sign-in unless explicitly disabled.
$mustChangePassword = isset($input['must_change_password']) ? ((int)(bool)$input['must_change_password']) : 1;
$role = $input['role'] ?? 'Staff';

if (!$name || !$username) {
    http_response_code(400);
    echo json_encode(['error' => 'Name and username are required.']);
    exit;
}

if (strlen((string)$password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Initial password must be at least 8 characters.']);
    exit;
}

if ($phone !== '' && !preg_match('/^09\d{9}$/', $phone)) {
    http_response_code(400);
    echo json_encode(['error' => 'Phone number must be 11 digits starting with 09.']);
    exit;
}

if ($status !== 'Active' && $status !== 'Inactive') {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid account status.']);
    exit;
}

if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address.']);
    exit;
}

$validRoles = ['Super Admin', 'Admin', 'Staff'];
if (!in_array($role, $validRoles)) {
    $role = 'Staff';
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
$stmt->execute([$username]);
if ($stmt->fetch()) {
    http_response_code(409);
    echo json_encode(['error' => 'Username already exists.']);
    exit;
}

if ($email) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        http_response_code(409);
        echo json_encode(['error' => 'Email already exists.']);
        exit;
    }
}

$hash = password_hash($password, PASSWORD_DEFAULT);

/*
 * New staff/admin accounts start with must_change_password = 1 (unless the
 * Super Admin explicitly unchecks it) so the initial password must be
 * replaced on first sign-in.
 */
$stmt = $pdo->prepare('INSERT INTO users (name, username, email, phone, password_hash, role, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$name, $username, $email ?: null, $phone ?: null, $hash, $role, $status, $mustChangePassword]);

$userId = $pdo->lastInsertId();

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$logStmt->execute([$currentUser['user_id'], 'create_user', 'user', $userId, 'Created user: ' . $name . ' (' . $role . ')']);

/*
 * Branded welcome email with the temporary credentials.
 * Fail-open by design: the account is already created, so mail
 * problems are reported via email_sent instead of erroring out.
 */
$emailSent = false;
if ($email !== '') {
    try {
        require_once __DIR__ . '/../config/mailer.php';
        require_once __DIR__ . '/../config/email_templates.php';
        $portalBase = rtrim((string)(getenv('APP_URL') ?: ''), '/');
        if (!$portalBase) {
            $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
            if ($origin && preg_match('#^https?://#i', $origin)) $portalBase = rtrim($origin, '/');
        }
        if (!$portalBase) $portalBase = 'https://xevera-portal.duckdns.org';
        $loginUrl = $portalBase . '/dashboard';
        $subject = xevera_account_created_email_subject($role);
        $text = xevera_account_created_email_text($name, $username, $email, $role, $status, $password, $loginUrl);
        $html = xevera_account_created_email_html($name, $username, $email, $role, $status, $password, $loginUrl);
        $emailSent = (bool)xevera_mail($email, $subject, $text, $html);
    } catch (Throwable $e) {
        error_log('xevera_users_create: welcome email failed: ' . $e->getMessage());
        $emailSent = false;
    }
}

echo json_encode([
    'message' => 'User created successfully.',
    'email_sent' => $emailSent,
    'user' => [
        'id' => (int)$userId,
        'name' => $name,
        'username' => $username,
        'email' => $email ?: null,
        'role' => $role,
        'status' => $status,
    ],
]);
