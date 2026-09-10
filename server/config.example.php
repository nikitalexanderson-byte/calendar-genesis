<?php
declare(strict_types=1);

return [
    'app_url' => 'https://genesiscalendar.ru',
    'google_client_id' => '',
    'google_client_secret' => '',
    'gemini_api_key' => '',
    'gemini_model' => 'gemini-3.8-flash',
    // Optional HTTPS relay with the same request/response contract. Useful when
    // the hosting region is not supported by the Gemini Developer API.
    'gemini_api_endpoint' => 'https://generativelanguage.googleapis.com/v1beta/interactions',
    'crypto_key' => '',
    'db_path' => __DIR__ . '/var/genesis.sqlite',
    'session_path' => __DIR__ . '/var/sessions',
    'cookie_secure' => true,
    'timezone' => 'Europe/Moscow',
    'admin_email' => 'nikitalexanderson@gmail.com',
];
