import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
const m=vi.hoisted(()=>({s3:vi.fn(),sts:vi.fn(),sign:vi.fn(),configs:[] as unknown[],read:vi.fn()}));
vi.mock('node:fs/promises',()=>({readFile:m.read}));
vi.mock('@aws-sdk/client-sts',()=>({STSClient:class{constructor(c:unknown){m.configs.push(c)}send=m.sts;destroy(){}},GetCallerIdentityCommand:class{constructor(public input:unknown){}}}));
vi.mock('@aws-sdk/client-s3',()=>{
 class Command{constructor(public input:unknown){}}
 return {S3Client:class{constructor(c:unknown){m.configs.push(c)}send=m.s3;destroy(){}},CreateBucketCommand:class extends Command{},PutObjectCommand:class extends Command{},GetObjectCommand:class extends Command{},GetBucketVersioningCommand:class extends Command{}};
});
vi.mock('@aws-sdk/s3-request-presigner',()=>({getSignedUrl:m.sign}));
import {createPlatformTemplateBucket,publishPlatformTemplateObject,ensureTemplatePublished} from '../templateHosting';
import {templateBucketEffect,templateObjectEffect,templateAccessEffect} from '../platformTemplatePlan';
import {bindPlatformExecution} from '@/lib/governance/platform/effectExecution';
const accountId='123456789012',region='us-east-2',bytes=Buffer.from('template-fixture'),digest=createHash('sha256').update(bytes).digest('hex');
function bind(effect:ReturnType<typeof templateBucketEffect>|ReturnType<typeof templateObjectEffect>|ReturnType<typeof templateAccessEffect>){
 const service={claimNextEffect:vi.fn(async()=>({effect,proof:{}})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})};return {binding:bindPlatformExecution(service,'fixture-action'),service};
}
beforeEach(()=>{vi.clearAllMocks();m.configs.length=0;vi.stubEnv('AWS_CONNECTOR_BROKER_ACCESS_KEY_ID','synthetic-key');vi.stubEnv('AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY','synthetic-secret');m.sts.mockResolvedValue({Account:accountId});m.read.mockResolvedValue(bytes);m.s3.mockResolvedValue({$metadata:{httpStatusCode:200},VersionId:'version-1',Status:'Enabled'});});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers()});
it('legacy GET/override cannot read credentials or reach AWS without an exact grant',async()=>{
 vi.stubEnv('AWS_CFN_TEMPLATE_S3_URL','https://unreviewed.invalid/template');expect(await ensureTemplatePublished()).toMatchObject({available:false,reason:'platform_review_required'});expect(m.sts).not.toHaveBeenCalled();expect(m.s3).not.toHaveBeenCalled();expect(m.sign).not.toHaveBeenCalled();expect(m.configs).toHaveLength(0);
});
it('bucket creation refuses the documented us-east-1 ACL-reset risk before AWS',async()=>{
 const effect=templateBucketEffect(accountId,'us-east-1'),b=bind(effect);await expect(createPlatformTemplateBucket({accountId,region:'us-east-1',platformExecution:b.binding})).rejects.toThrow();expect(m.sts).not.toHaveBeenCalled();expect(m.s3).not.toHaveBeenCalled();
});
it('creates only the exact reviewed regional bucket once using fixed endpoints and no SDK retry',async()=>{
 const effect=templateBucketEffect(accountId,region),b=bind(effect);expect(await createPlatformTemplateBucket({accountId,region,platformExecution:b.binding})).toMatchObject({bucket:effect.target.bucket});expect(m.s3).toHaveBeenCalledTimes(1);expect(m.s3.mock.calls[0][0].input).toEqual({Bucket:effect.target.bucket,CreateBucketConfiguration:{LocationConstraint:region}});expect(m.configs).toEqual(expect.arrayContaining([expect.objectContaining({maxAttempts:1,endpoint:'https://s3.us-east-2.amazonaws.com'})]));expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('conditional content-addressed upload preserves old objects and records its exact version',async()=>{
 const effect=templateObjectEffect(accountId,region,digest),b=bind(effect),result=await publishPlatformTemplateObject({accountId,region,platformExecution:b.binding});expect(result.objectVersion).toBe('version-1');expect(m.s3).toHaveBeenCalledTimes(2);expect(m.s3.mock.calls[1][0].input).toMatchObject({Bucket:effect.target.bucket,Key:effect.target.key,IfNoneMatch:'*',ExpectedBucketOwner:accountId,Body:bytes});expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('changed template bytes or broker account cannot reach a write',async()=>{
 for(const cause of ['bytes','account']){
  const effect=templateObjectEffect(accountId,region,digest),b=bind(effect);if(cause==='bytes')m.read.mockResolvedValueOnce(Buffer.from('changed'));else m.sts.mockResolvedValueOnce({Account:'999999999999'});
  await expect(publishPlatformTemplateObject({accountId,region,platformExecution:b.binding})).rejects.toThrow();expect(m.s3).not.toHaveBeenCalled();
 }
});
function access(ttlSeconds=3600){const input={accountId,region,objectVersion:'version-1',recipientDigest:'b'.repeat(64),ttlSeconds},effect=templateAccessEffect({...input,bytesDigest:digest}),b=bind(effect);return {input,effect,b}}
function urlFor(effect:ReturnType<typeof templateAccessEffect>){const date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,'');return `https://${effect.target.bucket}.s3.${region}.amazonaws.com/${effect.target.key}?versionId=version-1&X-Amz-Expires=${effect.target.ttlSeconds}&X-Amz-SignedHeaders=host&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Date=${date}&X-Amz-Credential=${encodeURIComponent('synthetic-key/'+date.slice(0,8)+'/'+region+'/s3/aws4_request')}&X-Amz-Signature=${'a'.repeat(64)}&x-amz-expected-bucket-owner=${accountId}`}

it('grants access only after exact version/bytes observation and a fresh final check',async()=>{
 const {input,effect,b}=access();m.s3.mockImplementation(async()=>({VersionId:'version-1',ContentLength:bytes.length,Body:(async function*(){yield bytes})()}));m.sign.mockResolvedValue(urlFor(effect));
 expect(await ensureTemplatePublished({platformExecution:b.binding,access:input})).toMatchObject({available:true,publishedNow:false,bucket:effect.target.bucket});expect(m.s3.mock.calls[0][0].input).toMatchObject({VersionId:'version-1',ExpectedBucketOwner:accountId});expect(m.sign).toHaveBeenCalledTimes(1);expect(m.sign.mock.calls[0][1].input.VersionId).toBe('version-1');expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'confirmed');
});
it('missing/unversioned or mismatched readback never signs a URL',async()=>{
 for(const version of ['null','other']){const {input,b}=access();m.s3.mockResolvedValueOnce({VersionId:version,ContentLength:bytes.length,Body:(async function*(){yield bytes})()});expect(await ensureTemplatePublished({platformExecution:b.binding,access:input})).toMatchObject({available:false});expect(m.sign).not.toHaveBeenCalled();}
});
it('signer substitutions cannot expand host, version, expiry or required headers',async()=>{
 for(const change of ['host','version','expiry','headers']){
  const {input,effect,b}=access();m.s3.mockResolvedValueOnce({VersionId:'version-1',ContentLength:bytes.length,Body:(async function*(){yield bytes})()});let url=urlFor(effect);if(change==='host')url=url.replace(effect.target.bucket+'.s3.'+region+'.amazonaws.com','other.invalid');if(change==='version')url=url.replace('versionId=version-1','versionId=other');if(change==='expiry')url=url.replace('Expires=3600','Expires=7200');if(change==='headers')url=url.replace('SignedHeaders=host','SignedHeaders=host%3Bextra');m.sign.mockResolvedValueOnce(url);
  expect(await ensureTemplatePublished({platformExecution:b.binding,access:input})).toMatchObject({available:false});expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
 }
});

it('does not report a grant from malformed signing evidence',async()=>{
 for(const field of ['X-Amz-Signature','X-Amz-Date','X-Amz-Credential','x-amz-expected-bucket-owner']){
  const {input,effect,b}=access();m.s3.mockResolvedValueOnce({VersionId:'version-1',ContentLength:bytes.length,Body:(async function*(){yield bytes})()});const url=new URL(urlFor(effect));url.searchParams.delete(field);m.sign.mockResolvedValueOnce(url.href);
  expect(await ensureTemplatePublished({platformExecution:b.binding,access:input})).toMatchObject({available:false});
 }
});

it('does not upload when bucket versioning is disabled or unverified',async()=>{
 for(const Status of [undefined,'Suspended']){m.s3.mockClear();const effect=templateObjectEffect(accountId,region,digest),b=bind(effect);m.s3.mockResolvedValueOnce({Status});await expect(publishPlatformTemplateObject({accountId,region,platformExecution:b.binding})).rejects.toThrow();expect(m.s3).toHaveBeenCalledTimes(1);expect(m.s3.mock.calls[0][0].input).not.toHaveProperty('Body');}
});
it('rechecks authority after asynchronous signing before exposing the URL',async()=>{
 const {input,effect,b}=access();let revoked=false;
 m.s3.mockResolvedValueOnce({VersionId:'version-1',ContentLength:bytes.length,Body:(async function*(){yield bytes})()});
 b.service.beforeEffectSend.mockImplementation(async()=>{if(revoked)throw Error('revoked')});m.sign.mockImplementationOnce(async()=>{revoked=true;return urlFor(effect)});
 expect(await ensureTemplatePublished({platformExecution:b.binding,access:input})).toMatchObject({available:false});expect(b.service.observeEffect).toHaveBeenCalledWith(expect.anything(),'unknown');
});

it.each(['authorization','observation'])('refuses a URL that expires during awaited %s without resigning',async phase=>{
 vi.useFakeTimers();const start=Date.parse('2026-11-12T00:00:00Z');vi.setSystemTime(start);const {input,effect,b}=access(1);
 m.s3.mockResolvedValueOnce({VersionId:'version-1',ContentLength:bytes.length,Body:(async function*(){yield bytes})()});m.sign.mockResolvedValueOnce(urlFor(effect));
 if(phase==='authorization')b.service.beforeEffectSend.mockImplementation(async()=>{vi.setSystemTime(start+2000)});else b.service.observeEffect.mockImplementation(async()=>{vi.setSystemTime(start+2000)});
 expect(await ensureTemplatePublished({platformExecution:b.binding,access:input})).toMatchObject({available:false});expect(m.sign).toHaveBeenCalledTimes(1);expect(b.service.observeEffect).toHaveBeenCalledTimes(1);
});
