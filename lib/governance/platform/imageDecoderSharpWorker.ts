import 'server-only';
import {z} from 'zod';
import {inspectImageDecoderCandidate,type ImageDecoderCandidateBackend} from './imageDecoderCandidate';

type Options=Parameters<ImageDecoderCandidateBackend['open']>[1];
interface CandidatePipeline{
 timeout(value:{seconds:number}):CandidatePipeline;
 metadata():Promise<unknown>;
 toColourspace(value:'srgb'):CandidatePipeline;
 ensureAlpha():CandidatePipeline;
 raw(value:{depth:'uchar'}):CandidatePipeline;
 toBuffer(value:{resolveWithObject:true}):Promise<{data:Uint8Array;info:unknown}>;
 destroy():unknown;
}
export type CandidateSharpLoader=()=>Promise<(bytes:Uint8Array,options:Options)=>CandidatePipeline>;
const loadCachedSharp:CandidateSharpLoader=async()=>{const {default:sharp}=await import('sharp');return (bytes,options)=>sharp(bytes,options)};
/** Dormant, not qualified. Calling open with the default loader executes native
 * code. Never invoke in the request process or ordinary tests. Actual launch,
 * package/native identity, native allocation and cleanup bounds need a protected
 * qualified parent; this module grants none of them. */
export function createDormantSharpImageBackend(load:CandidateSharpLoader=loadCachedSharp):ImageDecoderCandidateBackend{
 return {async open(bytes,options){
  const sharp=await load();const pipeline=sharp(bytes,options);let disposed=false;
  try{pipeline.timeout({seconds:1});return {
   async metadata(){return z.record(z.string(),z.unknown()).parse(await pipeline.metadata())},
   async rgba(){const value=await pipeline.toColourspace('srgb').ensureAlpha().raw({depth:'uchar'}).toBuffer({resolveWithObject:true});try{const info=z.object({width:z.number(),height:z.number(),channels:z.number(),depth:z.string()}).passthrough().parse(value.info);return {data:value.data,width:info.width,height:info.height,channels:info.channels,depth:info.depth}}catch{value.data?.fill(0);throw Error('platform_image_decode_unavailable')}},
   dispose(){if(!disposed){disposed=true;pipeline.destroy()}}
  }}catch{pipeline.destroy();throw Error('platform_image_decode_unavailable')}
 }};
}
const request=z.object({format:z.literal(1),purpose:z.literal('platform_image_candidate_decode_v1'),bytes:z.instanceof(Uint8Array),mimeType:z.enum(['image/png','image/jpeg']),profileDigest:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
/** One-use message algorithm, not a worker launcher or qualification issuer.
 * Even a successful reply explicitly carries no qualification. */
export function createDormantImageDecoderWorker(backend:ImageDecoderCandidateBackend){
 let consumed=false;
 return async(raw:unknown,signal:AbortSignal)=>{
  try{
   if(consumed)throw Error('consumed');consumed=true;
   const value=request.parse(raw);
   const candidate=await inspectImageDecoderCandidate(value.bytes,value.mimeType,value.profileDigest,backend,signal);
   return {ok:true as const,candidate,qualification:'not_established' as const};
  }catch{return {ok:false as const,error:'platform_image_decode_unavailable' as const,qualification:'not_established' as const}}
 };
}
