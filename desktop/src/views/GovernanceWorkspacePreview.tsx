import type {VerifiedDesktopIdentity} from '../lib/desktopClient';
import {GovernanceEvidenceView} from './GovernanceEvidenceView';

/** Deliberate DEV entries. The limits lane passes only its narrow identity;
 * generic evidence/source/baseline authoring and enrollment remain hidden. */
export function GovernanceWorkspacePreview({identity,onClose,executionLimits=false}:{identity:VerifiedDesktopIdentity;onClose:()=>void;executionLimits?:boolean}){
 const readable=identity.kind==='desktop_session'&&identity.capabilities.includes('workspace:read')&&identity.access.allowed;
 return <div className="min-h-0 flex-1 overflow-y-auto">
  <div className="mx-auto max-w-5xl">
   <header className="border-b border-white/10 p-6">
    <button type="button" className="btn-secondary" onClick={onClose}>Back to Settings</button>
    <p role="status" className="mt-4 text-sm text-amber-200">{executionLimits?"Execution limits preview · baseline-scoped view. Enforcement is not active.":"Local Governance preview. Enforcement is not active."}</p>
    <p className="mt-2 text-xs text-zinc-400">{executionLimits?"Load an exact saved baseline before reviewing limits. Current server permissions and independent review remain required; limits grant no new permission or coverage. Source collection, baseline approval and enrollment remain unavailable.":"Inspect saved records deliberately. Nothing loads automatically. Source checks may require current service access; approvals, source collection and activation are not available in this preview."}</p>
   </header>
   {readable?<GovernanceEvidenceView key={JSON.stringify(identity)+":"+executionLimits} executionPolicyIdentity={executionLimits?identity:undefined}/>:<p role="alert" className="p-6 text-sm text-zinc-300">A verified desktop workspace reader is required to inspect these records.</p>}
  </div>
 </div>;
}
