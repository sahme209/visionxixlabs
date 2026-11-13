import type {z} from 'zod';
import type {operationalSettingsManifest} from './contracts';
export type SettingsManifestMetadata=z.infer<typeof operationalSettingsManifest>&{digest:string;authority:'metadata_only';executionAuthorized:false};
/** Shared NONSECRET canonical inputs; hashes never cover the value/envelope. */
export function settingsEffectDigestInput(manifest:SettingsManifestMetadata,index:number){const setting=manifest.settings[index];if(!setting)throw Error('settings_plan_input_unavailable');return {purpose:'platform_settings_effect_v1',manifestDigest:manifest.digest,target:manifest.target,profileId:manifest.artifactProfileId,index,setting}}
export function settingsPlanInput(manifest:SettingsManifestMetadata,settingsDigests:readonly string[]){if(settingsDigests.length!==manifest.settings.length)throw Error('settings_plan_input_unavailable');return {format:1 as const,scope:'platform' as const,sourceDigest:manifest.digest,expiresAt:manifest.expiresAt,effects:settingsDigests.map((settingsDigest,index)=>({id:'setting_'+index,kind:'settings.vercel' as const,target:{projectId:manifest.target.projectId,settingsDigest}}))}}

export function settingsPhysicalTargetInput(manifest:SettingsManifestMetadata,index:number){const setting=manifest.settings[index];if(!setting)throw Error('settings_plan_input_unavailable');return {kind:'axiom_platform_settings_creation_v1',target:{projectId:manifest.target.projectId,teamId:manifest.target.teamId,name:setting.name,environment:setting.environment}}}
