/** Fixed application handoff only. Never carry OAuth codes, tokens, account IDs,
 * state or success claims in a native URL. The app reads its authenticated status. */
export const CLOUD_NATIVE_RETURN='axiom-agent://cloud/complete';
export function scheduleCloudNativeReturn(navigate:(url:string)=>void,schedule:(callback:()=>void,delay:number)=>unknown):unknown{return schedule(()=>navigate(CLOUD_NATIVE_RETURN),350)}
