<?php
/**
 * Per-role user counts for the Super Admin 2FA Control table.
 * Returns { counts: { 'Super Admin': n, 'Admin': n, 'Staff': n, 'Resident': n } }.
 */
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../middleware/auth.php';
requirePermission('users', ['Super Admin']);

require_once __DIR__ . '/../config/database.php';

$roles = ['Super Admin', 'Admin', 'Staff', 'Resident'];
$counts = array_fill_keys($roles, 0);

try {
    $stmt = $pdo->query('SELECT role, COUNT(*) AS c FROM users GROUP BY role');
    foreach ($stmt->fetchAll() as $row) {
        $r = (string) $row['role'];
        if (array_key_exists($r, $counts)) {
            $counts[$r] = (int) $row['c'];
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to count users.']);
    exit;
}

echo json_encode(['counts' => $counts]);
