import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {settingsArtifactBindingSchema} from './settingsArtifact';
const target=settingsArtifactBindingSchema.shape.target.pick({projectId:true,teamId:true,name:true,environment:true}).strict();
/** Exact physical setting identity; never accepts action/profile/artifact or
 * secret metadata. This is Axiom serialization, not provider CAS. */
export function nativeSettingsTargetKey(raw:unknown){return sha256ContentHash({kind:'axiom_platform_settings_creation_v1',target:target.parse(raw)})}
