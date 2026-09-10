import { getRuntimeLanguage, runtimeLocale } from "./i18n";

const DAY_MS = 86_400_000;
const JULIAN_UNIX_EPOCH = 2_440_588;
const JULIAN_2000 = 2_451_545;
const SOLAR_TRANSIT_OFFSET = 0.0009;
const OBLIQUITY = 23.4397 * Math.PI / 180;
const SUNRISE_ALTITUDE = -0.833 * Math.PI / 180;
const NETWORK_LOCATION_ENDPOINT = "https://get.geojs.io/v1/ip/geo.json";
const TIMEZONE_LOCATION_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const LOCATION_REQUEST_TIMEOUT_MS = 2_500;

const TIMEZONE_REFERENCE_LOCATIONS: Record<string, DeviceLocation> = {
  "Etc/UTC": { latitude: 51.4769, longitude: 0 },
  UTC: { latitude: 51.4769, longitude: 0 },
  "Europe/Kaliningrad": { latitude: 54.7104, longitude: 20.4522 },
  "Europe/Moscow": { latitude: 55.7558, longitude: 37.6173 },
  "Europe/Simferopol": { latitude: 44.9521, longitude: 34.1024 },
  "Europe/Kirov": { latitude: 58.6035, longitude: 49.6679 },
  "Europe/Volgograd": { latitude: 48.708, longitude: 44.514 },
  "Europe/Astrakhan": { latitude: 46.3497, longitude: 48.0408 },
  "Europe/Saratov": { latitude: 51.5336, longitude: 46.0343 },
  "Europe/Ulyanovsk": { latitude: 54.3142, longitude: 48.4031 },
  "Europe/Samara": { latitude: 53.1959, longitude: 50.1002 },
  "Asia/Yekaterinburg": { latitude: 56.8389, longitude: 60.6057 },
  "Asia/Omsk": { latitude: 54.9885, longitude: 73.3242 },
  "Asia/Novosibirsk": { latitude: 55.0084, longitude: 82.9357 },
  "Asia/Barnaul": { latitude: 53.3474, longitude: 83.7784 },
  "Asia/Tomsk": { latitude: 56.4977, longitude: 84.9744 },
  "Asia/Novokuznetsk": { latitude: 53.7557, longitude: 87.1099 },
  "Asia/Krasnoyarsk": { latitude: 56.0153, longitude: 92.8932 },
  "Asia/Irkutsk": { latitude: 52.2869, longitude: 104.305 },
  "Asia/Chita": { latitude: 52.034, longitude: 113.4994 },
  "Asia/Yakutsk": { latitude: 62.0355, longitude: 129.6755 },
  "Asia/Khandyga": { latitude: 62.6533, longitude: 135.5617 },
  "Asia/Vladivostok": { latitude: 43.1155, longitude: 131.8855 },
  "Asia/Ust-Nera": { latitude: 64.5667, longitude: 143.2 },
  "Asia/Magadan": { latitude: 59.5682, longitude: 150.8085 },
  "Asia/Sakhalin": { latitude: 46.9591, longitude: 142.738 },
  "Asia/Srednekolymsk": { latitude: 67.458, longitude: 153.706 },
  "Asia/Kamchatka": { latitude: 53.0452, longitude: 158.6483 },
  "Asia/Anadyr": { latitude: 64.7337, longitude: 177.5089 },
};

export type DeviceLocation = {
  latitude: number;
  longitude: number;
};

export type AutomaticSolarLocation = DeviceLocation & {
  source: "network" | "timezone-network" | "timezone-fallback";
};

export type SunriseSunset = {
  sunrise: Date;
  sunset: Date;
};

type NetworkLocationResponse = {
  latitude?: string | number;
  longitude?: string | number;
};

type TimezoneLocationResponse = {
  results?: Array<NetworkLocationResponse & { timezone?: string }>;
};

function validateLocation(data: NetworkLocationResponse): DeviceLocation {
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    throw new Error("Location response is invalid");
  }
  return { latitude, longitude };
}

