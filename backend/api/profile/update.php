<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
$user = requireAuth();
xevera_write_rate_limit($pdo, 'profile.update');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (!$name) { http_response_code(400); echo json_encode(['error' => 'Name is required.']); exit; }

$updates = ['name = ?', 'email = ?'];
$params = [$name, $email];

if (array_key_exists('phone', $input)) {
    $phoneVal = trim((string)$input['phone']);
    if ($phoneVal !== '' && !preg_match('/^09\d{9}$/', $phoneVal)) { http_response_code(400); echo json_encode(['error' => 'Phone number must be 11 digits starting with 09.']); exit; }
    $updates[] = 'phone = ?'; $params[] = $phoneVal;
}
if (array_key_exists('date_of_birth', $input)) { $updates[] = 'date_of_birth = ?'; $params[] = trim((string)$input['date_of_birth']) ?: null; }
if (array_key_exists('gender', $input)) { $updates[] = 'gender = ?'; $params[] = trim((string)$input['gender']); }
if (array_key_exists('address', $input)) { $updates[] = 'address = ?'; $params[] = trim((string)$input['address']); }
if (array_key_exists('emergency_contact', $input)) { $updates[] = 'emergency_contact = ?'; $params[] = json_encode($input['emergency_contact'] ?? null, JSON_UNESCAPED_UNICODE); }

if ($password) {
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $updates[] = 'password_hash = ?';
    $params[] = $hash;
}

$params[] = $user['user_id'];
$stmt = $pdo->prepare('UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = ?');
$stmt->execute($params);

$logStmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, NULL, ?)');
$logStmt->execute([(int)$user['user_id'], 'update_profile', 'user', 'Updated profile information']);

echo json_encode(['success' => true]);
