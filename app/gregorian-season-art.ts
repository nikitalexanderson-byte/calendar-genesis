type SeasonLocation = { latitude: number; timeZone?: string };
type Season = "winter" | "spring" | "summer" | "autumn";

/** Uses the same offline climate hints and artwork as the native calendar. */
export function gregorianSeasonArt(monthIndex: number, location: SeasonLocation): string {
  const zone = location.timeZone ?? "";
  const latitude = Math.abs(location.latitude);
  const southern = location.latitude < -5 || /^(Australia|Antarctica)\//.test(zone)
    || /^America\/Argentina\//.test(zone)
    || /Auckland|Chatham|Buenos_Aires|Montevideo|Santiago|Sao_Paulo|Johannesburg|Windhoek|Harare|Maputo/.test(zone);
  let region = "";
  if (/Phoenix|Hermosillo|Chihuahua|Cairo|Tripoli|Algiers|Tunis|Khartoum|Riyadh|Dubai|Abu_Dhabi|Kuwait|Baghdad|Tehran|Ashgabat|Alice_Springs|Lima/.test(zone)) region = "arid";
  else if (/Rome|Madrid|Lisbon|Athens|Malta|Nicosia|Istanbul|Los_Angeles|Perth|Tel_Aviv|Beirut|Casablanca/.test(zone)) region = "mediterranean";
  else if (/Darwin|Sao_Paulo|Singapore|Bangkok|Jakarta|Manila|Kolkata/.test(zone)) region = "tropical";
  else if ((latitude >= 58 || /Helsinki|Stockholm|Oslo|Reykjavik|Anchorage/.test(zone)) && !southern) region = "boreal";
  else if (southern && (latitude >= 23 || /Johannesburg|Windhoek|Harare|Maputo|Auckland|Chatham/.test(zone))) region = "southern";
  else if (latitude < 23.5 || /^(Pacific|Indian)\//.test(zone)) region = "tropical";
  const seasonMonth = ((monthIndex + (southern ? 6 : 0)) % 12 + 12) % 12;
  const season: Season = seasonMonth < 2 || seasonMonth === 11 ? "winter"
    : seasonMonth < 5 ? "spring" : seasonMonth < 8 ? "summer" : "autumn";
  return `gregorian-seasons/${region ? `${region}/` : ""}${season}.jpg`;
}
