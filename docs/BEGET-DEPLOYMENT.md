# Развёртывание GENESIS на Beget

## Структура

Рекомендуемая серверная структура:

```text
/home/h/haiirodw/genesis-app/
├── public_html/     # собранная PWA и /api
└── server/
    ├── config.php   # секреты, вне web-root
    ├── src/
    ├── migrations/
    ├── cron/
    └── var/         # SQLite, WAL и PHP-сессии
```

SQLite хранит общую физическую базу приложения, но каждая рабочая сущность имеет обязательный `user_id`. Все выборки и изменения ограничены текущим пользователем из защищённой PHP-сессии. Google refresh token шифруется Sodium secretbox; ключ хранится только в закрытом `config.php`.

## Домен и Google

Google OAuth для веб-приложений требует точного HTTPS callback и не принимает обычный IP-адрес. Поэтому сначала нужно привязать постоянный поддомен к `genesis-app/public_html`, включить PHP 8.3+ и сертификат, затем создать OAuth-клиент.

Необходимые значения `server/config.php`:

```php
'app_url' => 'https://genesis.example.com',
'google_client_id' => '...',
'google_client_secret' => '...',
'cookie_secure' => true,
```

Разрешённый redirect URI:

```text
https://genesis.example.com/api/auth/google/callback
```

## Синхронизация

Клиент сразу отправляет изменения в API, а при потере сети сохраняет до 2000 последних мутаций в локальной очереди. Планировщик Beget должен запускать `server/cron/sync.php` каждые 5 минут для изменений, сделанных непосредственно в Google Calendar.

Перед каждой выкладкой сохраняются локальная копия репозитория и резервная копия закрытого серверного каталога. Файл SQLite копируется только после checkpoint либо штатным SQLite backup, чтобы не получить несогласованную пару с WAL.
