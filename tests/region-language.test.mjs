import assert from "node:assert/strict";
import test from "node:test";
import { languageForRegion } from "../app/region-language.ts";

test("location hints choose the city's language before a different interface locale", () => {
  assert.equal(languageForRegion("America/Los_Angeles", "RU"), "en");
  assert.equal(languageForRegion("Asia/Tokyo", "RU"), "ja");
  assert.equal(languageForRegion("Europe/Warsaw", "RU"), "pl");
  assert.equal(languageForRegion("Etc/UTC", "US"), "en");
});
