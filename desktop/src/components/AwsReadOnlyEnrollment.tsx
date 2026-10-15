import { useCallback, useEffect, useRef, useState } from "react";
import { desktopClient, type VerifiedDesktopIdentity } from "../lib/desktopClient";
import { awsEnrollmentInputError, type AwsEnrollmentChallenge, type AwsEnrollmentInput, type DesktopAwsAccount, type DesktopAwsInventory } from "../lib/awsEnrollmentContract";

const emptyInput: AwsEnrollmentInput = { expectedAccountId: "", roleArn: "", region: "us-east-1" };

/** Existing-role enrollment only. IAM changes and deployment authority are not
 * requested or granted by this component; the server enforces every permission. */
export function AwsReadOnlyEnrollment({ identity }: { identity: VerifiedDesktopIdentity }) {
  const context = desktopClient.config;
  const capabilityKey = identity.capabilities.join("|");
  const [scope, setScope] = useState(() => ({ context, organizationId: identity.organizationId, kind: identity.kind, capabilityKey, revision: 0 }));
  const changed = scope.context !== context || scope.organizationId !== identity.organizationId
    || scope.kind !== identity.kind || scope.capabilityKey !== capabilityKey;
  if (changed) {
    // React adjusts guarded state before committing children. A new key resets
    // all enrollment state without rendering another credential's old challenge.
    setScope({ context, organizationId: identity.organizationId, kind: identity.kind, capabilityKey, revision: scope.revision + 1 });
  }
  return <AwsEnrollmentWorkspace key={changed ? scope.revision + 1 : scope.revision} identity={identity} />;
}

