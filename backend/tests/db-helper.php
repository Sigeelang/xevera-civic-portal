<?php
/**
 * Xevera test harness DB helper - CLI ONLY.
 *
 * Usage:
 *   php db-helper.php patch-otp       <email> <purpose> <otp>
 *   php db-helper.php expire-otp      <email> <purpose>
 *   php db-helper.php scalar          <sql>          (echoes first column of first row)
 *   php db-helper.php get-setting     <key>          (echoes value or '')
 *   php db-helper.php exec            <sql>          (echoes affected row count)
 *   php db-helper.php forge-token     <user_id> <role> <scope> <exp_offset_seconds>
 *   php db-helper.php reset-rate-limits
 *   php db-helper.php upsert-resident <email> <name> <password>
 *
 * Blocked from web access: CLI guard below + router.php blocks /tests/.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit('Not found');
}

require_once __DIR__ . '/../api/config/env.php';

$pdo = new PDO(
    sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        getenv('DB_HOST') ?: 'localhost',
        getenv('DB_PORT') ?: '3306',
        getenv('DB_NAME') ?: 'xevera_civic'),
    getenv('DB_USER') ?: 'root',
    (string) getenv('DB_PASS'),
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
);

$cmd = $argv[1] ?? '';

switch ($cmd) {
    case 'patch-otp': // email, purpose, otp
        $stmt = $pdo->prepare('UPDATE otp_verifications SET otp_hash = ?, attempts = 0 WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
        $stmt->execute([hash('sha256', $argv[4]), $argv[2], $argv[3]]);
        echo 'patched=' . $stmt->rowCount();
        break;

    case 'expire-otp': // email, purpose - backdate using PHP clock (app compares with PHP time())
        $past = date('Y-m-d H:i:s', time() - 60);
        $stmt = $pdo->prepare('UPDATE otp_verifications SET expires_at = ? WHERE email = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1');
        $stmt->execute([$past, $argv[2], $argv[3]]);
        echo 'expired=' . $stmt->rowCount();
        break;

    case 'scalar':
        $row = $pdo->query($argv[2])->fetch(PDO::FETCH_NUM);
        echo $row === false ? '' : (string) $row[0];
        break;

    case 'get-setting': // key -> string value or '' if missing
        $stmt = $pdo->prepare('SELECT `value` FROM system_settings WHERE `key` = ? LIMIT 1');
        $stmt->execute([$argv[2]]);
        $row = $stmt->fetch(PDO::FETCH_NUM);
        echo $row === false ? '' : (string) $row[0];
        break;

    case 'exec':
        echo $pdo->exec($argv[2]);
        break;

    case 'forge-token': // user_id, role, scope, exp_offset (negative = expired)
        require_once __DIR__ . '/../api/middleware/token.php';
        echo issue_token([
            'user_id' => (int) $argv[2],
            'role' => $argv[3],
            'scope' => $argv[4],
            'exp' => time() + (int) $argv[5],
        ]);
        break;

    case 'reset-rate-limits':
        $deleted = $pdo->exec('DELETE FROM rate_limits');
        echo 'cleared=' . $deleted;
        break;

    case 'upsert-resident': // email, name, password -> echoes user id
        $email    = $argv[2];
        $name     = $argv[3];
        $password = $argv[4];
        $username = strtolower(explode('@', $email)[0]);
        $hash     = password_hash($password, PASSWORD_DEFAULT);

        // Username collision guard.
        $base = $username;
        $suffix = 1;
        while (true) {
            $c = $pdo->prepare('SELECT id FROM users WHERE username = ?');
            $c->execute([$username]);
            if (!$c->fetch()) break;
            $existingId = (int)$pdo->query('SELECT id FROM users WHERE email = ' . $pdo->quote($email))->fetchColumn();
            if ($existingId) { $suffix++; $username = $base . '_' . $suffix; continue; }
            break;
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if ($row) {
            $pdo->prepare(
                'UPDATE users SET name = ?, username = ?, password_hash = ?, role = "Resident", status = "Active" WHERE id = ?'
            )->execute([$name, $username, $hash, (int)$row['id']]);
            echo 'updated=' . (int)$row['id'];
            break;
        }
        $pdo->prepare(
            'INSERT INTO users (name, username, password_hash, email, role, status) VALUES (?, ?, ?, ?, "Resident", "Active")'
        )->execute([$name, $username, $hash, $email]);
        echo 'created=' . (int)$pdo->lastInsertId();
        break;

    default:
        fwrite(STDERR, "Unknown command: {$cmd}\n");
        exit(1);
}
