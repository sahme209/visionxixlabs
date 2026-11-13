import {afterEach,it,expect,vi} from 'vitest';
import {S3Client} from '@aws-sdk/client-s3';
import {STSClient} from '@aws-sdk/client-sts';
import {ensureTemplatePublished} from '../templateHosting';
import {templateAccessEffect} from '../platformTemplatePlan';
import {bindPlatformExecution} from '@/lib/governance/platform/effectExecution';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs()});
/** Installed-presigner positive acceptance moved to templateNativeTransport.test
 * and the joined SQL executor; a v1 binding must not remain a signing bypass. */
it('even a well-shaped old binding and configured broker environment cannot reach signing credentials/native I/O',async()=>{vi.stubEnv('AWS_CONNECTOR_BROKER_ACCESS_KEY_ID','synthetic-key');vi.stubEnv('AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY','synthetic-secret');const effect=templateAccessEffect({accountId:'123456789012',region:'us-east-2',bytesDigest:'a'.repeat(64),objectVersion:'version-1',recipientDigest:'b'.repeat(64),ttlSeconds:3600}),service={claimNextEffect:vi.fn(async()=>({effect,proof:{}})),beforeEffectSend:vi.fn(async()=>{}),observeEffect:vi.fn(async()=>{})},sts=vi.spyOn(STSClient.prototype,'send').mockRejectedValue(Error('unexpected_native_call')),s3=vi.spyOn(S3Client.prototype,'send').mockRejectedValue(Error('unexpected_native_call'));const {bytesDigest:_,...access}=effect.target;expect(await ensureTemplatePublished({platformExecution:bindPlatformExecution(service,'legacy'),access})).toMatchObject({available:false});expect(service.claimNextEffect).not.toHaveBeenCalled();expect(sts).not.toHaveBeenCalled();expect(s3).not.toHaveBeenCalled()});
