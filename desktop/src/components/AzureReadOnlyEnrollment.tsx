import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { desktopClient, type DesktopClientConfig, type VerifiedDesktopIdentity } from "../lib/desktopClient";
import { azureEnrollmentClient } from "../lib/azureEnrollmentClient";
import type { DesktopAzureAccount, DesktopAzureInventory } from "../lib/azureEnrollmentContract";
interface AzureRequestOwner {
    mounted: boolean;
    catalog: number;
    mutation: number;
    authoritative: DesktopAzureAccount[];
    pending: Map<string, number>;
    inventoryRequests: Map<string, number>;
}
interface AzureCatalogUpdates {
    setAccounts: Dispatch<SetStateAction<DesktopAzureAccount[]>>;
    setSuspended: Dispatch<SetStateAction<string[]>>;
    setInventories: Dispatch<SetStateAction<Record<string, DesktopAzureInventory>>>;
    setError: Dispatch<SetStateAction<string | null>>;
}
function requestAzureCatalog(context: DesktopClientConfig, owner: AzureRequestOwner, updates: AzureCatalogUpdates): Promise<void> {
    const request = ++owner.catalog;
    const pendingAtStart = new Set(owner.pending.keys());
    return azureEnrollmentClient.list().then(result => {
        if (!owner.mounted || desktopClient.config !== context || owner.catalog !== request)
            return;
        if (!result.ok) {
            updates.setError(result.error);
            return;
        }
        const before = owner.authoritative;
        // A refresh can predate an unsettled POST; it cannot undo its suspension or newer revision.
        const blocked = new Set([...pendingAtStart, ...owner.pending.keys()]);
        const merged = result.data.accounts.map(account => {
            const old = before.find(row => row.id === account.id);
            return old && old.connectionVersion > account.connectionVersion ? old : account;
        });
        for (const old of before)
            if (blocked.has(old.id) && !merged.some(row => row.id === old.id))
                merged.push(old);
        owner.authoritative = merged;
        updates.setAccounts(merged);
        updates.setSuspended(previous => previous.filter(id => blocked.has(id)));
        updates.setInventories(previous => Object.fromEntries(Object.entries(previous).filter(([id, page]) => merged.some(account => account.id === id && account.connected && account.connectionVersion === page.connectionVersion && !blocked.has(id)))));
        updates.setError(null);
    });
}
/** Credentials exist transiently in this form/request; only the backend vault persists them. */
export function AzureReadOnlyEnrollment({ identity }: {
    identity: VerifiedDesktopIdentity;
}) {
    const context = desktopClient.config;
    const capabilities = identity.capabilities.join("|");
    const [binding, setBinding] = useState(() => ({ context, org: identity.organizationId, kind: identity.kind, capabilities, revision: 0 }));
    const changed = binding.context !== context || binding.org !== identity.organizationId || binding.kind !== identity.kind || binding.capabilities !== capabilities;
    if (changed)
        setBinding({ context, org: identity.organizationId, kind: identity.kind, capabilities, revision: binding.revision + 1 });
    return <AzureEnrollmentWorkspace key={changed ? binding.revision + 1 : binding.revision} identity={identity}/>;
}
function AzureEnrollmentWorkspace({ identity }: {
    identity: VerifiedDesktopIdentity;
}) {
    const context = desktopClient.config;
    const canRead = identity.kind === "desktop_session" && identity.capabilities.includes("workspace:read");
    const canManage = canRead && identity.capabilities.includes("connections:manage");
    const [tenantId, setTenantId] = useState("");
    const [subscriptionId, setSubscriptionId] = useState("");
    const [clientId, setClientId] = useState("");
    const [secret, setSecret] = useState("");
    const [accounts, setAccounts] = useState<DesktopAzureAccount[]>([]);
    const [inventories, setInventories] = useState<Record<string, DesktopAzureInventory>>({});
    const [reading, setReading] = useState<string[]>([]);
    const [suspended, setSuspended] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const owner = useRef<AzureRequestOwner>({
        mounted: false, catalog: 0, mutation: 0, authoritative: [],
        pending: new Map(), inventoryRequests: new Map(),
    });
    const current = () => owner.current.mounted && desktopClient.config === context;
    function refresh() {
        if (canRead)
            return requestAzureCatalog(context, owner.current, { setAccounts, setSuspended, setInventories, setError });
    }
    useEffect(() => {
        const requests = owner.current;
        requests.mounted = true;
        if (canRead)
            void requestAzureCatalog(context, requests, { setAccounts, setSuspended, setInventories, setError });
        return () => {
            requests.mounted = false;
            requests.catalog++;
            requests.mutation++;
            requests.pending.clear();
            requests.inventoryRequests.clear();
        };
    }, [canRead, context]);
    async function enroll() {
        if (!canManage || busy)
            return;
        const normalized = subscriptionId.trim().toLowerCase();
        const old = owner.current.authoritative.find(account => account.subscriptionId === normalized);
        const submitted = { tenantId, subscriptionId, clientId, clientSecret: secret, expectedVersion: old?.connectionVersion ?? null };
        setSecret("");
        setError(null);
        setNotice(null);
        setBusy(true);
        const request = ++owner.current.mutation;
        const result = await azureEnrollmentClient.enroll(submitted);
        if (!current() || owner.current.mutation !== request)
            return;
        setBusy(false);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        const account = result.data.account;
        const latest = owner.current.authoritative.find(row => row.subscriptionId === normalized);
        if (!account.connected || account.subscriptionId !== normalized || account.connectionVersion !== (old?.connectionVersion ?? 0) + 1 || (old ? latest?.id !== old.id || latest.connectionVersion !== old.connectionVersion : latest !== undefined)) {
            setError("Connection state changed while validating. Refresh before retrying.");
            return;
        }
        owner.current.catalog++;
        const next = [...owner.current.authoritative.filter(row => row.id !== account.id), account];
        owner.current.authoritative = next;
        setAccounts(next);
        setInventories(previous => { const copy = { ...previous }; delete copy[account.id]; return copy; });
        setSuspended(previous => previous.filter(id => id !== account.id));
        setNotice("Azure subscription read access verified by this service response. Request bounded resource-group inventory separately. Agent scans and cloud changes remain unavailable.");
    }
    async function read(account: DesktopAzureAccount) {
        if (!canRead || !account.connected || owner.current.pending.has(account.id) || suspended.includes(account.id))
            return;
        const request = (owner.current.inventoryRequests.get(account.id) ?? 0) + 1;
        owner.current.inventoryRequests.set(account.id, request);
        setReading(previous => [...previous.filter(id => id !== account.id), account.id]);
        setError(null);
        const result = await azureEnrollmentClient.inventory(account.id);
        if (!current() || owner.current.inventoryRequests.get(account.id) !== request)
            return;
        setReading(previous => previous.filter(id => id !== account.id));
        const latest = owner.current.authoritative.find(row => row.id === account.id);
        if (owner.current.pending.has(account.id) || !latest?.connected || latest.connectionVersion !== account.connectionVersion)
            return;
        if (!result.ok) {
            setError(result.error);
            return;
        }
        if (result.data.accountId !== account.id || result.data.subscriptionId !== account.subscriptionId || result.data.connectionVersion !== account.connectionVersion) {
            setError("Connection changed during inventory. Refresh before reading again.");
            return;
        }
        setInventories(previous => ({ ...previous, [account.id]: result.data }));
    }
    async function disconnect(account: DesktopAzureAccount) {
        if (!canManage || busy)
            return;
        const latest = owner.current.authoritative.find(row => row.id === account.id);
        if (!latest?.connected || latest.connectionVersion !== account.connectionVersion)
            return;
        owner.current.pending.set(account.id, account.connectionVersion);
        owner.current.catalog++;
        owner.current.inventoryRequests.set(account.id, (owner.current.inventoryRequests.get(account.id) ?? 0) + 1);
        setSuspended(previous => [...previous.filter(id => id !== account.id), account.id]);
        setReading(previous => previous.filter(id => id !== account.id));
        setInventories(previous => { const copy = { ...previous }; delete copy[account.id]; return copy; });
        setBusy(true);
        setError(null);
        setNotice(null);
        const request = ++owner.current.mutation;
        const result = await azureEnrollmentClient.disconnect(account.id, account.connectionVersion);
        if (!current() || owner.current.mutation !== request)
            return;
        setBusy(false);
        owner.current.pending.delete(account.id);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        const before = owner.current.authoritative.find(row => row.id === account.id);
        const returned = result.data.account;
        if (!before || before.connectionVersion !== account.connectionVersion || returned.id !== account.id || returned.subscriptionId !== account.subscriptionId || returned.connected || returned.connectionVersion !== account.connectionVersion + 1) {
            setError("Connection changed while disconnecting. Refresh its current state.");
            return;
        }
        owner.current.catalog++;
        const next = owner.current.authoritative.map(row => row.id === account.id ? returned : row);
        owner.current.authoritative = next;
        setAccounts(next);
        setNotice("Axiom's stored Azure credential was removed. The Azure service principal, its grants, and previously issued tokens were not revoked.");
    }
    const inputClass = "mt-1 w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2 text-sm text-zinc-200";
    return <section className="mt-6 rounded-xl border border-white/10 p-5" aria-label="Azure read-only connection">
    <h3 className="text-base font-semibold text-zinc-200">Azure read-only connection candidate</h3>
    <p className="mt-2 text-xs leading-5 text-zinc-400">Connect an existing service principal to verify one subscription and explicitly read a bounded first page of resource groups. This candidate does not establish real Azure acceptance or native release availability. No cloud changes are enabled.</p>
    {!canRead && <p className="mt-3 text-sm text-zinc-400">Pair this desktop with an accepted workspace membership to view Azure connections.</p>}
    {canManage && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void enroll(); }} autoComplete="off">
      <label className="text-xs text-zinc-400">Azure tenant ID<input className={inputClass} value={tenantId} onChange={event => setTenantId(event.target.value)}/></label>
      <label className="text-xs text-zinc-400">Azure subscription ID<input className={inputClass} value={subscriptionId} onChange={event => setSubscriptionId(event.target.value)}/></label>
      <label className="text-xs text-zinc-400">Azure client ID<input className={inputClass} value={clientId} onChange={event => setClientId(event.target.value)}/></label>
      <label className="text-xs text-zinc-400">Azure client secret<input type="password" autoComplete="new-password" className={inputClass} value={secret} onChange={event => setSecret(event.target.value)}/></label>
      <p className="text-xs text-zinc-500 sm:col-span-2">The secret is sent only to Axiom&apos;s backend encrypted vault. It clears after submission and is not saved in desktop settings. Subscription read validation does not verify a Reader-only role assignment.</p>
      <button disabled={busy} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">{busy ? "Working…" : "Validate & connect Azure"}</button>
    </form>}
    {canRead && <button type="button" disabled={busy} onClick={() => void refresh()} className="mt-3 rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Refresh Azure connections</button>}
    {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
    {notice && <p role="status" className="mt-3 text-xs text-zinc-300">{notice}</p>}
    <div className="mt-4 space-y-3">{accounts.map(account => <article key={`${account.id}:${account.connectionVersion}`} className="rounded-lg border border-white/10 p-3">
      <p className="text-sm text-zinc-200">{account.subscriptionId}</p><p className="mt-1 text-xs text-zinc-400">{account.status}</p>
      <p className="mt-1 text-xs text-zinc-500">Connection version {account.connectionVersion} · inventory requires a separate read</p>
      {account.connected && <div className="mt-3 flex gap-2">
        <button type="button" disabled={suspended.includes(account.id) || reading.includes(account.id) || busy} onClick={() => void read(account)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Read first resource-group page</button>
        {canManage && <button type="button" disabled={busy} onClick={() => void disconnect(account)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50">Disconnect Azure</button>}
      </div>}
      {inventories[account.id] && !suspended.includes(account.id) && <div className="mt-3 text-xs text-zinc-300"><p>First resource-group page only; this is not a complete subscription inventory.</p>{inventories[account.id].resourceGroups.length === 0 && <p>No groups observed on this first page.</p>}<ul>{inventories[account.id].resourceGroups.map(group => <li key={group.id}><span>{group.name}</span> · {group.location}</li>)}</ul></div>}
    </article>)}</div>
  </section>;
}
