import {it,expect,vi} from 'vitest';
import {createManualReleaseResultInspector} from '../manualReleaseResult';
import {compileOperationalManifest} from '../kernel';
const at=Date.parse('2026-11-12T00:00:00Z'),d='a'.repeat(64),ref='platform_evidence_11111111-1111-4111-8111-111111111111',commit='b'.repeat(40);
function fixture(){
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'release.manual',expiresAt:new Date(at+60000).toISOString(),source:{repository:'sahme209/visionxixlabs',branch:'main',commit},target:{projectId:'project',teamId:'team',environment:'production'},sourceHashes:{workflow:d,build:d,configuration:d,lock:d,schema:d},artifactEvidenceId:ref,ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref,commit}],compatibilityEvidenceId:ref,recoveryEvidenceId:ref,smokeProfileId:'production-smoke-v1'});
 if(manifest.kind!=='release.manual')throw Error('wrong fixture');
 const view={recordId:'platform_manual_release_11111111-1111-4111-8111-111111111111',manifest,status:'notice_recorded' as const,version:3,inspectedAt:at,attemptCount:1,providerExecution:false as const,ownerAuthorization:'external_not_verified' as const};
 const observation={deploymentId:'dpl_fixture',receiptId:ref,projectId:'project',teamId:'team',environment:'production',commit,providerState:'BUILDING',observedAt:new Date(at).toISOString(),expiresAt:new Date(at+60000).toISOString()};
 const inspect=vi.fn(async()=>structuredClone(view)),source={readExact:vi.fn(async()=>structuredClone(observation)),assertQualified:vi.fn(async()=>{}),assertReadyEvidence:vi.fn(async()=>{})};
 return {view,observation,inspect,source,result:createManualReleaseResultInspector(inspect,source)};
}
it('keeps accepted/building pending and requires additional exact qualified smoke/compatibility evidence for READY',async()=>{
 const f=fixture();expect(await f.result.inspect(f.view.recordId,'dpl_fixture')).toMatchObject({state:'pending',providerExecution:false,ownerAuthorization:'external_not_verified'});expect(f.source.assertReadyEvidence).not.toHaveBeenCalled();
 f.observation.providerState='READY';expect(await f.result.inspect(f.view.recordId,'dpl_fixture')).toMatchObject({state:'verified_ready'});expect(f.source.assertReadyEvidence).toHaveBeenCalled();
 f.source.assertReadyEvidence.mockRejectedValueOnce(Error('smoke unqualified'));await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow();
});
it('refuses wrong exact deployment, source, team or project and never promotes an owner report',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.observation.deploymentId='dpl_other'},(f:ReturnType<typeof fixture>)=>{f.observation.commit='f'.repeat(40)},(f:ReturnType<typeof fixture>)=>{f.observation.projectId='other'},(f:ReturnType<typeof fixture>)=>{f.observation.teamId='other'},(f:ReturnType<typeof fixture>)=>{f.observation.providerState='owner_attested'}]){
  const f=fixture();change(f);await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow();
 }
});
it('reauthenticates after the read and rejects stale, revoked or changed notice evidence without retry',async()=>{
 const f=fixture();f.inspect.mockRejectedValueOnce(Error('reader revoked'));await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow();expect(f.source.readExact).not.toHaveBeenCalled();
 f.source.readExact.mockImplementationOnce(async()=>{f.view.inspectedAt=at+60000;return f.observation});await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow();
 f.view.inspectedAt=at;f.source.assertQualified.mockRejectedValueOnce(Error('unqualified'));await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow();
 f.source.readExact.mockImplementationOnce(async()=>{f.inspect.mockRejectedValueOnce(Error('reader revoked'));return f.observation});await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow();
});
it('returns unknown and terminal failure honestly without a send, repeat notice or rollback capability',async()=>{
 const f=fixture();f.observation.providerState='UNKNOWN';expect(await f.result.inspect(f.view.recordId,'dpl_fixture')).toMatchObject({state:'unknown'});f.observation.providerState='ERROR';expect(await f.result.inspect(f.view.recordId,'dpl_fixture')).toMatchObject({state:'terminal_failure',providerExecution:false});expect(f.result).not.toHaveProperty('execute');
});

it('bounds the complete read to ten seconds and never retries an unresponsive supplier',async()=>{
 vi.useFakeTimers();try{const f=fixture();f.source.readExact.mockImplementationOnce(()=>new Promise(()=>{}));const pending=f.result.inspect(f.view.recordId,'dpl_fixture');const rejected=expect(pending).rejects.toThrow('manual_release_result_unavailable');await vi.advanceTimersByTimeAsync(10000);await rejected;expect(f.source.readExact).toHaveBeenCalledTimes(1)}finally{vi.useRealTimers()}
});
it('never returns private provider errors as result text',async()=>{
 const f=fixture();f.source.readExact.mockRejectedValueOnce(Error('PRIVATE_PROVIDER_BODY'));await expect(f.result.inspect(f.view.recordId,'dpl_fixture')).rejects.toThrow('manual_release_result_unavailable');
});
