import type { SubscriptionPlan } from "./cloud-sync";
const subscriptionNames:Record<SubscriptionPlan,string> = {
  free:"Free",standart:"Standart",premium:"Premium",business:"Business",premium4life:"Premium4Life",
};
export function subscriptionName(plan?:SubscriptionPlan):string {
  return plan ? subscriptionNames[plan] ?? "…" : "…";
}
