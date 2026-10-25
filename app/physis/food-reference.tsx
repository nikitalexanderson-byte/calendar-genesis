import type { Food } from './nutrition-domain';
import { foodReferenceFor } from './food-reference-domain';
export { FOOD_REFERENCES, isTopFood, manualReferenceFoods } from './food-reference-domain';
import './reference-catalogs.css';
export function FoodReferenceNote({ food, language }: { food: Food; language: string }) {
  const entry = foodReferenceFor(food); if (!entry) return null;
  const en = language === 'en'; const at = en ? 1 : 0;
  return <section className="physis-food-reference"><h4>{en ? 'Nutrient properties' : 'Нутриентные свойства'}</h4><p>{entry.properties[at]}</p><p>{entry.health[at]}</p><details><summary>{en ? 'Limits and sources' : 'Ограничения и источники'}</summary><p>{entry.limits[at]}</p>{entry.fdcId ? <p><a href={`https://fdc.nal.usda.gov/food-details/${entry.fdcId}/nutrients`} target="_blank" rel="noreferrer">USDA FoodData Central · {entry.fdcId}</a></p> : <p>{en ? 'No matching verified numerical composition: enter the actual label values. Missing values stay unknown.' : 'Точного проверенного численного состава нет: внесите значения с этикетки. Отсутствующие данные остаются неизвестными.'}</p>}{entry.links.map(url => <p key={url}><a href={url} target="_blank" rel="noreferrer">{new URL(url).hostname}</a></p>)}</details></section>;
}
export function SuperfoodCollectionNote({ language }: { language: string }) {
  const en = language === 'en';
  return <div className="physis-food-collection-note"><p>{en ? 'A selection from your source table. Foods remain in their regular categories too. Health effects depend on the whole diet and portion; the collection is not a medical ranking.' : 'Подборка из вашей исходной таблицы. Продукты доступны и в обычных категориях. Влияние на здоровье зависит от всего рациона и порции; подборка не является медицинским рейтингом.'}</p><details><summary>{en ? 'What was excluded' : 'Что не вошло в подборку'}</summary><p>{en ? 'Apricot kernels were excluded because their amygdalin can release cyanide. They are not a safe health food.' : 'Абрикосовые косточки исключены: амигдалин может высвобождать цианид. Они не представлены как безопасный продукт для здоровья.'}</p><a href="https://www.efsa.europa.eu/en/press/news/160427" target="_blank" rel="noreferrer">EFSA</a></details></div>;
}
