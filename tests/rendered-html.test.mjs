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
  const [calendarData, calendar, cloudSync, stoicheion, stoicheionData, welcome, styles, api, google, repository] = await Promise.all([
    readFile(new URL("../app/calendar-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/GenesisCalendar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cloud-sync.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/StoicheionView.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/stoicheion-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/WelcomeScreen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../server/public/api/index.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/google.php", import.meta.url), "utf8"),
    readFile(new URL("../server/src/repository.php", import.meta.url), "utf8"),
  ]);

  assert.match(calendarData, /getSolarEvents/);
  assert.match(calendarData, /summer-solstice/);
  assert.match(calendar, /solar-year-strip/);
  assert.match(calendar, /deleteCategory/);
  assert.match(calendar, /saveCategoryEdit/);
  assert.match(welcome, /Ваши задачи — только в Google и на вашем устройстве/);
  assert.doesNotMatch(welcome, /Артемида · полнолуние|Геката · новолуние/);
  assert.doesNotMatch(welcome, /admin-access/);
  assert.match(calendar, /month-art-v3\/month-/);
  assert.match(calendar, /calendar-month-art/);
  assert.match(calendar, /mini-pyata/);
  assert.match(calendar, /Math\.ceil\(availableDays \/ 5\)/);
  assert.match(calendar, /чётная/);
  assert.match(calendar, /\["I", "II", "III", "IIII", "V"\]/);
  assert.match(calendar, /onPointerMove/);
  assert.match(calendar, /StoicheionView/);
  assert.match(calendar, /Стойхейон/);
  assert.match(calendar, /calendar-day-task-count/);
  assert.match(calendar, /calendar-task-popover/);
  assert.match(calendar, /Редактирование задачи/);
  assert.match(calendar, /Редактирование проекта/);
  assert.match(calendar, /Поиск по тегам/);
  assert.match(calendar, /selectedDateIsPast/);
  assert.match(calendar, /label: "Месяц"/);
  assert.match(calendar, /Ближайшие дни/);
  assert.match(calendar, /window\.history\.pushState/);
  assert.match(calendar, /mini-day-task-count/);
  assert.match(calendar, /data-nav-id=\{item\.id\}/);
  assert.match(stoicheionData, /STOICHEION_SOURCE_COUNT = 23/);
  assert.match(stoicheionData, /STOICHEION_TOTAL_COUNT = 24/);
  assert.match(stoicheionData, /id: "alpha"/);
  assert.match(stoicheionData, /id: "chi"/);
  assert.match(stoicheionData, /id: "omega"/);
  assert.match(stoicheionData, /source: "editorial-placeholder"/);
  assert.match(stoicheion, /buildStoicheionSpread/);
  assert.match(stoicheion, /pythmenFromTotal/);
  assert.match(stoicheion, /Космический круг и девять ликов силы/);
  assert.match(stoicheion, /stoicheion-spread-grid/);
  assert.match(stoicheion, /Бросить ещё раз/);
  assert.match(stoicheion, /beginMotion\("daily", true\)/);
  assert.match(stoicheion, /MOTION_TRAVEL_REQUIRED/);
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
  assert.match(styles, /\.stoicheion-view/);
  assert.match(styles, /\.month-rail button:last-child/);
  assert.doesNotMatch(styles, /\.mobile-nav button\[data-nav-id="admin"\]\s*\{/);
  assert.match(styles, /grid-auto-flow: column/);
  assert.match(styles, /mask-image: linear-gradient\(to right/);
  assert.match(styles, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@keyframes shieldPulse/);
  assert.match(styles, /\.proof-private i::before/);
  assert.match(styles, /overflow-x: hidden/);
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
  assert.match(google, /genesisGoogleTasksApi\(\s*'PATCH'/);
  assert.match(cloudSync, /googleTaskListId/);

  await access(new URL("../public/month-frieze-v1.webp", import.meta.url));
  await access(new URL("../public/month-frieze-v2.png", import.meta.url));
  await access(new URL("../public/month-art-v3/month-01.webp", import.meta.url));
  await access(new URL("../public/month-art-v3/month-13.webp", import.meta.url));
});
