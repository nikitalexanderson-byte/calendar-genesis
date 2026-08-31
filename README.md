# GENESIS

Production: [https://genesiscalendar.ru](https://genesiscalendar.ru)

GENESIS — устанавливаемый календарь и менеджер жизни: сакральный 360-дневный круг, Артемида и Геката, план дня, проекты и подпроекты, категории, теги, зависимости, повторяющиеся задачи и напоминания Google Calendar.

## Что уже работает

- браузерный интерфейс для десктопа и телефона;
- PWA-установка и стационарный ярлык Windows;
- проекты, подпроекты, категории, теги и связи между задачами;
- повторения: ежедневно, по будням, еженедельно, ежемесячно и ежегодно;
- завершение с фиксацией времени и визуальным вычёркиванием;
- локальная офлайн-копия и очередь изменений до восстановления сети;
- PHP 8.3 API, SQLite и строгая изоляция записей по пользователю;
- Google OAuth 2.0 с PKCE и отдельный календарь `GENESIS` в Google Calendar;
- двусторонняя синхронизация названия, даты, времени, статуса и напоминания;
- Android-модуль Trusted Web Activity с application ID `ru.genesis.calendar`.

## Локальная разработка

Требуется Node.js 22.13 или новее.

```powershell
pnpm install
pnpm dev
pnpm lint
pnpm build
pnpm build:beget
```

Локальная версия хранит данные в браузере. Серверная синхронизация включается через `NEXT_PUBLIC_GENESIS_API_URL` или при Beget-сборке через `GENESIS_API_URL`.

## Сервер

Публичная статика собирается в `dist-beget/public_html`. Сервер находится в `server/`; файл `server/config.php`, SQLite-база, сессии и Google-токены не попадают в Git и должны находиться вне публичной директории.

Основные маршруты API:

- `GET /api/health` — состояние сервиса;
- `GET /api/session` — текущий пользователь и CSRF;
- `GET /api/bootstrap` — задачи, проекты и категории;
- `GET /api/auth/google/start` — начало Google OAuth;
- `PUT|DELETE /api/tasks/{id}` — задача и Google-событие;
- `PUT|DELETE /api/projects/{id}` — проект или подпроект;
- `PUT /api/categories/{id}` — категория;
- `POST /api/workspace/import` — безопасный перенос локального пространства после первого входа.

Подробности: [развёртывание Beget](docs/BEGET-DEPLOYMENT.md) и [Android / Play Market](docs/ANDROID-PLAY-MARKET.md).
