---
name: GENESIS STANDART
description: "Единая STANDART на основе Experimental: спокойная типографика и дерево проектов в зелёном и золоте GENESIS."
colors:
  light-green: "#255b59"
  light-gold: "#8c672b"
  light-gold-soft: "#d8bd80"
  dark-gold: "#e4c78c"
  dark-sage: "#acc7af"
  light-paper: "#eee9dc"
  light-surface: "#fffdf8"
  light-ink: "#132426"
  light-muted: "#526263"
  light-line: "#21383820"
  light-sidebar: "#07171b"
  dark-paper: "#0b1511"
  dark-surface: "#12241c"
  dark-control: "#193127"
  dark-ink: "#f0eee7"
  dark-muted: "#afbeb2"
  dark-line: "#ffffff18"
  dark-sidebar: "#06130f"
  sidebar-muted: "#a7b9b5"
  light-terracotta: "#a5543f"
  dark-terracotta: "#ed9b8a"
  shared-task-light: "#7350a2"
  shared-task-dark: "#c4a4ef"
  shared-task-dark-ink: "#241335"
typography:
  display:
    fontFamily: '"Source Serif 4", Literata, Georgia, serif'
    fontSize: "clamp(32px, 3.5vw, 48px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "-.02em"
  headline:
    fontFamily: '"Source Serif 4", Literata, Georgia, serif'
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "-.02em"
  title:
    fontFamily: '"Source Serif 4", Literata, Georgia, serif'
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.3
  body:
    fontFamily: 'Inter, "Source Sans 3", "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  task-title:
    fontFamily: 'Inter, "Source Sans 3", "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: 'Inter, "Source Sans 3", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
  caption:
    fontFamily: 'Inter, "Source Sans 3", "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  segment: "8px"
  control: "10px"
  surface: "12px"
  dialog: "16px"
spacing:
  tight: "4px"
  icon: "8px"
  compact: "12px"
  control: "16px"
  panel: "20px"
  section: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.light-green}"
    textColor: "{colors.light-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-dark:
    backgroundColor: "{colors.dark-gold}"
    textColor: "{colors.dark-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.light-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary-dark:
    backgroundColor: "transparent"
    textColor: "{colors.dark-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  field-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  segment-selected:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.segment}"
    padding: "8px 12px"
  segment-selected-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.segment}"
    padding: "8px 12px"
  navigation:
    backgroundColor: "transparent"
    textColor: "{colors.sidebar-muted}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  project-surface:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.surface}"
  project-surface-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.surface}"
  chaos:
    backgroundColor: "color-mix(in srgb, #fffdf8 65%, #eee9dc)"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.panel}"
  chaos-dark:
    backgroundColor: "color-mix(in srgb, #12241c 65%, #0b1511)"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.surface}"
    padding: "{spacing.panel}"
  theme-switch:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  theme-switch-dark:
    backgroundColor: "{colors.dark-surface}"
    textColor: "{colors.dark-ink}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
---

# Design System: GENESIS STANDART

## Overview

**Creative North Star: "GENESIS STANDART — дерево проектов в зелёном и золоте"**

По решению пользователя от 10 октября 2026 оформление Experimental переименовано в STANDART и стало единственной темой сайта. Светлая и тёмная схемы используют `data-genesis-theme="standart"` и `"standart-dark"`. Исторические значения Experimental в настройках аккаунта нормализуются с сохранением цветовой схемы. Слой `experimental-theme.css` содержит базовое оформление; `web-standart.css` сохраняет общую основу и загружается перед ним; `layout-refinements.css` содержит исправления компоновки и загружается последним. Переключатель семейства удалён.

