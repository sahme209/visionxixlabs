import {it,expect,vi,afterEach} from 'vitest';
import {NodeHttpHandler} from '@smithy/node-http-handler';
import {IncomingMessage} from 'node:http';
import {Socket} from 'node:net';
import {createPrivateOperationalStsIssuer as createPrivateOperationalStsIssuerActual,type PrivateOperationalStsPorts} from '../privateStsIssuer';
import {authorizeExecutionWindow,type ExecutionTimeAuthorization} from '../../executionTime';
import {preview} from '../../../../desktop/__tests__/fixtures/operationalReview';
import {compileOperationalManifest} from '../kernel';
const digest='a'.repeat(64);
// TEST ONLY: model the fake custodian's final read boundary explicitly. The
// actual native supplier is exercised separately; this adds no live qualifier.
function createPrivateOperationalStsIssuer(ports:PrivateOperationalStsPorts){
 const issuer=createPrivateOperationalStsIssuerActual({...ports,async readCustodianCredential(manifest,signal,beforeRead){if(!beforeRead)throw Error('missing synthetic source owner');await authorizeExecutionWindow(ports.clock,{expiresAt:Date.parse(manifest.expiresAt)},beforeRead,signal,async()=>{});return ports.readCustodianCredential(manifest,signal,beforeRead)}});
 const sourceOwner:ExecutionTimeAuthorization=async(check,finalFacts)=>{await check!();await finalFacts!()};
 return {...issuer,issue:(...[manifest,before,signal,record,admit,read=sourceOwner]:Parameters<typeof issuer.issue>)=>issuer.issue(manifest,before,signal,record,admit,read)};
}

