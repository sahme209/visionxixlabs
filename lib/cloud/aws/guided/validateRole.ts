import 'server-only';
import {STSClient,AssumeRoleCommand,GetCallerIdentityCommand} from '@aws-sdk/client-sts';
import {loadAppEnv} from '@/lib/config/env';
import {awsReadEndpoint,boundedAwsHandler} from '../ecsObservation/boundedAwsHandler';
import {assertAwsEnrollmentConfigured} from '../enrollment/stsValidation';
import {parseAwsEnrollmentInput} from '../enrollment/policy';
/** New guided profile only: one SDK attempt per fixed STS operation, shared total
 * deadline/body budget. No ambient identity, caching or inventory request. */
export async function validateGuidedAwsRole(raw:{expectedAccountId:string;roleArn:string;region:string;externalId:string;sessionName:string},parent:AbortSignal){
 const input=parseAwsEnrollmentInput({expectedAccountId:raw.expectedAccountId,roleArn:raw.roleArn,region:raw.region});
 if(!/^axiom-[a-f0-9]{32}$/.test(raw.externalId)||!/^[A-Za-z0-9_+=,.@-]{2,64}$/.test(raw.sessionName))throw Error('aws_guided_identity_unverified');
 assertAwsEnrollmentConfigured();const cfg=loadAppEnv();const signal=AbortSignal.any([parent,AbortSignal.timeout(8000)]),budget={remaining:65536};signal.throwIfAborted();const partition=input.roleArn.split(':')[1];
 const options={region:input.region,maxAttempts:1,ignoreConfiguredEndpointUrls:true,endpoint:awsReadEndpoint('sts',input.region,partition),useFipsEndpoint:false,useDualstackEndpoint:false,requestHandler:boundedAwsHandler(signal,budget)};
 const broker=new STSClient({...options,credentials:{accessKeyId:cfg.awsBrokerAccessKeyId!,secretAccessKey:cfg.awsBrokerSecretAccessKey!}});let tenant:STSClient|undefined;
 try{const r=await broker.send(new AssumeRoleCommand({RoleArn:input.roleArn,ExternalId:raw.externalId,RoleSessionName:raw.sessionName,DurationSeconds:900}),{abortSignal:signal});signal.throwIfAborted();const c=r.Credentials,expected=`arn:${partition}:sts::${input.expectedAccountId}:assumed-role/${input.roleArn.split('/').at(-1)}/${raw.sessionName}`;if(!c?.AccessKeyId||!c.SecretAccessKey||!c.SessionToken||r.AssumedRoleUser?.Arn!==expected)throw Error('aws_guided_identity_unverified');tenant=new STSClient({...options,credentials:{accessKeyId:c.AccessKeyId,secretAccessKey:c.SecretAccessKey,sessionToken:c.SessionToken}});const identity=await tenant.send(new GetCallerIdentityCommand({}),{abortSignal:signal});signal.throwIfAborted();if(identity.Account!==input.expectedAccountId||identity.Arn!==expected)throw Error('aws_guided_identity_unverified');return{accountId:identity.Account,assumedRoleArn:expected};}finally{tenant?.destroy();broker.destroy()}
}
