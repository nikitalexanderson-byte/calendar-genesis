# G1–G4: завершающий проход по основному промпту

Основание — свежий `origin/master` `54e57c0e31f2f3a660a4f1093c16bb706582dfaf`. PR #233 и deploy `39413334794` завершены успешно; production SHA/health, 90 текущих и 91 текущих+сохранённых JS/CSS подтверждены. Web-перетаскивание прошло независимые finish review и documentation check. Публичный Android остаётся 2.9.0/95. SSH не использовался.

Актуальный порядок пользователя: G1–G4 → C1–C6 → B1/B2/B4/B5/B7, затем деплой; после него E4/E5 → F1–F3 → A4 и следующий деплой. Предыдущий проверенный срез native C2 сохранён отдельным локальным commit `0d7883158fb3d4822c34c2124f247a1cfbdd9110` в `codex/native-automations`; текущая ветка G не содержит этот срез. Чужой untracked `.impeccable/review/` сохранён.

## Источник требований и фактический остаток

G1–G4 определены в `genesis-improvements-requirements-2026-10-14.md`; для каждого действует `genesis-universal-ux-acceptance-2026-10-19.md`. Реализованные web/native экраны и серверные контракты не переписываются ради новой структуры отчёта.

| ID | Реализовано | Что проверяется до закрытия |
|---|---|---|
| G1 | Backlog, планируемый/активный/завершённый спринт, даты, состав, явный carry-over, native journal и replay; настоящий HTTPS/PHP lifecycle и lost-reply replay | Совместимость всей прежней очереди и общий выпуск; зависимые B/C пользовательские сценарии |
| G2 | Независимые points/часы и 0/null, проектная шкала, суммы/исполнители, карточка и история; native PATCH, legacy-shaped preservation и отчёты настоящего API | Нативные пользовательские пути шаблонов/обмена данными и общий выпуск |
| G3 | Серверные переходы/поля/роли/согласование/WIP; web/native editor, repair/history и durable commands; корректная phone/font-матрица, native HTTPS WIP/ACL и B/C server gates | Сквозные native B/C пользовательские пути и общий выпуск |
| G4 | Настоящие события, план/факт/burndown/CFD/WIP, три единицы, источники; HTTPS report/check/sources, 100+31, REPORT_CHANGED и отзыв доступа | Общий app flow/выпуск, многолетние максимальные истории и зависимые native B/C пути |

Не добавляется холодный дисковый кеш отчёта: действующий контракт G4 явно оставляет только помеченный агрегат открытого экрана в памяти, очищая token/источники/задачу при offline. Это осознанное ограничение приватности, а не отсутствующий экран.

## Настоящий native HTTPS/PHP и runtime — 20 октября

Новый opt-in `NativePlanningHttpsIntegrationTest` проходит через production `AuthSessionClient`, его whitelist, encrypted Keystore jar, native parsers и PHP API изолированной SQLite. Используется отдельный QA package `ru.genesis.calendar.ghttps.debug`, HTTPS origin только `https://localhost:4443` и синтетические editor/viewer. Временное доверие ограничено переданным loopback certificate, стандартная hostname verification сохранена и TLS factory восстанавливается. Секреты не входят в логи, исходники или corpus; production TLS не менялся.

На API28 и API35 каждый runner завершился `OK (4 tests)`, все четыре выполнены:

- Связанный G1–G4 lifecycle: явное включение, A/B, 0/null и независимые единицы, суммы по исполнителю, legacy-shaped title PATCH, запуск, WIP1/typed error без частичной записи, workflow history, завершение с backlog/следующим спринтом, три единицы отчёта/check/sources и сохранение points после смены системы.
- Потеря уже committed HTTPS settings reply: настоящий encrypted `PlanningDraftStore` и `PlanningDraftService` переоткрываются вместе с клиентом; сохраняются pending attempts1 и точная команда; replay возвращает один receipt, повтор received не обращается к сети, stale revision отклоняется. Это проверяет planning journal, а не всю task outbox/старую очередь.
- 131 задача: native merge100+31, три календаря и Gregorian March context, все report units и sources100+31; `unestimated` отделено от unknown history и известного нуля.
- Viewer читает planning/workflow/report/sources, но не меняет настройки, workflow или оценку. После удаления из только этого синтетического проекта все шесть чтений, включая прежний report token и task source, отвечают404. Owner продолжает видеть исходную оценку.

Сохранены `output/g-https-api28.log`, `output/g-https-api35.log`, `output/g-https-test-build.log` и отдельные APK. SHA256 main QA APK — `074081f6dd9dd72b5acde3875b3528e6af4f162a7d3ec6f346dfb06437bafd6f`; финального test APK — `d534fb78eee23e50723534b67e187bf37904aa8089e884aaa76930c1b55e8cf5`. Транспортный fixture слушает только loopback, не пишет credential/body и умеет терять уже committed ответ. Его runtime certificate/key остаются в ignored output.

Повторно прошли `shared-planning`, `shared-workflows` с `workflow-integrations`, `shared-sprint-reports`, `shared-sprint-flow-model`, `planning-migration` и `workflows-migration`. Это подтверждает действующие bulk/C1 template/C2 worker/C5 import WIP gates, атомарный rollback, текущие ACL, честные пропуски истории и additive/repeated/rollback/backup migration contract. Только синтетические пространства; production БД не затрагивалась.

