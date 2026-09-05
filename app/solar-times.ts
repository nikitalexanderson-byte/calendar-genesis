const DAY_MS = 86_400_000;
const JULIAN_UNIX_EPOCH = 2_440_588;
const JULIAN_2000 = 2_451_545;
const SOLAR_TRANSIT_OFFSET = 0.0009;
const OBLIQUITY = 23.4397 * Math.PI / 180;
const SUNRISE_ALTITUDE = -0.833 * Math.PI / 180;

export type DeviceLocation = {
  latitude: number;
  longitude: number;
};

export type SunriseSunset = {
  sunrise: Date;
  sunset: Date;
};

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

export function formatDeviceSolarTime(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
