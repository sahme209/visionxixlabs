import {it,expect} from 'vitest';
import {inReleaseVerificationPhase,ReleaseVerificationFailure} from '../releaseVerificationPhase';
it('preserves successful verified results',async()=>{expect(await inReleaseVerificationPhase('source',async()=>({verified:true}))).toEqual({verified:true})});
it('replaces underlying provider secrets with a fixed public phase error',async()=>{
 try{await inReleaseVerificationPhase('workflow',async()=>{throw Error('private-provider-token')});throw Error('expected refusal')}catch(error){expect(error).toBeInstanceOf(ReleaseVerificationFailure);expect(error).toMatchObject({code:'release_review_workflow_unavailable',message:'Release verification could not be established.'});expect(JSON.stringify(error)).not.toContain('private-provider-token')}
});
it('preserves the more specific immutable-source refusal across phase boundaries',async()=>{
 const failure=new ReleaseVerificationFailure('policy',true);
 await expect(inReleaseVerificationPhase('source',async()=>{throw failure})).rejects.toBe(failure);
});
