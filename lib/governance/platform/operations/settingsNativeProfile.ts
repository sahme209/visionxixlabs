import {z} from 'zod';
const selection=z.object({type:z.enum(['encrypted','plain']),sensitivity:z.enum(['secret','nonsecret'])}).strict();
/** Fixed request semantics only, never provider/custody qualification. */
export function settingsNativeProfile(raw:unknown){const value=selection.parse(raw);if(value.sensitivity==='secret'&&value.type!=='encrypted')throw Error('settings_native_profile_unavailable');return Object.freeze({revision:'vercel_settings_visibility_v1' as const,type:value.sensitivity==='secret'?'sensitive' as const:value.type,visibility:value.sensitivity==='secret'?'secret' as const:'config' as const})}
