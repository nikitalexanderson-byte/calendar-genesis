import assert from 'node:assert/strict';
import test from 'node:test';
import {calendarModule} from './helpers/calendar-modules.mjs';
const r=calendarModule('app/rewards.ts');
const credit=(key,createdAt,amount=25)=>r.createRewardTransaction({amount,reason:'comeback',sourceId:key,idempotencyKey:key,createdAt});
const at='2026-10-18T12:00:00.000Z';

test('explicit early-deletion reset wins over credits at the same instant regardless of keys, timezone notation or arrival order',()=>{
 for(const timestamp of [at,'2026-10-18T12:00:00Z','2026-10-18T15:00:00+03:00']) {
  const earned=credit('zz-credit',timestamp);
  const ledger=r.resetLaurelsBalance([earned],'habit-deleted-reset','habit','aa-deletion',at);
  assert.equal(r.calculateLaurelsBalance(ledger),0);
  assert.equal(r.calculateLaurelsBalance([...ledger].reverse()),0);
  assert.equal(r.calculateLaurelsBalance([...ledger,...ledger]),0);
 }
});
test('a reward earned after a deletion remains valid while an offline replay cannot reissue older credits',()=>{
 const earned=credit('zz-credit','2026-10-18T11:59:59Z');
 const ledger=r.resetLaurelsBalance([earned],'habit-deleted-reset','habit','deletion',at);
 const next=[...ledger,credit('later','2026-10-18T12:00:00.001Z',5),earned];
 assert.equal(r.calculateLaurelsBalance(next),5);
 assert.equal(r.normalizeRewardTransactions(next).filter(row=>row.idempotencyKey==='zz-credit').length,1);
});
