import 'server-only';
import {loadAppEnv} from '@/lib/config/env';
import {encryptScopedCredential,decryptScopedCredential} from '@/lib/security/credentialVault';
import type {CloudOnboardingReadiness} from './onboardingReadinessContract';
const probeVault=()=>{const context='cloud-onboarding-local-probe-v1',plain='local-probe';if(decryptScopedCredential(encryptScopedCredential(plain,context),context)!==plain)throw Error('vault_unavailable');};
/** No storage/provider IO. The synthetic round trip tests the current local
 * vault primitive only, never decrypts a saved credential or returns ciphertext. */
export function readCloudOnboardingReadiness(input:{config:Pick<ReturnType<typeof loadAppEnv>,'awsBrokerConfigured'|'awsScanMode'>;awsEnabled:boolean;probeVault:()=>void}={config:loadAppEnv(),awsEnabled:process.env.ENABLE_CLOUD_CONNECTORS_AWS!=='false',probeVault}):CloudOnboardingReadiness{
 let vault:'available'|'unavailable'='available';try{input.probeVault();}catch{vault='unavailable';}
 const broker=input.config.awsBrokerConfigured?'present':'missing',liveMode=input.awsEnabled&&input.config.awsScanMode==='live'?'enabled':'disabled';
 return {aws:{vault,broker,liveMode,localPrerequisites:vault==='unavailable'?'unavailable':broker==='present'&&liveMode==='enabled'?'present':'missing',providerValidation:'not_checked'},azure:{vault,localPrerequisites:vault==='available'?'present':'unavailable',providerValidation:'not_checked'}};
}