Default JVM/release сборка успешна: 522 зарегистрированных cases, 517 выполненных, пять ожидаемых opt-in HTTP assumptions, ноль failures/errors; R8/lintVital/assembleRelease успешны. Отдельный unsigned APK SHA256 `dca1c8deaceeb60e3232d0ab81f5894b636ba50dcf47a5c066d709a2a49bd443`. Через `GenesisDexVerifier` на обоих API реально инициализированы15 mapped class holders, включая planning/workflow/report, lifecycle/protocol/journals и основные экраны. Логи `output/g-release-runtime-emulator-5554.log` / `5556.log` не заменяют старт подписанного APK.

Штатный build-only `prepare-relocation.yml` run `39418554256` запущен с master `54e57c0e31f2f3a660a4f1093c16bb706582dfaf` для `https://genesiscalendar.com`; результат и startup будут записаны после завершения. Это не deploy и не изменение публичного Android95. Продуктовый код G в этом проходе не менялся: исправлена доказательность UI harness и добавлена реальная транспортная приёмка. Реальный Google-вход/физический Samsung и полный общий выпуск остаются внешней/финальной приёмкой; разработка зависимых native C/B сценариев продолжается без повторного запроса пользователя. SSH не использовался.

## Первый узкий шаг

Первый шаг выполнен в пределах workflow capture harness: удалена внешняя симуляция `LocalDensity`, а плотность и масштаб шрифта подтверждаются через `TextLayoutResult` внутри отдельного Android Dialog. Harness использует реальные `wm`, density и системный fontScale; проверяет ширину с допуском ±1dp и fontScale с допуском .01. Макет, строки, токены и поведение продукта не изменены. Обе схемы сняты на реальных 360/390/768/1440dp, а существенные формы — на 390/768dp для 14 языков при fontScale 1.3. Originals сохранены отдельно от прежних кадров с неподтверждённой геометрией. Результат и границы приёмки зафиксированы ниже.

Затем добавить изолированную Android → HTTPS → локальный PHP приёмку через настоящий `AuthSessionClient`, не подменяя gateway фиктивным успехом. Только синтетический аккаунт и отдельный QA application ID; временный сертификат/сессия остаются в ignored test runtime и памяти. Это не подтверждение реального Google-входа. После транспортного прохода — связанный G1–G4 сценарий и недостающие B/C интеграции.

Физический Samsung сейчас отсутствует в `adb devices`; доступны два QA-эмулятора. Реальный Google-вход, физические жесты/TalkBack и официальный подписанный выпуск не объявляются выполненными по локальным fixtures. Недоступная внешняя проверка фиксируется отдельно; независимая реализация продолжается по пользовательской очереди. Пока остаются 21 частичный ID и 14 K/U/L.

### G3: завершённый пакет доказательств workflow capture

Завершены только исправление harness и обновление визуальных доказательств. [Manifest](../output/g-workflow-system-initial-manifest.json) содержит 144 originals в `output/g-workflow-system/initial`, 12 обзорных листов и 144 записи фактических плотности/ширины/шрифта внутри Dialog. 32 базовых кадра покрывают четыре ширины, обе схемы и read/fields/transitions/history при fontScale 1.0; ещё 112 — fields/transitions, обе схемы, 390/768dp и 14 языков при fontScale 1.3. Фактические ширины — 360, 390.28442, 768 и 1439.5dp, отклонение не больше .5dp. Все 12 листов открыты при сборке и независимом review. Восемь старых кадров в `output/g-workflow-before` сохранены как before, без приёмки прежних подписей 360dp.

Все шесть capture-запусков завершились `OK (1 test)`. Functional-логи API28 и API35 каждый подтверждают девять выполненных UI-кейсов и один явный capture-only assumption; итог runner — `OK (10 tests)`. Это fixture-проверки, а не Android→HTTPS→PHP. Сохранённые отдельно `output/g-workflow-system-app.apk` и `output/g-workflow-system-tests.apk` совпали по SHA-256 с обеими before-записями; последующие сборки не подменяют эти бинарники. Названия проектов и статусов остаются пользовательскими данными при смене языка.

Независимый [finish review](../output/g-workflow-system-finish-review.md) дал `ship` без material fixes в пределах исправления harness и этого evidence refresh. [Documentation check](../output/g-workflow-system-documentation-check.md) сверил доказательства и сохранил `PRODUCT.md`, `DESIGN.md` и `.impeccable/design.json` побайтно: новый компонент, ассет, UI-библиотека или изменение системы не вводились. Отдельно отмечено существовавшее расхождение web-sidecar о положении «Хаоса»; в этой задаче оно не исправлялось.

Пакет не закрывает G3 целиком, G1–G4, 21 частичный ID или 14 K/U/L. Отдельная HTTPS-приёмка, связанные G1–G4/B/C сценарии, реальный Google-вход/синхронизация, подписанный выпуск и production `MainActivity` остаются за его границами. Также не подтверждены физические жесты и производительность, predictive/system Back, TalkBack, клавиатура/IME, все нижние поля и loading/error/conflict состояния на всей языковой матрице. Белые системные значки в светлых кадрах принадлежат `PagerTestActivity` и не подтверждают contrast/insets production activity. Browser-матрица web не выполнялась; для этого native-пакета web detector неприменим. SSH не использовался.
