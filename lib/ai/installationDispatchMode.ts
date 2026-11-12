import {readInstallationAIMode} from './customerHostedConfig';
/** Existing cloud and legacy local adapters are online-only. Customer-hosted
 * inference must use its separate token-admitted path, never this fallback. */
export function assertOnlineAIDispatch():void {
 if(readInstallationAIMode(process.env.AXIOM_OFFLINE_MODE)!=='online')throw new Error('installation_cloud_ai_unavailable');
}
