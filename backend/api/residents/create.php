<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
requirePermission('residents', ['Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'residents.create');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';
$address = trim($input['address'] ?? '');

if (!$name || !$email || !$password) {
  http_response_code(400);
  echo json_encode(['error' => 'Name, email, and password are required.']);
  exit;
}

$stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
  http_response_code(409);
  echo json_encode(['error' => 'Email already registered.']);
  exit;
}

$username = strtolower(explode('@', $email)[0]);
$base = $username;
$suffix = 1;
while (true) {
  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
  $stmt->execute([$username]);
  if (!$stmt->fetch()) break;
  $username = $base . '_' . $suffix;
  $suffix++;
}

$hash = password_hash($password, PASSWORD_DEFAULT);

$stmt = $pdo->prepare('INSERT INTO users (name, username, password_hash, email, address, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$name, $username, $hash, $email, $address, 'Resident', 'Active']);

$userId = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('INSERT INTO activity_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)');
$stmt->execute([$userId, 'create_user', 'resident', $userId, 'Admin created resident account for ' . $name]);

echo json_encode(['success' => true, 'id' => $userId, 'username' => $username]);