async function requestJson(url: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, LOCATION_REQUEST_TIMEOUT_MS);
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Location request failed: ${response.status}`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

async function getIpLocation(signal?: AbortSignal): Promise<AutomaticSolarLocation> {
  const data = await requestJson(NETWORK_LOCATION_ENDPOINT, signal) as NetworkLocationResponse;
  return { ...validateLocation(data), source: "network" };
}

async function getTimezoneNetworkLocation(timeZone: string, signal?: AbortSignal): Promise<AutomaticSolarLocation> {
  const city = timeZone.split("/").at(-1)?.replaceAll("_", " ") || "Greenwich";
  const url = new URL(TIMEZONE_LOCATION_ENDPOINT);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "10");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", getRuntimeLanguage());
  const data = await requestJson(url.toString(), signal) as TimezoneLocationResponse;
  const result = data.results?.find((location) => location.timezone === timeZone) ?? data.results?.[0];
  if (!result) throw new Error("Timezone location was not found");
  return { ...validateLocation(result), source: "timezone-network" };
}

function timezoneOffsetHours(timeZone: string) {
  const probe = new Date();
  probe.setUTCSeconds(0, 0);
  try {
    const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(probe).map((part) => [part.type, part.value]));
    const zonedTime = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    return Math.max(-12, Math.min(14, (zonedTime - probe.valueOf()) / 3_600_000));
  } catch {
    return 0;
  }
}

export function getTimezoneFallbackLocation(timeZone: string): AutomaticSolarLocation {
  const reference = TIMEZONE_REFERENCE_LOCATIONS[timeZone];
  if (reference) return { ...reference, source: "timezone-fallback" };

  const latitude = timeZone.startsWith("Australia/")
    || timeZone.startsWith("Indian/")
    || /Buenos_Aires|Sao_Paulo|Santiago|Montevideo/.test(timeZone)
    ? -25
    : timeZone.startsWith("America/")
    ? 40
    : timeZone.startsWith("Europe/")
    ? 50
    : timeZone.startsWith("Asia/")
    ? 35
    : timeZone.startsWith("Antarctica/")
    ? -70
    : 0;
  return {
    latitude,
    longitude: timezoneOffsetHours(timeZone) * 15,
    source: "timezone-fallback",
  };
}

export async function getAutomaticSolarLocation(timeZone: string, signal?: AbortSignal): Promise<AutomaticSolarLocation> {
  try {
    return await Promise.any([
      getIpLocation(signal),
      getTimezoneNetworkLocation(timeZone, signal),
    ]);
  } catch {
    return getTimezoneFallbackLocation(timeZone);
  }
}

function toJulian(date: Date) {
  return date.valueOf() / DAY_MS - 0.5 + JULIAN_UNIX_EPOCH;
}

function fromJulian(julianDay: number) {
  return new Date((julianDay + 0.5 - JULIAN_UNIX_EPOCH) * DAY_MS);
}

function solarMeanAnomaly(days: number) {
  return (357.5291 + 0.98560028 * days) * Math.PI / 180;
}

function eclipticLongitude(meanAnomaly: number) {
  const center = (1.9148 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly) + 0.0003 * Math.sin(3 * meanAnomaly)) * Math.PI / 180;
  const perihelion = 102.9372 * Math.PI / 180;
  return meanAnomaly + center + perihelion + Math.PI;
}

function solarDeclination(longitude: number) {
  return Math.asin(Math.sin(longitude) * Math.sin(OBLIQUITY));
}

function solarTransitJulian(approximateTransit: number, meanAnomaly: number, longitude: number) {
  return JULIAN_2000 + approximateTransit + 0.0053 * Math.sin(meanAnomaly) - 0.0069 * Math.sin(2 * longitude);
}

export function getSunriseSunset(date: Date, location: DeviceLocation): SunriseSunset | null {
  const latitude = location.latitude * Math.PI / 180;
  const longitudeWest = -location.longitude * Math.PI / 180;
  const days = toJulian(date) - JULIAN_2000;
  const cycle = Math.round(days - SOLAR_TRANSIT_OFFSET - longitudeWest / (2 * Math.PI));
  const approximateTransit = SOLAR_TRANSIT_OFFSET + (longitudeWest / (2 * Math.PI)) + cycle;
  const meanAnomaly = solarMeanAnomaly(approximateTransit);
  const longitude = eclipticLongitude(meanAnomaly);
  const declination = solarDeclination(longitude);
  const hourAngleCosine = (
    Math.sin(SUNRISE_ALTITUDE) - Math.sin(latitude) * Math.sin(declination)
  ) / (Math.cos(latitude) * Math.cos(declination));

  if (!Number.isFinite(hourAngleCosine) || hourAngleCosine < -1 || hourAngleCosine > 1) return null;

  const hourAngle = Math.acos(hourAngleCosine);
  const solarNoon = solarTransitJulian(approximateTransit, meanAnomaly, longitude);
  const sunset = solarTransitJulian(
    approximateTransit + hourAngle / (2 * Math.PI),
    meanAnomaly,
    longitude,
  );
  const sunrise = solarNoon - (sunset - solarNoon);

  return {
    sunrise: fromJulian(sunrise),
    sunset: fromJulian(sunset),
  };
}

export function formatDeviceSolarTime(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat(runtimeLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
