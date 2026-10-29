import {useEffect,useState} from 'react';
import {desktopClient,type VerifiedDesktopIdentity} from '../lib/desktopClient';
import {cloudOnboardingNotice,type CloudOnboardingReadiness} from '../../../lib/cloud/onboardingReadinessContract';
/** Informational only. Existing connection controls and server authority remain unchanged. */
export function CloudOnboardingStatus({provider,identity}:{provider:'aws'|'azure';identity:VerifiedDesktopIdentity}){
 const context=desktopClient.config,scope=JSON.stringify([identity.organizationId,identity.kind,identity.capabilities]);
 const [state,setState]=useState<{context:typeof context;scope:string;value:CloudOnboardingReadiness|null}|null>(null);
 useEffect(()=>{let current=true;
  if(identity.kind==='desktop_session'&&identity.capabilities.includes('workspace:read'))void (async()=>{try{const result=await desktopClient.cloudOnboardingReadiness();if(current&&desktopClient.config===context)setState({context,scope,value:result.ok?result.data:null});}catch{if(current&&desktopClient.config===context)setState({context,scope,value:null});}})();
  return()=>{current=false;};
 },[context,scope]);
 if(identity.kind!=='desktop_session'||!identity.capabilities.includes('workspace:read'))return null;
 const owned=state?.context===context&&state.scope===scope;
 const text=!owned?'Checking local cloud setup prerequisites…':state.value?cloudOnboardingNotice(provider,state.value):'Local cloud setup status is unavailable. This does not establish whether a cloud connection exists or is usable.';
 return <p role="status" className="mt-2 text-xs leading-5 text-zinc-400">{text}</p>;
}
