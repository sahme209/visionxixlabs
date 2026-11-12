import 'server-only';
import {readBoundedRequestJson} from '@/lib/api/readBoundedRequestJson';
import {createDefaultPlatformRequestService} from './requestService';
import {platformSourceCommand,platformSourcePage} from './sourceCatalog';
type Service=Pick<Awaited<ReturnType<typeof createDefaultPlatformRequestService>>,'sources'>;
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
/** Prepared internal metadata read only. No registered route or source approval. */
export function createPlatformSourceHttp(factory:(request:Request)=>Promise<Service>=createDefaultPlatformRequestService){
 return async(request:Request)=>{
  if(request.method!=='POST')return reply({ok:false,error:'method_not_allowed'},405);
  let service:Service;
  try{service=await factory(request)}catch{return reply({ok:false,error:'platform_reader_unavailable'},401)}
  let command;
  try{command=platformSourceCommand.parse(await readBoundedRequestJson(request,AbortSignal.any([request.signal,AbortSignal.timeout(5000)]),4096))}catch{return reply({ok:false,error:'invalid_platform_source_request'},400)}
  try{request.signal.throwIfAborted();const page=platformSourcePage.parse(await service.sources(command.kind,command.cursor));if(page.kind!==command.kind)throw Error('wrong_page');request.signal.throwIfAborted();return reply({ok:true,data:page})}catch{return reply({ok:false,error:'platform_sources_unavailable'},409)}
 };
}
