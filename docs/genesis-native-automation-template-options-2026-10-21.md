# C2: чтение параметров шаблона в управлении правилами — 21 октября2026

Следующий срез после [исправления IME формы C1](genesis-native-template-keyboard-2026-10-21.md). Полный C2 и общий остаток21 ID/14 K/U/L не закрыты.

## Короткий аудит и решение

Конструктор умеет сохранять типизированные template options через SharedAutomationEditorProtocol и показывает применение через SharedTemplateApplyForm. Экран управления получает только название шаблона. SharedAutomationPresentation считает читаемыми лишь пустые options и защищённо блокирует enable/retry остальных правил, направляя в конструктор. Это оставляет неполным обычный сценарий управления уже настроенным правилом.

Нужна привязанная к текущему правилу, аккаунтному composition scope и актуальному проекту проверка сохранённых параметров. Переиспользовать контракт нормализации options, чтение полного source и настоящий preview без применения. Показать имеющуюся форму параметров в read-only раскрытии действия, включая transfer flags, mappings, typed values и preview notices/blockers. Не создавать второй редактор и не переводить пользовательский текст.

Разрешать enable/retry лишь после чтения всех поддерживаемых параметров и успешного preview. Неизвестные параметры, недоступный источник, устаревшая ревизия, неправильная область и blocker должны сохранять защитный отказ. Выключение/удаление/восстановление отключённого правила остаются доступными по прежним правилам. Не менять неизменяемый journal для уже отправленной команды и не заменять operationId при потере ответа.

Любое переключение/закрытие/отзыв доступа очищает прочитанные источники и preview; поздний ответ не должен вернуть их в другой экран. Календарь и базовый день примера берутся из правила и его часового пояса, независимо от календаря отображения.

THESIS: параметры сохранённого правила понятны до его включения и повторного запуска. OWN-WORLD: существующие STANDART/Material/Affairs, light/dark и48dp. STORY: открыть правило → раскрыть создание из шаблона → прочитать параметры/ограничения → выполнить подтверждённую управляющую команду. FIRST VIEWPORT: текущая библиотека и карточка сохраняются, объёмные параметры раскрываются по месту. FORM: code-led расширение одного существующего экрана, без нового мира/библиотеки/ассетов.

Проверки: пустые и непустые options, false/0/null, переназначения и удалённые ссылки, недоступный источник, старая схема/future keys, изменение правила/проекта между чтениями, отмена поздних ответов, read-only и lost-reply replay. Затем живой локальный HTTPS/PHP путь, обе темы/классы устройств и приёмка переведённых существующих controls. Миграции и production-БД изменения не нужны; SSH не используется.

## Реализация и текущие проверки

C1 checkpoint сохранён в GitHub как `670824a`; продолжение — `codex/native-automation-parameters`. Добавлен отдельный in-memory reader source/preview и read-only раскрытие существующей формы. Непустые options проходят прежний typed protocol, область проекта/пространства и revision; canApply/blockers определяют доступность enable/retry. Неизвестные поля не нормализуются молча. Снятие/закрытие экрана очищает данные и отменяет поздние ответы. Типы0/false/null и правило часового пояса покрыты тестами. Management journal не менялся.

Focused JVM:20 случаев пройдены (9 новых,11 прежних state cases), включая lost reply с тем же command/operationId, недоступный source, stale revision, future keys и поздний preview. В первой попытке тестовый transport неверно называл expectedRevision; исправлен только fixture, затем cases прошли.

Реальный HTTPS UI выявил прежнюю ошибку открытия карточки: choose запускался из CoroutineScope списка. При переключении на карточку список удалялся из composition и отменял свой сетевой запрос; чистые синхронные mocks этого не выявляли. Прямой preflight state через PHP читает правило и preview успешно, UI до фикса останавливался после project read. Выбор правила перенесён в scope всего SharedAutomationsScreen. Новый device regression с задержанным project read уже проходит. Эта правка не отменяет защиту при закрытии/смене аккаунта.

Native HTTPS форма теперь открывается и показывает сохранённые title/assignee flag как читаемые факты. Fixed confirm/retry/done не требуют Scroll SemanticsAction. Реальный сценарий подтверждает включение правила, потерю ответа после записи сервером, recreation и повтор той же команды; применение шаблона и создание задач в этом сценарии отсутствуют.

Дополнительные 2 JVM-проверки подтверждают безопасную обработку ошибок mapping/reference и сетевых/ACL-ошибок. При несовместимой конфигурации сохраняются карточка, редактирование и выключение; включение/retry остаются заблокированными. При сети или отзыве прав живые сведения очищаются. Focused suite теперь 22/22, включая 11 inspection и 11 существующих state cases.

Языковой HTTPS-прогон выявил ещё один дефект: после RU → EN загруженная страница правил не появлялась в библиотеке, хотя worker/project уже отрисованы. Простое ожидание нового keyed composition не устранило сбой. Передача загруженной page непосредственно в AutomationLibrary устранила воспроизводимый сценарий; полная съёмка 14 языков × 2 темы с font130 прошла (84 PNG). Отдельный mock с задержанными project/list reads прошёл и до этой правки, поэтому сам по себе не доказывает воспроизведение дефекта. Визуальный проход нашёл перенос последней буквы немецкого заголовка: на узких экранах заголовок и ряд кнопок разнесены. Последняя физическая съёмка подтверждает целое слово, читаемые значения, отдельные 48dp действия и отсутствие бокового обрезания.

