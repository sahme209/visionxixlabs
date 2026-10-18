import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { TerraformCustomerPlanProfile } from "./TerraformCustomerPlanProfile";
import { desktopClient } from "../lib/desktopClient";
import type { TerraformPlanMetadata,TerraformPlanProjection,TerraformPlanReadData,CustomerSavedPlanProjection } from "../../../lib/terraform/customerPlanDto";

const unavailable = "Saved plan evidence is unavailable. Ask your workspace administrator to review artifact storage and the trusted plan producer.";
const actionKinds = ["create", "update", "delete", "replace", "read", "no-op"] as const;
function validData(data:TerraformPlanReadData):boolean{
  return data?.executionEnabled===false&&["unavailable","customer_ci_import"].includes(data.producer)&&Array.isArray(data.plans)&&data.plans.length<=20&&data.plans.every(plan=>{
    const summary="summary" in plan&&Array.isArray(plan.summary?.rows)&&actionKinds.every(kind=>Number.isSafeInteger(plan.summary.counts?.[kind])&&plan.summary.counts[kind]>=0);
    if(typeof plan.id!=="string"||!/^[a-f0-9]{64}$/.test(plan.binaryDigest)||typeof plan.environmentId!=="string"||typeof plan.expiresAt!=="string"||!Number.isSafeInteger(plan.requestVersion)||plan.requestVersion<1||plan.approval!=="unavailable"||plan.executionEnabled!==false)return false;
    if(plan.evidenceScope==="owned_local_fixture")return plan.currentTarget==="unavailable"&&(plan.inspection==="metadata_only"||plan.inspection==="artifact_bytes_checked"&&summary);
    if(plan.evidenceScope!=="customer_ci_attested"||typeof plan.historical!=="boolean"||typeof plan.profileId!=="string"||!Number.isSafeInteger(plan.profileRevision)||plan.profileRevision<1||!Number.isSafeInteger(plan.runAttempt)||plan.runAttempt<1||!/^\d+$/.test(plan.runId))return false;
    if(plan.inspection==="metadata_only")return plan.currentTarget==="not_observed";
    if(plan.inspection!=="producer_bytes_verified"||!summary||!["unavailable","observed_match"].includes(plan.currentTarget))return false;
    const detail=plan as CustomerSavedPlanProjection;
    return ["unexpired","expired"].includes(detail.validity)&&(detail.currentTarget!=="observed_match"||detail.validity==="unexpired"&&!detail.historical&&typeof detail.observedAt==="string"&&Number.isFinite(Date.parse(detail.observedAt)));
  });
}

/** Stored read projection only. This component never creates a plan, approval,
 * credential, handoff or execution. Context revisions invalidate all evidence. */
