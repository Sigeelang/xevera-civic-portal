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

/*
 * This endpoint is PUBLIC (pre-registration), so it must be rate limited -
 * otherwise an attacker can fill the disk with 5 MB uploads.
 *
 * Proof of residency: MAXIMUM 2 images (JPG/JPEG/PNG, 5 MB each).
 * Accepts proof[] (multiple) or legacy single proof field.
 */
require_once __DIR__ . '/../middleware/write_ratelimit.php';
xevera_write_rate_limit($pdo, 'auth.upload_proof');

$maxFiles = 2;
$maxSize = 5 * 1024 * 1024;
$mimeToExt = ['image/jpeg' => 'jpg', 'image/png' => 'png'];
$allowedExts = ['jpg', 'jpeg', 'png'];

// Normalize to a list of file arrays.
$incoming = [];
if (isset($_FILES['proof'])) {
    if (is_array($_FILES['proof']['name'])) {
        $count = count($_FILES['proof']['name']);
        for ($i = 0; $i < $count; $i++) {
            $incoming[] = [
                'name' => $_FILES['proof']['name'][$i],
                'type' => $_FILES['proof']['type'][$i] ?? '',
                'tmp_name' => $_FILES['proof']['tmp_name'][$i] ?? '',
                'error' => $_FILES['proof']['error'][$i] ?? UPLOAD_ERR_NO_FILE,
                'size' => $_FILES['proof']['size'][$i] ?? 0,
            ];
        }
    } else {
        $incoming[] = $_FILES['proof'];
    }
}

// Drop empty slots, then enforce the backend cap.
$incoming = array_values(array_filter($incoming, function ($f) {
    return ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
}));

if (!$incoming) {
    http_response_code(400);
    echo json_encode(['error' => 'No file uploaded or upload error.']);
    exit;
}

if (count($incoming) > $maxFiles) {
    http_response_code(400);
    echo json_encode(['error' => 'Maximum of 2 proof-of-residency images allowed.']);
    exit;
}

$dir = __DIR__ . '/../../uploads/residency';
if (!is_dir($dir)) { mkdir($dir, 0750, true); }

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$saved = [];

foreach ($incoming as $file) {
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Upload error. Please try again.']);
        exit;
    }

    if (($file['size'] ?? 0) > $maxSize) {
        http_response_code(400);
        echo json_encode(['error' => 'Each image must be 5 MB or smaller.']);
        exit;
    }

    // Real MIME from file content (never trust the client header).
    $mime = finfo_file($finfo, $file['tmp_name']);
    // Image integrity: must decode as a real image.
    $dims = @getimagesize($file['tmp_name']);
    if (!isset($mimeToExt[$mime]) || $dims === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Only JPG, JPEG, and PNG images are allowed.']);
        exit;
    }

    // Extension must agree with the real MIME.
    $origExt = strtolower(pathinfo($file['name'] ?? '', PATHINFO_EXTENSION));
    if (!in_array($origExt, $allowedExts, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Only JPG, JPEG, and PNG images are allowed.']);
        exit;
    }

    $ext = $mimeToExt[$mime];
    $filename = 'proof_' . bin2hex(random_bytes(16)) . '.' . $ext;
    $dest = $dir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save file.']);
        exit;
    }

    chmod($dest, 0640);
    $saved[] = [
        'filename' => $filename,
        'original_name' => $file['name'],
        'mime' => $mime,
        'size' => $file['size'],
    ];
}

finfo_close($finfo);

echo json_encode([
    'success' => true,
    'files' => $saved,
]);
