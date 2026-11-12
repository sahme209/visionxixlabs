import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {digest} from '../contracts';
import {settingsArtifactBindingSchema,type SettingsArtifactBinding} from './settingsArtifact';
import {nativeSettingsTargetKey} from './settingsReservation';
const body=z.object({format:z.literal(1),purpose:z.literal('platform_settings_creation_result_v1'),actionId:settingsArtifactBindingSchema.shape.actionId,effectIndex:z.number().int().min(0).max(31),planDigest:digest,manifestDigest:digest,nativeKey:digest,outcome:z.enum(['confirmed','refused','unknown']),settingId:z.string().regex(/^[A-Za-z0-9_-]{1,256}$/).nullable(),observedAt:z.number().int().nonnegative().safe()}).strict();
const schema=body.extend({receiptDigest:digest}).strict();
export function readSettingsResult(raw:unknown){const value=schema.parse(raw),{receiptDigest,...fields}=value;if(receiptDigest!==sha256ContentHash(fields)||value.outcome==='confirmed'&&value.settingId===null||value.outcome!=='confirmed'&&value.settingId!==null)throw Error('settings_result_unavailable');return Object.freeze(value)}
export type SettingsResult=ReturnType<typeof readSettingsResult>;
/** Digests cover nonsecret metadata only; neither a signature nor independent
 * provider qualification. Original immutable event is authoritative history. */
export function createSettingsResult(raw:SettingsArtifactBinding,outcome:SettingsResult['outcome'],settingId:string|null,observedAt:number){const b=settingsArtifactBindingSchema.parse(raw),{projectId,teamId,name,environment}=b.target,fields=body.parse({format:1,purpose:'platform_settings_creation_result_v1',actionId:b.actionId,effectIndex:b.effectIndex,planDigest:b.planDigest,manifestDigest:b.manifestDigest,nativeKey:nativeSettingsTargetKey({projectId,teamId,name,environment}),outcome,settingId,observedAt});return readSettingsResult({...fields,receiptDigest:sha256ContentHash(fields)})}
