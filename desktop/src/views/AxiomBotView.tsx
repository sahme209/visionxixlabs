import {useState,useSyncExternalStore} from 'react';
import type {AxiomBotDraft} from '../components/AxiomBotDraftTask';
import {SavedBotTaskWorkspace} from '../components/SavedBotTaskWorkspace';
import {desktopClient,type VerifiedDesktopIdentity} from '../lib/desktopClient';
/** Host identity/context owns the local editor; service routes independently authorize every saved draft. */
export function AxiomBotView({identity,active=true,onConnectApps}:{identity?:VerifiedDesktopIdentity;active?:boolean;onConnectApps?:()=>void}){
 const config=desktopClient.config;
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision);
 // Revalidation returns a new object even when the verified authority is unchanged.
 // Include the complete verified identity; config/revision still fence credential changes.
 const identityKey=JSON.stringify(identity);
 const fresh=(generation:number)=>({config,revision,identityKey,generation,draft:{ownerKey:`local-bot-workspace:${generation}`,title:'',task:'',context:''} as AxiomBotDraft});
 const [scope,setScope]=useState(()=>fresh(0));
 const owned=scope.config===config&&scope.revision===revision&&scope.identityKey===identityKey;
 if(!owned)setScope(fresh(scope.generation+1));
 // Recovery uses only the server-verified paired user, never email or the ephemeral observation actor.
 const recoveryIdentity=identity?.kind==='desktop_session'&&typeof identity.userId==='string'&&identity.userId.length>0&&identity.userId.length<=240&&identity.userId===identity.userId.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(identity.userId)&&identity.organizationId?{organizationId:identity.organizationId,userId:identity.userId}:undefined;
 const paired=identity?.kind==='desktop_session'&&Boolean(identity.organizationId)&&config.sessionToken?.startsWith('axm.desk.');
 return <section hidden={!active} aria-label="Axiom Bot workspace" className="bot-workspace flex min-h-0 flex-1 flex-col overflow-hidden">
  {onConnectApps&&<div className="bot-workspace-context flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2"><span className="text-xs text-zinc-500">Tasks first. Actions stay reviewed.</span><button type="button" onClick={onConnectApps} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-describedby="bot-app-access-note">Connect apps</button><span id="bot-app-access-note" className="sr-only">Manage workspace integrations. Bot actions require their own permissions.</span></div>}
  {owned&&paired?<SavedBotTaskWorkspace canManageActions={identity!.capabilities.includes('connections:manage')} {...(recoveryIdentity?{recoveryIdentity}:{})} observationIdentity={{workspaceId:identity!.organizationId,actorId:scope.draft.ownerKey}} key={scope.draft.ownerKey} ownerKey={scope.draft.ownerKey} draft={scope.draft} active={active} onDraftChange={next=>setScope(value=>value.config===config&&value.revision===revision&&value.identityKey===identityKey&&next.ownerKey===value.draft.ownerKey?{...value,draft:next}:value)}/>:<p role="status" className="p-6 text-sm text-zinc-400">A verified paired workspace session is required to edit and save an Axiom Bot draft. Execution is unavailable.</p>}
 </section>;
}
