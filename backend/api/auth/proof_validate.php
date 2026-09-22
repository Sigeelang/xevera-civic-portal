<?php
/*
 * Shared proof-of-residency filename validation.
 *
 * Accepts up to 2 server-generated filenames (proof_<32 hex>.jpg|jpeg|png)
 * that must already exist under uploads/residency. Accepts the new
 * `proof_filenames` array or the legacy single `proof_filename` string.
 * Throws RuntimeException with a user-facing message on any failure.
 */

function xevera_proof_dir(): string {
    return __DIR__ . '/../../uploads/residency';
}

function xevera_validate_proof_list(array $input): array {
    $list = [];
    if (isset($input['proof_filenames']) && is_array($input['proof_filenames'])) {
        foreach ($input['proof_filenames'] as $f) {
            $f = trim((string)$f);
            if ($f !== '') $list[] = $f;
        }
    } elseif (!empty($input['proof_filename'])) {
        $list[] = trim((string)$input['proof_filename']);
    }

    if (!$list) {
        throw new RuntimeException('Please upload at least one proof-of-residency image.');
    }

    if (count($list) > 2) {
        throw new RuntimeException('Maximum of 2 proof-of-residency images allowed.');
    }

    $dir = xevera_proof_dir();
    foreach ($list as $f) {
        if (!preg_match('/^proof_[a-f0-9]{32}\.(jpg|jpeg|png)$/', $f) || !is_file($dir . '/' . $f)) {
            throw new RuntimeException('Invalid proof of residency file. Please re-upload.');
        }
    }

    return array_values($list);
}
