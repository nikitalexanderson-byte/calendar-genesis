import type { Food } from './nutrition-domain.ts';
import { blankFood } from './nutrition-domain.ts';
import raw from './food-reference-data.json';
type FoodReference = { id: string; fdcId: number | null; manualId?: number; name: string[]; aliases?: string[]; category: string; state: Food['state']; top: boolean; properties: string[]; health: string[]; limits: string[]; links: string[]; legume?: boolean };
export const FOOD_REFERENCES = raw as FoodReference[];
export const foodReferenceFor = (food: Food) => FOOD_REFERENCES.find(entry => entry.id === food.provenance.id || `reference:${entry.id}` === food.provenance.id);
export const isTopFood = (food: Food) => food.category === 'ТОП СУПЕРФУДОВ' || !!food.collections?.includes('superfoods') || !!foodReferenceFor(food)?.top;
export function manualReferenceFoods(language: string) {
  return FOOD_REFERENCES.filter(entry => entry.manualId).map(entry => {
    const food = blankFood();
    food.name = entry.name[language === 'en' ? 1 : 0]; food.aliases = [...entry.name, ...(entry.aliases ?? [])];
    food.category = entry.category; food.state = entry.state; food.collections = ['superfoods'];
    food.ingredients = food.name; food.compositionKnown = false;
    if (entry.legume) food.contains = ['legume'];
    food.provenance = { provider: 'manual', id: `reference:${entry.id}`, version: 'GENESIS / 2026-10-25 / label required', source: entry.links[0], license: 'Original reference text; numerical composition requires the product label.' };
    return { id: `00000000-0000-4000-8000-${String(entry.manualId).padStart(12, '0')}`, food };
  });
}
