import {describe,it,expect} from 'vitest';
import {loadAwsGuidedRegistry} from '../registry';
const scope={organizationId:'org_one',userId:'user',sessionId:'paired'};
const value=()=>({version:1,organizationId:'org_one',template:{templateUrl:`https://axiom-approved.s3.us-east-2.amazonaws.com/roles/${'a'.repeat(64)}.yaml`,templateDigest:'a'.repeat(64),policyDigest:'b'.repeat(64),brokerPrincipalArn:'arn:aws:iam::111111111111:role/Broker',roleName:'AxiomReader',capability:'ec2_describe_instances_v1',reviewed:true},choices:[{id:'account1',name:'Approved sandbox',accountId:'895544788479',region:'us-east-2',readScope:'EC2 instance metadata; no changes'}]});
describe('AWS administrator registry',()=>{
 it('uses only exact organization-bound closed configuration and fixed S3 artifact',()=>{const r=loadAwsGuidedRegistry(JSON.stringify(value()),scope);expect(r?.choices[0]).toMatchObject({accountId:'895544788479',region:'us-east-2',roleName:'AxiomReader'});expect(loadAwsGuidedRegistry(JSON.stringify(value()),{...scope,organizationId:'other'})).toBeNull()});
 it.each([undefined,'{}','{','x'.repeat(65537)])('fails closed on absent/malformed/oversized registry',raw=>{expect(loadAwsGuidedRegistry(raw,scope)).toBeNull()});
 it('rejects extra authority, duplicate choices and mutable template URLs',()=>{const x=value();Object.assign(x,{autoApprove:true});expect(loadAwsGuidedRegistry(JSON.stringify(x),scope)).toBeNull();const y=value();y.choices.push(y.choices[0]);expect(loadAwsGuidedRegistry(JSON.stringify(y),scope)).toBeNull();const z=value();z.template.templateUrl='https://visionxixlabs.com/api/aws/quick-deploy-url';expect(loadAwsGuidedRegistry(JSON.stringify(z),scope)).toBeNull()});
});