function AwsEnrollmentWorkspace({ identity }: { identity: VerifiedDesktopIdentity }) {
  const context = desktopClient.config;
  const paired = identity.kind === "desktop_session";
  const canRead = paired && identity.capabilities.includes("workspace:read");
  const canManage = paired && identity.capabilities.includes("connections:manage");
  const [input, setInput] = useState<AwsEnrollmentInput>(emptyInput);
  const [accounts, setAccounts] = useState<DesktopAwsAccount[] | null>(null);
  const [suspendedAccounts, setSuspendedAccounts] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<AwsEnrollmentChallenge | null>(null);
  const [phase, setPhase] = useState<"idle" | "starting" | "completing">("idle");
  const [refreshing, setRefreshing] = useState(canRead);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [trustConfirmed, setTrustConfirmed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(false);
  const operation = useRef(0);
  const accountRequest = useRef(0);
  const pendingDisconnects = useRef(new Map<string, number>());

  const applyAccountList = useCallback((next: DesktopAwsAccount[], pendingAtStart: Map<string, number>) => {
    // A list can predate a still-pending command even if it resolves later.
    // It cannot release suspension, including for a replaced credential. A
    // post-settlement read must confirm the authoritative connection state.
    const blocked = new Set([...pendingAtStart.keys(), ...pendingDisconnects.current.keys()]);
    setAccounts(next);
    setSuspendedAccounts(previous => previous.filter(id => blocked.has(id)));
  }, []);

  const refreshAccounts = useCallback(async () => {
    if (!canRead) return;
    const request = ++accountRequest.current;
    const pendingAtStart = new Map(pendingDisconnects.current);
    const result = await desktopClient.desktopCloudAccounts();
    if (!mounted.current || request !== accountRequest.current || desktopClient.config !== context) return;
    setRefreshing(false);
    if (result.ok) applyAccountList(result.data.accounts, pendingAtStart);
    else setError(result.error);
  }, [canRead, context, applyAccountList]);

  useEffect(() => {
    const lifecycle = mounted;
    const activeOperation = operation;
    const activeAccountRequest = accountRequest;
    lifecycle.current = true;
    if (canRead) {
      const request = ++activeAccountRequest.current;
      const pendingAtStart = new Map(pendingDisconnects.current);
      void desktopClient.desktopCloudAccounts().then(result => {
        if (!lifecycle.current || request !== activeAccountRequest.current || desktopClient.config !== context) return;
        setRefreshing(false);
        if (result.ok) applyAccountList(result.data.accounts, pendingAtStart);
        else setError(result.error);
      });
    }
    return () => { lifecycle.current = false; activeOperation.current++; activeAccountRequest.current++; };
  }, [canRead, context, applyAccountList]);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  function updateInput(field: keyof AwsEnrollmentInput, value: string) {
    operation.current++;
    setInput(previous => ({ ...previous, [field]: value }));
    setChallenge(null); setPhase("idle"); setTrustConfirmed(false); setError(null); setNotice(null);
  }

  async function startEnrollment() {
    if (!canManage || phase !== "idle") return;
    const submitted = { expectedAccountId: input.expectedAccountId.trim(), roleArn: input.roleArn.trim(), region: input.region.trim() };
    const invalid = awsEnrollmentInputError(submitted);
    if (invalid) { setError(invalid); return; }
    const request = ++operation.current;
    setPhase("starting"); setError(null); setNotice(null); setChallenge(null); setTrustConfirmed(false);
    const result = await desktopClient.startAwsReadOnlyEnrollment(submitted);
    if (!mounted.current || operation.current !== request || desktopClient.config !== context) return;
    setPhase("idle");
    if (!result.ok) { setError(result.error); return; }
    const value = result.data;
    if (value.expectedAccountId !== submitted.expectedAccountId || value.roleArn !== submitted.roleArn || value.region !== submitted.region || Date.parse(value.expiresAt) <= Date.now()) {
      setError("The enrollment challenge did not match this account and role, or has expired. Start again."); return;
    }
    setNow(Date.now()); setChallenge(value);
  }

  async function completeEnrollment() {
    if (!canManage || phase !== "idle" || !challenge || !trustConfirmed) return;
    if (Date.parse(challenge.expiresAt) <= Date.now()) { setError("This enrollment challenge expired. Start again for a new external ID."); return; }
    const request = ++operation.current;
    const expected = challenge;
    setPhase("completing"); setError(null); setNotice(null);
    const result = await desktopClient.completeAwsReadOnlyEnrollment(expected.attemptId, expected.externalId);
    if (!mounted.current || operation.current !== request || desktopClient.config !== context) return;
    setPhase("idle");
    if (!result.ok) { setError(result.error); return; }
    const account = result.data.account;
    if (!account.connected || account.status !== "connected" || account.accountId !== expected.expectedAccountId || !account.regions.includes(expected.region)) {
      setError("The service did not verify the expected AWS account and region. Existing connections are unchanged."); return;
    }
    // Prevent an older in-flight list response from undoing the verified result.
    accountRequest.current++;
    setRefreshing(false);
    setAccounts(previous => [...(previous ?? []).filter(item => item.id !== account.id), account]);
    pendingDisconnects.current.delete(account.id);
    setSuspendedAccounts(previous => previous.filter(id => id !== account.id));
    setChallenge(null); setTrustConfirmed(false);
    setNotice("AWS role identity verified by the service. Bounded inventory requires a separate read; Agent scans and deployment execution are not enabled.");
  }

  function beginDisconnect(account: DesktopAwsAccount) {
    pendingDisconnects.current.set(account.id, account.connectionVersion);
    accountRequest.current++;
    operation.current++;
    setRefreshing(false); setChallenge(null); setPhase("idle"); setTrustConfirmed(false);
    setSuspendedAccounts(previous => previous.includes(account.id) ? previous : [...previous, account.id]);
  }

  function confirmDisconnected(account: DesktopAwsAccount) {
    pendingDisconnects.current.delete(account.id);
    accountRequest.current++;
    setRefreshing(false);
    setAccounts(previous => (previous ?? []).map(item => item.id === account.id ? account : item));
    setSuspendedAccounts(previous => previous.filter(id => id !== account.id));
    setNotice("Axiom connection disconnected. AWS roles, trust policies and existing STS sessions were not revoked. Reconnect requires a fresh verified enrollment.");
  }

  function settleDisconnect(accountId: string, expectedVersion: number) {
    if (pendingDisconnects.current.get(accountId) === expectedVersion) pendingDisconnects.current.delete(accountId);
  }

  function discardChallenge() {
    operation.current++; setPhase("idle"); setChallenge(null); setTrustConfirmed(false); setError(null);
    setNotice("Enrollment dismissed locally. A server verification already started may still finish; refresh account state to check. The challenge expires separately.");
  }

  const expired = challenge !== null && Date.parse(challenge.expiresAt) <= now;
  const inputClass = "mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-white/25 disabled:opacity-50";
  const buttonClass = "rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50";

  return <section aria-labelledby="aws-enrollment-heading" className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
    <h3 id="aws-enrollment-heading" className="text-sm font-semibold text-zinc-200">AWS read-only role enrollment</h3>
    <p className="mt-2 text-xs leading-5 text-zinc-400">Verify an existing AWS role in the intended account. This app does not create IAM roles, change trust policies, run Terraform, or grant deployment permission. Role identity verification does not attest the role’s complete IAM permission policy. Azure and Google Cloud enrollment remain unavailable here.</p>
    {!paired && <p role="status" className="mt-3 text-xs text-zinc-400">Use browser pairing to manage cloud connections. Administrator recovery keys cannot enroll a cloud account.</p>}
    {paired && !canManage && <p role="status" className="mt-3 text-xs text-zinc-400">Your verified workspace role does not include connection management. An authorized workspace administrator must enroll the account.</p>}
    {canRead && <div className="mt-3">
      <p className="text-xs text-zinc-400">Service-recorded AWS role identities</p>
      {accounts === null ? <p className="mt-1 text-xs text-zinc-500">{refreshing ? "Checking verified accounts…" : "Account state unavailable. Retry when the service is ready."}</p>
        : accounts.length === 0 ? <p className="mt-1 text-xs text-zinc-500">No verified AWS account records were returned.</p>
          : <ul className="mt-2 space-y-2">{accounts.map(account => <li key={account.id} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">
            <span className="font-mono">{account.accountId}</span> · {suspendedAccounts.includes(account.id) ? "Connection state requires refresh" : account.connected ? "Role identity verified" : "Disconnected from Axiom"}
            <p className="mt-1 text-zinc-500">Regions: {account.regions.length ? account.regions.join(", ") : "Not recorded"} · {account.connected ? "Inventory not checked" : "Inventory unavailable"}</p>
            {account.lastValidatedAt && <p className="mt-1 text-zinc-500">Last service validation: {account.lastValidatedAt}</p>}
            {account.revokedAt && <p className="mt-1 text-zinc-500">Disconnected at: {account.revokedAt}. History and account allowance are retained.</p>}
            {canManage && account.connected && <AwsDisconnectControls key={account.connectionVersion} account={account} suspended={suspendedAccounts.includes(account.id)} onStarted={() => beginDisconnect(account)} onSettled={() => settleDisconnect(account.id, account.connectionVersion)} onDisconnected={confirmDisconnected} />}
            {suspendedAccounts.includes(account.id) && <p className="mt-2 text-xs text-zinc-400">Inventory is hidden until a fresh account-state read confirms the disconnect outcome.</p>}
            {account.connected && !suspendedAccounts.includes(account.id) && <AwsBoundedInventory account={account} />}
            {!account.connected && canManage && <button type="button" onClick={() => { updateInput("expectedAccountId", account.accountId); setInput(previous => ({ ...previous, expectedAccountId: account.accountId, roleArn: "", region: account.regions[0] ?? "us-east-1" })); }} className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06]">Prepare a fresh reconnection</button>}
          </li>)}</ul>}
      <button type="button" onClick={() => { setRefreshing(true); void refreshAccounts(); }} disabled={refreshing} className={`${buttonClass} mt-2`}>Refresh AWS account state</button>
    </div>}
    {canManage && <div className="mt-4 space-y-3">
      <label className="block text-xs text-zinc-400">Expected AWS account ID<input value={input.expectedAccountId} onChange={event => updateInput("expectedAccountId", event.target.value)} inputMode="numeric" autoComplete="off" className={inputClass} /></label>
      <label className="block text-xs text-zinc-400">Existing IAM role ARN<input value={input.roleArn} onChange={event => updateInput("roleArn", event.target.value)} autoComplete="off" spellCheck={false} className={inputClass} /></label>
      <label className="block text-xs text-zinc-400">AWS region<input value={input.region} onChange={event => updateInput("region", event.target.value)} autoComplete="off" className={inputClass} /></label>
      <button type="button" disabled={phase !== "idle"} onClick={() => void startEnrollment()} className={buttonClass}>{phase === "starting" ? "Preparing challenge…" : "Prepare read-only enrollment"}</button>
      {challenge && <div className="rounded-lg border border-white/10 p-3">
        <p className="text-xs leading-5 text-zinc-400">Give this external ID only to the authorized operator configuring the already-approved role trust. Use the reviewed Axiom caller principal from your operator setup instructions. Changing AWS trust requires separate authorization; this screen does not perform or authorize that change.</p>
        <label className="mt-3 block text-xs text-zinc-400">Enrollment external ID<input readOnly value={challenge.externalId} className={inputClass} /></label>
        <p className="mt-2 text-xs text-zinc-500">Expires: {challenge.expiresAt}. {expired ? "Expired; prepare a new challenge." : "No connection is established until service verification succeeds."}</p>
        <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-zinc-400"><input type="checkbox" checked={trustConfirmed} onChange={event => setTrustConfirmed(event.target.checked)} />An authorized operator has separately configured this existing role for the expected read-only access.</label>
        <button type="button" disabled={phase !== "idle" || !trustConfirmed || expired} onClick={() => void completeEnrollment()} className={`${buttonClass} mt-3`}>{phase === "completing" ? "Verifying role identity…" : "Verify existing AWS role"}</button>
      </div>}
      {(challenge || phase !== "idle") && <button type="button" onClick={discardChallenge} className={buttonClass}>Dismiss enrollment</button>}
    </div>}
    {error && <p role="alert" className="mt-3 text-xs leading-5 text-red-300">{error} Previously recorded connections have not been removed.</p>}
    {notice && <p role="status" className="mt-3 text-xs leading-5 text-zinc-400">{notice}</p>}
  </section>;
}

function AwsBoundedInventory({ account }: { account: DesktopAwsAccount }) {
  const context = desktopClient.config;
  const mounted = useRef(false);
  const request = useRef(0);
  const regionsKey = account.regions.join(",");
  const scope = { context, id: account.id, accountId: account.accountId, validatedAt: account.lastValidatedAt, version: account.connectionVersion, regionsKey };
  const [result, setResult] = useState<{
    scope: typeof scope; loading: boolean; inventory: DesktopAwsInventory | null; error: string | null;
  } | null>(null);
  // Hide an already-loaded result synchronously when its account/credential
  // scope changes. Effects only manage lifecycle ownership, never reset state.
  const current = result && result.scope.context === context && result.scope.id === account.id
    && result.scope.accountId === account.accountId && result.scope.validatedAt === account.lastValidatedAt
    && result.scope.version === account.connectionVersion && result.scope.regionsKey === regionsKey ? result : null;
  const loading = current?.loading ?? false;
  const inventory = current?.inventory ?? null;
  const error = current?.error ?? null;
  useEffect(() => {
    const lifecycle = mounted;
    const activeRequest = request;
    lifecycle.current = true;
    return () => { lifecycle.current = false; activeRequest.current++; };
  }, [account.id, account.accountId, account.lastValidatedAt, account.connectionVersion, regionsKey, context]);

  async function readInventory() {
    const generation = ++request.current;
    setResult({ scope, loading: true, error: null, inventory: null });
    const response = await desktopClient.desktopAwsInventory(account.id);
    if (!mounted.current || request.current !== generation || desktopClient.config !== context) return;
    if (!response.ok) { setResult({ scope, loading: false, error: response.error, inventory: null }); return; }
    if (response.data.accountId !== account.accountId || !account.regions.includes(response.data.region)) {
      setResult({ scope, loading: false, error: "Inventory did not match this verified account and region.", inventory: null }); return;
    }
    setResult({ scope, loading: false, error: null, inventory: response.data });
  }

  return <div className="mt-2 border-t border-white/10 pt-2">
    <p className="text-xs leading-5 text-zinc-500">Read one EC2 page in the enrolled region. This is a bounded live sample, not a complete inventory. Agent scans and deployment remain disabled.</p>
    <button type="button" disabled={loading} onClick={() => void readInventory()} className="mt-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.06] disabled:opacity-50">{loading ? "Reading bounded inventory…" : "Read bounded EC2 inventory"}</button>
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error} No sample data is substituted.</p>}
    {inventory && <div className="mt-2 text-xs leading-5 text-zinc-400">
      <p>Live EC2 sample · {inventory.region} · observed {inventory.observedAt}</p>
      <p>{inventory.truncated ? "Truncated result; more resources may exist." : "Single-page sample; other regions and resource types are not included."} Complete account inventory: no.</p>
      {inventory.instances.length === 0 ? <p>No instances returned in this bounded sample. This is not proof that the AWS account is empty.</p>
        : <ul className="mt-1 space-y-1">{inventory.instances.map(instance => <li key={instance.instanceId} className="font-mono">{instance.instanceId} · {instance.state} · {instance.instanceType} · {instance.availabilityZone}</li>)}</ul>}
    </div>}
  </div>;
}

