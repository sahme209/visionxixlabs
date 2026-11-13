import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {createDefaultPlatformRequestService} from './requestService';
import {platformHistoryCommand,platformHistoryPage} from './historyContract';
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'history'>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared read-only endpoint; NOT registered or enabled in production. */
export function createPlatformHistoryHttp(factory:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;
  try{service=await factory(request)}catch{return reply({ok:false,error:'platform_reader_unavailable'},401)}
  let command;
  try{command=platformHistoryCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_history_request'},400)}
  try{request.signal.throwIfAborted();const page=platformHistoryPage.parse(await service.history(command.cursor));request.signal.throwIfAborted();return reply({ok:true,data:page})}catch{return reply({ok:false,error:'platform_history_unavailable'},409)}
 };
}