Спокойный рабочий ритм взят из согласованного раздела проектов [tempo-roan-delta.vercel.app](https://tempo-roan-delta.vercel.app/): Inter для управления, Source Serif 4 для заголовков, тонкие контурные иконки и раскрываемое дерево. Зелёный и золотой принадлежат GENESIS. Авторские изображения, сакральные цвета, SVG/JS и обратная связь сохраняют свои смысловые места и геометрию. Публичный интерфейс остаётся на существующем стеке React/Vite и PHP/SQLite; новая UI-библиотека не используется.

**Key Characteristics:**

- Светлая бумага и глубокие зелёные тёмные поверхности с тёплым текстом.
- Serif-заголовки проектов, компактные Inter-контролы и переносимые длинные названия.
- Раскрываемые реальные проекты; на телефоне и планшете «Хаос» сверху над деревом, на десктопе — справа на всю высоту дерева. Кнопки создания находятся над рабочей областью. Проект раскрывается при наведении перетаскиваемой задачи.
- В общих делах навигация пространства отделена от выбранного проекта. Карточки проектов имеют видимые границы; стрелка и название выровнены в одной строке, дочерние проекты показаны с отступом. Задача, созданная в доске, сразу сохраняется в её статусе; кнопка хаос-бокса сохраняет задачу в хаос-боксе.
- Формы с датами позволяют выбрать собственный календарь. При создании привычки начало выбирается на сегодня или в будущем; после сохранения начало и все параметры баллов фиксируются в вебе и Android.
- Общий язык личных и общих дел при сохранении списка, досок и календаря.
- Выбор светлой или тёмной схемы единой темы STANDART.

**The Single Theme Rule.** Эти токены принадлежат единственной теме STANDART. Пользователь выбирает только светлую или тёмную цветовую схему.

Источники: [экспериментальный слой](app/experimental-theme.css), [базовые роли](app/globals.css), [тёмные роли](app/dark-theme.css), [Universal UI](app/universal-ui.css), [Standart и общая обратная связь](app/web-standart.css), [контроллер темы](app/theme-controller.ts) и согласованное направление (локальный `work/experimental-direction.md`, вне Git). Значения frontmatter извлечены из кода; extensions в `.impeccable/design.json` содержат тени, движение, точки адаптации и пояснения. Синтетические тональные полосы sidecar служат только для панели документации.


## Colors

Палитра соединяет зелёные рабочие роли, золотые ориентиры и тёплые нейтральные поверхности. Примитивы frontmatter — нормативные значения; цветовые имена ниже описывают назначение.

### Primary

- **Глубокий зелёный** (`light-green`): основные действия в светлой схеме; связан с `--teal` и `--ui-accent`.
- **Тёплое золото** (`dark-gold`): основные действия и ориентиры в тёмной схеме; `--ui-accent` переключается на `--gold`, текст кнопки использует тёмную поверхность.
- **Шалфейный** (`dark-sage`): вторичный зелёный акцент тёмной схемы, например активный часовой сектор и выбранный AM/PM. В активном AM/PM текст использует тёмную бумагу для контраста.

### Secondary

- **Сдержанное золото** (`light-gold`): фокус, счётчики, раскрытие и прогресс в светлой схеме.
- **Светлое золото** (`light-gold-soft`): активная навигационная иконка на тёмном сайдбаре светлой схемы.

### Tertiary

- **Терракотовый сигнал** (`light-terracotta`, `dark-terracotta`): счётчик «Хаоса» и hover удаления. Это сохранённая роль базовых светлого/тёмного стилей, не дополнительный основной акцент.

### Neutral

| Роль | Светлая схема | Тёмная схема |
| --- | --- | --- |
| Фон рабочей области | `light-paper` | `dark-paper` |
| Карточки, поля, диалоги | `light-surface` | `dark-surface` |
| Основной текст | `light-ink` | `dark-ink` |
| Метаданные, placeholders | `light-muted` | `dark-muted` |
| Разделители | `light-line` | `dark-line` |
| Сайдбар | `light-sidebar` (унаследован) | `dark-sidebar` |
| Текст навигации | `sidebar-muted` | `sidebar-muted` |

`dark-control` применяется к выбранным календарным/языковым вариантам и совместимым тёмным контролам. Обычные Experimental-поля используют `--surface`; базовый dark-layer сохраняет свои более специфичные назначения для сложных форм.

Состояния вычисляются из текущих ролей: hover — 9% зелёного с поверхностью; фон акцентного действия — 12% золота с поверхностью; тонкая граница — 13% основного текста с прозрачностью. «Хаос» смешивает поверхность (65%) с бумагой. Эти формулы остаются `color-mix(in srgb, ...)` в коде и компонентах sidecar.

**The Authored Color Rule.** Тема не перекрашивает авторские изображения и сакральные диаграммы как обычные карточки. Месячный `--month-accent`, точные названия, греческие буквы, выделенные месяцы и Apeiron остаются в своей календарной системе.

## Typography

**Display Font:** Source Serif 4, затем Literata и Georgia.
**Body Font:** Inter, затем Source Sans 3, Segoe UI и sans-serif.

**Character:** Serif задаёт спокойную иерархию и читабельные названия проектов; Inter удерживает управление и метаданные компактными. Heading-роль использует нормальное начертание, плотное межбуквенное расстояние и сбалансированный перенос; локальная вторая часть заголовка может быть курсивной.

### Hierarchy

- **Display** (`typography.display`): название рабочей области. На ширинах до 600px проектный h1 становится (34px).
- **Headline** (`typography.headline`): обычный h2. Контекст общих дел использует локальный размер `clamp(24px, 3vw, 32px)`; диалог может сохранять исходный размер Standart.
- **Title** (`typography.title`): название проекта в дереве. Общий h3 имеет line-height (1.35).
- **Body** (`typography.body`): пояснения и ввод; описание рабочей области ограничено (65ch).
- **Task title** (`typography.task-title`): названия личных и общих задач.
- **Label** (`typography.label`): основные кнопки и переключатели без uppercase.
- **Caption** (`typography.caption`): метаданные проектов; общие подписи наследуют line-height (1.5), диалоговые подписи получают (13px).

Счётчики, метаданные задач и часы используют `tabular-nums`. Длинные русские названия проектов наследуют `overflow-wrap: anywhere` и естественный перенос; их нельзя заменять обрезанными строками ради плотности.

**The Type Roles Rule.** Source Serif 4 ведёт заголовки; Inter ведёт действия, задачи и ввод. Малые служебные исключения не задают размеры для нового основного текста.

Шрифты self-hosted в `public/fonts/experimental/`: variable normal Inter (100–900) и Source Serif 4 (200–900), `font-display: swap`, исходные unicode ranges. Provenance и перечень языковых subsets зафиксированы в [README](public/fonts/experimental/README.md). Лицензии: [Inter OFL](public/fonts/experimental/Inter-OFL.txt), [Source Serif 4 OFL](public/fonts/experimental/SourceSerif4-OFL.txt). Во время работы нет запроса шрифтов на сторонний сервер.

## Layout

Desktop-shell использует сайдбар (240px) и `minmax(0, 1fr)` для рабочей области. Контент центрируется с максимальной шириной (1400px), отступом (32px) и вертикальным ритмом `spacing.section`. Заголовок проектов находится в общем потоке без вложенной hero-карточки.

Композиция личных проектов: дерево `minmax(0, 1fr)`, «Хаос» (300px), между ними общий gap (24px). Это правило конкретной поверхности проектов, не обязательная композиция каждого экрана. Дерево имеет самостоятельный заголовок, разделённые строки и раскрываемые реальные задачи/списки. Desktop-отступ вложенности — глубина, ограниченная тремя уровнями, умноженная на (20px).

- **От 1280px:** статус, поиск, новый проект и создание задачи размещаются в одном ряду; поиск получает минимум (180px).
- **До 1100px:** заголовок и topbar допускают перенос, счётчики занимают отдельную строку.
- **До 1040px:** «Хаос» располагается над деревом; от 1041px — справа на всю высоту дерева.
- **До 900px:** shell становится блочным, workspace получает (24px), список общих дел переходит в одну колонку.
- **До 600px:** workspace получает (20px 16px), section gap (20px), toolbar распределён на статусы / поиск / действия. h1, марка и счётчики уменьшаются; действия строки проекта получают ширину (44px) и отдельный ряд; вложенность ограничена шагом (12px). Общие категории идут вертикальным списком, форма — в одну колонку.

Основные controls имеют minimum height (44px). Сегментированные компактные варианты внутри группы используют minimum height (38px); desktop-иконки действий дерева имеют ширину (36px) и высоту не менее (44px). Это наблюдаемые различия, а не обещание универсального квадрата 44×44.

Общие дела получают ту же типографику и контроли, собственный sidebar (240px), адаптивные действия, а также сохраняют пространства, проекты, список, доски и календарь. Полный набор навигации и календарных режимов остаётся доступным.

В нативном Android действуют исходные границы GENESIS: плашка календаря, навигация и содержимое — самостоятельные блоки; плашка прокручивается в общем потоке. Этот web-документ не утверждает реализацию нового Android-оформления.

## Elevation & Depth

STANDART опирается на тональные поверхности, тонкие разделители и границы. Дерево, строки, sidebar общих дел и «Хаос» не имеют внешней тени. Активный сегмент получает мягкую малую тень; активный проект общих дел — золотую границу и тональную подложку. Заголовки диалогов прозрачные и находятся в общем потоке формы. Диалог создания проекта поднимается над рабочей областью; существующие feedback-эффекты наследуются.

### Shadow Vocabulary

- **Selected segment** (`0 1px 3px #0001`): небольшое выделение выбранного сегмента.
- **Current shared project** (`inset 2px 0 var(--gold)`): направление внутри навигации.
- **Project composer** (`0 24px 80px #0005`): модальный слой создания; backdrop использует z-index (800).
- **Sacred month state** (`inset 3px 0 0 var(--month-accent)`): сохранённый смысловой маркер в тёмном календаре, вне языка обычных карточек.

**The Quiet Surface Rule.** Обычные проектные поверхности разделяются тоном и границей; модальная тень принадлежит диалогу, не каждой строке дерева.

Движение переключателя и шеврона — (180ms ease-out); основные кнопки наследуют state transition (150ms). При `prefers-reduced-motion: reduce` общий stylesheet переводит scrolling в `auto`, снижает animation/transition duration до (0.01ms) и ограничивает анимацию одним проходом. Локальный слой отключает transition переключателя; существующие project/habit/orbit правила отключают авторские анимации. Это сохраняет обратную связь, не вводя нового языка движения.

## Shapes

Радиусы frontmatter отражают уровень компонента: компактный сегмент — `rounded.segment`, основной control — `rounded.control`, самостоятельная поверхность — `rounded.surface`, диалог — `rounded.dialog`. Строка дерева плоская, с нижним разделителем; сама панель скруглена. У прогресса остаётся тонкая полоска (84×3px) и локальное скругление (2px).

Обычные границы — (1px); «Хаос» и поля переноса используют dashed, обозначая контейнер неразобранного или переносимого содержимого. Изображения, авторские круги, календарные ячейки и часы сохраняют исходную геометрию.

## Components

### Buttons

Спокойные компактные действия с явным цветом роли.

- **Shape:** `rounded.control`, padding основного варианта из frontmatter, minimum height (44px).
- **Primary:** зелёный/светлая поверхность в светлой схеме, золото/тёмная поверхность в тёмной.
- **Secondary / Ghost:** прозрачный фон, основной текст, тонкая вычисляемая граница.
- **Hover:** `brightness(1.08)`; реальные disabled/pending состояния принадлежат исходным компонентам.
- **Focus:** keyboard focus — золотой outline (2px), offset (3px). Это правило действует также на ссылки, inputs, select, textarea и summary.

### Chips / Segments

Группа получает плотный фон, padding и gap (3px). Кнопки имеют `rounded.segment`; выбранное состояние обозначается `aria-selected`, `aria-current` или `aria-pressed`, поверхностью, границей и малой тенью. У shared view-switch активный текст золотой. Сегменты переключают реальные режимы и фильтры, не служат декоративными метками.

### Cards / Containers

Дерево использует `project-surface` и `project-surface-dark`, `rounded.surface`, тонкую вычисляемую границу и плоское состояние. Заголовок внутри дерева имеет padding (16px 20px), строки — вертикальный (16px). «Хаос» получает своё смешение бумаги и поверхности, dashed-границу и padding `spacing.panel`. Открытие формы не заменяет дерево: новый проект создаётся в диалоге шириной до (560px), с max-height `calc(100dvh - 32px)` и внутренней прокруткой.

### Inputs / Fields

Поля имеют minimum height (44px), `rounded.control`, фон поверхности и тонкую границу; textarea допускает vertical resize. При focus граница золотая; placeholder — вторичный текст с opacity (1), caret — золото. Ошибки, проверка и disabled состояния сохраняются из существующих форм; этот слой не придумывает новые сообщения или протоколы.

### Navigation

Сайдбар остаётся тёмным в обеих схемах. Навигация использует Inter, minimum height (44px), padding (10px 14px), прозрачный фон и приглушённый текст. Hover/active получают тёплый светлый текст и слабый светлый фон; active-иконка золотая. Mobile-nav использует бумагу, основной текст и разделитель текущей схемы.

Новые интерфейсные контуры берутся из inline-SVG [ExperimentalIcon](app/ExperimentalIcon.tsx): viewBox (24×24), stroke (1.75), round cap/join, обычный размер (18px), `currentColor`. Иконки имеют `aria-hidden` и не получают focus; имя действия принадлежит кнопке. Геометрия Lucide сопровождается [ISC-лицензией](public/fonts/experimental/Lucide-LICENSE.txt). Существующие PNG/JPG/SVG/WEBP, сакральные иконки и анимации сохраняются отдельно.

### Color mode

В настройках оформления доступны только светлая и тёмная схемы STANDART. Выбор сохраняется в аккаунте существующим контроллером; отдельного переключателя семейства тем нет.

### Project disclosure

Название проекта раскрывает содержимое через `aria-expanded`; шеврон поворачивается на (90deg), реальные задачи и списки показываются в поле проекта. Строка сохраняет завершение, под-проект, редактирование, перенос, удаление и drag/drop. Hover и drop-target используют золотой wash; удаление — терракотовый сигнал. Общие дела сохраняют свою исходную структуру раскрытия и права.

### Shared workspace and attachments

Фраза «Планируйте вместе. Личные задачи, привычки и календарь остаются вашими» идёт сразу под заголовком общих дел. Ниже пространство, владелец и число участников собраны в одну приглушённую плашку: подписи Source Serif 4 слева, значения Inter справа, между ними тонкие линии. Плашка без шеврона показывает полное описание пространства при наведении, фокусе или касании. Длинный текст переносится и прокручивается. Настройки проекта прижаты к правому краю. Выбор проекта показывает иерархию и число задач; пустое пространство предлагает «Создать первый проект».

«Категории» — единый вертикальный раскрываемый блок с ведущим шевроном и шапкой Inter 16px/600, как у нижних служебных блоков. Создание и редактирование категории открывает модальное окно; создание доступно и при свёрнутом списке. На десктопе компактный селектор статуса задачи занимает правую верхнюю часть карточки над редактированием и удалением.

Общий календарь использует бумажную поверхность, акцентную навигацию, отдельные оттенки выходных и дней с задачами. Клик по дню открывает различимые записи в модальном списке. Выполненные задачи собраны отдельно. Списки личных и общих задач по месячным счётчикам остаются доступны при переводе указателя; название ведёт к карточке в проекте, галочка завершает задачу или сохраняет требуемое подтверждение.

Типы записей используют существующие формы и календарные окна: задача, встреча, событие; день рождения доступен только в личных делах. Встреча поддерживает время окончания. Выбор участников подтверждения и категории их прав оформлены существующими переключателями, полями и модальными окнами STANDART.

Общие календарные счётчики — отдельные круглые фиолетовые элементы в нижнем правом углу, с белым текстом днём и тёмным вечером. Цвет различает общие дела и личное завершение. Удаление остаётся явным красным действием, отдельным от редактирования.

Уведомления о комментариях отделены от фона обводкой 1px: тёмно-зелёная #214c3d в светлой схеме, золотистая #c6a66c в тёмной.

Вложения задачи используют пунктирную область с иконкой скрепки, кнопкой «Выбрать файлы», подсказкой о перетаскивании, форматах и лимитах и списком файлов. У доски сохраняются только её существующие поля изображения.

## Do's and Don'ts

### Do:

- **Do** развивать единую STANDART на основе согласованного Experimental и GENESIS Universal UI.
- **Do** сохранять цветовую схему исторических настроек при переходе на единую STANDART.
- **Do** использовать Inter для управления и Source Serif 4 для проектной иерархии.
- **Do** сохранять все изображения, сакральные SVG/JS, названия месяцев, греческие буквы, выделения и Apeiron на существующих смысловых местах.
- **Do** сохранять фактическую дату «Сегодня», независимость календаря отображения и ввода/повторов, кастомные окна 24h и AM/PM.
- **Do** сохранять раскрываемые реальные проекты, все их действия и общие list/board/calendar workflows.
- **Do** проверять обе схемы на 360, 390, 768 и 1440px, сохранять до/после и явно отмечать непроверенные состояния.
- **Do** при сворачивании десктопной навигации до 56px отдавать освободившуюся ширину рабочей сетке; сохранять логотип, значки, доступные названия и ручную стрелку на границе панели.

### Don't:

- **Don't** возвращать отдельное семейство Experimental или переключатель семейства тем.
- **Don't** переносить с референса синий/мятный акцент вместо зелёного/золотого GENESIS.
- **Don't** удалять или заменять изображения ради компактности либо перекрашивать авторскую геометрию как обычный UI.
- **Don't** скрывать действия при переносе длинного названия проекта или заменять реальное содержимое дерева декоративным.
- **Don't** связывать выбранную дату календаря с датой экрана «Сегодня».
- **Don't** менять существующий стек, вводить новую UI-библиотеку или канонизировать служебные малые подписи как основной текст.

Эта документация извлекает код и не заменяет проверку UI. Google sync, реальные приглашения, наполненные привычки и нативный Android не подтверждены локальным seeded preview; тестовый fixture не синхронизируется. Эти состояния должны оставаться явно непроверенными в отчёте релиза.
