<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
requirePermission('residents', ['Admin', 'Super Admin']);

require_once __DIR__ . '/../config/database.php';

$q = trim($_GET['search'] ?? '');

$cols = "id, name, username, email, address, role, status, created_at, last_login_at, residency_proof, residency_proof2";
try {
  $pdo->query("SELECT $cols FROM users LIMIT 1");
} catch (Throwable $e) {
  // Pre-migration schemas: fall back to the base column set.
  $cols = "id, name, username, email, address, role, status, created_at, last_login_at";
  try {
    $pdo->query("SELECT $cols FROM users LIMIT 1");
  } catch (Throwable $e2) {
    $cols = "id, name, username, email, address, role, status, created_at";
  }
}

$sql = "SELECT $cols FROM users WHERE role = 'Resident'";
$params = [];

if ($q) {
  $sql .= ' AND (name LIKE ? OR email LIKE ? OR username LIKE ?)';
  $params[] = "%$q%";
  $params[] = "%$q%";
  $params[] = "%$q%";
}

$sql .= ' ORDER BY created_at DESC';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$residents = $stmt->fetchAll();

echo json_encode(array_map(function ($u) {
  return [
    'id' => (int)$u['id'],
    'name' => $u['name'],
    'username' => $u['username'],
    'email' => $u['email'],
    'address' => $u['address'] ?? '',
    'role' => $u['role'] ?? 'Resident',
    'status' => $u['status'],
    'created_at' => $u['created_at'],
    'last_login_at' => $u['last_login_at'] ?? null,
    'residency_proof' => $u['residency_proof'] ?? null,
    'residency_proof2' => $u['residency_proof2'] ?? null,
  ];
}, $residents));
