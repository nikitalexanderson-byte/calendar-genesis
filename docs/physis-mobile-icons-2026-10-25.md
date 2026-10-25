# Фюзис: мобильные иконки разделов — 25 октября 2026

На ширине до 600 px главный переключатель Фюзиса показывает один ряд из четырёх одинаковых кнопок с иконками:

| Раздел | Lucide |
|---|---|
| Тренировки | `dumbbell` — гантель |
| Питание | `apple` — яблоко |
| БАДы и лекарства | `pill` — пилюля |
| Мониторинг показателей | `heart-pulse` — сердце с кардиограммой |

Использован существующий `HealthIcon`, набор Lucide 0.468.0. [Лицензия ISC](https://lucide.dev/license) разрешает бесплатное использование и распространение; исходная лицензия и атрибуция уже сохранены в `app/physis/vendor/lucide/LICENSE`. Новые пакеты, сетевые запросы за иконками и отдельная UI-библиотека не добавлены.

Иконки 28×28 px, кнопки высотой минимум 48 px, четыре равные колонки. Цвет и состояние выбранного раздела наследуются от общего переключателя сайта. Каждая кнопка сохраняет локализованное доступное название; общий `ButtonTooltips` показывает название при наведении и клавиатурном фокусе. На широком экране остаются исходные текстовые подписи.

Данные, маршруты, подменю и настройки не меняются. Android не собирается и не публикуется. Ручной SSH не используется.

## Проверка

Исходные и итоговые снимки сохранены в `output/playwright/physis-mobile-icons-before-*` и `physis-mobile-icons-after-*` для светлой/тёмной схем × 360/390/768/1440 px. Проверки завершены, результаты приведены ниже.

Непроверенные состояния: Safari/Firefox, физические телефоны и планшеты, screen reader, реальный сенсорный ввод, отдельный проход всех языков и мобильная альбомная ориентация. Доступные названия, клавиатура и ширины проверены в Chromium.


## Завершение общего обновления — 25 октября 2026

Изменения включают весь незавершённый набор из чата «Реализовать раздел Фюзис»:

- Четыре бесплатные мобильные иконки Lucide; ширина каждого действия одинакова, высота 48 px. Проверены клавиатура, подсказки и переходы между разделами.
- Общий компонент `DialogHeaderActions` в обоих web-входах: закреплённые заголовок, дискетка «Сохранить» и закрытие. Независимые формы сохраняются одним нажатием после проверки обязательных полей; дополнительные способы сохранения доступны в меню. Существующие обработчики, ограничения и disabled-состояния сохраняются.
- Пол, возраст, рост, вес, активность, цель, БЖУ, показатели дневной сводки и личные правила собраны в «Личных данных» и сохраняются одной зашифрованной записью. Из общих настроек профиль убран. «Личные данные» стоят перед шестерёнкой, статус «Сохранено» убран из верхнего блока.
- Исторические и витаминоподобные вещества размещены обычными карточками в существующем справочнике, K2 имеет отдельную карточку и пищевые источники. Всего 46 карточек, в том числе прежние 15 минералов. Добавлены абрикосовые ядра в пользовательскую подборку с указанием риска цианида, без выдуманного КБЖУ и рекомендаций употребления.
- Главные блоки Привычек, Фюзиса, Стойхейона и Теокиклоса имеют одинаковую высоту для каждого размера экрана: 488 px на 360/390, 344 px на 768 и 265 px на 1440; радиус 10 px. Сияющие буквы в главных блоках Оракула заменены иллюстрациями, рабочие карты и круги сохранены.
- Гермес изображён с естественной кожей и матовой тканью, картами с повторяющимся геометрическим меандром и зелёными глазами. 12 олимпийцев и Дионис общаются друг с другом; взгляды направлены в разные стороны.

### Проверки завершённого набора

`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm test` (719/719) и `pnpm build:beget` прошли. Lint сообщает только два прежних предупреждения об img в MindmapNodeContent/MindmapPresentationFields. Целевой TypeScript-check прошёл. Impeccable detect не выявил новых замечаний в изменённом коде; оставшиеся замечания касаются ранее существовавших строк.

Chromium: светлая/тёмная схемы × 360/390/768/1440 px, равная высота блоков, радиусы, отсутствие горизонтального переполнения и pageerror, доступные названия четырёх иконок, клавиатура, подсказки, закрепление шапки при прокрутке профиля/настроек. Сценарии сохранения: одна запись профиля, восстановление после reload, запрет частичного сохранения при некорректных БЖУ, несколько форм одной кнопкой, busy, альтернативное действие и вложенное окно.

Скриншоты до/после: `output/playwright/physis-mobile-icons-before-*`, `physis-mobile-icons-after-*`, `unified-heroes-before-*`, `unified-heroes-after-*`, `unified-profile-scroll-*` и `unified-settings-scroll-*`. Они хранятся локально вне Git.

Не проверены Safari/Firefox, реальные телефоны/планшеты, screen reader, сенсорный ввод, альбомная ориентация, полный ручной проход всех языков и каждого модального окна/прав доступа; серверные сохранения проверялись на изолированном локальном аккаунте. Автоматические языковые проверки прошли. Новый Android не собирался, ручной SSH не использовался, миграций и изменений БД нет.

### Иллюстрации и промпты

Использован встроенный ImageGen (редактирование исходных растров). Итоговые файлы в проекте: `public/oracle-art/hermes-cards-realistic.png`, `public/oracle-art/olympian-council-realistic.png`. Отброшенные варианты сохранены только локально.

Промпты реалистичной версии Гермеса и собрания:

```text
Use case: style-transfer. Edit target: the supplied Hermes banner. Preserve the story, overall framing, reaching hand throwing the same illustrated Stoicheion oracle cards toward the viewer, their Greek letters and card artwork, winged hat, caduceus, and small green flames in the eyes. Change the visual material and rendering style radically: Hermes must look like a living human with realistic olive skin, natural pores, soft diffuse light, matte dark-green woven linen cloak, small restrained antique bronze accessories. No bronze/gold skin, no statue, no metallic body, no shiny armor, no gloss, no lacquer, no excessive filigree, no slick CGI look. A believable cinematic historical scene, muted forest-green and warm cream GENESIS palette. Keep cards sharp, with original illustrations, meander borders, Greek letters only and no Russian descriptions. Keep dark muted near-solid forest background toward the left with empty copy space. Wide banner matching input composition. No text added, no watermark.

Use case: style-transfer. Edit target: the supplied Olympus council banner. Transform this metallic glossy illustration into a realistic cinematic historical ensemble of living human Greek gods. Natural Mediterranean skin with fine texture, matte woven linen and wool robes, restrained weathered bronze accessories, soft daylight, subtle natural shadows, warm stone architecture, muted deep forest-green and cream GENESIS palette. No metallic skin, no bronze statues, no gold bodies, no lacquer or plastic CGI, no ornate shiny costumes. Preserve narrative and right-weighted ensemble composition with dark empty copy space on the left. Exactly 13 distinct adult people, all faces clearly separate and naturally proportioned: Zeus with lightning and Hera with diadem seated in the middle; Poseidon with trident, Demeter with wheat, Athena with helmet and spear, Apollo with lyre, Artemis with bow, Ares with helmet, Aphrodite, Hephaestus with hammer, Hermes with winged hat and caduceus, Hestia with hearth flame, Dionysus with grapes and wine cup. Make all thirteen identifiable without written labels. Three coherent depth rows rather than a dense crowd; no extra people or background faces. Keep heads and torso silhouettes within frame, 12 Olympians plus 13th Dionysus. Wide banner matching input aspect ratio. No text, no watermark.
```

Промпты последних уточнений пользователя (ровный меандр и беседа богов):

```text
Precision edit of the supplied realistic Hermes banner. Change only the decorative borders printed on the four flying oracle cards. Replace their imperfect AI-generated border ornament with a beautifully exact flat printed Greek-key meander: one continuous rectangular fret with strictly uniform stroke width, uniform square modules, identical repeat spacing and clean 90-degree corners, accurately projected into the perspective plane of each card. The corner joins must be neat and geometrically coherent. It should look like the same professionally vector-designed gold ink border printed onto all four cards. Use a clean simple repeat rather than intricate clutter. No broken repeats, fused lines, inconsistent pseudo-symbols, irregular wobble, tangled ornament or random marks. Preserve the illustrated card faces and Greek letters, their placement, perspective and number; preserve Hermes' realistic living skin, matte green cloth, expression, reaching hand, winged hat, caduceus, green eye flames and all background/composition. No other change.

Edit the supplied realistic council of 13 Greek gods banner. Preserve the natural realistic skin, matte forest-green and cream woven robes, restrained antique accessories, marble hall, exact 13 distinct adult characters and their identifying objects, wide right-weighted banner composition with dark empty copy space on the left. Change the poses, gaze directions and hand gestures so this is a living council engaged in conversation, NOT a group staring off to the right. Zeus and Hera in the middle turn their faces toward each other, making eye contact while Zeus speaks and Hera gestures back. Poseidon turns toward Demeter below him as she looks up at him. Hephaestus and Athena exchange a glance across the upper middle. Apollo turns his head toward Artemis, who faces him in response. Ares at lower left turns inward toward Aphrodite, who answers with a conversational hand gesture. At lower right Hermes turns toward Dionysus, who smiles toward Hermes while holding his wine cup. Hestia looks toward the central conversation, tending her small hearth. Varied natural three-quarter and partial-profile faces oriented in alternating directions, relaxed expressive small gestures, plausible anatomy, no identical poses, no straight-on posed portrait, no synchronized gazes. Every face remains distinguishable, all 13 gods present and visible. No new people or text. Keep living human materials and natural soft daylight, no metallic/glossy skin.
```
