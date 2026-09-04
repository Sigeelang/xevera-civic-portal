<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../middleware/auth.php';
$user = requireAuth();

require_once __DIR__ . '/../config/database.php';

$stmt = $pdo->prepare('SELECT id, name, username, email, role, status, profile_photo, phone, date_of_birth, gender, address, created_at, last_login_at, email_verified, phone_verified, emergency_contact, security_settings FROM users WHERE id = ?');
$stmt->execute([$user['user_id']]);
$profile = $stmt->fetch();

if (!$profile) { http_response_code(404); echo json_encode(['error' => 'User not found.']); exit; }

$profile['emergency_contact'] = $profile['emergency_contact'] ? json_decode($profile['emergency_contact'], true) : null;
$profile['security_settings'] = $profile['security_settings'] ? json_decode($profile['security_settings'], true) : null;
$profile['email_verified'] = (int)$profile['email_verified'];
$profile['phone_verified'] = (int)$profile['phone_verified'];
$profile['member_since'] = $profile['created_at'];

echo json_encode($profile);
