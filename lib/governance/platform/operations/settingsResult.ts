import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {settingsResultBody as body,settingsResultSchema as schema} from './settingsResultContract';
import {settingsArtifactBindingSchema,type SettingsArtifactBinding} from './settingsArtifact';
import {nativeSettingsTargetKey} from './settingsReservation';
export function readSettingsResult(raw:unknown){const value=schema.parse(raw),{receiptDigest,...fields}=value;if(receiptDigest!==sha256ContentHash(fields)||value.outcome==='confirmed'&&value.settingId===null||value.outcome!=='confirmed'&&value.settingId!==null)throw Error('settings_result_unavailable');return Object.freeze(value)}
export type SettingsResult=ReturnType<typeof readSettingsResult>;
/** Digests cover nonsecret metadata only; neither a signature nor independent
 * provider qualification. Original immutable event is authoritative history. */
export function createSettingsResult(raw:SettingsArtifactBinding,outcome:SettingsResult['outcome'],settingId:string|null,observedAt:number){const b=settingsArtifactBindingSchema.parse(raw),{projectId,teamId,name,environment}=b.target,fields=body.parse({format:1,purpose:'platform_settings_creation_result_v1',actionId:b.actionId,effectIndex:b.effectIndex,planDigest:b.planDigest,manifestDigest:b.manifestDigest,nativeKey:nativeSettingsTargetKey({projectId,teamId,name,environment}),outcome,settingId,observedAt});return readSettingsResult({...fields,receiptDigest:sha256ContentHash(fields)})}
