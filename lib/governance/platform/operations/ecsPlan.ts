import {operationalEcsPlanInput} from './ecsPlanInput';
import {compilePlatformPlan} from '../kernel';
import {readOperationalManifest,type OperationalManifest} from './kernel';
export type EcsManifest=Extract<OperationalManifest,{kind:'deployment.ecs'}>;
const fail=():never=>{throw Error('ecs_plan_unavailable')};
/** Metadata compilation does not qualify account/run/source, image immutability,
 * native state or rollback condition. Those require a private current supplier. */
export function compileOperationalEcsPlan(manifest:EcsManifest){
 const m=readOperationalManifest(manifest);if(m.kind!=='deployment.ecs')return fail();
 return compilePlatformPlan(operationalEcsPlanInput(m));
}