function AwsDisconnectControls({ account, suspended, onStarted, onSettled, onDisconnected }: {
  account: DesktopAwsAccount; suspended: boolean; onStarted: () => void; onSettled: () => void; onDisconnected: (account: DesktopAwsAccount) => void;
}) {
  const context = desktopClient.config;
  const mounted = useRef(false);
  const request = useRef(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const lifecycle = mounted;
    const activeRequest = request;
    lifecycle.current = true;
    return () => { lifecycle.current = false; activeRequest.current++; };
  }, [account.id, account.connectionVersion, context]);

  async function disconnect() {
    if (busy || suspended) return;
    const generation = ++request.current;
    setBusy(true); setError(null); onStarted();
    const result = await desktopClient.disconnectDesktopAwsAccount(account.id, account.connectionVersion);
    // This callback only releases the parent's matching pending-version ref;
    // it cannot apply an outcome or clear suspended inventory. It must run even
    // if account replacement unmounted this old command's control.
    onSettled();
    if (!mounted.current || generation !== request.current || desktopClient.config !== context) return;
    setBusy(false);
    if (!result.ok) { setError(`${result.error} The outcome is unconfirmed; refresh account state before using this connection.`); return; }
    if (result.data.account.accountId !== account.accountId || result.data.account.connected || !result.data.account.revokedAt) {
      setError("The service did not confirm the intended account was disconnected. Refresh its state."); return;
    }
    onDisconnected(result.data.account);
  }

  return <div className="mt-2">
    {!confirming ? <button type="button" disabled={suspended} onClick={() => setConfirming(true)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/[0.06] disabled:opacity-50">Disconnect from Axiom</button>
      : <div role="alertdialog" aria-labelledby={`aws-disconnect-${account.id}`} className="rounded-lg border border-white/15 p-3">
        <h4 id={`aws-disconnect-${account.id}`} className="text-xs font-semibold text-zinc-200">Disconnect AWS account {account.accountId} from Axiom?</h4>
        <p className="mt-2 text-xs leading-5 text-zinc-400">This removes Axiom’s saved connection configuration and stops new reads through this connection. It does not delete or modify AWS roles or trust policies, revoke existing STS sessions, stop deployments, or delete history. Previously issued STS sessions may remain valid for up to 15 minutes. The retained account still counts toward your workspace allowance.</p>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy || suspended} onClick={() => void disconnect()} className="rounded-lg border border-red-400/25 px-3 py-2 text-xs text-red-200 disabled:opacity-50">{busy ? "Disconnecting Axiom access…" : "Disconnect Axiom access"}</button>
          {!busy && <button type="button" onClick={() => { setConfirming(false); setError(null); }} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300">{suspended ? "Close confirmation" : "Keep connection"}</button>}
        </div>
        {busy && <p className="mt-2 text-xs text-zinc-500">Leaving this screen does not cancel a server operation already started. Refresh account state when you return.</p>}
        {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      </div>}
  </div>;
}
