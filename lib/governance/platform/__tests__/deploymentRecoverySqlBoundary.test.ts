import {expect,it,vi} from 'vitest';
import {createPlatformSqlRepository,type PlatformSql} from '../sqlRepository';
import {compilePlatformPlan,createPlatformAction} from '../kernel';
it('refuses recovery metadata on unrelated action kinds rather than silently dropping native evidence',async()=>{
 const d='a'.repeat(64),id='platform_action_11111111-1111-4111-8111-111111111111',state=createPlatformAction(compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(5000).toISOString(),effects:[{id:'setting',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}}]}),{userId:'requester',sessionId:'session'},1000),execute=vi.fn(async()=>1),query=vi.fn(async()=>[{next:0}]),sql={$queryRawUnsafe:query,$executeRawUnsafe:execute} as unknown as PlatformSql;
 const repo=createPlatformSqlRepository({$transaction:async fn=>fn(sql)});
 await expect(repo.transaction(async tx=>{await tx.lock(id);await tx.event({actionId:id,kind:'proposed',state,deploymentReleaseObservation:{format:1,purpose:'platform_deployment_terminal_observation_v1',observationId:'platform_evidence_22222222-2222-4222-8222-222222222222',nativeKey:d,generation:1,actionId:id,requestReceiptDigest:d,providerDeploymentId:'dpl_fixture',profileDigest:d,kind:'terminal_safe_to_release',observedAt:1200,expiresAt:4000}})})).rejects.toThrow();
 expect(execute).not.toHaveBeenCalled();expect(query).toHaveBeenCalledTimes(1);
});
