import assert from 'node:assert/strict';
import test from 'node:test';
import {
  regimenEvents, reviseRegimen, validPeriod, validateCareRecord, validDrug,
  activeAmount, convertMass, convertGlucose, oralNutrientsForDay, intakeRecordId,
  cancelIntake, measurementUnits, careMomentParts, editCareMoment, pendingIntakeEvents,
} from '../app/physis/care-domain.ts';
import { newPhysisRecord } from '../app/physis/types.ts';

const drug = () => ({ name: 'Test supplement', brand: '', category: 'supplement', form: 'Капсула', route: 'oral', activeIngredients: 'magnesium', amountPerUnit: 100, activeUnit: 'mg', concentration: null, concentrationUnit: 'mg/ml', packageSize: '', source: 'Synthetic test fixture', notes: '', favorite: false, archived: false, nutrients: [{ nutrient: 'magnesium', value: 100, unit: 'mg', elemental: true }] });
const period = (patch = {}) => ({ id: crypto.randomUUID(), start: '2026-03-07', end: '', timeZone: 'America/New_York', mode: 'daily', times: ['09:00'], weekdays: [1, 2, 3, 4, 5], everyDays: 1, everyHours: 24, anchorAt: '2026-03-07T14:00:00Z', dose: 1, unit: 'шт', route: 'oral', food: '', notes: '', ...patch });
const regimen = (periods = [period()]) => newPhysisRecord('regimen', { name: 'Test course', drugId: crypto.randomUUID(), drugSnapshot: drug(), version: 1, periods, archived: false, previousVersions: [] });
const intake = (patch = {}) => ({ eventId: crypto.randomUUID(), regimenId: null, regimenVersion: null, plannedAt: null, takenAt: '2026-10-24T12:00:00Z', timeZone: 'Europe/Moscow', day: '2026-10-24', quantity: 2, unit: 'шт', route: 'oral', status: 'taken', postponedUntil: null, drugSnapshot: drug(), source: 'manual', note: '', editedAt: null, ...patch });
const measurement = (patch = {}) => ({ type: 'pressure', label: 'Blood pressure', value: 120, secondValue: 80, pulse: 64, unit: 'mmHg', timestamp: '2026-10-24T12:00:00Z', timeZone: 'Europe/Moscow', day: '2026-10-24', source: 'Manual', device: '', context: 'Seated', intervalMinutes: null, arm: 'Left', position: 'Seated', note: '', scale: 'numeric', target: null, editedAt: null, ...patch });

test('postponed reminders cross midnight without changing the original event, version or journal day', () => {
  const course = regimen([period({ start: '2026-10-24', timeZone: 'Europe/Moscow', times: ['23:30'] })]);
  const original = regimenEvents(course, '2026-10-24', '2026-10-24')[0];
  const fact = newPhysisRecord('intake', intake({ eventId: original.eventId, regimenId: course.id, regimenVersion: 1,
    plannedAt: original.plannedAt, day: '2026-10-24', status: 'postponed', postponedUntil: '2026-10-24T22:30:00Z' })); // 01:30 Moscow on Oct 25.
  const before = structuredClone(fact);
  const edited = structuredClone(course.data); edited.drugSnapshot.name = 'New version product';
  course.data = reviseRegimen(course.data, edited, '2026-10-25');
  assert.equal(pendingIntakeEvents([course], [fact], '2026-10-24').length, 0);
  const pending = pendingIntakeEvents([course], [fact], '2026-10-25');
  assert.equal(pending.length, 2);
  assert.equal(pending[0].eventId, original.eventId);
  assert.equal(pending[0].plannedAt, original.plannedAt);
  assert.equal(pending[0].day, '2026-10-24');
  assert.equal(pending[0].regimenVersion, 1);
  assert.equal(pending[0].drugSnapshot.name, 'Test supplement');
  assert.equal(pending[0].dueAt, fact.data.postponedUntil);
  assert.equal(pending.filter(event => Date.parse(event.dueAt) <= Date.parse('2026-10-24T22:29:00Z')).length, 0);
  assert.equal(pending.filter(event => Date.parse(event.dueAt) <= Date.parse('2026-10-24T22:30:00Z')).length, 1);
  assert.equal(pendingIntakeEvents([course], [fact], '2026-10-26', true).filter(event => event.postponed).length, 1);
  assert.deepEqual(fact, before);
  fact.data.status = 'taken';
  assert.equal(pendingIntakeEvents([course], [fact], '2026-10-25').length, 1);
});

