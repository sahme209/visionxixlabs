import 'server-only';
import {createDefaultPlatformRequestService} from './requestService';
import {bindPlatformExecution} from './effectExecution';
/** Must be invoked only for the exact independently approved plan. No API-key,
 * cron or client actor override. A lost/uncertain parent claim is not retried. */
export async function createDefaultPlatformExecution(request:{headers:Headers},actionId:string,expectedVersion:number){
 const service=await createDefaultPlatformRequestService(request);
 await service.claim(actionId,expectedVersion);
 return bindPlatformExecution(service,actionId);
}
