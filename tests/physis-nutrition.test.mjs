import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  blankFood, nutrient, baseAmount, itemNutrients, totalNutrients, snapshotItem, copyMeal,
  recipeFood, foodWarnings, resolveTargets, estimateEnergy, energyDifference, summaryForDay,
  importUsdaFood, validateNutritionRecord, suggestPortion, compareNutrientReference, NUTRIENT_REFERENCES,
} from '../app/physis/nutrition-domain.ts';
import { newPhysisRecord } from '../app/physis/types.ts';

function food(name = 'Label food', nutrients = { energy: 120, protein: 10, fat: 4, carbohydrate: 11 }) {
  return { ...blankFood(), name, compositionKnown: true, nutrients: Object.fromEntries(Object.entries(nutrients).map(([key, value]) => [key, nutrient(value, key, '100g', 'Label', '2026-10')])) };
}
function meal(items, status = 'actual') {
  return { date: '2026-10-24', time: '12:00', timeZone: 'Europe/Moscow', name: 'Lunch', status, items, note: '' };
}

test('known zero, unknown and trace remain distinct in totals', () => {
  const first = food('Known', { energy: 100, protein: 0, fiber: 2 });
  const second = food('Unknown', { energy: 200, protein: null });
  second.nutrients.fiber = nutrient(null, 'fiber', '100g', 'Label', '1', 'trace');
  const totals = totalNutrients([snapshotItem('a', first, 100, 'g'), snapshotItem('b', second, 50, 'g')]);
  assert.equal(totals.energy.value, 200);
  assert.equal(totals.protein.value, null);
  assert.equal(totals.protein.knownValue, 0);
  assert.equal(totals.protein.knownItems, 1);
  assert.equal(totals.fiber.value, null);
  assert.equal(totals.fiber.knownValue, 2);
  assert.equal(first.nutrients.protein.quality, 'zero');
  assert.equal(second.nutrients.protein.quality, 'unknown');
  assert.equal(second.nutrients.fiber.quality, 'trace');
});

test('liquid conversion requires explicit density and portions use their own basis', () => {
  const oil = food('Oil', { energy: 900, fat: 100 });
  assert.throws(() => baseAmount(oil, 10, 'ml'), /плотность/);
  oil.densityGPerMl = .92;
  assert.ok(Math.abs(baseAmount(oil, 10, 'ml') - 9.2) < 1e-9);
  oil.servingAmount = 15;
  assert.equal(baseAmount(oil, 2, 'serving'), 30);
  const liquid = { ...food(), basis: '100ml', densityGPerMl: 1.2 };
  assert.equal(baseAmount(liquid, 120, 'g'), 100);
  assert.throws(() => baseAmount(oil, 0, 'g'));
  assert.throws(() => baseAmount(oil, Infinity, 'g'));
});

test('meal snapshot and history are unaffected by catalog changes; copy remains a plan', () => {
  const original = food();
  const item = snapshotItem('food-id', original, 150, 'g');
  const originalMeal = meal([item]);
  original.name = 'Renamed'; original.nutrients.protein.value = 999;
  assert.equal(item.food.name, 'Label food');
  assert.equal(itemNutrients(item).protein.value, 15);
  const copied = copyMeal(originalMeal, '2027-01-01', 'original-meal');
  assert.equal(copied.status, 'planned');
  assert.equal(copied.items[0].food.nutrients.protein.value, 10);
  assert.notEqual(copied.items[0].id, item.id);
  copied.items[0].food.name = 'Changed copy';
  assert.equal(item.food.name, 'Label food');
  assert.throws(() => copyMeal(originalMeal, '2026-02-30'));
});

test('daily actual and planned totals stay separate across dates and fortified sources', () => {
  const ordinary = food(); const fortified = { ...food('Fortified'), fortified: true };
  const actual = newPhysisRecord('meal', meal([snapshotItem('a', ordinary, 100, 'g'), snapshotItem('b', fortified, 50, 'g')]));
  const planned = newPhysisRecord('meal', meal([snapshotItem('a', ordinary, 200, 'g')], 'planned'));
  const other = newPhysisRecord('meal', { ...meal([snapshotItem('a', ordinary, 1000, 'g')]), date: '2026-10-25' });
  const summary = summaryForDay({ records: [actual, planned, other] }, '2026-10-24');
  assert.equal(summary.actual.energy.value, 180);
  assert.equal(summary.planned.energy.value, 240);
  assert.equal(summary.food.energy.value, 120);
  assert.equal(summary.fortified.energy.value, 60);
});

