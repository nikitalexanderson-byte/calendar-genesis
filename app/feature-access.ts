/** Server-owned entitlement. Never infer payment from a locally editable user plan. */
export type FeatureAccess = {
  schemaVersion: 1;
  policyRevision: string;
  enforcementEnabled: boolean;
  declaredPlan: string;
  effectivePlan: string;
  lifetimePremium: boolean;
  validUntil: string | null;
  evaluatedAt: string;
  allowedFeatures: string[];
  freeFeatures: string[];
};

function subscriptionExpiry(value: string | null): number {
  if (typeof value !== "string") return Number.NaN;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts || parts[0] !== value) return Number.NaN;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = parts;
  const year = Number(yearText), month = Number(monthText), day = Number(dayText);
  const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = Number(offsetHourText ?? 0), offsetMinute = Number(offsetMinuteText ?? 0);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1]
    || Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59
    || offsetHour > 18 || offsetMinute > 59 || (offsetHour === 18 && offsetMinute !== 0)) return Number.NaN;
  return Date.parse(value);
}

export function featureAllowed(access: FeatureAccess | undefined, feature: string, now = Date.now()): boolean {
  if (!access?.enforcementEnabled) return true;
  if (access.schemaVersion !== 1) return false;
  const expiry = subscriptionExpiry(access.validUntil);
  const expired = !access.lifetimePremium && access.effectivePlan !== "free" && (!Number.isFinite(expiry) || now >= expiry);
  return (expired ? access.freeFeatures : access.allowedFeatures).includes(feature);
}
