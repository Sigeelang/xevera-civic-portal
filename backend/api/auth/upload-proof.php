<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config/database.php';

/*
 * This endpoint is PUBLIC (pre-registration), so it must be rate limited -
 * otherwise an attacker can fill the disk with 5 MB uploads.
 */
require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'auth.upload_proof');

$allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
$maxSize = 5 * 1024 * 1024;

if (!isset($_FILES['proof']) || $_FILES['proof']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error.']);
    exit;
}

$file = $_FILES['proof'];

if ($file['size'] > $maxSize) {
    http_response_code(400);
    echo json_encode(['error' => 'File too large. Maximum size is 5 MB.']);
    exit;
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!in_array($mime, $allowed, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid file type. Accepted: JPG, JPEG, PNG, PDF.']);
    exit;
}

$ext = match($mime) {
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'application/pdf' => 'pdf',
    default => 'bin'
};

$dir = __DIR__ . '/../../uploads/residency';
if (!is_dir($dir)) { mkdir($dir, 0750, true); }

$filename = 'proof_' . bin2hex(random_bytes(16)) . '.' . $ext;
$dest = $dir . '/' . $filename;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file.']);
    exit;
}

chmod($dest, 0640);

echo json_encode([
    'success' => true,
    'filename' => $filename,
    'original_name' => $file['name'],
    'mime' => $mime,
    'size' => $file['size'],
]);