test('same-day postponement is not duplicated and explicit PRN reminders survive course archive', () => {
  const course = regimen([period({ start: '2026-10-24', timeZone: 'UTC' })]);
  const event = regimenEvents(course, '2026-10-24', '2026-10-24')[0];
  const fact = newPhysisRecord('intake', intake({ eventId: event.eventId, regimenId: course.id, regimenVersion: 1,
    plannedAt: event.plannedAt, timeZone: 'UTC', status: 'postponed', postponedUntil: '2026-10-24T16:00:00Z' }));
  assert.equal(pendingIntakeEvents([course], [fact], '2026-10-24').length, 1);
  fact.data.status = 'cancelled';
  assert.equal(pendingIntakeEvents([course], [fact], '2026-10-24')[0].dueAt, event.plannedAt);
  fact.data.status = 'skipped';
  assert.equal(pendingIntakeEvents([course], [fact], '2026-10-24').length, 0);
  course.data.archived = true;
  const manual = newPhysisRecord('intake', intake({ status: 'postponed', postponedUntil: '2026-10-25T09:00:00Z' }));
  const pending = pendingIntakeEvents([course], [manual], '2026-10-25');
  assert.equal(pending.length, 1); assert.equal(pending[0].regimenId, null); assert.equal(pending[0].plannedAt, null);
});

test('daily local 09:00 and every 24h differ across spring DST', () => {
  const daily = regimen();
  const fixed = regimen([period({ mode: 'hours' })]);
  const local = regimenEvents(daily, '2026-03-07', '2026-03-09');
  const absolute = regimenEvents(fixed, '2026-03-07', '2026-03-09');
  assert.equal(local.length, 3);
  assert.equal(absolute.length, 3);
  assert.equal(Date.parse(local[1].plannedAt) - Date.parse(local[0].plannedAt), 23 * 3600000);
  assert.equal(Date.parse(absolute[1].plannedAt) - Date.parse(absolute[0].plannedAt), 24 * 3600000);
  assert.equal(local[1].plannedAt, '2026-03-08T13:00:00.000Z');
  assert.equal(absolute[1].plannedAt, '2026-03-08T14:00:00.000Z');
});

test('PRN has no automatic missed events; weekdays and end dates constrain schedules', () => {
  assert.deepEqual(regimenEvents(regimen([period({ mode: 'prn', times: [] })]), '2026-03-07', '2026-03-10'), []);
  const selected = regimenEvents(regimen([period({ mode: 'weekdays', weekdays: [1], end: '2026-03-09' })]), '2026-03-07', '2026-03-15');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].day, '2026-03-09');
  assert.equal(validPeriod(period({ mode: 'daily', times: [] })), false);
  assert.equal(validPeriod(period({ times: ['09:00', '09:00'] })), false);
});

