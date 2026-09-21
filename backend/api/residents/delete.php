<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); exit; }

require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../middleware/write_ratelimit.php';
requirePermission('residents', ['Admin', 'Super Admin']);
xevera_write_rate_limit($pdo, 'residents.delete');

require_once __DIR__ . '/../config/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$id = (int)($input['id'] ?? 0);

if (!$id) { http_response_code(400); echo json_encode(['error' => 'Invalid ID.']); exit; }

$stmt = $pdo->prepare("DELETE FROM users WHERE id = ? AND role = 'Resident'");
$stmt->execute([$id]);

echo json_encode(['success' => true]);
