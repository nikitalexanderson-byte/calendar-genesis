<?php
declare(strict_types=1);

return [
    'app_url' => 'https://genesiscalendar.com',
    'google_only' => true,
    'google_client_id' => '',
    'google_client_secret' => '',
    // Yandex ID sign-in remains unavailable until both values are configured.
    // Keep the secret only in the private server/config.php file.
    'yandex_client_id' => '',
    'yandex_client_secret' => '',
    // Recommended neural provider for Russian hosting. Create one GigaChat API
    // project, paste its Authorization Key here once, and token renewal will be
    // handled automatically by GENESIS.
    'gigachat_enabled' => false,
    'gigachat_authorization_key' => '',
    'gigachat_scope' => 'GIGACHAT_API_PERS',
    'gigachat_model' => 'GigaChat',
    'gigachat_auth_endpoint' => 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
    'gigachat_api_endpoint' => 'https://api.giga.chat/v1',
    // Optional absolute path to a CA bundle containing the Russian Ministry of
    // Digital Development root certificates when the host does not trust them.
    'gigachat_ca_path' => '',
    // Keep the assistant disabled unless the server can reach Gemini from a
    // supported region (or through an explicitly configured relay).
    'gemini_enabled' => false,
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
    // Optional external channels. Keep disabled until genuine server transport
    // is configured. Neither configuration nor task watching subscribes users.
    'notifications' => [
        'web_push' => [
            // Stable P-256 (prime256v1) VAPID private key, PEM format.
            // Keep only in private server/config.php; never commit the key.
            'private_key' => '',
            'subject' => 'https://genesiscalendar.com',
        ],
        'email' => [
            // Set to 'mail' only with a working PHP mail transport and an
            // authorized sender configured by the domain administrator.
            'transport' => '',
            'from' => '',
        ],
    ],
    'admin_email' => 'nikitalexanderson@gmail.com',
];
