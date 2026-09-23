import assert from "node:assert/strict";
import test from "node:test";

import { cleanGenesisAppUrl } from "../app/app-url.ts";

test("removes the transient QA marker from every GENESIS section link", () => {
  const sections = [
    "today",
    "all-tasks",
    "projects",
    "habits",
    "calendar",
    "year",
    "stoicheion",
    "theokyklos",
    "admin",
  ];
  for (const section of sections) {
    assert.equal(
      cleanGenesisAppUrl(`https://genesiscalendar.ru/?qa=6b0d2bb#${section}`),
      `/#${section}`,
    );
  }
});

test("keeps supported query parameters while removing QA", () => {
  assert.equal(
    cleanGenesisAppUrl("https://genesiscalendar.ru/?lang=en&qa=temporary#calendar"),
    "/?lang=en#calendar",
  );
  assert.equal(
    cleanGenesisAppUrl("/?auth_error=access_denied#today"),
    "/?auth_error=access_denied#today",
  );
});

test("leaves already clean links unchanged", () => {
  assert.equal(cleanGenesisAppUrl("https://genesiscalendar.ru/#projects"), "/#projects");
});
