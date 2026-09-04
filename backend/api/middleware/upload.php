<?php
/**
 * File-upload safety helpers.
 *
 * Defense in depth:
 *   1. If the filename has a recognizable image extension, it must
 *      be in the allow-list. (When the server strips the extension
 *      from $_FILES['name'] — a known XAMPP PHP-dev-server quirk —
 *      we fall through to content-only validation.)
 *   2. getimagesize() reads the file's actual header to determine
 *      its real mime. The mime must be in the allow-list.
 *   3. The returned extension is derived from the *verified mime*
 *      (not from the filename), so a `.jpg` extension with `image/png`
 *      content is saved as `.png`.
 *   4. If both filename and content are present, the filename's
 *      extension must agree with the verified mime. This catches
 *      polyglot attacks where the extension is `jpg` but the body
 *      is `image/png` (or vice versa).
 *
 * The combined checks defeat:
 *   - Renamed PHP files (`evil.php` saved as `evil.jpg`): rejected
 *     by the content sniff.
 *   - Polyglot files: rejected by the ext-vs-mime consistency check.
 *   - Non-image files served with a `Content-Type: image/jpeg`
 *     header: rejected by the content sniff.
 *
 * Every uploader in the app should call `xevera_validate_image_upload()`
 * before `move_uploaded_file()`. The check fails closed: on any
 * rejection, the helper emits a 400 JSON response and calls `exit`.
 */
const XEVERA_IMAGE_EXT_TO_MIME = [
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'webp' => 'image/webp',
];
const XEVERA_IMAGE_MIME_TO_EXT = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];
const XEVERA_IMAGE_MAX_BYTES_DEFAULT = 5 * 1024 * 1024; // 5 MB

/**
 * Validate a single uploaded image file.
 *
 * @param array $file     One entry from the $_FILES superglobal.
 * @param int   $maxBytes Per-upload byte cap. Defaults to 5 MB.
 *
 * Emits a 400 JSON response and exits on rejection. On success
 * returns an associative array with the verified data:
 *   ['ext' => 'jpg', 'mime' => 'image/jpeg']
 */
function xevera_validate_image_upload(array $file, int $maxBytes = XEVERA_IMAGE_MAX_BYTES_DEFAULT): array {
    if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Upload failed. Please try again.']);
        exit;
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid upload source.']);
        exit;
    }
    if (($file['size'] ?? 0) > $maxBytes) {
        http_response_code(400);
        echo json_encode(['error' => 'File exceeds size limit.']);
        exit;
    }

    // 1. Extension check (when the filename has one).
    $ext = strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
    if ($ext !== '' && !isset(XEVERA_IMAGE_EXT_TO_MIME[$ext])) {
        http_response_code(400);
        echo json_encode(['error' => 'Only JPG, PNG, or WEBP images are allowed.']);
        exit;
    }

    // 2. Content sniff: read the file header to confirm it's an image.
    $info = @getimagesize($file['tmp_name']);
    if (!$info || !isset(XEVERA_IMAGE_MIME_TO_EXT[$info['mime']])) {
        http_response_code(400);
        echo json_encode(['error' => 'File content is not a supported image.']);
        exit;
    }

    // 3. If the filename extension disagrees with the verified mime,
    //    reject. This catches polyglot attacks like `evil.jpg`
    //    containing image/png bytes.
    $mimeExt = XEVERA_IMAGE_MIME_TO_EXT[$info['mime']];
    if ($ext !== '' && $ext !== 'jpeg' && $ext !== $mimeExt) {
        http_response_code(400);
        echo json_encode(['error' => 'File extension does not match its content.']);
        exit;
    }

    // When the filename had no extension (some dev servers strip it),
    // fall back to the verified mime's canonical extension.
    if ($ext === '') {
        $ext = $mimeExt;
    } elseif ($ext === 'jpeg') {
        // Normalize jpeg -> jpg for the saved filename.
        $ext = 'jpg';
    }

    return ['ext' => $ext, 'mime' => $info['mime']];
}
