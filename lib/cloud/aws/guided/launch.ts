import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
const id=z.string().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/);
const sha=z.string().regex(/^[a-f0-9]{64}$/);
const account=z.string().regex(/^\d{12}$/);
const region=z.string().regex(/^us-(?:east|west)-[12]$/);
export const awsGuidedSelectionSchema=z.object({choiceId:id,accountId:account,region,roleName:z.string().regex(/^[A-Za-z0-9_+=,.@-]{1,64}$/)}).strict();
export type AwsGuidedSelection=z.infer<typeof awsGuidedSelectionSchema>;
export const awsGuidedTemplateSchema=z.object({templateUrl:z.string().url().max(2048),templateDigest:sha,policyDigest:sha,brokerPrincipalArn:z.string().regex(/^arn:aws:iam::\d{12}:(?:role\/[A-Za-z0-9_+=,.@\/-]+|user\/[A-Za-z0-9_+=,.@\/-]+)$/),roleName:z.string().regex(/^[A-Za-z0-9_+=,.@-]{1,64}$/),capability:z.literal('ec2_describe_instances_v1'),reviewed:z.literal(true)}).strict();
export type AwsGuidedTemplate=z.infer<typeof awsGuidedTemplateSchema>;
/** Pure launch construction from server-validated selection/template/challenge.
 * It neither publishes a template nor creates an AWS role. No legacy hosting helper. */
export function buildAwsGuidedLaunch(raw:{selection:AwsGuidedSelection;template:AwsGuidedTemplate;challenge:{attemptId:string;externalId:string;expiresAt:string}},now=Date.now()){
 const selection=awsGuidedSelectionSchema.parse(raw.selection),template=awsGuidedTemplateSchema.parse(raw.template);
 const challenge=z.object({attemptId:id,externalId:z.string().regex(/^axiom-[a-f0-9]{32}$/),expiresAt:z.string().datetime()}).strict().parse(raw.challenge);
 const expiry=Date.parse(challenge.expiresAt);if(expiry<=now||expiry>now+600000||selection.roleName!==template.roleName)throw Error('aws_guided_binding_invalid');
 const host=new URL(template.templateUrl);
 // Approved immutable S3 object only: never the auto-publishing quick-deploy endpoint.
 if(host.protocol!=='https:'||host.username||host.password||host.port||host.search||host.hash||!/^[-a-z0-9]+\.s3\.(?:us-east-[12]|us-west-[12])\.amazonaws\.com$/.test(host.hostname)||!host.pathname.endsWith('/'+template.templateDigest+'.yaml'))throw Error('aws_guided_template_unavailable');
 const params=new URLSearchParams({templateURL:template.templateUrl,stackName:'axiom-read-'+challenge.attemptId.slice(0,32),param_ExternalId:challenge.externalId,param_BrokerPrincipalArn:template.brokerPrincipalArn,param_RoleName:template.roleName});
 const proposal={accountId:selection.accountId,region:selection.region,roleArn:`arn:aws:iam::${selection.accountId}:role/${template.roleName}`,brokerPrincipalArn:template.brokerPrincipalArn,templateDigest:template.templateDigest,policyDigest:template.policyDigest,capability:template.capability,externalId:challenge.externalId};
 return{attemptId:challenge.attemptId,expiresAt:challenge.expiresAt,proposal,proposalDigest:createHash('sha256').update(JSON.stringify(proposal)).digest('hex'),consoleUrl:`https://${selection.region}.console.aws.amazon.com/cloudformation/home?region=${selection.region}#/stacks/quickcreate?${params}`,connected:false as const,providerWritePerformed:false as const,automaticCallbackAvailable:false as const};
}
