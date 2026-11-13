import {afterEach,expect,it,vi} from 'vitest';
import {createNativeCustodianPorts,type NativeCustodianQualification} from '../nativeCustodianSupplier';
import {readNativeCustodianResponse} from '../nativeCustodianHttp';
import {preview} from '../../../../desktop/__tests__/fixtures/operationalReview';
import {compileOperationalManifest} from '../kernel';
vi.mock('../nativeCustodianHttp',()=>({readNativeCustodianResponse:vi.fn()}));
const digest='a'.repeat(64),now=Date.now(),sourceRoleArn='arn:aws:iam::123456789012:role/fixture-source';
function manifest(){const {digest:ignored,authority,executionAuthorized,...m}=preview.manifest;const result=compileOperationalManifest({...m,issuerProfileDigest:digest});if(result.kind!=='deployment.ecs')throw Error('fixture');return result}
function setup(){
 const profile={profileDigest:digest,relativePath:'/v2/credentials/synthetic',sourceRoleArn,maximumExpiresAt:now+3600000};
 const qualification={assertQualified:vi.fn(async()=>{}),assertSourceLeaseCurrent:vi.fn(async()=>{}),capture:vi.fn(async()=>profile),assertCurrent:vi.fn<NativeCustodianQualification['assertCurrent']>(async()=>{}),clock:vi.fn(async()=>({earliest:now,latest:now+1000}))};
 const native={RoleArn:sourceRoleArn,AccessKeyId:'SYNTHETIC_ACCESS',SecretAccessKey:'SYNTHETIC_SECRET',Token:'SYNTHETIC_SESSION',Expiration:new Date(now+600000).toISOString()};
 vi.mocked(readNativeCustodianResponse).mockResolvedValue(JSON.stringify(native));
 return {profile,qualification,native,ports:createNativeCustodianPorts(qualification),m:manifest(),signal:new AbortController().signal};
}
afterEach(()=>vi.resetAllMocks());
it('binds source-role response and immutable profile to the actual private issuer port',async()=>{
 const f=setup(),result=await f.ports.readCustodianCredential(f.m,f.signal);expect(result).toMatchObject({profileDigest:digest,accessKeyId:'SYNTHETIC_ACCESS',expiresAt:now+600000});expect(result.leaseRef).toMatch(/^platform_credential_/);expect(readNativeCustodianResponse).toHaveBeenCalledOnce();await f.ports.assertCustodianCurrent(f.m,result,f.signal);await expect(f.ports.assertCustodianCurrent(f.m,{...result},f.signal)).rejects.toThrow('custodian_native_supplier_unavailable');
});
it('refuses missing qualification before native acquisition',async()=>{
 const f=setup();f.qualification.assertCurrent.mockRejectedValue(Error('PRIVATE'));await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow('custodian_native_supplier_unavailable');expect(readNativeCustodianResponse).not.toHaveBeenCalled();
});
it.each(['RoleArn','AccessKeyId','SecretAccessKey','Token','Expiration'])('requires native %s without leaking response',async field=>{
 const f=setup();delete (f.native as Record<string,unknown>)[field];vi.mocked(readNativeCustodianResponse).mockResolvedValue(JSON.stringify(f.native));await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow(/^custodian_native_supplier_unavailable$/);
});
it('rejects target-role substitution, unknown response fields and unqualified lifetime',async()=>{
 const f=setup();vi.mocked(readNativeCustodianResponse).mockResolvedValue(JSON.stringify({...f.native,RoleArn:f.m.roleArn}));await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow();vi.mocked(readNativeCustodianResponse).mockResolvedValue(JSON.stringify({...f.native,Unexpected:'x'}));await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow();vi.mocked(readNativeCustodianResponse).mockResolvedValue(JSON.stringify({...f.native,Expiration:new Date(now+3600001).toISOString()}));await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow();
});
it('captures profile coordinates before awaits and refuses changed current authority',async()=>{
 const f=setup();f.qualification.assertCurrent.mockImplementationOnce(async()=>{f.profile.relativePath='/v2/credentials/changed';f.profile.sourceRoleArn='arn:aws:iam::123456789012:role/changed'});await f.ports.readCustodianCredential(f.m,f.signal);expect(readNativeCustodianResponse).toHaveBeenCalledWith('/v2/credentials/synthetic',f.signal);expect(f.qualification.assertCurrent.mock.calls[0][1]).toMatchObject({sourceRoleArn});
});
it('rechecks trusted time and runtime after acquisition and never retries a refusal',async()=>{
 const f=setup();f.qualification.clock.mockResolvedValue({earliest:now+600000,latest:now+600001});await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow();expect(readNativeCustodianResponse).toHaveBeenCalledOnce();
});
it('joins actual private issuer without losing opaque supplier ownership before STS',async()=>{
 const {createPrivateOperationalStsIssuer}=await import('../privateStsIssuer');
 const {NodeHttpHandler}=await import('@smithy/node-http-handler');
 const {IncomingMessage}=await import('node:http');const {Socket}=await import('node:net');
 const f=setup();const sent=vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{
  const session=new URLSearchParams(String(request.body)).get('RoleSessionName')!;
  expect(request.headers.authorization).toContain('Credential=SYNTHETIC_ACCESS/');
  const body=new IncomingMessage(new Socket());body.push(Buffer.from(`<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleResult><AssumedRoleUser><Arn>arn:aws:sts::123456789012:assumed-role/fixture/${session}</Arn><AssumedRoleId>SYNTHETIC:${session}</AssumedRoleId></AssumedRoleUser><Credentials><AccessKeyId>SYNTHETIC_DERIVED</AccessKeyId><SecretAccessKey>SYNTHETIC_SECRET</SecretAccessKey><SessionToken>SYNTHETIC_SESSION</SessionToken><Expiration>${new Date(Date.now()+600000).toISOString()}</Expiration></Credentials></AssumeRoleResult><ResponseMetadata><RequestId>synthetic-request</RequestId></ResponseMetadata></AssumeRoleResponse>`));body.push(null);return {response:{statusCode:200,headers:{'content-type':'text/xml','x-amzn-requestid':'synthetic-request'},body}};
 });
 const events:string[]=[];const result=await createPrivateOperationalStsIssuer(f.ports).issue(f.m,async check=>{events.push('role');await check?.()},f.signal,async observation=>{expect(observation.profileDigest).toBe(digest);events.push('source-recorded')},async()=>{events.push('source-intent')});
 expect(result).toMatchObject({accessKeyId:'SYNTHETIC_DERIVED'});expect(sent).toHaveBeenCalledOnce();expect(events).toEqual(['source-intent','source-recorded','role']);sent.mockRestore();
});
it('keeps one captured private clock across awaited profile checks and the exported issuer port',async()=>{
 const f=setup(),original=f.qualification.clock;
 f.qualification.assertCurrent.mockImplementationOnce(async()=>{
  original.mockResolvedValue({earliest:now,latest:f.profile.maximumExpiresAt});
  f.qualification.clock=vi.fn(async()=>({earliest:1,latest:2}));
 });
 await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow('custodian_native_supplier_unavailable');
 expect(readNativeCustodianResponse).not.toHaveBeenCalled();
 expect(await f.ports.clock(f.signal)).toEqual({earliest:now,latest:f.profile.maximumExpiresAt});
});
it('rechecks the same captured qualification after its clock wait before acquiring native credentials',async()=>{const f=setup();f.qualification.clock.mockImplementation(async()=>{f.qualification.assertCurrent.mockRejectedValue(Error('revoked during clock'));return {earliest:now,latest:now+1000}});await expect(f.ports.readCustodianCredential(f.m,f.signal)).rejects.toThrow();expect(readNativeCustodianResponse).not.toHaveBeenCalled()});
