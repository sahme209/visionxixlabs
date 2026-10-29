/** Local prerequisite evidence only; never a connection, permission or execution grant. */
export interface CloudOnboardingReadiness {
 aws:{vault:'available'|'unavailable';broker:'present'|'missing';liveMode:'enabled'|'disabled';localPrerequisites:'present'|'missing'|'unavailable';providerValidation:'not_checked'};
 azure:{vault:'available'|'unavailable';localPrerequisites:'present'|'unavailable';providerValidation:'not_checked'};
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).length===expected.length&&expected.every(k=>Object.prototype.hasOwnProperty.call(v,k));
export function isCloudOnboardingReadiness(value:unknown):value is CloudOnboardingReadiness{
 if(!object(value)||!keys(value,['aws','azure'])||!object(value.aws)||!object(value.azure))return false;
 const a=value.aws,z=value.azure;
 if(!keys(a,['vault','broker','liveMode','localPrerequisites','providerValidation'])||!keys(z,['vault','localPrerequisites','providerValidation'])||a.providerValidation!=='not_checked'||z.providerValidation!=='not_checked'||(a.vault!=='available'&&a.vault!=='unavailable')||a.vault!==z.vault||(a.broker!=='present'&&a.broker!=='missing')||(a.liveMode!=='enabled'&&a.liveMode!=='disabled'))return false;
 return a.localPrerequisites===(a.vault==='unavailable'?'unavailable':a.broker==='present'&&a.liveMode==='enabled'?'present':'missing')&&z.localPrerequisites===(z.vault==='available'?'present':'unavailable');
}
export function cloudOnboardingNotice(provider:'aws'|'azure',value:CloudOnboardingReadiness):string{
 const state=value[provider];
 if(state.vault==='unavailable')return 'Secure credential storage is unavailable. A service administrator must review the configuration. Cloud access has not been checked.';
 if(provider==='azure')return 'Secure credential storage is available. Azure access has not been checked. Use an existing service principal with read access to the selected subscription; ambient Azure settings do not enroll this workspace.';
 if(value.aws.broker==='missing')return 'The service AWS broker is not configured. A service administrator must review broker access. Cloud access has not been checked.';
 if(value.aws.liveMode==='disabled')return 'AWS enrollment is disabled by the service configuration. Cloud access has not been checked.';
 return 'Local AWS prerequisites are present. AWS role trust, account access and inventory permissions have not been checked.';
}
