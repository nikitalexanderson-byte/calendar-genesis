# Фюзис: единый вход GENESIS

24 октября 2026. По прямому уточнению пользователя Фюзис использует общий вход сайта и открывается без дополнительного Google OAuth, отдельного пароля, обязательного recovery code и кнопки блокировки. Это одно личное пространство с разными разделами. Будущие отдельные приложения сейчас не разрабатываются.

Доступ предоставляется ровно трём primary Google-аккаунтам: nikitalexanderson@gmail.com, jurijjlogvinov@gmail.com, picishina@gmail.com. Проверка использует общую серверную сессию и email её владельца, как админ-панель. Старые валидные сессии сайта допускаются сразу. Explicit native channel, linked identity, посторонние и анонимные запросы запрещены. Фюзис не добавлен в Android; GENESIS_DEPLOY_ANDROID=false.

Vault v2 хранит случайный ключ записей, обёрнутый существующим общим ключом аккаунта. Записи остаются зашифрованными. Это доверительная модель общего аккаунта GENESIS, а не отдельное zero-knowledge хранилище. Ключ Фюзиса не сохраняется отдельно в браузере; logout уничтожает memory store. Новые encrypted backups открываются тем же аккаунтом, legacy backups — прежним recovery code.

Данные v1 не удаляются. Пустое старое хранилище автоматически переводится на v2 атомарным rotate с revision/cursor. Для существующих зашифрованных записей прежний пароль/код нужен один раз; CAS rewrap сохраняет исходный ключ и ciphertext всех записей. Ввод неверного пароля ничего не меняет. Сетевой сбой после commit восстанавливается чтением актуального vault; конкурентное создание в другой вкладке не заменяет её ключ.

Новая SVG-иконка — силуэт согнутой руки, общий для меню десктопа, мобильного меню и заголовка. Новый UI runtime и зависимости не добавлялись.

## Проверки

- pnpm install --frozen-lockfile: passed.
- pnpm lint: 0 ошибок, 2 прежних предупреждения img в Mindmap.
- pnpm test: 679 passed, включая перенос ключей, новый браузер, подмену владельца/ключа, конкуренцию вкладок, logout в процессе wrapping и потерю ответа после commit.
- PHP security: 151 checks passed с реальными SQLite/HTTP и конкурирующими процессами. Проверяются primary site sessions, точные адреса, native/linked/anonymous denial, CSRF, owner isolation, CAS, ciphertext preservation и v2 validation.
- GENESIS_MINDMAPS=true pnpm build:beget: passed; largest JS 349968/350000 bytes.
- Дополнительный tsc --noEmit захватывает старые архивные worktrees/work и завершился с их прежними ошибками; в изменённых app/physis и icon-файлах диагностик нет. Основные обязательные проверки выше пройдены.
- Браузер: перенос синтетических legacy данных с неизменным ciphertext, повторное открытие после reload для всех трёх synthetic owners, открытие в чистом browser context без локального ключа, отсутствие дополнительных password/OAuth controls, настройки без управления отдельным паролем. Светлая/тёмная темы × 360/390/768/1440: без горизонтального overflow, кнопки Фюзиса не менее 44px.
- До: output/playwright/physis-unified-before.png. После: output/playwright/physis-unified-after-{light,dark}-{360,390,768,1440}.png; настройки: physis-unified-settings.png. Логи: output/physis-unified-*.log.

Не проверены: физический телефон, screen reader, полный клавиатурный маршрут, настоящий Google OAuth остальных двух тестеров. Их серверный доступ проверен синтетическими primary-сессиями. Прямой SSH не использовался.

## Выпуск и откат

Только существующий deploy.yml после merge. Автоматический runtime backup прежний; SQL migration и ручное изменение production DB не нужны. Code rollback сохраняет v2 data, но старый UI не умеет его открывать: при проблеме предпочтителен forward fix или временное отключение пилота без удаления данных. Database restore автоматически не выполнять. После CI проверяются deploy-meta SHA и health; репозиторий возвращается в Private.
