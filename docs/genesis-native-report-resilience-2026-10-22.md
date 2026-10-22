# G4/C6/U: устойчивый и читаемый отчёт Android

Локальное продолжение [аудита](genesis-native-report-resilience-audit-2026-10-22.md), [web-отчёта](genesis-sprint-report-resilience-2026-10-22.md) и нативных названий `3589523`. Подтверждённая сводка и её единица сохраняются при неудачной смене единицы и обрыве ожидающего обновления. Источники, открытая задача и token очищаются; из источников экран возвращается к обзору. Холодный offline не создаёт отчёт. Отзыв доступа, изменение отчёта и закрытие экрана удаляют fallback и отвергают поздний ответ.

Деплой, push, merge, SSH и физические телефоны не использовались. Основное приложение и его аккаунты не очищались; проверки выполнялись в `ru.genesis.calendar.g1qa.debug`.

## Изменения интерфейса и сети

События, состав/оценки и события дня используют общие иконки 48dp/10dp с локализованными доступными именами. Выбор единицы в offline блокируется, уже открытое меню закрывается. Числа сводки и выбранная единица сохраняют читаемый `onSurfaceVariant` при disabled-переходах. Контраст светлого текста данных вырос с 1,75:1 до 5,87:1; в ночной схеме — 6,93:1. Ошибка сети показывается один раз, без ложного сообщения об изменении доступа; status/error получили polite live-region.

Системные status/navigation панели окна согласованы со светлой и тёмной схемами способом из существующего командного отчёта. До правки изолированный Dialog показывал белые значки на светлом и тёмные navigation-значки на тёмном фоне; финальные кадры подтверждают читаемые значки. Это не утверждение о прежнем виде подписанного production `MainActivity`.

Реальные disconnect-прогоны обнаружили ненадёжность одного callback-пути, в том числе при открытом меню. Окно теперь получает callback на main Handler и раз в секунду проверяет локальное состояние соединения. Lifecycle observer запускает проверку только в STARTED, останавливает в фоне и удаляет её при dispose. Проверка не обращается к серверу и не обновляет отчёт после подключения: доступен явный Refresh. Cached aggregate остаётся только в памяти текущего экрана.

## Принятые проверки

- До изменения state: 30 focused JVM cases, три настоящих assertion failures — потеря aggregate при смене единицы, потеря во время pending refresh и неверный sources-pane после NETWORK. Конечный прямой JUnitCore: **31 PASS**, включая clear/late reply при close/revoked/REPORT_CHANGED. Использованы текущие compiled Kotlin/Javac classes с SHA-256; прежняя проблема Gradle worker не объявляется исправленной.
- API28 `emulator-5554` и API35 `emulator-5556`: **по 14 UI PASS, 3 предусмотренных opt-in skips, 0 failures**. Проверены 0, смена единицы, 131 источник, свежая перемещённая архивная задача, partial/missing history, 30 статусов/крупные числа, system Back, смена языка/аккаунта, поздний ответ и отзыв доступа. Новый default case измеряет фактический TextLayoutResult чисел/единицы: обе схемы и все 14 языков, минимум 4,5:1.
- На обоих API **по три последовательных реальных отключения Wi-Fi/data** с заранее открытым меню. Все шесть PASS: sources/menu исчезают, offline aggregate сохраняется, после подключения нет auto-refresh, явный Refresh восстанавливает чтение. Исходные wifi/mobile settings восстановлены в каждом запуске; diagnostics содержат только network/visibility flags.
- Конечный APK: `4928460a9bbbc4023d5a0b069bdfa1e43f254ffaf1404eee016b78a1d46be922`; test APK: `91083a2f4727bf91e9cbdc03c208401b8a4125612aff839c13a03739166888db`. UI, network repeats и конечная capture-матрица используют одинаковые SHA; package, target и packaged project DEX проверены до установки.
- **32 конечных физических screencap PNG**: overview/charts/sources/offline, обе схемы ×360/390/768/1440dp, fontScale1,3, EN. Просмотрены все четыре контактных листа и оригиналы 360 light offline,390 dark offline,768 light charts,1440 dark sources. Before — восемь физических кадров исходного APK, один лист и ключевой оригинал просмотрены. Фактические dp/fontScale записаны; физические PNG включают масштабирование и рамки эмулятора. Display settings полностью восстановлены.
- `assembleDebug`, `assembleDebugAndroidTest`, `compileDebugUnitTestKotlin`, `bundleDebugClassesToRuntimeJar`, `lintDebug`: **BUILD SUCCESSFUL**, exit0. `git diff --check` PASS. Web-код и его ассеты не менялись; предыдущие 496 web tests/gates относятся к неизменённому web-срезу и повторно здесь не запускались.

Основной протокол — `output/native-report-resilience/final-receipt.json`: source/PNG hashes, сборка, baseline/final JVM, оба UI runners, шесть network trials и before/after. Измерения по PNG — `offline-readability-{before,final}-pixels.json` в том же каталоге. Конечные кадры — `after-complete/`; обзор — `contact-after-complete-{360,390,768,1440}-en.png`. Логи — `output/native-report-resilience-network-monitor-build.log`, `native-report-resilience-junit-{before,after}.log`, `native-report-resilience-regression*.{json,log}`, `native-report-network-repeat-emulator-555{4,6}.json` и отдельные trial-файлы.

## Непринятые промежуточные доказательства и границы

Первые 16 `UiDevice` PNG обрезали правый край при wm override; они не заменяют физические before. Первый after JVM использовал старый runtime JAR; его failures отделены от принятого запуска текущих classes. Промежуточный ADB-обрыв завершил только360dp, display восстановлен. Ранние callback-only network timeouts не объявлены PASS по единственному удачному повтору: принят только позднейший одинаковый APK с шестью успешными trials. Серия136 `after-bars` PNG проверила 14-язычные подписи/переходы, но предшествовала исправлению disabled contrast; окончательная цветовая приёмка — 32 `after-complete` PNG. Полная история harness приведена в аудите.

В этом срезе не проверены подписанный авторизованный `MainActivity`, свежий Google OAuth, production/native HTTP, физические жесты и TalkBack. Ранее выполненный изолированный G HTTPS-протокол остаётся отдельным доказательством; он не приписывается этим UI-тестам. Многолетние максимальные истории, полная зависимая B/C/G интеграция и общий разрешённый выпуск остаются в основном плане.

Строгий статус сохраняется: **11/32 принятых ID, 21 частичный ID и отдельно 14 K/U/L**. Локальное исправление отчёта не закрывает G4/C6/U целиком и не разрешает публикацию.
