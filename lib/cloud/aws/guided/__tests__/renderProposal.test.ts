import {it,expect} from 'vitest';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {renderAwsGuidedTemplateProposal,constructAwsGuidedTemplate} from '../template';
// Explicit opt-in owned local artifact; normal test runs need no private fixture.
it.skipIf(process.env.AXIOM_RENDER_AWS_GUIDED_PROPOSAL!=='true')('renders the generated-policy artifact for review only',()=>{const base='/private/tmp/axiom-aws-guided-policy-evidence',policy=JSON.parse(readFileSync(base+'/reader-policy.json','utf8')),source=readFileSync('lib/cloud/aws/guided/callbackLambda.py','utf8'),hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),input={readerPolicy:policy,callbackPolicy:null,readerDigest:hash(policy),callbackDigest:hash(null),generatorReceipt:{tool:'iam-policy-autopilot' as const,sourceDigest:createHash('sha256').update(source).digest('hex'),reviewed:false},lambdaSource:source};expect(()=>constructAwsGuidedTemplate(input)).toThrow();const rendered=renderAwsGuidedTemplateProposal(input);expect(rendered.activationAvailable).toBe(false);writeFileSync(base+'/template-review.json',JSON.stringify(rendered,null,2)+'\n');});
