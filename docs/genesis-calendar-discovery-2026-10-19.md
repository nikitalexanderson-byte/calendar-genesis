# Calendar discovery: подсказки, навигация и установка

Ветка `codex/calendar-discovery-ui`, основание `05b00907`. UI-этап опубликован 20 октября через PR #218: master/production `8c9351f78379431128b4acbbd6ce22fb6e1ba19e`, deploy `39324432158` success. Общий остаток сохраняется: **21 partial + 14 K/U/L**.

Production `/deploy-meta.json` содержит этот SHA, `/api/health` возвращает ok. Новые entry `index-Xqwoye2z.js` / `index-SB7Ut97M.css` и предыдущий production entry `index-SZd7wCQx.js` отвечают200. SSH не использовался. Авторизованные и реальные device-сценарии ограничены локальной приёмкой ниже; публичный health не подменяет Google-вход или установку iOS.

## Поведение

- В личных делах `SharedAffairsHint` показывается только eligible-аккаунту, когда общие дела выключены либо подраздел скрыт. У неeligible-аккаунта подсказки нет. Ссылка на личный кабинет прокручивает к его кнопке и переводит focus без автоматического открытия кабинета.
- `AccountGuide` показывает стрелку 15 секунд и золотое выделение 15 минут. Повторный запрос перезапускает сроки; состояние привязано к текущему user ID. Reduced motion отключает движение/пульсацию и smooth-scroll, сохраняя статические ориентиры и те же сроки.
- Новый Google-аккаунт начинает с Gregorian для отображения и задач. При первом доступном просмотре календаря `CalendarExploreNotice` знакомит с включёнными sacred/lunar режимами. Факт показа подтверждается серверным account preference; локальная отметка по user ID подавляет повтор, пока подтверждение повторяется при reconnect. Закрытие, reload, новый browser context и повторный login не должны заново включать подтверждённый показ. Legacy-аккаунты получают pending=0, их выбор календаря сохраняется.
- Выбор альтернативы меняет только календарь отображения. Календарь ввода задач/повторов независим: в QA после выбора sacred для отображения task mode остался profane. Тексты discovery, «Этот месяц» и iOS-инструкции заданы для 14 языков.
- На mobile доступные account/install/voice действия находятся рядом с брендом, три включённых календаря — равными кнопками во всю ширину ниже. Дата и краткая подпись разнесены вертикально; закреплённые уведомления стоят рядом с датой. Существующие условия доступности действий и поведение незакреплённой панели сохраняются.
- «Этот месяц» есть в Gregorian, sacred и lunar месячных экранах при просмотре другого месяца. Действие возвращает текущий период активной системы и закрывает просмотр дня; на desktop находится справа в строке рассвета/заката. Это не переход на экран «Сегодня».
- Shared Gregorian grid повторно использует семь weekday-масок и месячную основу существующего year-палитрового слоя: 18%/16% маски, 19%/23% месячного акцента в light/dark. Солнечная дата имеет золотой фон и рамку 2px при доступных sacred features. Задачи, счётчики, выбранный день и today-маркеры остаются отдельными элементами. Личный месяц, sacred/lunar сетки и task calendar не переоформляются.
- iOS вне standalone открывает три ручных шага: Safari → «Поделиться» → «На экран Домой» / «Добавить». В standalone install-кнопки нет. APK/TWA остаются Android-only; iOS-инструкция относится к PWA, а не к новому native iPhone-приложению.

## Миграция и совместимость

`079_calendar_exploration.sql` добавляет только `calendar_exploration_pending INTEGER NOT NULL DEFAULT 0` с проверкой 0/1. Новый Google insert устанавливает 1; preferences API принимает только false для подтверждения. Обычные старые preference patches и login replay не включают показ заново.

Изолированный PHP test проверяет согласованную SQLite-копию через VACUUM INTO, сохранение legacy lunar-выбора, additive compatibility старых записей, Gregorian defaults и replay/acknowledgement. При code rollback добавленный столбец можно оставить: старый код его игнорирует, запись старого клиента проверена. Production runtime-backup остаётся частью существующего deploy workflow; автоматическое восстановление production-БД не выполняется, database rollback требует отдельного согласованного плана и проверки runtime-копии.

## Локальная приёмка

Финальная основа — `output/playwright/discovery-finish-confirm.log`: 33 заменённых captures, `findings: []`; light/dark × 360/390/768/1440px для шапки, month footer и shared grid, возврат месяца всех трёх систем и solar exception. `discovery-confirm-qa.log` содержит предыдущий проход, а не ещё 33 отдельных accepted originals. Основная shared-матрица была пустой: её результаты сами по себе не подтверждают filled cells.

`discovery-extra-checks.log`: `findings: []`, 17 cases — eligible/disabled и hidden-submenu hint, pinned notifications, повторные таймеры/reduced motion, once-tip после reload/нового context, независимость display/task mode, iOS steps/Escape/focus и standalone. `discovery-filled-confirm.log`: `findings: []`, 8 cases — три task previews + ellipsis + total 4 и today-marker в обеих схемах на четырёх ширинах; synthetic dates восстановлены. Дополнительные originals — `discovery-hint-*`, `discovery-guide-*`, `discovery-pinned-*`, `discovery-newcomer-*`, `discovery-ios-*`, `discovery-filled-*`.

Finish reviewer нашёл и направил два исправления CSS: date block снова имеет вертикальную grid-композицию, а декоративные кольца month header больше не превращают шапку во внутренний scroll container. Финальное подтверждение прошло: scrollTop=0, h1Offset=52/57/64; повторно открытые documenter month/header originals подтверждают видимый заголовок и сохранённую композицию. Scoped evidence — 24 before + 77 after, всего 101 original (33 primary + 36 extra + 8 filled after), без двойного счёта заменённых кадров.

По переданным результатам frozen install, lint 0 errors / 2 прежних warnings, 353 web tests, `build:beget` с max asset 349993 bytes и PHP migration test прошли. После последних CSS-исправлений сборка повторно прошла; TypeScript после lint/test не менялся. Документер не повторял команды. Точный deploy SHA, GitHub Actions и production checks добавляет владелец после фактической публикации.

## Границы

Проверки локальные, с synthetic accounts и Chromium; iOS UA/touch/standalone эмуляция не заменяет настоящий iPhone/Safari. Не проверены реальный Google signup/consent, реальная установка PWA, Android APK/TWA runtime и полная синхронизация. Проверен normal same-breakpoint close/focus; возврат focus при замене opener во время mobile↔desktop breakpoint не гарантирован. Полный screen-reader проход, native-language editorial quality и все редкие calendar/task сочетания не сертифицированы.

STANDART, существующие ассеты и стек сохранены. Source, CI, server/runtime, private/config/session/phone файлы и remaining-work ledger этим documentation pass не изменялись; SSH и браузер не использовались. Широкий исторический metadata/domain drift не исправлялся.
