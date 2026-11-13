import {beforeAll,it,expect,vi} from 'vitest';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createOperationalWorkloadIdentity} from '../workloadIdentity';
const at=Date.parse('2026-11-12T00:00:00Z'),seconds=at/1000,d='a'.repeat(64),commit='b'.repeat(40),actionId='platform_action_11111111-1111-4111-8111-111111111111';
const workload={repository:'sahme209/visionxixlabs',ref:'refs/heads/main',commit,workflowCommit:commit,workflowPath:'.github/workflows/axiom-deploy-aws-ecs.yml',workflowSha256:d,runId:'12345',attempt:1};
const binding={actionId,manifestDigest:d,workload,expiresAt:new Date(at+300000).toISOString()};
let keys:Awaited<ReturnType<typeof generateKeyPair>>,publicKey:Awaited<ReturnType<typeof exportJWK>>;
beforeAll(async()=>{keys=await generateKeyPair('RS256');publicKey=await exportJWK(keys.publicKey)});
function claims(){return {iss:'https://token.actions.githubusercontent.com',aud:'axiom-synthetic-release',sub:'repo:sahme209/visionxixlabs:ref:refs/heads/main',jti:'synthetic-token-id',iat:seconds,nbf:seconds,exp:seconds+120,repository:workload.repository,repository_id:'123',repository_owner_id:'456',repository_owner:'sahme209',repository_visibility:'public',event_name:'workflow_dispatch',ref_type:'branch',runner_environment:'github-hosted',ref:workload.ref,sha:commit,workflow_ref:'sahme209/visionxixlabs/'+workload.workflowPath+'@refs/heads/main',workflow_sha:commit,run_id:workload.runId,run_attempt:'1'}}
async function token(change:Record<string,unknown>={},header:Record<string,unknown>={}){return new SignJWT({...claims(),...change}).setProtectedHeader({alg:'RS256',kid:'synthetic-key',...header}).sign(keys.privateKey)}
function fixture(){let now=at;const reserved=new Set<string>(),reserve=vi.fn(async(key:string)=>{if(reserved.has(key))throw Error('replayed');reserved.add(key)}),tx={now:async()=>now,reserveWorkloadIdentity:reserve};
 const profile={format:1,issuer:'https://token.actions.githubusercontent.com',audience:'axiom-synthetic-release',subject:claims().sub,repository:workload.repository,repositoryId:'123',repositoryOwnerId:'456',workflowPath:workload.workflowPath,workflowCommit:commit,workflowSha256:d,maximumLifetimeSeconds:300,keys:[{...publicKey,alg:'RS256',use:'sig',kid:'synthetic-key'}]};
 const source={readProfile:vi.fn(async():Promise<unknown>=>structuredClone(profile)),assertProfileCurrent:vi.fn(async()=>{})},clock=vi.fn(async()=>({earliest:now,latest:now})),controller=new AbortController(),identity=createOperationalWorkloadIdentity(source,clock,controller.signal);return {tx,reserve,reserved,profile,source,clock,controller,identity,setNow:(n:number)=>{now=n}};
}
it('verifies the actual signed synthetic JWT and issues only an opaque identity proof consumed once',async()=>{
 const f=fixture(),proof=await f.identity.authenticate(f.tx,await token(),binding);expect(JSON.stringify(proof)).toBe('{}');expect(f.reserve).not.toHaveBeenCalled();
 const identity=await f.identity.consume(f.tx,proof,binding);expect(identity).toMatchObject({principalKind:'workload',actionId,executionAuthorized:false,authority:'identity_only'});expect(JSON.stringify(identity)).not.toContain('synthetic-token-id');await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();expect(f.reserve).toHaveBeenCalledTimes(1);
});
it.each([{iss:'https://evil.example'},{aud:'other'},{aud:['axiom-synthetic-release','other']},{repository:'fork/repo'},{ref:'refs/heads/feature'},{sha:'f'.repeat(40)},{workflow_ref:'sahme209/visionxixlabs/.github/workflows/other.yml@refs/heads/main'},{workflow_sha:'f'.repeat(40)},{run_id:'999'},{run_attempt:'2'},{sub:'other'},{exp:seconds},{iat:seconds+1},{nbf:seconds+1},{exp:seconds+301}])('rejects a signed token with mismatched or invalid claims %j',async(change)=>{
 const f=fixture();await expect(f.identity.authenticate(f.tx,await token(change),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});
it('rejects human/static/forged/serialized proofs before replay storage, with no authentication fallback',async()=>{
 const f=fixture();for(const value of ['axm.desk.synthetic.signature','static-token','x'.repeat(32769)])await expect(f.identity.authenticate(f.tx,value,binding)).rejects.toThrow();
 const proof=await f.identity.authenticate(f.tx,await token(),binding);await expect(f.identity.consume(f.tx,structuredClone(proof),binding)).rejects.toThrow();expect(f.reserve).not.toHaveBeenCalled();
 await expect(f.identity.consume(f.tx,proof,{...binding,actionId:'platform_action_22222222-2222-4222-8222-222222222222'})).rejects.toThrow();expect(f.reserve).not.toHaveBeenCalled();
});
it('keeps replay exclusion across verifier instances and refuses a changed current profile or expired proof',async()=>{
 const f=fixture(),jwt=await token(),first=await f.identity.authenticate(f.tx,jwt,binding);await f.identity.consume(f.tx,first,binding);
 const other=createOperationalWorkloadIdentity(f.source,f.clock,f.controller.signal),second=await other.authenticate(f.tx,jwt,binding);await expect(other.consume(f.tx,second,binding)).rejects.toThrow();expect(f.reserved.size).toBe(1);
 const third=await f.identity.authenticate(f.tx,await token({jti:'third'}),binding);f.profile.workflowSha256='f'.repeat(64);await expect(f.identity.consume(f.tx,third,binding)).rejects.toThrow();expect(f.reserve).toHaveBeenCalledTimes(2);
 f.profile.workflowSha256=d;const fourth=await f.identity.authenticate(f.tx,await token({jti:'fourth'}),binding);f.setNow(at+120000);await expect(f.identity.consume(f.tx,fourth,binding)).rejects.toThrow();expect(f.reserved.size).toBe(1);
});
it('rejects qualification revocation and unknown reservation without restoring the consumed proof',async()=>{
 const f=fixture();f.source.assertProfileCurrent.mockRejectedValueOnce(Error('profile unavailable'));await expect(f.identity.authenticate(f.tx,await token(),binding)).rejects.toThrow();
 const proof=await f.identity.authenticate(f.tx,await token(),binding);f.reserve.mockRejectedValueOnce(Error('unknown commit'));await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();expect(f.reserve).toHaveBeenCalledTimes(1);
});
it('rejects valid-looking claims with a corrupted signature instead of merely decoding them',async()=>{
 const f=fixture(),parts=(await token()).split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);await expect(f.identity.authenticate(f.tx,parts.join('.'),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});
it('rechecks qualification and expiry after awaited verification without leaking profile errors',async()=>{
 const f=fixture();f.source.assertProfileCurrent.mockImplementationOnce(async()=>{f.setNow(at+120000)});await expect(f.identity.authenticate(f.tx,await token(),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});

it('accepts the documented bounded x5t header without treating its thumbprint as a trusted key source',async()=>{
 const f=fixture(),proof=await f.identity.authenticate(f.tx,await token({}, {typ:'JWT',x5t:'synthetic-thumbprint'}),binding);expect(await f.identity.consume(f.tx,proof,binding)).toMatchObject({authority:'identity_only'});
});
it.each([{repository_id:'999'},{repository_owner_id:'999'},{event_name:'pull_request'},{ref_type:'tag'},{runner_environment:'self-hosted'},{job_workflow_ref:'other/repo/.github/workflows/deploy.yml@refs/heads/main'},{job_workflow_sha:'f'.repeat(40)}])('rejects signed namespace/event/runtime or unsupported called-workflow substitution %j',async(change)=>{
 const f=fixture();await expect(f.identity.authenticate(f.tx,await token(change),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});
it.each([{x5t:42},{jku:'https://untrusted.example/keys'},{x5u:'https://untrusted.example/cert'}])('rejects malformed thumbprints or unreviewed remote key hints %j',async(header)=>{
 const f=fixture();await expect(f.identity.authenticate(f.tx,await token({},header),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});
it('rechecks the privately consumed identity for later credential phases without accepting serialized metadata',async()=>{
 const f=fixture(),proof=await f.identity.authenticate(f.tx,await token(),binding),consumed=await f.identity.consume(f.tx,proof,binding);
 await f.identity.assertConsumedCurrent(f.tx,consumed,binding);await expect(f.identity.assertConsumedCurrent(f.tx,structuredClone(consumed),binding)).rejects.toThrow();
 f.source.assertProfileCurrent.mockRejectedValueOnce(Error('profile revoked'));await expect(f.identity.assertConsumedCurrent(f.tx,consumed,binding)).rejects.toThrow();
});

it('binds an exact reviewed environment and protection revision to signed workload identity',async()=>{const f=fixture(),environment='axiom-reviewed-release',protectionRevision='c'.repeat(64),scoped={...binding,workload:{...workload,environment,protectionRevision}},profile={...f.profile,environment,protectionRevision,subject:'repo:sahme209/visionxixlabs:environment:'+environment};f.source.readProfile.mockResolvedValue(profile);const proof=await f.identity.authenticate(f.tx,await token({environment,sub:profile.subject}),scoped);expect(await f.identity.consume(f.tx,proof,scoped)).toMatchObject({workload:{environment,protectionRevision},authority:'identity_only'});});
it('refuses omitted or substituted signed environments and stale protection profiles',async()=>{const f=fixture(),environment='axiom-reviewed-release',protectionRevision='c'.repeat(64),scoped={...binding,workload:{...workload,environment,protectionRevision}},profile={...f.profile,environment,protectionRevision};f.source.readProfile.mockResolvedValue(profile);for(const change of [{},{environment:'different'}])await expect(f.identity.authenticate(f.tx,await token(change),scoped)).rejects.toThrow();f.source.readProfile.mockResolvedValue({...profile,protectionRevision:'d'.repeat(64)});await expect(f.identity.authenticate(f.tx,await token({environment}),scoped)).rejects.toThrow();expect(f.reserve).not.toHaveBeenCalled()});

it.each([{earliest:at-1,latest:at},{earliest:at,latest:at+120000}])('rejects a signed token whose interval crosses its validity boundary %j',async interval=>{
 const f=fixture();f.clock.mockResolvedValue(interval);await expect(f.identity.authenticate(f.tx,await token(),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});
it('retires an unconsumed proof when its private clock reaches expiry despite a valid database timestamp',async()=>{
 const f=fixture(),proof=await f.identity.authenticate(f.tx,await token(),binding);f.clock.mockResolvedValue({earliest:at+119999,latest:at+120000});
 await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();expect(f.reserve).not.toHaveBeenCalled();f.clock.mockResolvedValue({earliest:at,latest:at});await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();
});
it('rechecks profile authority after the awaited private clock read',async()=>{
 const f=fixture();let revoked=false;f.source.assertProfileCurrent.mockImplementation(async()=>{if(revoked)throw Error('synthetic profile revoked')});f.clock.mockImplementation(async()=>{revoked=true;return {earliest:at,latest:at}});
 await expect(f.identity.authenticate(f.tx,await token(),binding)).rejects.toThrow('operational_workload_unavailable');expect(f.reserve).not.toHaveBeenCalled();
});
it('does not issue a proof after its request is canceled during the clock read',async()=>{
 const f=fixture();f.clock.mockImplementation(async()=>{f.controller.abort();return {earliest:at,latest:at}});await expect(f.identity.authenticate(f.tx,await token(),binding)).rejects.toThrow();expect(f.reserve).not.toHaveBeenCalled();
});
it('retains the replay reservation if the private interval expires while reservation is awaited',async()=>{
 const f=fixture(),proof=await f.identity.authenticate(f.tx,await token(),binding),reserve=f.reserve.getMockImplementation()!;
 f.reserve.mockImplementationOnce(async key=>{await reserve(key);f.clock.mockResolvedValue({earliest:at+119999,latest:at+120000})});
 await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();expect(f.reserved.size).toBe(1);expect(f.reserve).toHaveBeenCalledOnce();
 f.clock.mockResolvedValue({earliest:at,latest:at});await expect(f.identity.consume(f.tx,proof,binding)).rejects.toThrow();expect(f.reserve).toHaveBeenCalledOnce();
});
it('honors a shorter original action deadline independently of token expiry',async()=>{
 const f=fixture(),short={...binding,expiresAt:new Date(at+60000).toISOString()};f.clock.mockResolvedValue({earliest:at,latest:at+60000});
 await expect(f.identity.authenticate(f.tx,await token(),short)).rejects.toThrow();expect(f.reserve).not.toHaveBeenCalled();
});
