import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the GENESIS application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /GENESIS/);
  assert.match(html, /К основному содержанию/);
  assert.match(html, /Круг года/);
  assert.match(html, /--month-accent:/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
  assert.doesNotMatch(html, /href=["']\/admin-access/);
});

test("keeps the requested calendar and privacy features wired", async () => {
  const [calendarData, calendar, calendarDatePicker, accountPanel, cloudSync, recurrenceBuilder, taskRecurrence, moonPhase, solarTimes, stoicheion, stoicheionData, welcome, styles, api, google, repository, multiAccountMigration, i18n, languageMigration, englishManifest] = await Promise.all([
    readFile(new URL("../app/calendar-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/GenesisCalendar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CalendarDatePicker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AccountPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cloud-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/RecurrenceBuilder.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/task-recurrence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/MoonPhaseIcon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/solar-times.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/StoicheionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/stoicheion-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/WelcomeScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../server/public/api/index.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/google.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/repository.php", import.meta.url), "utf8"),
    readFile(new URL("../server/migrations/006_calendar_multi_account.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../server/migrations/007_user_language.sql", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.en.webmanifest", import.meta.url), "utf8"),
  ]);

  assert.match(calendarData, /getSolarEvents/);
  assert.match(calendarData, /summer-solstice/);
  assert.match(calendarData, /calendarDateNote/);
  assert.match(calendarData, /normalizeCalendarDateNote/);
  assert.match(calendarData, /if \(!normalized \|\| mode === "profane"/);
  assert.match(calendarData, /return "";/);
  assert.match(calendarData, /formatCalendarDate/);
  assert.match(calendarDatePicker, /Сакральный календарь/);
  assert.match(calendarDatePicker, /Лунный календарь/);
  assert.match(calendarDatePicker, /Пята \{day\.pyata/);
  assert.match(accountPanel, /calendar-mode-segment/);
  assert.match(accountPanel, /Несколько Google-аккаунтов/);
  assert.match(accountPanel, /По выбору при создании/);
  assert.match(accountPanel, /language-preference/);
  assert.match(accountPanel, /🇷🇺/);
  assert.match(accountPanel, /🇺🇸/);
  assert.match(welcome, /welcome-language-picker/);
  assert.match(cloudSync, /language: Language/);
  assert.match(repository, /'language' => \$language/);
  assert.match(languageMigration, /ADD COLUMN language/);
  assert.match(i18n, /useDocumentLanguage/);
  assert.match(i18n, /MutationObserver/);
  assert.match(englishManifest, /"lang": "en-US"/);
  assert.match(calendar, /task-description-viewer/);
  assert.match(calendar, /task-sync-account-picker/);
  assert.doesNotMatch(calendar, /renderTaskCalendarByMode/);
  assert.doesNotMatch(calendar, /activeCalendarMode !== "sacred"/);
  assert.match(calendar, /const isSaturday = gregorian\.getDay\(\) === 6/);
  assert.match(calendar, /weekday: "long"/);
  assert.match(calendar, /weekday: "short"/);
  assert.match(calendar, /calendar-weekday-full/);
  assert.match(calendar, /calendar-weekday-short/);
  assert.match(calendar, /isSaturday \? " saturday"/);
  assert.match(styles, /\.year-grid \.mini-day\.today/);
  assert.match(styles, /background: var\(--month-accent\)/);
  assert.doesNotMatch(styles, /inset 0 0 0 999px rgba\(20, 31, 29/);
  assert.match(cloudSync, /connectAdditionalGoogleAccount/);
  assert.match(api, /purpose === 'link'/);
  assert.match(google, /genesisListAllGoogleTasks/);
  assert.match(google, /genesisResolveTaskTargetAccounts/);
  assert.match(google, /\$calendarMode === 'profane'/);
  assert.doesNotMatch(google, /Календарная дата:\\n/);
  assert.match(repository, /GENESIS_ADMIN_EMAIL = 'nikitalexanderson@gmail.com'/);
  assert.match(multiAccountMigration, /CREATE TABLE IF NOT EXISTS linked_google_accounts/);
  assert.match(calendar, /solar-year-strip/);
  assert.match(calendar, /deleteCategory/);
  assert.match(calendar, /saveCategoryEdit/);
  assert.match(welcome, /Ваши задачи — только в Google и на вашем устройстве/);
  assert.doesNotMatch(welcome, /Артемида · полнолуние|Геката · новолуние/);
  assert.doesNotMatch(welcome, /admin-access/);
  assert.match(calendar, /month-art-v4\/month-/);
  assert.match(calendar, /calendar-month-art/);
  assert.match(calendar, /mini-pyata/);
  assert.match(calendar, /Math\.ceil\(availableDays \/ 5\)/);
  assert.match(calendar, /чётная/);
  assert.match(calendar, /\["I", "II", "III", "IIII", "V"\]/);
  assert.match(calendar, /onPointerMove/);
  assert.match(calendar, /StoicheionView/);
  assert.match(calendar, /Стойхейон/);
  assert.match(calendar, /calendar-day-task-count/);
  assert.doesNotMatch(calendar, /calendar-day-task-preview/);
  assert.doesNotMatch(calendar, /calendar-task-popover/);
  assert.match(calendar, /selectedDayTasks/);
  assert.match(calendar, /day-details-tasks/);
  assert.match(calendar, /day-details-celestial/);
  assert.match(calendar, /Луна и Солнце/);
  assert.match(calendar, /Фаза Луны, рассвет и закат/);
  assert.match(calendar, /Редактирование задачи/);
  assert.match(calendar, /Редактирование проекта/);
  assert.match(calendar, /Поиск проектов по тегам/);
  assert.match(calendar, /newTaskDueDate/);
  assert.match(calendar, /renderTaskCreateForm\("all-tasks"\)/);
  assert.match(calendar, /renderTaskCreateForm\("today"\)/);
  assert.doesNotMatch(calendar, /renderTaskCreateForm\("planner"\)/);
  assert.doesNotMatch(calendar, /<aside className="planner-panel"/);
  assert.match(calendar, /id: "all-tasks", label: "Задачи"[\s\S]*id: "projects", label: "Проекты"/);
  assert.match(calendar, /Несортированное/);
  assert.match(calendar, /data-project-drop-id=\{project\.id\}/);
  assert.match(calendar, /data-project-drop-id=\{TASK_INBOX_PROJECT_ID\}/);
  assert.match(calendar, /Задача «\$\{item\.title\}» возвращена в хаос-бокс/);
  assert.match(calendar, /projectDragProps/);
  assert.match(calendar, /beginProjectTouchDrag/);
  assert.match(calendar, /className="inbox-list-item project-draggable-item"[\s\S]*projectDragProps\(item\)/);
  assert.match(calendar, /className=\{`project-assigned-task project-draggable-item/);
  assert.match(calendar, /project-assigned-items/);
  assert.doesNotMatch(calendar, /matchingTaggedTasks/);
  assert.match(calendar, /Дополнительная информация/);
  assert.match(calendar, /<span>Срок выполнения<\/span>/);
  assert.match(calendar, /newTaskEndDate/);
  assert.match(calendar, /taskRangeLabel/);
  assert.match(cloudSync, /endDate: string/);
  assert.match(moonPhase, /MOON_PHASE_STEPS = 30/);
  assert.match(moonPhase, /moon-phase-light/);
  assert.match(calendar, /MoonPhaseIcon/);
  assert.match(calendar, /Создано в GENESIS/);
  assert.match(calendar, /Создано в Google Calendar/);
  assert.doesNotMatch(calendar, /disabled=\{isPast\}/);
  assert.match(calendar, /task-list-workspace/);
  assert.match(calendar, /task-list-board/);
  assert.match(calendar, /Несколько новых задач/);
  assert.match(calendar, /CREATE_NEW_TASK_LIST_ID/);
  assert.match(calendar, /moveTaskToTaskList/);
  assert.match(calendar, /linkTaskListToProject/);
  assert.match(calendar, /saveTaskListEdit/);
  assert.match(calendar, /deleteTaskList/);
  assert.match(calendar, /taskListsForWorkspace/);
  assert.match(calendar, /Основной список Google · удалить нельзя/);
  assert.match(calendar, /Пока он пуст и не привязан к проекту, GENESIS скрывает его автоматически/);
  assert.match(calendar, /Редактирование списка задач/);
  assert.match(calendar, /Удалить список «\$\{taskList\.title\}»/);
  assert.match(calendar, /Список задач — это группа смежных задач/);
  assert.match(calendar, /renderTaskListCreateForm\("all-tasks"\)/);
  assert.match(calendar, /renderTaskListCreateForm\("today"\)/);
  assert.doesNotMatch(calendar, /renderTaskListCreateForm\("projects"\)/);
  assert.match(calendar, /DeviceClock/);
  assert.match(calendar, /Сегодня \{isNewMoonDay \? "новолуние" : "полнолуние"\}/);
  assert.match(calendar, /SOLAR_EVENT_COPY/);
  assert.match(calendar, /Академия Генезис/);
  assert.match(calendar, /t\.me\/genesisbasilea/);
  assert.match(calendar, /donate\.stream\/genesiscalendar/);
  assert.match(calendar, /Солнечно-лунный календарь/);
  assert.doesNotMatch(calendar, /Солнечный круг, услышанный через Луну/);
  assert.match(calendar, /<em>\{weekday\}<\/em>/);
  assert.match(calendar, /label: "Месяц"/);
  assert.doesNotMatch(calendar, /Ближайшие дни/);
  assert.match(calendar, /dayDetailsOpen/);
  assert.match(calendar, /setDayDetailsOrigin\("year"\);\s*setDayDetailsOpen\(true\);\s*};/);
  assert.match(calendar, /Открыть месяц «\{selectedMonth\.name\}»/);
  assert.match(calendar, /const openMonth = \(\) => \{[\s\S]*setDayDetailsOpen\(false\);[\s\S]*navigateTo\("calendar"\);/);
  assert.match(calendar, /day-details-modal/);
  assert.match(calendar, /onPointerDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\) setDayDetailsOpen\(false\)/);
  assert.match(calendar, /window\.history\.pushState/);
  assert.match(calendar, /mini-day-task-dot/);
  assert.doesNotMatch(calendar, /mini-day-task-count/);
  assert.match(calendar, /const isYearSaturday = getGregorianDate\([\s\S]*\.getDay\(\) === 6/);
  assert.match(calendar, /isYearSaturday \? " saturday"/);
  assert.match(styles, /Hierarchy uses four clear contrast levels/);
  assert.match(styles, /\.project-tree-panel > \.section-heading h2/);
  assert.match(calendar, /data-nav-id=\{item\.id\}/);
  assert.match(calendar, /task-form-section task-form-schedule/);
  assert.match(calendar, /task-form-section task-form-destination/);
  assert.match(calendar, /task-form-section task-form-settings/);
  assert.match(calendar, /<RecurrenceBuilder/);
  assert.match(calendar, /buildTaskSeries/);
  assert.match(calendar, /saveTaskSeries/);
  assert.doesNotMatch(calendar, /setTaskRecurrence\(/);
  assert.doesNotMatch(calendar, /<option value="daily">Каждый день<\/option>/);
  assert.match(recurrenceBuilder, /type="checkbox"/);
  assert.match(recurrenceBuilder, /С какого/);
  assert.match(recurrenceBuilder, /По какое/);
  assert.match(recurrenceBuilder, /По пятам/);
  assert.match(recurrenceBuilder, /По дням месяца/);
  assert.match(recurrenceBuilder, /В какие лунные месяцы/);
  assert.match(recurrenceBuilder, /Нечётные/);
  assert.match(recurrenceBuilder, /Чётные/);
  assert.match(recurrenceBuilder, /Будни/);
  assert.match(recurrenceBuilder, /Выходные/);
  assert.match(recurrenceBuilder, /Google Tasks/);
  assert.match(recurrenceBuilder, /aria-pressed=\{selected\}/);
  assert.match(recurrenceBuilder, /recurrence-inherited-mode/);
  assert.doesNotMatch(recurrenceBuilder, /recurrence-mode-toggle/);
  assert.doesNotMatch(recurrenceBuilder, /const setMode/);
  assert.match(taskRecurrence, /buildRecurrenceDates/);
  assert.match(taskRecurrence, /alignRecurrenceConfigWithCalendar/);
  assert.match(taskRecurrence, /calendarMode === "profane"\) return "classic"/);
  assert.match(taskRecurrence, /calendarMode === "lunar"\) return "lunar"/);
  assert.match(taskRecurrence, /Сакральный календарь/);
  assert.match(taskRecurrence, /Профанский календарь/);
  assert.match(taskRecurrence, /Лунный календарь/);
  assert.match(taskRecurrence, /getSacredDate/);
  assert.match(taskRecurrence, /getMoon/);
  assert.match(taskRecurrence, /lunarMonthOptions/);
  assert.match(taskRecurrence, /selectedPyatas/);
  assert.match(taskRecurrence, /MAX_RECURRENCE_OCCURRENCES/);
  assert.match(taskRecurrence, /cursor <= end/);
  assert.match(taskRecurrence, /selectedDays\.has/);
  assert.match(calendar, /calendar-sun-times/);
  assert.doesNotMatch(calendar, /navigator\.geolocation/);
  assert.doesNotMatch(calendar, /requestDeviceLocation/);
  assert.match(calendar, /getAutomaticSolarLocation/);
  assert.match(calendar, /Расчёт выполнен по часовому поясу устройства/);
  assert.doesNotMatch(calendar, /Рассвет и закат временно недоступны/);
  assert.doesNotMatch(calendar, /Не удалось связаться с сервисом определения региона/);
  assert.match(solarTimes, /getSunriseSunset/);
  assert.match(solarTimes, /https:\/\/get\.geojs\.io\/v1\/ip\/geo\.json/);
  assert.match(solarTimes, /geocoding-api\.open-meteo\.com\/v1\/search/);
  assert.match(solarTimes, /getAutomaticSolarLocation/);
  assert.match(solarTimes, /getTimezoneFallbackLocation/);
  assert.match(solarTimes, /TIMEZONE_REFERENCE_LOCATIONS/);
  assert.match(solarTimes, /Promise\.any/);
  assert.match(solarTimes, /LOCATION_REQUEST_TIMEOUT_MS/);
  assert.match(solarTimes, /SUNRISE_ALTITUDE/);
  assert.match(solarTimes, /formatDeviceSolarTime/);
  assert.match(stoicheionData, /STOICHEION_SOURCE_COUNT = 24/);
  assert.match(stoicheionData, /STOICHEION_TOTAL_COUNT = 24/);
  assert.match(stoicheionData, /id: "alpha"/);
  assert.match(stoicheionData, /id: "chi"/);
  assert.match(stoicheionData, /id: "omega"/);
  assert.match(stoicheionData, /Метафизика перекрестка миров и Огненной Души/);
  assert.doesNotMatch(stoicheionData, /source: "editorial-placeholder"/);
  assert.match(stoicheion, /buildStoicheionSpread/);
  assert.match(stoicheion, /pythmenFromTotal/);
  assert.match(stoicheion, /Космический круг и девять ликов силы/);
  assert.match(stoicheion, /stoicheion-spread-grid/);
  assert.match(stoicheion, /Перебросить/);
  assert.match(stoicheion, /beginMotion\("daily", true, event\.timeStamp\)/);
  assert.match(stoicheion, /MOTION_TRAVEL_REQUIRED = 4480/);
  assert.match(stoicheion, /loadStoicheionDraws/);
  assert.match(stoicheion, /spreadCanReroll/);
  assert.match(stoicheion, /трёхминутное окно/i);
  assert.match(stoicheion, /moveThroughField/);
  assert.match(stoicheion, /isStoicheionCardReversed/);
  assert.match(stoicheion, /buildStoicheionSpreadReading/);
  assert.match(stoicheion, /Перевёрнутое положение/);
  assert.match(stoicheion, /PREVIEW_POSITIONS/);
  assert.match(stoicheion, /stoicheion-compass-rose/);
  assert.match(stoicheion, /Водите мышью по экрану или проведите пальцем/);
  assert.doesNotMatch(stoicheion, />ΣΤ</);
  assert.doesNotMatch(stoicheion, /STOICHEION_SOURCE_COUNT/);
  assert.doesNotMatch(stoicheion, /STOICHEION_TOTAL_COUNT/);
  assert.doesNotMatch(calendar, /Открыть →/);
  assert.match(styles, /\.calendar-month-art/);
  assert.match(styles, /\.year-month::before/);
  assert.match(styles, /\.year-open-button/);
  assert.match(styles, /\.mini-pyata-days/);
  assert.match(styles, /grid-auto-rows: max-content/);
  assert.match(styles, /\.project-row\.drop-target/);
  assert.match(styles, /\.project-tree-workspace/);
  assert.match(styles, /\.inbox-card\.drop-target/);
  assert.match(styles, /\.project-drag-preview/);
  assert.match(styles, /\.project-draggable-item\s*\{[\s\S]*touch-action: none/);
  assert.match(styles, /\.day-details-modal/);
  assert.match(styles, /\.today-create-options:has\(> details\[open\]\)/);
  assert.match(styles, /\.task-form-section/);
  assert.match(styles, /\.recurrence-builder/);
  assert.match(styles, /\.recurrence-inherited-mode/);
  assert.doesNotMatch(styles, /\.recurrence-mode-toggle/);
  assert.match(styles, /\.month-calendar \.calendar-day\.saturday/);
  assert.match(styles, /\.year-grid \.mini-day\.saturday\s*\{[\s\S]*rgba\(22, 37, 35, \.09\)/);
  assert.match(styles, /\.mini-day-task-dot\s*\{[\s\S]*width: 7px;[\s\S]*height: 7px;[\s\S]*background: var\(--terracotta\)/);
  assert.doesNotMatch(styles, /\.mini-day\.has-task\s*\{[\s\S]{0,160}background: var\(--terracotta\)/);
  assert.match(styles, /\.year-grid \.mini-day\.today\s*\{[\s\S]*border-color: #8f3026;[\s\S]*rgba\(181, 65, 47, \.9\)/);
  assert.match(styles, /\.month-calendar \.calendar-day\.saturday \.calendar-weekday\s*\{[\s\S]*font-weight: 950/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.calendar-weekday-full\s*\{[\s\S]*display: none/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.calendar-weekday-short\s*\{[\s\S]*display: inline/);
  assert.doesNotMatch(styles, /\.calendar-day\.saturday\s*\{[\s\S]{0,180}#111817/);
  assert.match(styles, /\.recurrence-day-grid\.dense/);
  assert.match(styles, /\.recurrence-range/);
  assert.match(styles, /\.recurrence-month-grid/);
  assert.match(styles, /\.recurrence-preset-row/);
  assert.match(styles, /\.recurrence-summary\.warning/);
  assert.match(styles, /\.calendar-sun-times/);
  assert.match(styles, /--paper: #e1d9c8/);
  assert.match(styles, /\.calendar-solar-control > div/);
  assert.match(styles, /\.stoicheion-view/);
  assert.match(styles, /\.month-rail button:last-child/);
  assert.doesNotMatch(styles, /\.mobile-nav button\[data-nav-id="admin"\]\s*\{/);
  assert.match(styles, /grid-auto-flow: column/);
  assert.match(styles, /mask-image: linear-gradient\(to right/);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@keyframes shieldPulse/);
  assert.match(styles, /\.proof-private i::before/);
  assert.match(styles, /overflow-x: hidden/);
  assert.match(styles, /overscroll-behavior-x: none/);
  assert.match(calendar, /ux-install-icon/);
  assert.match(calendar, /ux-calendar-icon/);
  assert.doesNotMatch(calendar, />↓</);
  assert.doesNotMatch(calendar, />↥</);
  assert.doesNotMatch(styles, /background-size: 100% 100%, 1300% 100%/);
  assert.doesNotMatch(styles, /repeat\(5, minmax\(78px, 1fr\)\)/);
  assert.doesNotMatch(api, /admin-access/);
  assert.match(repository, /nikitalexanderson@gmail\.com/);
  assert.match(repository, /genesisRequireAdmin/);
  assert.match(google, /https:\/\/www\.googleapis\.com\/auth\/tasks/);
  assert.match(google, /genesisSyncNativeGoogleTask/);
  assert.match(google, /genesisCreateGoogleTaskList/);
  assert.match(google, /genesisDefaultGoogleTaskListId/);
  assert.match(google, /'isDefault' =>/);
  assert.match(google, /genesisUpdateGoogleTaskList/);
  assert.match(google, /genesisDeleteGoogleTaskList/);
  assert.match(google, /genesisSource/);
  assert.match(google, /'google-calendar'/);
  assert.match(google, /— GENESIS —/);
  assert.match(google, /genesisGoogleTasksApi\(\s*'PATCH'/);
  assert.match(google, /genesisClientTimeZone/);
  assert.match(google, /genesisEndDate/);
  assert.match(google, /genesisCycleMode/);
  assert.match(google, /genesisCyclePattern/);
  assert.match(google, /genesisCycleDays/);
  assert.match(google, /genesisCycleStart/);
  assert.match(google, /genesisCycleEnd/);
  assert.match(google, /genesisCycleMonths/);
  assert.match(google, /genesisCyclePyatas/);
  assert.match(google, /genesisSeriesId/);
  assert.match(google, /'due' => \$endDate/);
  assert.match(cloudSync, /googleTaskListId/);
  assert.match(cloudSync, /recurrenceMode: RecurrenceMode/);
  assert.match(cloudSync, /recurrencePattern: RecurrencePattern/);
  assert.match(cloudSync, /recurrenceDays: number\[\]/);
  assert.match(cloudSync, /recurrenceStartDate: string \| null/);
  assert.match(cloudSync, /recurrenceEndDate: string \| null/);
  assert.match(cloudSync, /recurrenceMonths: number\[\]/);
  assert.match(cloudSync, /recurrencePyatas: number\[\]/);
  assert.match(cloudSync, /recurrenceSeriesId: string \| null/);
  assert.match(cloudSync, /taskListLinks/);
  assert.match(cloudSync, /googleEventId: task\.googleEventId/);
  assert.match(api, /\$path === 'task-lists'/);
  assert.match(api, /\$segments\[0\] === 'task-lists'/);
  assert.match(cloudSync, /updateGoogleTaskList/);
  assert.match(cloudSync, /removeGoogleTaskList/);
  assert.match(cloudSync, /X-Genesis-Time-Zone/);
  assert.match(repository, /genesisSaveStoicheionDraw/);
  assert.match(accountPanel, /role="switch"/);
  assert.match(accountPanel, /Запретить себе гадания/);
  assert.match(cloudSync, /updateAccountPreferences/);
  assert.match(calendar, /divinationDisabled=\{Boolean\(cloudUser\?\.stoicheionDivinationDisabled\)\}/);
  assert.match(stoicheion, /Гадания по картам выключены/);
  assert.match(stoicheion, /все буквенные карты и их значения остаются доступны/);
  assert.match(api, /\$method === 'PUT' && \$path === 'account\/preferences'/);
  assert.match(repository, /stoicheion_divination_disabled/);
  assert.match(repository, /Гадания по картам отключены в личном кабинете/);
  assert.match(calendar, /TimeClockPicker/);
  assert.doesNotMatch(calendar, /<datalist/);

  await access(new URL("../public/month-frieze-v1.webp", import.meta.url));
  await access(new URL("../public/month-frieze-v2.png", import.meta.url));
  await Promise.all(Array.from({ length: 13 }, (_, index) =>
    access(new URL(`../public/month-art-v4/month-${String(index + 1).padStart(2, "0")}.webp`, import.meta.url)),
  ));
  await access(new URL("../server/migrations/004_stoicheion_draws.sql", import.meta.url));
  await access(new URL("../server/migrations/005_stoicheion_divination_preference.sql", import.meta.url));
  await access(new URL("../server/migrations/007_user_language.sql", import.meta.url));
});

test("ships the complete illustrated Stoicheion deck with exact Greek typography", async () => {
  const ids = [
    "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta",
    "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "pi", "rho",
    "sigma", "tau", "upsilon", "phi", "chi", "psi", "omega",
  ];

  await Promise.all(ids.map((id) => access(new URL(`../public/stoicheion-cards/${id}.webp`, import.meta.url))));
  await access(new URL("../public/stoicheion-cards/frame-greek-key.svg", import.meta.url));

  const [view, cardArt, frame] = await Promise.all([
    readFile(new URL("../app/StoicheionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/stoicheion-card-art.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/stoicheion-cards/frame-greek-key.svg", import.meta.url), "utf8"),
  ]);
  const authoredCardArt = cardArt.split("const FALLBACK_ART")[0];
  const invocations = [...authoredCardArt.matchAll(/invocation: "([^"]+)"/g)].map((match) => match[1]);

  assert.equal(invocations.length, 24);
  invocations.forEach((invocation) => assert.match(invocation, /^[\p{Script=Greek}\p{Mark}]+$/u));
  ids.forEach((id) => assert.match(cardArt, new RegExp(`\\b${id}: \\{`)));
  assert.match(view, /\/stoicheion-cards\/\$\{letter\.id\}\.webp/);
  assert.match(view, /\/stoicheion-cards\/frame-greek-key\.svg/);
  assert.doesNotMatch(view, /\/stoicheion-cards\/frame(?:-linked-key)?\.svg/);
  assert.match(view, /StoicheionCardFace/);
  assert.doesNotMatch(view, /Пока изображения карт готовятся/);
  assert.match(frame, /pattern id="greek-key-top"/);
  assert.match(frame, /pattern id="greek-key-left"/);
  assert.match(frame, /M0 0V35H40 M10 0V15H30V35 M40 5H20V25H0/);
  assert.match(frame, /<rect x="32" y="32" width="20" height="20"\/>/);
  assert.doesNotMatch(frame, /linked-key|meander-|M60 76|M256 62/);
  assert.match(view, /<i lang="el">\{art\.invocation\}<\/i>/);
});

test("keeps Google OAuth consent, account binding, and token handling hardened", async () => {
  const [calendar, welcome, accountPanel, cloudSync, legal, api, bootstrap, google, repository, viteConfig, htaccess] = await Promise.all([
    readFile(new URL("../app/GenesisCalendar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/WelcomeScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AccountPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cloud-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/LegalPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../server/public/api/index.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/bootstrap.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/google.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/repository.php", import.meta.url), "utf8"),
    readFile(new URL("../vite.beget.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/.htaccess", import.meta.url), "utf8"),
  ]);

  assert.match(welcome, /google-signin-light-pill\.svg/);
  assert.match(calendar, /google-signin-light-square\.svg/);
  assert.match(cloudSync, /purpose=login/);
  assert.match(cloudSync, /purpose=services/);
  assert.match(cloudSync, /consumeGoogleAuthError/);
  assert.match(google, /GENESIS_GOOGLE_IDENTITY_SCOPES/);
  assert.match(google, /GENESIS_GOOGLE_SERVICE_SCOPES/);
  assert.match(google, /calendar\.app\.created/);
  assert.match(google, /https:\/\/www\.googleapis\.com\/auth\/tasks/);
  assert.match(google, /code_challenge_method/);
  assert.match(google, /genesisRevokeGoogleToken/);
  assert.match(google, /oauth2\.googleapis\.com\/revoke/);
  assert.match(api, /issued_at/);
  assert.match(api, /time\(\) - 600/);
  assert.match(api, /hash_equals/);
  assert.match(api, /unset\(\$_SESSION\['oauth_request'\]\)/);
  assert.match(api, /genesisSafeReturnTo/);
  assert.match(api, /account_mismatch/);
  assert.match(api, /missing_permissions/);
  assert.match(bootstrap, /session\.use_strict_mode/);
  assert.match(bootstrap, /session\.use_only_cookies/);
  assert.match(bootstrap, /display_errors/);
  assert.doesNotMatch(bootstrap, /getTraceAsString/);
  assert.match(repository, /email_verified/);
  assert.match(repository, /WHERE google_sub = :sub LIMIT 1/);
  assert.doesNotMatch(repository, /WHERE google_sub = :google_sub OR email = :email/);
  assert.match(repository, /genesisRevokeGoogleToken\(\$user\)/);
  assert.match(repository, /function genesisDisconnectGoogleServices/);
  assert.match(api, /account\/google-services\/disconnect/);
  assert.match(cloudSync, /disconnectGoogleServices/);
  assert.match(cloudSync, /if \(!remote\.user\.calendarConnected\) return/);
  assert.match(calendar, /if \(workspace\.user\.calendarConnected\)/);
  assert.match(calendar, /if \(!cloudUser\?\.calendarConnected\) return/);
  assert.match(accountPanel, /Отключить Calendar и Tasks/);
  assert.match(legal, /Google Tasks/);
  assert.match(legal, /Limited Use/);
  assert.match(legal, /developers\.google\.com\/terms\/api-services-user-data-policy/);
  assert.match(viteConfig, /sourcemap: false/);
  assert.match(htaccess, /connect-src 'self' https:\/\/get\.geojs\.io https:\/\/geocoding-api\.open-meteo\.com/);
  assert.match(legal, /GeoJS/);
  assert.match(legal, /Open-Meteo/);

  await access(new URL("../public/google-signin-light-pill.svg", import.meta.url));
  await access(new URL("../public/google-signin-light-square.svg", import.meta.url));
  await access(new URL("../public/.well-known/security.txt", import.meta.url));
  await access(new URL("../public/robots.txt", import.meta.url));
  await access(new URL("../public/sitemap.xml", import.meta.url));
  await access(new URL("../docs/GOOGLE-OAUTH-PUBLISHING.md", import.meta.url));
});