При удалении самой библиотеки на время загрузки потребовалось также вынести из её scope запросы фильтра и пагинации. Два существующих UI-сценария усилены настоящим suspension на чтении project/list: оба воспроизвели отмену запроса до правки и прошли после (`native-automation-parameters-library-lifecycle-{repro,fixed}-api28.log`). Это функциональная коррекция незавершённого кандидата, без изменения компоновки. Закрытие всего экрана по-прежнему отменяет эти запросы.

## Достоверность изображений и незавершённая проверка

Первоначальные C2 PNG через UiAutomation.takeScreenshot на API28 были обрезаны при логическом wm size внутри физического дисплея; их нельзя использовать как доказательство обрезания интерфейса. Проверка screencap показала полный физический кадр 1080×1920. Восстановлены physical baseline на четырёх ширинах и съёмка after, для каждой сохранены происхождение и SHA. Новые captures используют screencap-physical-display, проверяют логические bounds экрана и целую 48dp кнопку закрытия. C1 helper уже делал это корректно и не менялся.

Исторические C1/C2 проверки: API28 24 случая и 2 дополнительных replay прошли; API35 полный прогон имел timeout C1 на ожидании dep:51, затем focused C1 + реальный C2 прошли 2/2. Ранний диагностический APK также имел SlotWriter exception на teardown; причина не установлена. Эти логи сохранены и не объявлены исправленными последующими успешными повторами. ADB daemon дважды останавливался при переносе/настройке capture; это отдельный сбой harness. Повторяются лишь идемпотентные чтения/настройки, а не отправленная instrumentation-команда.

При финальном 1440/API35 запуске instrumentation процесс завершился до начала теста. Системный exit-info подтверждает ANR `failed to complete startup`; crash-buffer не содержит нового Kotlin/Compose fatal. Отдельный mock-only запуск также не дошёл до тестов. Перезапущен только проверенный QA AVD `GenesisMatrix_API35_medium_tablet`, без очистки userdata. После этого все четыре профиля последней сборки и языковая съёмка прошли; причина startup ANR не объявляется исправленной в продукте. Диагностика сохранена как `output/native-automation-parameters-final-api35-{exit-info,system,crash}.log`.

## Последняя визуальная матрица

Реестр `output/native-automation-parameters/manifest-final.json`: **16 baseline + 24 after/base + 84 after/font130 = 124** PNG. After/base — 360/390/API28 и 768/1440/API35, обе схемы, top/options/preview. After/font130 — 390/API28, все14 языков, обе схемы и те же три положения. Все after привязаны к SHA последнего debug/test APK; это не старые cropped изображения. Отдельно просмотрены baseline360 light selection, after360 dark top, after1440 light options, after768 dark preview и окончательные font130 DE dark options / ZH light options / JA dark preview. Остальные оригиналы проверены по PNG, SHA, происхождению и bounds; индивидуальный просмотр всех124 не заявляется.

Inline finish review сохранён в `.impeccable/review/native-automation-parameters/finish-review.md`: `ship` относится только к локальному C2 disclosure и не является независимой или полной приёмкой C2.

## Финальные проверки исходников

- **622 JVM cases: 617 выполнены, 5 предусмотренных opt-in skips, 0 failures/errors.** Оба настоящих HTTP opt-in C1/C2 включены. `output/native-automation-parameters-accepted-jvm.log`. Один предыдущий запуск имел ошибку самого PowerShell-вызова без пути `GENESIS_AUTOMATIONS_HTTP_TARGET`; после исправления полного пути весь набор выполнен заново, затем ещё раз на последнем source.
- **API28 и API35: по25 C1/C2 functional/HTTPS случаев**, затем ещё по2 отдельных C2 lost-reply/recreation повтора. Итого три последовательных успешных C2 сценария на каждом устройстве. Логи: `output/native-automation-parameters-final/`. Отдельные два delayed filter/page случая также имеют before-fail / after-pass доказательство. Старые timeout/teardown/startup логи сохранены отдельно.
- **Native lint и unsigned production-origin release/R8 прошли на последнем source.** Логи `output/native-automation-parameters-accepted-{lint,release}.log`;18 R8 holders, включая новый inspection, инициализированы ART на обеих API. `output/native-automation-parameters-runtime/receipt.json` содержит SHA APK/mapping; это не установка или signed startup.
- **Frozen pnpm install, lint, 364/364 tests с аудитами14 языков и build:beget прошли.** Lint:0 errors/2 прежних img warnings. Build подтверждает90 обязательных entry assets и203 visual assets. Логи `output/native-automation-parameters-final-web-{install,lint,test,build}.log`.
- Debug, test, unsigned release и R8 mapping сохранены в `output/native-automation-parameters/artifacts/` с `sha256.json`. Registry и capture driver не принимают старые обрезанные PNG; повтор adb ограничен идемпотентными командами. Canonical PRODUCT/DESIGN/sidecar не менялись.

Перед сохранением checkpoint повторно получен origin/master: `438f94149cae474ac1cd38ccec20f16608821ec0`; публичные deploy-meta и API health совпадают с этим опубликованным состоянием, health ok. Это read-only проверка существующего production, а не приёмка боевого выполнения C2. Следующий срез — [C3 definitions/history/archive](genesis-native-field-management-2026-10-21.md).

Непроверенные состояния: подписанный production startup и новый публичный APK; физические Samsung/Realme; Google-обмен между аккаунтами; боевое исполнение автоматизаций/конкурентный worker/его аварийное восстановление; TalkBack и аппаратная клавиатура; C2 landscape; font130 вне390dp; полная визуальная матрица всех вариантов mappings/values/errors. Браузерный UI не менялся, нативные captures не подменяют browser acceptance. C1 IME matrix из отдельного аудита не расширяется автоматически на C2.

Полный C2,21 ID и14 K/U/L не закрыты; публикации нет. В production ничего не менялось, SSH не использовался.
