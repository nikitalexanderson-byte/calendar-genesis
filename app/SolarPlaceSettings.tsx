"use client";

import { useState } from "react";
import { readSolarPlace, saveSolarPlace, searchSolarPlaces, solarPlaceLabel, type SolarPlace } from "./solar-place";

export function SolarPlaceSettings() {
  const [selected, setSelected] = useState<SolarPlace | null>(() => readSolarPlace());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SolarPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const search = async () => {
    setBusy(true);
    setError("");
    try {
      const found = await searchSolarPlaces(query);
      setResults(found);
      if (!found.length) setError("Город не найден. Уточните название и страну.");
    } catch { setError("Не удалось найти город. Проверьте подключение."); }
    finally { setBusy(false); }
  };

  return <section className="account-preferences solar-place-preference" aria-labelledby="solar-place-title" data-exp-ui="panel">
    <div>
      <span className="eyebrow">Восход и закат</span>
      <h3 id="solar-place-title">Местоположение</h3>
      <p>Выберите страну и город. Время будет рассчитано для его координат и местного часового пояса.</p>
      <p aria-live="polite">{selected ? `Выбрано: ${solarPlaceLabel(selected)}` : "Город не выбран: время с символом ≈ приблизительно."}</p>
    </div>
    <div className="solar-place-search">
      <label htmlFor="solar-place-query">Город, страна</label>
      <input id="solar-place-query" value={query} onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} />
      <button type="button" disabled={query.trim().length < 2 || busy} onClick={() => void search()}>
        {busy ? "Ищем…" : "Найти город"}
      </button>
    </div>
    {error && <p role="alert">{error}</p>}
    {results.length > 0 && <div className="solar-place-results" aria-label="Найденные города">
      {results.map((place) => <button type="button" key={`${place.name}-${place.latitude}-${place.longitude}`}
        onClick={() => { saveSolarPlace(place); setSelected(place); setResults([]); setQuery(solarPlaceLabel(place)); }}>
        {solarPlaceLabel(place)} · {place.timeZone}
      </button>)}
    </div>}
    {selected && <button type="button" className="secondary-button" onClick={() => {
      saveSolarPlace(null); setSelected(null); setQuery("");
    }}>Сбросить город</button>}
  </section>;
}