test('regimen revision excludes expired periods, freezes old drug snapshots and retains N-day cadence', () => {
  const expired = period({ start: '2026-10-01', end: '2026-10-10', timeZone: 'UTC' });
  const live = period({ start: '2026-10-20', timeZone: 'UTC', mode: 'every-days', everyDays: 3 });
  const original = regimen([expired, live]);
  const edited = structuredClone(original.data); edited.drugSnapshot.name = 'Changed'; edited.drugSnapshot.amountPerUnit = 200;
  const revised = reviseRegimen(original.data, edited, '2026-10-25', '2026-10-24T00:00:00Z');
  assert.equal(revised.periods.length, 3);
  assert.ok(revised.periods.every(validPeriod));
  assert.equal(revised.previousVersions.length, 1);
  assert.equal(revised.previousVersions[0].drugSnapshot.name, 'Test supplement');
  assert.equal(original.data.periods[1].end, '');
  const events = regimenEvents({ ...original, data: revised }, '2026-10-23', '2026-10-29');
  assert.deepEqual(events.map(event => event.day), ['2026-10-23', '2026-10-26', '2026-10-29']);
  assert.equal(events[0].drugSnapshot.name, 'Test supplement');
  assert.equal(events[0].regimenVersion, 1);
  assert.equal(events[1].drugSnapshot.name, 'Changed');
  assert.equal(events[1].regimenVersion, 2);
  const secondRevision = reviseRegimen(revised, structuredClone(revised), '2026-10-28');
  assert.ok(secondRevision.periods.every(validPeriod));
  assert.equal(secondRevision.previousVersions.length, 2);
  assert.equal(regimenEvents({ ...original, data: secondRevision }, '2026-10-29', '2026-10-29').length, 1);
});

test('solution amounts require concentration; IU never turns into mass', () => {
  const product = drug();
  assert.deepEqual(activeAmount(product, 2, 'шт'), { value: 200, unit: 'mg' });
  assert.equal(activeAmount(product, 2, 'ml'), null);
  product.concentration = 5; product.concentrationUnit = 'mg/ml';
  assert.deepEqual(activeAmount(product, 2, 'ml'), { value: 10, unit: 'mg' });
  assert.equal(activeAmount(product, 20, 'капля'), null);
  assert.deepEqual(activeAmount(product, 400, 'IU'), { value: 400, unit: 'IU' });
  assert.equal(convertMass(400, 'IU', 'mg'), null);
  assert.equal(convertMass(1, 'g', 'mg'), 1000);
  assert.equal(convertMass(1000, 'mcg', 'mg'), 1);
  assert.equal(convertMass(5, 'toString', 'mg'), null);
});

test('food totals count only actual oral elemental unit doses and separate supplement/medicine', () => {
  const medicine = { ...drug(), category: 'medicine', nutrients: [{ nutrient: 'magnesium', value: .05, unit: 'g', elemental: true }] };
  const records = [
    newPhysisRecord('intake', intake()),
    newPhysisRecord('intake', intake({ quantity: .5, status: 'partial', drugSnapshot: medicine })),
    newPhysisRecord('intake', intake({ route: 'intramuscular' })),
    newPhysisRecord('intake', intake({ status: 'skipped' })),
    newPhysisRecord('intake', intake({ status: 'cancelled' })),
    newPhysisRecord('intake', intake({ unit: 'ml' })),
    newPhysisRecord('intake', intake({ day: '2026-10-23' })),
    newPhysisRecord('intake', intake({ drugSnapshot: { ...drug(), nutrients: [{ nutrient: 'magnesium', value: 500, unit: 'mg', elemental: false }] } })),
  ];
  const totals = oralNutrientsForDay({ records }, '2026-10-24');
  assert.equal(totals.length, 2);
  assert.equal(totals[0].value, 200);
  assert.equal(totals[1].category, 'medicine');
  assert.equal(convertMass(totals[1].value, totals[1].unit, 'mg'), 25);
  const duplicate = drug(); duplicate.nutrients.push({ ...duplicate.nutrients[0] });
  assert.equal(validDrug(duplicate), false);
});

test('cancelling an intake retains stable identity for marking it again', async () => {
  const original = newPhysisRecord('intake', intake());
  const cancelled = cancelIntake(original.data, '2026-10-25T00:00:00Z');
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.eventId, original.data.eventId);
  assert.equal(cancelled.quantity, original.data.quantity);
  assert.equal(cancelled.editedAt, '2026-10-25T00:00:00Z');
  assert.ok(validateCareRecord({ ...original, data: cancelled }));
  const first = await intakeRecordId('owner', cancelled.eventId);
  assert.equal(first, await intakeRecordId('owner', original.data.eventId));
  assert.notEqual(first, await intakeRecordId('other-owner', original.data.eventId));
  assert.deepEqual(oralNutrientsForDay({ records: [{ ...original, data: cancelled }] }, '2026-10-24'), []);
});

