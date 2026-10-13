"use client";
import { useState } from "react";
import { updateAdminSubscription, type SubscriptionPlan, type AdminUserStats } from "./cloud-sync";
import { adminUserCopy as c } from "./admin-user-copy";

export const SUBSCRIPTION_PLANS = ["free", "standart", "premium", "business", "premium4life"] as const satisfies readonly SubscriptionPlan[];
export const subscriptionLabel = (plan: SubscriptionPlan) => plan === "premium4life" ? "Premium4Life" : plan;

export function SubscriptionControl({user,onSaved,onRefresh}: {user:AdminUserStats;onSaved:(plan:SubscriptionPlan)=>void;onRefresh:()=>Promise<void>}) {
  const current=user.subscriptionPlan ?? "free";
  const [draft,setDraft]=useState<SubscriptionPlan|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[failed,setFailed]=useState(false);
  const selected=draft ?? current;
  return <div className="admin-subscription-control" data-no-translate>
    <small>{c("current")}: <span>{subscriptionLabel(current)}</span></small>
    <form onSubmit={async event=>{
      event.preventDefault();setBusy(true);setMessage("");setFailed(false);
      try { const result=await updateAdminSubscription(user.id,selected,current);onSaved(result.subscriptionPlan);setDraft(null);setMessage(c("saved")); }
      catch(reason) {setFailed(true);setMessage(reason instanceof Error&&reason.message==="SUBSCRIPTION_STATUS_CONFLICT" ? c("conflict") : c("error"));}
      finally {setBusy(false);}
    }}>
      <select aria-label={`${c("plan")}: ${user.email}`} value={selected} disabled={busy} onChange={event=>{setDraft(event.target.value as SubscriptionPlan);setMessage("");setFailed(false);}}>
        {SUBSCRIPTION_PLANS.map(plan=><option key={plan} value={plan}>{subscriptionLabel(plan)}</option>)}
      </select>
      <button type="submit" className="secondary-button" disabled={busy||selected===current} aria-label={`${c("save")}: ${user.email}`}>{busy ? c("saving") : c("save")}</button>
    </form>
    {message ? <p className={failed ? "auth-error" : "admin-success"} role={failed ? "alert" : "status"}>{message}</p> : null}
    {failed ? <button type="button" className="secondary-button" disabled={busy} onClick={async()=>{
      setBusy(true);
      try {await onRefresh();setDraft(null);setMessage("");setFailed(false);}
      finally {setBusy(false);}
    }}>{c("refresh")}</button> : null}
  </div>;
}
