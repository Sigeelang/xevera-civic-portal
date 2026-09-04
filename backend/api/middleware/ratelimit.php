<?php
function checkRateLimit(PDO $pdo, int $maxRequests, int $windowSeconds = 3600, string $endpoint = 'report_submit'): void {
  $headers = getallheaders();
  $token = $headers['Authorization'] ?? $headers['authorization'] ?? '';
  $userId = null;

  if (preg_match('/^Bearer\s+(.+)$/i', $token, $matches)) {
    $b64 = $matches[1];
    $dot = strrpos($b64, '.');
    if ($dot !== false) {
      $b64 = substr($b64, 0, $dot);
    }
    $payload = json_decode(base64_decode($b64), true);
    if ($payload && isset($payload['user_id'])) {
      $userId = $payload['user_id'];
    }
  }

  if ($userId) {
    $identifier = 'user_' . $userId;
    $type = 'user';
  } else {
    $identifier = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $type = 'ip';
  }

  $pdo->exec("DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL $windowSeconds SECOND");

  $stmt = $pdo->prepare("SELECT COUNT(*) FROM rate_limits WHERE identifier = ? AND type = ? AND endpoint = ? AND window_start > NOW() - INTERVAL $windowSeconds SECOND");
  $stmt->execute([$identifier, $type, $endpoint]);
  $count = (int)$stmt->fetchColumn();

  if ($count >= $maxRequests) {
    http_response_code(429);
    $retryAfter = $windowSeconds;
    header('Retry-After: ' . $retryAfter);
    echo json_encode(['error' => 'Too many submissions. Please try again later.', 'retry_after' => $retryAfter]);
    exit;
  }

  $stmt = $pdo->prepare("INSERT INTO rate_limits (identifier, type, endpoint, window_start) VALUES (?, ?, ?, NOW())");
  $stmt->execute([$identifier, $type, $endpoint]);
}