const authorize=(action:()=>Promise<void>=async()=>{})=>async(check?:()=>Promise<void>,finalFacts?:()=>Promise<void>)=>{await action();await check?.();await finalFacts?.()};
function manifest(){const {digest:ignored,authority,executionAuthorized,...m}=preview.manifest;const result=compileOperationalManifest({...m,issuerProfileDigest:digest});if(result.kind!=='deployment.ecs')throw Error('fixture');return result}
const credential=()=>({leaseRef:'platform_credential_11111111-1111-4111-8111-111111111111',profileDigest:digest,accessKeyId:'SYNTHETICBASEKEY',secretAccessKey:'synthetic-base-secret',sessionToken:'synthetic-base-session',expiresAt:Date.now()+1200000});
const ports=()=>({clock:async()=>({earliest:Date.now(),latest:Date.now()+1}),assertQualified:vi.fn(async()=>{}),assertSourceLeaseCurrent:vi.fn(async()=>{}),readCustodianCredential:vi.fn(async()=>credential()),assertCustodianCurrent:vi.fn(async()=>{}),assertCustodianFactsCurrent:vi.fn(async()=>{})});
it('cannot mint when the original owner omits final native custody-facts acknowledgment',async()=>{const p={...ports(),assertCustodianFactsCurrent:vi.fn(async()=>{})},native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('intercepted'));await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),async check=>{await check!()},new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();expect(native).not.toHaveBeenCalled()});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
it('signs one exact AssumeRole with the separate private identity, never a GitHub token',async()=>{let authorized=false;const p=ports(),m=manifest(),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{expect(authorized).toBe(true);expect(request.hostname).toBe('sts.us-east-2.amazonaws.com');expect(request.headers.authorization).toContain('Credential=SYNTHETICBASEKEY/');expect(request.headers['x-amz-security-token']).toBe('synthetic-base-session');const fields=new URLSearchParams(String(request.body));expect(fields.get('Action')).toBe('AssumeRole');expect(fields.has('WebIdentityToken')).toBe(false);expect(fields.get('DurationSeconds')).toBe('900');const session=fields.get('RoleSessionName')!,body=new IncomingMessage(new Socket());body.push(Buffer.from(`<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleResult><AssumedRoleUser><Arn>arn:aws:sts::123456789012:assumed-role/fixture/${session}</Arn><AssumedRoleId>SYNTHETIC:${session}</AssumedRoleId></AssumedRoleUser><Credentials><AccessKeyId>SYNTHETIC_ACCESS</AccessKeyId><SecretAccessKey>SYNTHETIC_SECRET</SecretAccessKey><SessionToken>SYNTHETIC_SESSION</SessionToken><Expiration>${new Date(Date.now()+600000).toISOString()}</Expiration></Credentials></AssumeRoleResult><ResponseMetadata><RequestId>synthetic-request</RequestId></ResponseMetadata></AssumeRoleResponse>`));body.push(null);return {response:{statusCode:200,headers:{'content-type':'text/xml','x-amzn-requestid':'synthetic-request'},body}}});vi.stubEnv('AWS_ENDPOINT_URL_STS','https://must-not-use.invalid');const admit=vi.fn(async()=>{});const result=await createPrivateOperationalStsIssuer(p).issue(m,authorize(async()=>{authorized=true}),new AbortController().signal,async()=>{},admit);expect(admit).toHaveBeenCalledOnce();expect(admit.mock.invocationCallOrder[0]).toBeLessThan(p.readCustodianCredential.mock.invocationCallOrder[0]);expect(native).toHaveBeenCalledOnce();expect(result).toMatchObject({accessKeyId:'SYNTHETIC_ACCESS'});expect(p.assertCustodianCurrent).toHaveBeenCalledTimes(2)});
it('refuses old manifests and mismatched source profiles without credential or native fallback',async()=>{const p=ports(),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('private'));await expect(createPrivateOperationalStsIssuer(p).issue(preview.manifest,authorize(),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();expect(p.readCustodianCredential).not.toHaveBeenCalled();p.readCustodianCredential.mockResolvedValue({...credential(),profileDigest:'b'.repeat(64)});await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();expect(native).not.toHaveBeenCalled()});
it('rechecks custodian and final authority before native dispatch, and does not retry uncertainty',async()=>{const p=ports(),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('PRIVATE'));p.assertCustodianCurrent.mockResolvedValueOnce().mockRejectedValueOnce(Error('revoked'));await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();expect(native).not.toHaveBeenCalled();p.assertCustodianCurrent.mockResolvedValue();await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow('operational_private_sts_issuance_unavailable');expect(native).toHaveBeenCalledOnce()});
it('does not open the custodian credential supplier without durable source-intent admission',async()=>{const p=ports(),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('must not send'));await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,async()=>{})).rejects.toThrow();expect(p.readCustodianCredential).not.toHaveBeenCalled();expect(native).not.toHaveBeenCalled()});
it('honors a refused source-intent callback before opening the credential supplier',async()=>{const p=ports(),admit=vi.fn(async()=>{throw Error('drained')}),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('must not send'));await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,async()=>{},admit)).rejects.toThrow();expect(admit).toHaveBeenCalledOnce();expect(p.readCustodianCredential).not.toHaveBeenCalled();expect(native).not.toHaveBeenCalled()});
it('refuses supplier mutation during an awaited custody check before recording or STS',async()=>{
 const p=ports(),supplied=credential();p.readCustodianCredential.mockResolvedValue(supplied);p.assertCustodianCurrent.mockImplementation(async()=>{supplied.accessKeyId='SUBSTITUTED'});const record=vi.fn(async()=>{}),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('must not send'));
 await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,record,async()=>{})).rejects.toThrow('operational_private_sts_issuance_unavailable');expect(record).not.toHaveBeenCalled();expect(native).not.toHaveBeenCalled();
});
it('blocks STS when the private interval overlaps source expiry even though the process clock has time left',async()=>{
 const supplied=credential(),p={...ports(),clock:async()=>({earliest:supplied.expiresAt-1,latest:supplied.expiresAt})};
 p.readCustodianCredential.mockResolvedValue(supplied);
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('intercepted outbound request'));
 await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();
 expect(native).not.toHaveBeenCalled();
});
it('rechecks the private interval after awaited final authority before the one STS send',async()=>{
 const supplied=credential();let expired=false;
 const p={...ports(),clock:async()=>({earliest:supplied.expiresAt-(expired?1:1000),latest:supplied.expiresAt-(expired?0:900)})};
 p.readCustodianCredential.mockResolvedValue(supplied);
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('intercepted outbound request'));
 await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(async()=>{expired=true}),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();
 expect(native).not.toHaveBeenCalled();
});
it('keeps the original private time source when a caller replaces the port during final authority',async()=>{
 const supplied=credential();let expired=false;
 const p={...ports(),clock:async()=>({earliest:supplied.expiresAt-1000,latest:supplied.expiresAt-(expired?0:900)})};
 p.readCustodianCredential.mockResolvedValue(supplied);
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('intercepted outbound request'));
 await expect(createPrivateOperationalStsIssuer(p).issue(manifest(),authorize(async()=>{expired=true;p.clock=async()=>({earliest:1,latest:2})}),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();
 expect(native).not.toHaveBeenCalled();
});
it('blocks an action that expires during the final clock read while its source credential remains valid',async()=>{
 const {digest:ignored,authority,executionAuthorized,...base}=manifest(),end=Date.now()+1000;const m=compileOperationalManifest({...base,expiresAt:new Date(end).toISOString()});if(m.kind!=='deployment.ecs')throw Error('fixture');
 let reads=0;const p={...ports(),clock:async()=>{await Promise.resolve();return {earliest:end-10,latest:++reads===1?end-1:end}}};
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockRejectedValue(Error('intercepted outbound request'));
 await expect(createPrivateOperationalStsIssuer(p).issue(m,authorize(),new AbortController().signal,async()=>{},async()=>{})).rejects.toThrow();
 expect(native).not.toHaveBeenCalled();
});
