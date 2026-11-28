import {ProviderLogo} from './CatalogIcon';
import {OutlookActionsPanel} from './OutlookActionsPanel';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {open} from '@tauri-apps/plugin-shell';
import {desktopClient} from '../lib/desktopClient';
import {outlookRequest} from '../lib/outlookTransport';
import type {OutlookStatus,OutlookRead} from '../../../lib/desktop/outlookContract';
const context = {getConfig: () => desktopClient.config, getRevision: desktopClient.getContextRevision, subscribe: desktopClient.subscribeContext};

export function OutlookIntegrationCard({embedded = false}: {embedded?: boolean} = {}) {
  const revision = useSyncExternalStore(context.subscribe, context.getRevision, context.getRevision);
  return <OutlookConnection key={revision} embedded={embedded} revision={revision} />;
}

function OutlookConnection({embedded, revision}: {embedded: boolean; revision: number}) {
  const [status, setStatus] = useState<OutlookStatus>();
  const [data, setData] = useState<OutlookRead>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const flight = useRef<AbortController | null>(null);
  const config = desktopClient.config;

  useEffect(() => {
    void load(false);
    return () => {
      flight.current?.abort();
      flight.current = null;
    };
  }, []);

  function ownsRequest(controller: AbortController) {
    return flight.current === controller && !controller.signal.aborted &&
      desktopClient.config === config && desktopClient.getContextRevision() === revision;
  }

  function startRequest() {
    if (flight.current || desktopClient.getContextRevision() !== revision || desktopClient.config !== config) return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true);
    setError("");
    return controller;
  }

  function finishRequest(controller: AbortController) {
    if (ownsRequest(controller)) setBusy(false);
    if (flight.current === controller) flight.current = null;
  }

  async function load(read: boolean) {
    const binding = status?.state === "connected" ? status.binding : undefined;
    if (read && !binding) return;
    const controller = startRequest();
    if (!controller) return;
    setData(undefined);
    try {
      const start = new Date().toISOString();
      const query = read && binding ? {
        start,
        end: new Date(Date.parse(start) + 7 * 86400000).toISOString(),
        connectionId: binding.connectionId,
        connectionRevision: binding.connectionRevision,
      } : undefined;
      const result = await outlookRequest(context, query, controller.signal);
      if (!ownsRequest(controller)) return;
      if (!result.ok) {
        setError(result.error);
        if (read) setStatus({state: "needs_attention"});
      } else if ("mail" in result.data) {
        const observed = result.data.binding;
        if (!binding || observed.organizationId !== binding.organizationId || observed.connectionId !== binding.connectionId ||
          observed.connectionRevision !== binding.connectionRevision || observed.accountId !== binding.accountId ||
          observed.consentedByUserId !== binding.consentedByUserId || result.data.account.id !== binding.accountId) {
          setStatus({state: "needs_attention"});
          setError("The Outlook connection changed. Refresh its status before continuing.");
          return;
        }
        setData(result.data);
      } else {
        setStatus(result.data);
      }
    } catch {
      if (ownsRequest(controller)) {
        setError("Outlook status could not be verified. Refresh status to try again.");
        if (read) setStatus({state: "needs_attention"});
      }
    } finally {
      finishRequest(controller);
    }
  }

  async function connect() {
    const controller = startRequest();
    if (!controller) return;
    try {
      const result = await desktopClient.verifyCurrentCredential();
      if (!ownsRequest(controller)) return;
      if (!result.ok || result.data.kind !== 'desktop_session' || !result.data.userId || !result.data.capabilities.includes('connections:manage')) throw Error();
      await open(`${desktopClient.config.apiBase}/account/integrations/outlook?` + new URLSearchParams({
        expectedOrganizationId: result.data.organizationId, expectedUserId: result.data.userId,
      }));
    } catch {
      if (ownsRequest(controller)) setError('An administrator must open Outlook setup from the current workspace.');
    } finally {
      finishRequest(controller);
    }
  }

 const connected=status?.state==='connected';return <section className={embedded?"space-y-3":"rounded-xl border border-white/10 p-4"} aria-label="Outlook connection"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-medium">{embedded?'Connection':<><ProviderLogo provider="outlook"/>Microsoft Outlook</>}</h3>{!embedded&&<p className="mt-1 text-xs text-zinc-400">Basic inbox context and calendar availability for the consenting user.</p>}<p className="mt-2 text-sm" role="status">{!status?'Status not loaded':status.state==='not_configured'?'Awaiting service activation':connected?'Connected':status.state==='reconnect_required'?'Reconnect required':status.state==='owner_only'?'Available to the mailbox owner':status.state==='not_connected'?'Not connected':'Needs attention'}</p>{status&&'account'in status&&<p className="mt-1 text-xs">{status.account.email??status.account.displayName} · {status.actionConsent?'Action consent recorded; exact approval still required':'Read access only'}</p>}</div><div className="flex flex-wrap gap-2"><button className="btn-secondary" disabled={busy||status?.state==='not_configured'} onClick={()=>void connect()}>{connected?'Manage':'Connect'}</button><button className="btn-secondary" disabled={busy} onClick={()=>void load(false)}>{busy?'Checking…':'Refresh status'}</button>{connected&&<button className="btn-secondary" disabled={busy} onClick={()=>void load(true)}>Read mailbox context</button>}</div></div>{error&&<p role="alert" className="mt-3 text-sm">{error}</p>}{data&&<div className="mt-4 space-y-3"><p className="text-xs text-zinc-400">Observed {new Date(data.observedAt).toLocaleString()}. No message bodies, attachments or AI sharing.</p><h4>Recent inbox</h4>{data.mail.messages.length?data.mail.messages.map(m=><p key={m.id} className="wrap-break-word text-sm">{m.subject||'(No subject)'} · {m.from?.address??'Sender unavailable'}</p>):<p className="text-sm">No messages in this bounded inbox view.</p>}{data.mail.truncated&&<p className="text-xs">More messages exist; this view is limited to ten.</p>}<h4>Next seven days</h4>{data.calendar.events.length?data.calendar.events.map(e=><p key={e.id} className="wrap-break-word text-sm">{e.subject||'(No subject)'} · {new Date(e.startUtc).toLocaleString()}{e.isCancelled?' · Cancelled':''}</p>):<p className="text-sm">No events in this time window.</p>}{data.calendar.truncated&&<p className="text-xs">More events exist; this view is limited to twenty.</p>}<button className="btn-secondary" onClick={()=>setData(undefined)}>Clear local view</button></div>}{status&&status.state!=='not_configured'&&<OutlookActionsPanel connectionReady={connected}/>}</section>
}
