<?php
declare(strict_types=1);

// This handler belongs only to the retired GENESIS domain on the shared Beget site.
$host = (string) ($_SERVER['HTTP_HOST'] ?? '');
if (!preg_match('/^(?:www\.)?genesiscalendar\.ru(?::[0-9]+)?$/i', $host)) {
    http_response_code(404);
    exit;
}

$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
if (!str_starts_with($uri, '/') || preg_match('/[\x00-\x20\x7f]/', $uri)) {
    http_response_code(400);
    exit;
}

// Keep the original path and query, with a fixed destination origin.
header('Location: https://genesiscalendar.com' . $uri, true, 301);
header('Cache-Control: public, max-age=300');
exit;
