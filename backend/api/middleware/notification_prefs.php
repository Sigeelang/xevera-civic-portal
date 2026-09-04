<?php
function pref_enabled(PDO $pdo, int $userId, string $key): bool {
    static $cache = [];
    if (!isset($cache[$userId])) {
        $stmt = $pdo->prepare('SELECT * FROM notification_prefs WHERE user_id = ?');
        $stmt->execute([$userId]);
        $row = $stmt->fetch();
        if (!$row) {
            $cache[$userId] = [
                'notify_like' => 1,
                'notify_comment' => 1,
                'notify_status' => 1,
                'notify_follow' => 1,
            ];
        } else {
            $cache[$userId] = $row;
        }
    }
    return (int)($cache[$userId][$key] ?? 1) === 1;
}