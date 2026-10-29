import {OBSERVATION_MAX_PNG_BYTES} from './computerObservationContract';
export const NATIVE_OBSERVATION_SOURCE='native_selected_window' as const;
export interface NativeObservationStatus {supported:boolean;source:typeof NATIVE_OBSERVATION_SOURCE;reason?:string;inputAvailable:false;aiSharingAvailable:false;backgroundCapture:false}
export interface NativeObservationSelection {source:typeof NATIVE_OBSERVATION_SOURCE;sessionId:string;revision:number;appLabel:string;windowLabel:string;expiresAt:string;inputAvailable:false;aiSharingAvailable:false;backgroundCapture:false}
export interface NativeObservationCapture {source:typeof NATIVE_OBSERVATION_SOURCE;sessionId:string;revision:number;observedAt:string;width:number;height:number;pngBase64:string;expiresAt:string;inputAvailable:false;aiSharingAvailable:false;backgroundCapture:false}
export interface NativeObservationAdapter {current(input:{ownerContextRef:string;sessionId:string;expectedRevision:number},signal:AbortSignal):Promise<unknown>;status(signal:AbortSignal):Promise<unknown>;select(ownerContextRef:string,signal:AbortSignal):Promise<unknown>;capture(input:{ownerContextRef:string;sessionId:string;expectedRevision:number},signal:AbortSignal):Promise<unknown>;stop(input:{ownerContextRef:string;sessionId:string|null}):Promise<unknown>}
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.prototype.hasOwnProperty.call(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const flags=(v:Record<string,unknown>)=>v.source===NATIVE_OBSERVATION_SOURCE&&v.inputAvailable===false&&v.aiSharingAvailable===false&&v.backgroundCapture===false;
const common=['source','inputAvailable','aiSharingAvailable','backgroundCapture'];
const label=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&new TextEncoder().encode(v).byteLength<=240&&!/[\x00-\x1f\x7f-\x9f]/.test(v);
export const nativeSessionId=(v:unknown):v is string=>typeof v==='string'&&/^observation_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const instant=(v:unknown):v is string=>{try{return typeof v==='string'&&new Date(v).toISOString()===v}catch{return false}};
export const isNativeObservationStatus=(v:unknown):v is NativeObservationStatus=>record(v)&&keys(v,[...common,'supported'],['reason'])&&flags(v)&&typeof v.supported==='boolean'&&(v.reason===undefined||typeof v.reason==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(v.reason));
export const isNativeObservationSelection=(v:unknown,now:number):v is NativeObservationSelection=>record(v)&&keys(v,[...common,'sessionId','revision','appLabel','windowLabel','expiresAt'])&&flags(v)&&nativeSessionId(v.sessionId)&&v.revision===0&&label(v.appLabel)&&label(v.windowLabel)&&instant(v.expiresAt)&&Date.parse(v.expiresAt)>now&&Date.parse(v.expiresAt)<=now+125000;
export function decodeNativeObservationCapture(v:unknown,session:NativeObservationSelection,started:number,now:number):{capture:NativeObservationCapture;png:Uint8Array}|null{
 if(!record(v)||!keys(v,[...common,'sessionId','revision','observedAt','width','height','pngBase64','expiresAt'])||!flags(v)||v.sessionId!==session.sessionId||v.revision!==session.revision+1||!instant(v.observedAt)||Date.parse(v.observedAt)<started||Date.parse(v.observedAt)>now||!instant(v.expiresAt)||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)>now+125000||!Number.isSafeInteger(v.width)||!Number.isSafeInteger(v.height)||Number(v.width)<1||Number(v.height)<1||Number(v.width)>1600||Number(v.height)>1600||typeof v.pngBase64!=='string'||v.pngBase64.length>Math.ceil(OBSERVATION_MAX_PNG_BYTES/3)*4||v.pngBase64.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(v.pngBase64))return null;
 let png:Uint8Array;try{const raw=atob(v.pngBase64);if(raw.length<33||raw.length>OBSERVATION_MAX_PNG_BYTES)return null;png=Uint8Array.from(raw,c=>c.charCodeAt(0))}catch{return null}
 if(![137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82].every((n,i)=>png[i]===n)){png.fill(0);return null}
 const header=new DataView(png.buffer);if(header.getUint32(16)!==v.width||header.getUint32(20)!==v.height){png.fill(0);return null}
 return{capture:v as unknown as NativeObservationCapture,png};
}
/** Fixed native discriminants only. Arbitrary IPC strings never become UI text. */
const nativeErrors=new Set(['native_observation_unsupported','native_observation_invalid_request','native_observation_foreground_required','native_observation_operation_busy','native_observation_selection_cancelled','native_observation_selection_unavailable','native_observation_session_changed','native_observation_session_expired','native_observation_capture_unavailable','native_observation_capture_invalid','native_observation_operation_stopped','native_observation_operation_timeout']);
export function safeNativeObservationError(error:unknown,fallback:string){const code=typeof error==='string'?error:error instanceof Error?error.message:null;return code&&nativeErrors.has(code)?code:fallback}
export function nativeObservationRecoveryMessage(code:string|undefined):string|null{
 switch(code){
 case 'native_observation_foreground_required':return 'Bring Axiom to the foreground, then choose Select window again.';
 case 'native_observation_operation_busy':return 'Another window observation is still active. Wait for the macOS picker to close, then select a window again.';
 case 'native_observation_invalid_request':return 'Native observation rejected the request (native_observation_invalid_request). Reopen the Computer panel and select a window again.';
 case 'native_observation_selection_cancelled':return 'No window was selected. Choose Select window when you are ready.';
 case 'native_observation_operation_timeout':return 'Window observation timed out. Wait for the macOS picker to close, then select a window again.';
 case 'native_observation_session_expired':return 'Window observation expired. Select a window again.';
 case 'native_observation_session_changed':return 'The selected window session changed. Select a window again.';
 case 'native_observation_unsupported':return 'Window observation requires a supported native macOS build (15.2 or later).';
 case 'native_observation_capture_invalid':case 'native_observation_capture_unavailable':return 'The selected window could not be captured. Select a window again.';
 case 'native_observation_operation_stopped':return 'Window observation stopped. Select a window again when ready.';
 case 'native_observation_selection_unavailable':return 'The macOS window picker is unavailable. Bring Axiom to the foreground and select a window again.';
 default:return null;
 }
}
