# GENESIS: UI и надёжность загрузки, 22 октября 2026

Срез продолжает E/F/A4 и отдельные замечания пользователя. Проверки выполнялись inline, без субагентов. Публикация Android2.9.3/98 и production walkthrough ещё не завершены; основной промпт и21 частичный функциональный ID не объявляются закрытыми.

## Аудит и изменения

- Изображение «Выход — Эрос и Психея» сохранено в исходном PNG/WebP. Публичная доставка соседнего символа воспроизводила временный502; это возможная причина пользовательского скриншота, а не доказанное объяснение именно того запроса. Все13 SVG символов используют общий bounded retry:400/1200ms, максимум3 запроса. Service worker не заменяет хороший image cache ошибочным/HTML ответом и использует canonical cached image для offline retry с query. Оригиналы не заменялись.
- Сообщения: постоянная иконка верхней панели; без открепления; badge только count>0. Desktop-окно перемещается целиком, меняет размер, ограничивается viewport и сохраняет размеры по аккаунту на устройстве. Есть клавиатурные стрелки/Home/Escape и возврат фокуса. Исчезновение последнего непрочитанного не закрывает окно. На mobile пустое окно280px; resize/drag отсутствуют. Открытие и геометрия не маркируют сообщения прочитанными.
- Desktop priority: метка находится справа над таймером; ровно одна видимая метка, прежняя mobile-компоновка сохранена.
- Android: общий control corner10dp/min48dp, единая прямоугольная AffairsIconButton, отделённая форма карточек16dp. Recovery metadata сгруппированы; restore/retry/edit используют общие icon actions. Выбор стороны конфликта сохраняет короткие явные подписи и vertical gaps.
- Большие редакторы не упираются в localStorage: encrypted IndexedDB transactional CAS/limit20; старые записи доступны до явного восстановления. Sign-out очищает store и запрещает delayed writers. Ошибка уведомления вкладок не меняет результат уже durable commit.

## Проверки и материалы

- Frozen install, lint0errors/2 прежних image warnings,457 web tests,14 языков, build:beget PASS: `output/a4-ui-final-*.log`.
-56 browser message checks PASS;8 after PNG/STANDART light/dark/360/390/768/1440: `output/a4-message-window-compact.log`, `output/playwright/a4-messages-final-*.png`. Первоначальный reload assertion ожидал ответ старого patch в сериализованной очереди; harness теперь ждёт сохранение итоговых координат через session и повторно проходит reload.
-2 priority checks и8 PNG PASS: `output/a4-priority-final.log`, `output/playwright/a4-priority-final-*.png`; right edges отличаются меньше1px.
-3 symbol checks и8 PNG PASS:502→retry, все13 PNG decode256×256, постоянный отказ останавливается после3 запросов: `output/a4-symbol-recovery.log`, `output/playwright/a4-symbol-final-*.png`. SW recovery отдельно покрыт обязательными tests.
-59 текущих UI editor/replay checks,16 прямых IDB checks,2 live cross-tab checks,230-task large cold recovery и legacy numeric apply PASS; детали в [A4 receipt](genesis-a4-editor-recovery-2026-10-22.md). До: `output/playwright/a4-template-before-*.png`, `a4-ux-before-*.png`; после: `a4-template-final-*.png`, `a4-automation-final-*.png`, `a4-template-apply-final-*.png`. Скриншоты и output остаются локальными, вне Git.
-13/13 native planning functional cases на каждом API28/API35/Samsung PASS: `output/a4-native/final/*/planning-ux-functional.log`. Native conflict2/2 на каждом устройстве и9 PNG, E/F source/font1.3 в обеих темах на Samsung/tablet проверены до последних замен только радиуса.
- Финальная production-origin native JVM/lint/R8 проверка после последних corner changes PASS:723 cases/715 executed/8 opt-in skips/0 failures, `output/a4-ui-publish-native.log`.68-holder ART на трёх устройствах PASS, `output/a4-ui-publish-art.log`, `output/a4-ux-release-runtime/receipt.json`. Asset byte parity552 public originals/1 native-only/102 catalogs PASS, `output/a4-ui-publish-assets.log`.

## Непроверенные состояния

Tablet restore PNG остаются пустыми при успешных semantics/bounds и повторном bounded capture; визуальная приёмка этих кадров не заявляется. Финальные signed98 startup/upgrade, Google-вход с нуля, два настоящих аккаунта и полный production walkthrough ещё не подтверждены. Реальные версии Samsung/site сохранены; сторона конфликта автоматически не выбиралась. Исторические TypeScript diagnostics не исправлялись и tsc PASS не заявляется.

SSH, чтение токенов/приватной production-БД и ручное изменение production-БД не использовались.
