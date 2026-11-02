const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {validateBundle}=require('./validate-support-knowledge.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'articles/agent-reviewed-action.r1.json')));
function fixture(t,change=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-help-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'source.txt'),'source evidence');
 const article=structuredClone(original);article.productVersion='fixture-release-1';article.sources=[{path:'source.txt',sha256:hash('source evidence')}];article.verification.evidencePaths=['source.txt'];article.verification.verifiedVersion=article.productVersion;
 const evaluation={schema:1,articleId:article.id,revision:1,status:'proposed-not-executed',scope:'Offline fixture only',productVersion:article.productVersion,articleSha256:'0'.repeat(64),cases:[{id:'fixture-01',question:'What happened?',requiredResponse:'Read history.',requiredCitation:'Approved current revision only.'}]};
 change(article,evaluation,root);
 const bytes=JSON.stringify(article);if(evaluation.articleSha256==='0'.repeat(64))evaluation.articleSha256=hash(bytes);
 fs.writeFileSync(path.join(root,'article.json'),bytes);fs.writeFileSync(path.join(root,'evaluation.json'),JSON.stringify(evaluation));
 return{root,articlePath:'article.json',evaluationPath:'evaluation.json',expectedVersion:'fixture-release-1'};
}
test('valid draft passes structure and integrity but is ineligible for customer retrieval',t=>{const result=validateBundle(fixture(t));assert.equal(result.valid,true);assert.equal(result.customerEligible,false);assert(result.customerBlockers.includes('article_not_approved'));});
for(const [name,change]of [
 ['unknown article property',(a)=>{a.tenantSecret='unexpected';}],
 ['invalid approval date',(a)=>{a.status='approved';a.review={reviewer:'human',reviewedAt:'yesterday'};a.verification.verifiedAt='2026-11-02T12:00:00Z';}],
 ['missing approval identity',(a)=>{a.status='approved';}],
 ['duplicate control IDs',(a)=>{a.controlIds.push(a.controlIds[0]);}],
 ['changed source bytes',(_a,_e,r)=>{fs.writeFileSync(path.join(r,'source.txt'),'changed');}],
 ['source outside root',(a)=>{a.sources[0].path='../outside';}],
 ['fixture article version mismatch',(_a,e)=>{e.productVersion='different';}],
 ['fixture revision mismatch',(_a,e)=>{e.revision=2;}],
 ['fixture article hash mismatch',(_a,e)=>{e.articleSha256='a'.repeat(64);}],
 ['duplicate question IDs',(_a,e)=>{e.cases.push({...e.cases[0]});}],
 ['unrecognized fixture field',(_a,e)=>{e.passed=true;}],
 ['empty required response',(_a,e)=>{e.cases[0].requiredResponse='';}],
])test('rejects '+name,t=>assert.throws(()=>validateBundle(fixture(t,change))));
test('explicit target version rejects a different release',t=>{const input=fixture(t);input.expectedVersion='fixture-release-2';assert.throws(()=>validateBundle(input),/version/i);});
test('customer mode rejects an otherwise valid internal draft',t=>{assert.throws(()=>validateBundle({...fixture(t),customer:true}),/customer/i);});
test('withdrawn and superseded records remain ineligible without deleting history',t=>{for(const status of ['withdrawn','superseded']){const input=fixture(t,a=>{a.status=status;});const bytes=fs.readFileSync(path.join(input.root,input.articlePath));assert.equal(validateBundle(input).customerEligible,false);assert.deepEqual(fs.readFileSync(path.join(input.root,input.articlePath)),bytes);}});
test('symlink cannot make an out-of-root source readable',t=>{const outside=fs.mkdtempSync(path.join(os.tmpdir(),'axiom-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));fs.writeFileSync(path.join(outside,'secret'),'outside');const input=fixture(t,(a,_e,r)=>{fs.symlinkSync(path.join(outside,'secret'),path.join(r,'link'));a.sources=[{path:'link',sha256:hash('outside')}];});assert.throws(()=>validateBundle(input),/outside root/);});
test('unreviewed public media cannot be customer eligible',t=>{const input=fixture(t,a=>{a.status='approved';a.classification='public';a.review={reviewer:'synthetic-test-reviewer',reviewedAt:'2026-11-02T12:00:00Z'};a.verification.verifiedAt='2026-11-02T12:00:00Z';a.media=[{kind:'screenshot',path:'source.txt',sha256:hash('source evidence'),description:'Synthetic test fixture',transcriptPath:null,publicReviewApproved:false}];});assert.equal(validateBundle(input).customerEligible,false);assert.throws(()=>validateBundle({...input,customer:true}),/customer/);});