export function TerraformPlanReview({ requestId, requestVersion }: { requestId: string; requestVersion: number }) {
  const revision = useSyncExternalStore(desktopClient.subscribeContext, desktopClient.getContextRevision, desktopClient.getContextRevision);
  const key = `${revision}:${requestId}:${requestVersion}`;
  const activeKey = useRef(key);
  const attempt = useRef(0);
  useLayoutEffect(() => { activeKey.current = key; attempt.current += 1; }, [key]);
  const [state, setState] = useState<{ key: string; loading: boolean; plans: TerraformPlanMetadata[]; detail?: TerraformPlanProjection; error?: string; truncated?: boolean }>({ key, loading: false, plans: [] });
  const current = state.key === key ? state : { key, loading: false, plans: [] };
  useEffect(() => () => { attempt.current += 1; }, []);

  async function read(artifactId?: string,reset=false) {
    const requestKey = key;
    const requestAttempt = ++attempt.current;
    const requestRevision = desktopClient.getContextRevision();
    setState({ key, loading: true, plans: artifactId&&!reset ? current.plans : [] });
    try {
      const result = artifactId ? await desktopClient.getDeploymentTerraformPlan(requestId, artifactId) : await desktopClient.listDeploymentTerraformPlans(requestId);
      if (activeKey.current !== requestKey || attempt.current !== requestAttempt || desktopClient.getContextRevision() !== requestRevision) return;
      if (!result.ok || !validData(result.data)) { setState({ key, loading: false, plans: [], error: unavailable }); return; }
      if (result.data.plans.some(p => p.evidenceScope==="owned_local_fixture"?p.requestVersion!==requestVersion:p.requestVersion>requestVersion||p.requestVersion!==requestVersion&&!p.historical)) { setState({ key, loading: false, plans: [], error: unavailable }); return; }
      if (artifactId) {
        const plan = result.data.plans[0];
        if (result.data.plans.length !== 1 || plan?.id !== artifactId || !(plan.inspection === "artifact_bytes_checked" || plan.inspection === "producer_bytes_verified") || !("summary" in plan)) { setState({ key, loading: false, plans: [], error: unavailable }); return; }
        setState({ key, loading: false, plans: reset?[]:current.plans, detail: plan });
      } else setState({ key, loading: false, plans: result.data.plans, truncated: result.data.truncated });
    } catch {
      if (activeKey.current === requestKey && attempt.current === requestAttempt && desktopClient.getContextRevision() === requestRevision) setState({ key, loading: false, plans: [], error: unavailable });
    }
  }

  return <section aria-label="Terraform saved plan review" className="mt-4 rounded-xl border border-white/10 p-4 text-xs text-zinc-400">
    <h3 className="text-sm font-semibold text-white">Saved Terraform plan evidence</h3>
    <p className="mt-2">Review only. Approval and current backend/target authority are unavailable. Terraform apply stays disabled.</p>
    <p className="mt-1">Local fixture evidence does not verify a customer cloud account. Customer CI evidence requires a reviewed protected producer and its own immutable profile.</p>
    <button type="button" className="btn-secondary mt-3 disabled:opacity-50" disabled={current.loading} onClick={() => void read()}>{current.loading ? "Reading evidence…" : "Read saved plan metadata"}</button>
    {current.error && <p role="alert" className="mt-3 text-rose-300">{current.error}</p>}
    {!current.loading && state.key === key && !current.error && current.plans.length === 0 && <p className="mt-3">No saved plan evidence loaded.</p>}
    <ul className="mt-3 space-y-2">{current.plans.map(plan => <li key={plan.id}><button type="button" className="btn-secondary disabled:opacity-50" disabled={current.loading} onClick={() => void read(plan.id)}>Inspect {plan.binaryDigest.slice(0, 12)}</button><span className="ml-2">Metadata only · expires {new Date(plan.expiresAt).toLocaleString()}</span></li>)}</ul>
    {current.truncated && <p className="mt-2">Showing the latest 20 artifact records. Earlier records are not covered by this list.</p>}
    {current.detail && <div className="mt-4" role="status">
      {current.detail.evidenceScope==="owned_local_fixture"?<p>Artifact bytes checked · owned local fixture only</p>:<>
        <p>Customer producer bytes verified{current.detail.historical?" · historical evidence":""} · {"validity" in current.detail?current.detail.validity:"unavailable"}</p>
        <p>Profile {current.detail.profileId} revision {current.detail.profileRevision} · CI run {current.detail.runId} attempt {current.detail.runAttempt}</p>
        {current.detail.currentTarget==="observed_match"&&"observedAt" in current.detail?<p>Backend matched at {current.detail.observedAt}. Read-only lock observation; no lock is held.</p>:<p>Current backend match is unavailable. Stored producer evidence is not current target authority.</p>}
      </>}
      <p className="mt-1 break-all">SHA-256 {current.detail.binaryDigest}</p>
      <p className="mt-1">Environment: {current.detail.environmentId} · request version {current.detail.requestVersion}</p>
      <p className="mt-2">{current.detail.summary.counts.create} create · {current.detail.summary.counts.update} update · {current.detail.summary.counts.delete} delete · {current.detail.summary.counts.replace} replace</p>
      <ul>{current.detail.summary.rows.map(row => <li key={row.address} className="mt-1 break-all">{row.kind}: {row.address}</li>)}</ul>
    </div>}
    <TerraformCustomerPlanProfile key={key} requestId={requestId} requestVersion={requestVersion} onEvidenceInvalidated={()=>{attempt.current+=1;setState({key,loading:false,plans:[]});}} onImported={id=>void read(id,true)}/>
  </section>;
}
