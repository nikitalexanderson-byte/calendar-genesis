# Снимки beta.3

Все новые изображения используют синтетическое debug-пространство. Это нативные viewport-снимки Compose основного окна; они не подтверждают системные insets/IME, физический планшет или реальные серверные данные. Ширина 1440dp моделируется LocalDensity/LocalConfiguration на эмуляторе, поэтому фактический PNG может быть узким и очень высоким. Базовый системный font_scale остаётся 1.3; font100/font130 обозначают Compose viewport.

Исходные пользовательские фото просмотрены локально и не публикуются. Сохранённые кадры beta.2 остаются в [предыдущем индексе](../3.0-review2/screenshots.md); числа задач между fixture-снимками не сравниваются. Первый beta.3 checkpoint source: `84e181ab3a8aac9e475930024bdd4c30cb88f669`; debug SHA-256: `f4b056a5835801afc43b5a9e2a579a126d387fd562d481df34854b45b507a254`.

| Поверхность | Светлая, 390dp | Тёмная, 390dp |
| --- | --- | --- |
| Сегодня, фоновая картинка | [кадр](after/390-light-font100-portrait-today-profane-art.png) | [кадр](after/390-dark-font100-portrait-today-profane-art.png) |
| Меню, круглый логотип и постоянные подписи | [кадр](after/390-light-font100-portrait-drawer-always-labels.png) | [кадр](after/390-dark-font100-portrait-drawer-always-labels.png) |
| Описание сакрального дня без второй кнопки | [кадр](after/390-light-font100-portrait-today-sacred-description.png) | [кадр](after/390-dark-font100-portrait-today-sacred-description.png) |
| Автоматический блок пяты/стихии/смысла внизу | [кадр](after/390-light-font100-portrait-sacred-knowledge-bottom.png) | [кадр](after/390-dark-font100-portrait-sacred-knowledge-bottom.png) |
| Месяц с открытой информацией | [кадр](after/390-light-font100-portrait-calendar-lunar-month.png) | [кадр](after/390-dark-font100-portrait-calendar-lunar-month.png) |
| Год без плашки календаря | [кадр](after/390-light-font100-portrait-calendar-lunar-year.png) | [кадр](after/390-dark-font100-portrait-calendar-lunar-year.png) |
| Оракул → Теокиклос | [кадр](after/390-light-font100-portrait-oracle-theokyklos.png) | [кадр](after/390-dark-font100-portrait-oracle-theokyklos.png) |
| Оракул → Стойхейон | [кадр](after/390-light-font100-portrait-oracle-stoicheion.png) | [кадр](after/390-dark-font100-portrait-oracle-stoicheion.png) |

Дополнительно сохранены [Сегодня 360dp/font1.3](after/360-light-font130-portrait-today-profane-art.png), [меню 360dp/font1.3](after/360-dark-font130-portrait-drawer-always-labels.png), [Сегодня 1440dp](after/1440-light-font100-portrait-today-profane-art.png) и [месяц 1440dp](after/1440-dark-font100-portrait-calendar-lunar-month.png).

[Матрица 10 случаев](matrix.json), [sidecars с runId/version](runs/) и [логи](logs/) связывают подтверждающие кадры с checkpoint. Первая визуальная инспекция выявила повтор гражданской даты в раскрытой карточке; он устранён одним пакетом, затем выполнен подтверждающий проход. Зелёная рамка фокуса на раннем частном кадре была эффектом сохранённого TalkBack эмулятора; для подтверждения он временно отключён с сохранением исходных значений и последующим восстановлением.

Финальное дополнение настроек относится к source `bd919b2b7ad407ab83843b6a65da79f7e4761255`, debug SHA `14c91a0050e83b80c59725a03e959f1857549b9801b0dd9e60b3a032548ade6c`: [светлая 360dp/font1.3](final-settings/360-light-font130-appearance.png), [тёмная 360dp/font1.3](final-settings/360-dark-font130-appearance.png), [отдельные результаты](final-settings/results.json). Это дополнительный узкий проход по новому запросу, без нового эстетического цикла прежних экранов.
