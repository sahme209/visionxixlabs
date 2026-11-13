import 'server-only';
import {z} from 'zod';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {digest} from './contracts';
import {imagePublicationLineageBody as body} from './imagePublicationContract';
export const imagePublicationLineageSchema=body.extend({lineageDigest:digest}).strict().refine(v=>{const {lineageDigest,...value}=v;return hash(value)===lineageDigest});
/** Metadata compiler, never a proof issuer. Only the private SQL reader may
 * supply it to the actual preparation/final-send authority path. */
export function compileImagePublicationLineage(raw:unknown){const value=body.parse(raw);return Object.freeze(imagePublicationLineageSchema.parse({...value,lineageDigest:hash(value)}))}
export type ImagePublicationLineage=z.infer<typeof imagePublicationLineageSchema>;
