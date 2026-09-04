<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../config/cors.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Public FAQ endpoint — no auth required.
$items = [
    [
        'question' => 'How do I submit a report?',
        'answer' => 'Go to Report an Issue, fill in the category, location, and description, and attach photos. You can submit without signing in, but creating an account lets you track status.',
    ],
    [
        'question' => 'How do I track my report?',
        'answer' => 'Open My Reports. Each card shows the current status (Pending, In Progress, Resolved, etc.) and the latest activity on the timeline.',
    ],
    [
        'question' => 'How long does it take for my report to be resolved?',
        'answer' => 'Resolution time depends on the category and urgency. The home page shows the current community average. You will receive a notification when your status changes.',
    ],
    [
        'question' => 'Can I save a report for later?',
        'answer' => 'Yes. Open a report and tap the bookmark icon. Saved reports appear under Saved Reports in your sidebar.',
    ],
    [
        'question' => 'How do I change my notification settings?',
        'answer' => 'Open Settings → Notifications. Each channel can be toggled independently and is saved to your account.',
    ],
    [
        'question' => 'How is my data protected?',
        'answer' => 'Xevera follows the Data Privacy Act. Your contact details are only used to update you about your reports and never shared publicly without consent.',
    ],
];

echo json_encode(['items' => $items, 'total' => count($items)]);