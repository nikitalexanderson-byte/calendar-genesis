import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { gregorianSeasonArt } from "../app/gregorian-season-art.ts";

test("Gregorian seasons follow both hemispheres, including year boundaries", () => {
  const north={latitude:55.75,timeZone:"Europe/Moscow"};
  const south={latitude:-33.87,timeZone:"Australia/Sydney"};
  assert.deepEqual([0,2,5,8,11].map(month=>gregorianSeasonArt(month,north)),
    ["winter","spring","summer","autumn","winter"].map(season=>`gregorian-seasons/${season}.jpg`));
  assert.deepEqual([0,2,5,8,11].map(month=>gregorianSeasonArt(month,south)),
    ["summer","autumn","winter","spring","summer"].map(season=>`gregorian-seasons/southern/${season}.jpg`));
});

test("Regional landscapes match the native climate families", () => {
  const locations=[
    [60.17,"Europe/Helsinki","boreal/winter"],
    [41.90,"Europe/Rome","mediterranean/winter"],
    [24.71,"Asia/Riyadh","arid/winter"],
    [1.35,"Asia/Singapore","tropical/winter"],
    [-23.55,"America/Sao_Paulo","tropical/summer"],
    [-33.93,"Africa/Johannesburg","southern/summer"],
    [-31.95,"Australia/Perth","mediterranean/summer"],
  ];
  for (const [latitude,timeZone,expected] of locations)
    assert.equal(gregorianSeasonArt(0,{latitude,timeZone}),`gregorian-seasons/${expected}.jpg`);
});

test("Every selected image exists and preserves the native original", () => {
  for (const location of [{latitude:55.75},{latitude:62},{latitude:41,timeZone:"Europe/Rome"},
    {latitude:24,timeZone:"Asia/Riyadh"},{latitude:1,timeZone:"Asia/Singapore"},{latitude:-34}]) {
    for(let month=0;month<12;month++) {
      const file=gregorianSeasonArt(month,location);
      const publicFile=new URL(`../public/${file}`,import.meta.url);
      assert.ok(existsSync(publicFile));
      assert.deepEqual(readFileSync(publicFile),readFileSync(new URL(`../android/app/src/main/assets/originals/${file}`,import.meta.url)));
    }
  }
});
