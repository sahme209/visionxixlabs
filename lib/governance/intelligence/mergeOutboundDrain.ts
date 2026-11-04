import 'server-only';
import {createEnrollmentDrainAuthority} from './enrollmentDrainAuthority';
import {createMergeOutboundDrain as createCore} from './mergeOutboundDrainCore';
type CoreArgs=Parameters<typeof createCore>;
export function createMergeOutboundDrain(repo:CoreArgs[0],request:CoreArgs[1],scope:CoreArgs[2],operationId:CoreArgs[3],store:CoreArgs[4],ports:Omit<CoreArgs[5],'createDrainAuthority'>){
 return createCore(repo,request,scope,operationId,store,{...ports,createDrainAuthority:createEnrollmentDrainAuthority});
}
