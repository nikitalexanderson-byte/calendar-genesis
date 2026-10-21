# Видимость изображений григорианского года — 21 октября 2026

По просьбе «картинки бы чуток поярче сделать» слегка усилена видимость существующих сезонных изображений за карточками месяцев григорианского года. Даты сохраняют визуальный приоритет. Независимый [finish review](../output/art-visibility-finish-review.md) завершён с `disposition: ship`.

Изменение опубликовано на [genesiscalendar.com](https://genesiscalendar.com): [PR #238](https://github.com/nikitalexanderson-byte/calendar-genesis/pull/238) объединён коммитом `ccb882e18a2dfd2e41026af0ea753571a9e01e3f`, [workflow 39499555665](https://github.com/nikitalexanderson-byte/calendar-genesis/actions/runs/39499555665) завершился успешно. Публичная проверка подтверждает SHA деплоя, работоспособность API и обе CSS-правки. Новый Android APK не создавался и не публиковался.

## Изменение и границы

В [app/gregorian-season-art.css](../app/gregorian-season-art.css) относительно исходного коммита `master` (`ed5248db90104ee21c95e6245883de30c9a62052`) изменены две декларации:

| Схема | Было | Стало | Результат |
| --- | --- | --- | --- |
| `standart` | Прозрачность изображения `.16` | `.24` | Существующая фотография заметнее за датами. |
| `standart-dark` | Нейтральный тёмный слой `rgb(6 8 10 / .90)` | `rgb(6 8 10 / .84)` | Существующий пейзаж виден яснее через затемнение; opacity псевдоэлемента остаётся `1`. |

Прозрачность изображения шапки месячного экрана остаётся `.14`. Геометрия карточек, footer, ячейки и числа, weekday-маски, солнечные даты, today/selected-маркеры, изображения и их смысловые места не изменены. Выбор региона, месяца и полушария, сакральный и лунный календари, тексты и поведение сохранены. Ассеты не добавлялись, не заменялись и не удалялись.

## Соответствие действующей системе

Правка остаётся внутри **The Gregorian Season Surface Rule** в [DESIGN.md](../DESIGN.md): общий базовый фон всех 12 месяцев в каждой схеме, неброская региональная фотография и нейтральное затемнение тёмных годовых карточек. Существующее правило также присутствует в [.impeccable/design.json](../.impeccable/design.json). Новых примитивов, общего системного правила или визуального мира нет; `PRODUCT.md`, `DESIGN.md` и sidecar сохранены без изменений.

Пять опор системы остаются прежними:

1. Палитра: светлая бумага, глубокие зелёные поверхности, зелёный и золотой GENESIS.
2. Типографика: Source Serif 4 для заголовков, Inter для управления, задач и ввода; существующая шкала сохранена.
3. **The Single Theme Rule**: единая STANDART с дневной и ночной схемами.
4. **The Gregorian Season Surface Rule**: сезонное изображение поддерживает карточку, даты остаются основным содержимым.
5. **The Authored Color Rule** и **The Gregorian Footer Rule**: авторские ассеты и календарные роли сохранены, footer остаётся у нижнего края карточки.

Прямо обнаруженное прежнее расхождение документации оставлено без ремонта: соседний абзац `DESIGN.md` о тёмных weekday-ячейках описывает основу с месячным акцентом (23%) и маску (16%), тогда как существующий scoped override в `app/gregorian-season-art.css` использует основу `#2b3832`, маску (22%) и отдельное значение понедельника (27%). Эти строки уже присутствуют в указанном исходном коммите `master` и данной правкой не меняются. Они не объявлены новым правилом системы; более широкий аудит документации не проводился.

## Сохранённые проверки

Проверены обе схемы на ширинах 360, 390, 768 и 1440 px. В восьми принятых before/after случаях [манифест](../output/art-visibility-manifest.json) подтверждает 12 месяцев, 365 дней, одинаковую вычисленную окраску дат и геометрию карточек, отсутствие горизонтального переполнения. Независимый reviewer открыл все десять текущих оригиналов, оба исходных зимних кадра и восемь дополнительных зимних crops в исходных пикселях для обеих телефонных ширин и схем из `output/art-visibility-review-crops/`; изображения стали умеренно заметнее, числа сохранили приоритет.

| Схема | Ширина viewport | До | После |
| --- | --- | --- | --- |
| `standart` | 360 | [PNG](../output/playwright/art-visibility-before-standart-360.png) | [PNG](../output/playwright/art-visibility-after-standart-360.png) |
| `standart` | 390 | [PNG](../output/playwright/art-visibility-before-standart-390.png) | [PNG](../output/playwright/art-visibility-after-standart-390.png) |
| `standart` | 768 | [PNG](../output/playwright/art-visibility-before-standart-768.png) | [PNG](../output/playwright/art-visibility-after-standart-768.png) |
| `standart` | 1440 | [PNG](../output/playwright/art-visibility-before-standart-1440.png) | [PNG](../output/playwright/art-visibility-after-standart-1440.png) |
| `standart-dark` | 360 | [PNG](../output/playwright/art-visibility-before-standart-dark-360.png) | [PNG](../output/playwright/art-visibility-after-standart-dark-360.png) |
| `standart-dark` | 390 | [PNG](../output/playwright/art-visibility-before-standart-dark-390.png) | [PNG](../output/playwright/art-visibility-after-standart-dark-390.png) |
| `standart-dark` | 768 | [PNG](../output/playwright/art-visibility-before-standart-dark-768.png) | [PNG](../output/playwright/art-visibility-after-standart-dark-768.png) |
| `standart-dark` | 1440 | [PNG](../output/playwright/art-visibility-before-standart-dark-1440.png) | [PNG](../output/playwright/art-visibility-after-standart-dark-1440.png) |

Дополнительно сохранены кадры декабря–февраля при 1440×1000: [светлый до](../output/playwright/art-visibility-before-standart-winter.png) / [после](../output/playwright/art-visibility-after-standart-winter.png), [тёмный до](../output/playwright/art-visibility-before-standart-dark-winter.png) / [после](../output/playwright/art-visibility-after-standart-dark-winter.png). Полностраничные PNG уже viewport на 15 px из-за полосы прокрутки; это учтено в манифесте. Сравнительные листы служат указателями, оригиналы — доказательствами.

| Команда / проверка | Сохранённый результат |
| --- | --- |
| `pnpm install --frozen-lockfile` | [Успешно](../output/art-visibility-install.log). |
| `pnpm lint` | [0 ошибок, 2 прежних предупреждения `img`](../output/art-visibility-lint.log). |
| `pnpm test` | [364 passed, 0 failed, 0 skipped](../output/art-visibility-test.log). |
| `pnpm build:beget` | [Успешно](../output/art-visibility-build.log), проверены публичные документы и offline precache. |
| Один detector для изменённого CSS | [`[]`](../output/art-visibility-detector.json). |

Entry-файлы принятой локальной визуальной проверки: `index-BK1ckNs5.js` и `index-BWVj-xh9.css`. Первая попытка after обслуживала закешированный baseline и исключена: `art-visibility-after-stale-fixture.log` не является доказательством текущего результата. Принятые случаи проверяют `.24` / `.84`.

SHA256 CSS принятой локальной проверки: `44070c0ee11b28fbc31a133bf27fdcc8918d1f08067f1489dd680e3fa97fa91c`. При исходном документировании все 20 PNG проверены по SHA256 и размерам из манифеста, все шесть source/context хешей совпали. После переключения рабочей ветки Git нормализовал окончания строк CSS: его текущий raw-хеш отличается, но LF-нормализованное содержимое совпадает с опубликованным Git blob; остальные пять source/context хешей остаются прежними. Подробности и итог проверки записаны в [documentation check](../output/art-visibility-documentation-check.md).

## Подтверждение публикации

[Результат Actions](../output/art-visibility-actions-result.json) подтверждает `completed` / `success` для SHA `ccb882e18a2dfd2e41026af0ea753571a9e01e3f`. Деплой выполнен 21 октября 2026 в 00:28:40 по Москве (`2026-10-20T21:28:40Z`); [публичная проверка](../output/art-visibility-production-check.json) сохранена в 00:32:02 по Москве (`2026-10-20T21:32:02.981Z`). Временные ошибки read-only запросов GitHub CLI были сетевыми; итоговый статус подтверждён через подключённый GitHub.

- `/deploy-meta.json` содержит тот же merge SHA и run ID `39499555665`; `/api/health` возвращает `ok: true`.
- Опубликованный CSS `/assets/index-B56ve_5G.css` отличается именем от локального визуального entry. Прямая проверка подтверждает обе scoped величины `.24` и `.84`; SHA256 опубликованного CSS — `da8db5a052765f51587528895b026939277a91c3bca0d1e550504ce73428c292`.
- Успешно проверены HTTP-ответы 90 текущих JS/CSS-файлов, всего 92 текущих и сохранённых файлов.
- Android-релиз остаётся `2.9.0`, code `95`; SHA256 прежнего APK — `a04a3b8c85d6b3977fc634f7f3779b5cac3ff93eddc2bd27ac006b2c50449243`.

## Непроверенные состояния и публикация

Не проверялись Safari и Firefox, физические устройства, screen reader, каждый язык и отдельный визуальный проход по всем 72 сочетаниям региона/месяца. У baseline остались визуально непроверенными области полностраничных PNG вне зимних кадров и дополнительных телефонных crops; хеши и размеры всех оригиналов проверены. Документирование опирается на сохранённые доказательства и независимый review; browser, detector и сборки повторно не запускались.

Авторизованный визуальный просмотр production после публикации не выполнялся; приведённая выше публичная проверка подтверждает метаданные деплоя, API, CSS и HTTP-доступность файлов. Новый APK отсутствует; native Android-проверки этой правки не выполнялись. SSH не использовался. Миграций, ручных изменений production-БД и server-only данных не было.
