# G2/native: оценки в карточке общей задачи

Основание — [предварительный аудит](genesis-native-task-estimates-audit-2026-10-19.md) после опубликованного G2/web в PR #207. Этот срез реализует одну нативную карточку;21 функциональный ID полного промпта и14 общих K/U/L остаются открытыми. Полный native backlog/sprints/workflow/reports этим экраном не объявляется завершённым.

## Поведение

В существующую карточку добавлены независимые story points и часы. Ноль отличается от отсутствия; пустое поле отправляется как null, нетронутое не входит в PATCH. Числа допускают точку/запятую, максимум1000000 и2 десятичных знака. Незавершённый или неправильный ввод сохраняется и блокирует отправку. На телефоне поля идут вертикально, на широком экране — рядом. Используются прежние Material3/Universal UI и общий14-язычный planning-каталог без второй копии.

В существующем SavedState сохраняются raw input, base values и touched flags. При явном обновлении после конфликта изменённое поле сохраняется, соседнее нетронутое получает актуальную оценку. Есть возврат к сохранённым оценкам и предупреждение о несохранённых изменениях. При выключенном планировании уже записанные оценки остаются читаемыми. Отзыв editTasks и отключение planning сохраняют предложенное значение, но не разрешают отправку. Явные серверные permissions имеют приоритет над legacy role; это не полная C6/native-реализация.

Воспроизведён и исправлен старый дефект: короткий pending-ответ очищал название карточки. Теперь оптимистическая задача строится из исходной задачи и отправленных полей; введённое название и оценки сохраняются. Pending/error команда блокирует новую команду той же задачи. Повторная отправка использует исходные body и UUID из существующей зашифрованной очереди. Неизвестный5xx/protocol/storage результат не считается подтверждённым отказом; запись удаляется только после проверки идентичности task/project/revision и отсутствия pending placeholder. Проверка применяется к create/update/move, фоновой отправке и явному Retry.

## Проверки

297 JVM tests прошли, приложение и test APK собраны offline с отдельным QA application ID `ru.genesis.calendar.g2qa.debug`. Чистый прогон15 instrumentation tests прошёл дважды:0/null/no-op, dirty-only PATCH, saved-state restore, конфликт/rebase, planning off, отзыв edit, viewer, явные permissions, pending-title, прежний request body при повторном отказе, поиск/фильтры и2 реальных encrypted-store сценария.

Для visual QA используются принадлежащие этому запуску API28 phone и API35 tablet; release/default debug profile не очищается. Сохранены24 before PNG и42 after PNG плюс4 Japanese/error/font130 PNG. Первый общий просмотр формы/очереди/клавиатуры/ошибки обнаружил два дефекта fixture: locale-тест не устанавливал Surface/LocalContentColor и не ждал завершения системной IME-анимации. Исправлена только тестовая оболочка и ожидание IME; production-компоненты из-за этих снимков не перекрашивались. Один подтверждающий проход завершился успешно:15 tests, обе схемы ×360/390/768/1440dp,14 языков со шрифтом130% на390/768dp. Исправленные снимки ошибки и закрытой клавиатуры просмотрены; дальнейшие visual-итерации не выполнялись.

Доказательства: `output/native-estimates-pending-before.log`, `output/native-estimates-isolated-recovery-build.log`, `output/native-estimates-confirm-build.log`, `output/native-estimates-functional-final.log`, `output/native-estimates-acceptance-{run,confirm}.log`, `output/native-estimates-i18n.log`; PNG в `output/playwright/native-estimates-{before,after}-*.png`. Первые проблемные fixture-снимки сохранены как `native-estimates-pass1-*`. Обязательные web install/lint/352 tests/build также прошли на этом исходном коде вместе с правкой desktop actions. Публикация исходников фиксируется отдельно после штатного workflow.

## Непроверенные состояния и выпуск

Instrumentation UI использует SharedWorkspaceGateway fixture. Живой native→HTTP→PHP с Google-аккаунтом, физические устройства, полноценный durable unsubmitted cold-start journal и вся межэкранная C/G-интеграция здесь не подтверждены. Уже отправленные команды сохраняются действующим encrypted outbox; SavedState незавершённого ввода не выдаётся за отдельную cold-start библиотеку.

API/SQL/зависимости/writer protocol не менялись. Этот исходный код готовится к следующему общему Android-выпуску; официальный APK остаётся2.9.0/95, protocol6 и GENESIS_DEPLOY_ANDROID=false. E4/F/protocol7 из отдельной ветки автоматически не объединяются. Ручной SSH и изменения production-БД не использовались.