test('glucose unit conversion round trips without changing original measurement', () => {
  const entry = measurement({ type: 'glucose', label: 'Glucose', value: 5.5, secondValue: null, unit: 'mmol/L' });
  const display = convertGlucose(entry.value, entry.unit, 'mg/dL');
  assert.ok(Math.abs(display - 99.1001) < 1e-8);
  assert.ok(Math.abs(convertGlucose(display, 'mg/dL', 'mmol/L') - 5.5) < 1e-8);
  assert.equal(entry.value, 5.5);
  assert.equal(entry.unit, 'mmol/L');
  assert.throws(() => convertGlucose(4, 'IU', 'mmol/L'));
});

test('pressure requires both values, built-in measurement units are strict and timestamps include a zone', () => {
  assert.ok(validateCareRecord(newPhysisRecord('measurement', measurement())));
  assert.equal(validateCareRecord(newPhysisRecord('measurement', measurement({ secondValue: null }))), false);
  assert.equal(validateCareRecord(newPhysisRecord('measurement', measurement({ unit: 'kg' }))), false);
  assert.equal(validateCareRecord(newPhysisRecord('measurement', measurement({ type: 'weight', value: 70, unit: 'stone' }))), false);
  assert.equal(validateCareRecord(newPhysisRecord('measurement', measurement({ timestamp: '2026-10-24T12:00:00' }))), false);
  assert.equal(validateCareRecord(newPhysisRecord('measurement', measurement({ timestamp: '2026-02-30T12:00:00Z' }))), false);
  assert.deepEqual(measurementUnits('weight'), ['kg', 'lb']);
  assert.deepEqual(measurementUnits('pressure'), ['mmHg']);
  assert.ok(validateCareRecord(newPhysisRecord('measurement', measurement({ type: 'custom', label: 'Forearm', value: 30, secondValue: null, unit: 'cm' }))));
});

test('custom date and clock fields resolve recorded local time and preserve an unchanged midnight instant', () => {
  const original = '2026-10-23T21:05:33.123Z';
  assert.deepEqual(careMomentParts(original, 'Europe/Moscow', '2026-10-24'), { day: '2026-10-24', time: '00:05' });
  const unchanged = editCareMoment(original, 'Europe/Moscow', '2026-10-24', '00:05');
  assert.equal(unchanged.timestamp, original);
  const moved = editCareMoment(original, 'Europe/Moscow', '2026-10-25', '00:05');
  assert.equal(moved.timestamp, '2026-10-24T21:05:00.000Z');
  assert.equal(moved.day, '2026-10-25');
  const postponed = editCareMoment(null, 'Europe/Moscow', '2026-10-25', '18:30');
  assert.equal(postponed.timestamp, '2026-10-25T15:30:00.000Z');
  assert.throws(() => careMomentParts(original, 'Not/AZone', '2026-10-24'));
  assert.throws(() => editCareMoment(original, 'Europe/Moscow', '2026-02-30', '12:00'));
});

test('custom clock changes use Genesis DST policy and retain an unchanged later overlap occurrence', () => {
  const gap = editCareMoment(null, 'America/New_York', '2026-03-08', '02:30');
  assert.equal(gap.adjustment, 'gap-forward');
  assert.deepEqual(careMomentParts(gap.timestamp, 'America/New_York', '2026-03-08'), { day: '2026-03-08', time: '03:30' });
  const laterOverlap = '2026-11-01T06:30:45.000Z';
  assert.equal(editCareMoment(laterOverlap, 'America/New_York', '2026-11-01', '01:30').timestamp, laterOverlap);
  const changedOverlap = editCareMoment(laterOverlap, 'America/New_York', '2026-11-01', '01:45');
  assert.equal(changedOverlap.adjustment, 'overlap-earlier');
  assert.equal(changedOverlap.timestamp, '2026-11-01T05:45:00.000Z');
});
