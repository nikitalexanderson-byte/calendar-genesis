import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {featureAllowed} from "../app/feature-access.ts";
const now = Date.parse("2026-10-30T00:00:00Z");
const access = {schemaVersion:1, policyRevision:"synthetic", enforcementEnabled:true, declaredPlan:"premium", effectivePlan:"premium", lifetimePremium:false,
  validUntil:"2026-11-30T00:00:00Z", evaluatedAt:"2026-10-30T00:00:00Z", allowedFeatures:["tasks","diary"], freeFeatures:["tasks"]};
test("3.1.3 policy and legacy clients remain unrestricted for every plan", () => {
  const policy = JSON.parse(readFileSync(new URL("../server/resources/feature-access-policy.json", import.meta.url)));
  assert.equal(policy.enforcementEnabled, false);
  for (const plans of Object.values(policy.features)) assert.deepEqual(plans, ["free","standart","premium","business"]);
  assert.equal(featureAllowed(undefined, "diary", now), true);
  assert.equal(featureAllowed({...access,enforcementEnabled:false}, "unknown", now), true);
});
test("future active paid access is explicit; unknown capabilities fail closed", () => {
  assert.equal(featureAllowed(access,"diary",now),true);
  assert.equal(featureAllowed(access,"teams",now),false);
});
test("unpaid or expired status drops to free at the boundary", () => {
  for (const validUntil of [null,"invalid","2026-10-30T00:00:00Z",
    "2030-02-30T00:00:00Z", "2030-11-31T00:00:00Z", "2100-02-29T00:00:00Z",
    "2030-01-01T24:00:00Z", "2030-01-01T12:60:00Z", "2030-01-01T12:00:60Z",
    "2030-01-01T00:00:00+18:01", "2030-01-01T00:00:00-18:01",
    "2030-01-01T00:00:00+19:00", "2030-01-01T00:00:00+01:60"]) {
    assert.equal(featureAllowed({...access,validUntil},"diary",now),false);
    assert.equal(featureAllowed({...access,validUntil},"tasks",now),true);
  }
});

test("valid Gregorian leap dates and maximum Java-compatible offsets retain paid access", () => {
  for (const validUntil of ["2028-02-29T12:00:00+03:00", "2028-02-29T23:45:59+18:00",
    "2028-02-29T23:45:59-18:00", "2400-02-29T00:00:00Z"]) {
    assert.equal(featureAllowed({...access,validUntil},"diary",now),true,validUntil);
  }
});
test("admin-assigned lifetime Premium does not expire or become Business", () => {
  const lifetime = {...access,lifetimePremium:true,declaredPlan:"premium4life",validUntil:null};
  assert.equal(featureAllowed(lifetime,"diary",now+1e12),true);
  assert.equal(featureAllowed(lifetime,"teams",now),false);
  assert.equal(featureAllowed({...lifetime,validUntil:"2030-02-30T00:00:00Z"},"diary",now+1e12),true);
});