test('recipe yield changes concentration, not total nutrients, and missing composition propagates', () => {
  const lentils = { ...food('Lentils', { energy: 100, protein: 10, fiber: 5 }), contains: ['legume'], legumePreparation: 'adequately-cooked' };
  const oil = { ...food('Seed oil', { energy: 900, protein: 0, fat: 100 }), contains: ['seed-oil'], compositionKnown: false };
  const ingredients = [snapshotItem('lentils', lentils, 200, 'g'), snapshotItem('oil', oil, 10, 'g')];
  const recipe = recipeFood('Soup', ingredients, 500, 2);
  assert.equal(recipe.nutrients.energy.value, 58);
  assert.equal(recipe.nutrients.protein.value, 4);
  assert.equal(recipe.nutrients.fiber.value, null);
  assert.equal(recipe.servingAmount, 250);
  assert.equal(itemNutrients(snapshotItem('soup', recipe, 2, 'serving')).energy.value, 290);
  assert.deepEqual(recipe.contains, ['legume', 'seed-oil']);
  assert.equal(recipe.compositionKnown, false);
  assert.equal(recipe.legumePreparation, 'adequately-cooked');
  assert.equal(recipe.nutrients.energy.quality, 'estimate');
  assert.throws(() => recipeFood('Broken', ingredients, 0, 2));
});

test('personal food rules do not prevent facts, and legume cooking warnings are conditional', () => {
  const soy = { ...food('Soy'), contains: ['soy', 'legume'], legumePreparation: 'undercooked' };
  assert.ok(foodWarnings(soy).some(warning => warning.type === 'personal'));
  assert.ok(foodWarnings(soy).some(warning => warning.type === 'allergen'));
  assert.ok(foodWarnings(soy).some(warning => warning.type === 'preparation'));
  assert.ok(validateNutritionRecord(newPhysisRecord('meal', meal([snapshotItem('soy', soy, 100, 'g')]))));
  soy.legumePreparation = 'adequately-cooked';
  assert.equal(foodWarnings(soy).some(warning => warning.type === 'preparation'), false);
  assert.equal(foodWarnings(soy, []).some(warning => warning.type === 'personal'), false);
  const genericOil = { ...food('Vegetable oil'), compositionKnown: false };
  assert.equal(foodWarnings(genericOil).some(warning => warning.type === 'personal'), false);
  assert.ok(foodWarnings(genericOil).some(warning => warning.type === 'incomplete'));
});

test('energy percentages are not mass percentages and g/kg needs body mass', () => {
  const inputs = { mode: 'calories', unit: 'energy-percent', energy: 2000, protein: 30, fat: 30, carbohydrate: 40, weightKg: 80 };
  const result = resolveTargets(inputs);
  assert.equal(result.protein, 150);
  assert.ok(Math.abs(result.fat - 66.66666666666667) < 1e-6);
  assert.equal(result.carbohydrate, 200);
  assert.throws(() => resolveTargets({ ...inputs, carbohydrate: 30 }), /100%/);
  assert.throws(() => resolveTargets({ ...inputs, unit: 'g', protein: 30, fat: 30, carbohydrate: 30 }), /согласованы/);
  const byWeight = resolveTargets({ mode: 'macros', unit: 'g-per-kg', protein: 2, fat: 1, carbohydrate: 3, energy: 0, weightKg: 80 });
  assert.equal(byWeight.protein, 160);
  assert.equal(byWeight.energy, 2320);
  assert.throws(() => resolveTargets({ ...inputs, unit: 'g-per-kg', weightKg: null }), /массу/);
});

test('food label energy is preserved even when 4/9/4 differs', () => {
  const label = food('High fiber label', { energy: 100, protein: 10, fat: 0, carbohydrate: 30, fiber: 20 });
  assert.equal(energyDifference(label), -60);
  assert.equal(itemNutrients(snapshotItem('label', label, 200, 'g')).energy.value, 200);
  assert.equal(label.nutrients.energy.value, 100);
});

test('Mifflin estimate has version/source, does not add activity calories twice and rejects exclusions', () => {
  const input = { age: 30, heightCm: 180, weightKg: 80, formulaSex: 'male', activityFactor: 1.5, excluded: false };
  const result = estimateEnergy(input);
  assert.equal(result.resting, 1780);
  assert.equal(result.maintenance, 2670);
  assert.match(result.source, /10.1093/);
  assert.match(result.version, /1990/);
  assert.throws(() => estimateEnergy({ ...input, age: 17 }));
  assert.throws(() => estimateEnergy({ ...input, excluded: true }));
  assert.throws(() => estimateEnergy({ ...input, activityFactor: 0 }));
});

test('USDA starter IDs, version, real composition and estimated zeros retain provenance', () => {
  const raw = JSON.parse(readFileSync(new URL('../app/physis/nutrition-seed.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(raw.length, 4);
  for (const entry of raw) {
    const imported = importUsdaFood(entry);
    assert.equal(imported.provenance.provider, 'USDA');
    assert.match(imported.provenance.license, /CC0/);
    assert.equal(imported.provenance.id, String(entry.fdcId));
    assert.ok(validateNutritionRecord(newPhysisRecord('food', imported)));
  }
  const apple = importUsdaFood(raw.find(entry => entry.fdcId === 171688));
  assert.equal(apple.nutrients.energy.value, 52);
  assert.equal(apple.nutrients.protein.value, .26);
  assert.equal(apple.nutrients.transFat.value, 0);
  assert.equal(apple.nutrients.transFat.quality, 'estimate');
  assert.equal(apple.compositionKnown, false);
  assert.throws(() => importUsdaFood({ description: 'No ID', foodNutrients: [] }));
  const unsupported = importUsdaFood({ fdcId: 1, description: 'Wrong unit', foodNutrients: [{ nutrient: { id: 1090, unitName: 'IU' }, amount: 5 }] });
  assert.equal(unsupported.nutrients.magnesium, undefined);
});

test('portion suggestions honor a limit and never invent unknown nutrients', () => {
  const known = food();
  assert.deepEqual(suggestPortion(known, 'protein', 20), { quantity: 200, unit: 'g', fulfills: true });
  assert.deepEqual(suggestPortion(known, 'protein', 200), { quantity: 1000, unit: 'g', fulfills: false });
  assert.equal(suggestPortion(known, 'magnesium', 20), null);
  assert.equal(suggestPortion(known, 'protein', 0), null);
});

test('decode/import validation rejects malformed quantities, hidden unit mismatch and forged recipe results', () => {
  const valid = newPhysisRecord('food', food());
  assert.ok(validateNutritionRecord(valid));
  const mismatch = structuredClone(valid); mismatch.data.nutrients.protein.unit = 'IU';
  assert.equal(validateNutritionRecord(mismatch), false);
  const zero = structuredClone(valid); zero.data.nutrients.protein.quality = 'zero';
  assert.equal(validateNutritionRecord(zero), false);
  const badDate = newPhysisRecord('meal', { ...meal([snapshotItem('a', food(), 100, 'g')]), date: '2026-02-30' });
  assert.equal(validateNutritionRecord(badDate), false);
  const items = [snapshotItem('a', food(), 100, 'g')];
  const recipe = newPhysisRecord('recipe', { name: 'Meal', ingredients: items, yieldGrams: 200, servings: 2, note: '', food: recipeFood('Meal', items, 200, 2) });
  assert.ok(validateNutritionRecord(recipe));
  recipe.data.food.nutrients.protein.value = 400;
  assert.equal(validateNutritionRecord(recipe), false);
  const liquid = newPhysisRecord('meal', meal([{ ...snapshotItem('a', food(), 100, 'g'), unit: 'ml' }]));
  assert.equal(validateNutritionRecord(liquid), false);
});

test('magnesium supplemental UL excludes food and enforces age, units and incomplete sources', () => {
  const reference = NUTRIENT_REFERENCES[0];
  const person = { age: 30, sex: 'female', state: 'general' };
  const sources = { food: 1000, supplement: 300, medicine: 25, unit: 'mg' };
  const comparison = compareNutrientReference(reference, person, sources);
  assert.equal(comparison.value, 325);
  assert.equal(comparison.aboveUpperLimit, false);
  assert.equal(compareNutrientReference(reference, person, { ...sources, medicine: 100 }).aboveUpperLimit, true);
  assert.equal(compareNutrientReference(reference, { ...person, age: 17 }, sources), null);
  assert.equal(compareNutrientReference(reference, { ...person, age: null }, sources), null);
  assert.equal(compareNutrientReference(reference, person, { ...sources, unit: 'mcg' }), null);
  assert.equal(compareNutrientReference(reference, person, { ...sources, supplement: null }), null);
  assert.equal(compareNutrientReference(reference, person, { ...sources, food: null }).value, 325);
});

test('structured JSON round trip preserves snapshots and unknown values', () => {
  const record = newPhysisRecord('meal', meal([snapshotItem('a', food('Unknown iron', { energy: 100, iron: null }), 125, 'g')]));
  const restored = JSON.parse(JSON.stringify(record));
  assert.ok(validateNutritionRecord(restored));
  assert.deepEqual(restored, record);
  assert.equal(restored.data.items[0].food.nutrients.iron.value, null);
});
