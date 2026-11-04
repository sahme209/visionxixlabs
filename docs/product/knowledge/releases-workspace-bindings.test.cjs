const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./releases-workspace-bindings.json'),root=path.resolve(__dirname,'../../..');
const sources=Object.fromEntries(inventory.files.map(f=>[f.source,fs.readFileSync(path.join(root,f.source),'utf8')]));
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const registeredAttributes=inventory.controls.map(c=>' data-help-id="'+c.helpId+'"');
const strip=text=>registeredAttributes.reduce((current,attr)=>current.split(attr).join(''),text);
const tags=['button','input','select','textarea','summary','a'];
function issues(texts){
 const errors=[],found=new Map();let total=0;
 for(const record of inventory.files){
  const file=ts.createSourceFile(record.source,texts[record.source],ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),counts={};let declarations=0;
  if(file.parseDiagnostics.length)errors.push('invalid TSX');
  function visit(n){
   if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
    const tag=n.tagName.getText(file),attrs=n.attributes.properties.filter(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='data-help-id');
    if(tags.includes(tag)){declarations++;counts[tag]=(counts[tag]||0)+1;if(attrs.length!==1)errors.push('unbound or duplicate control metadata');}
    for(const attr of attrs){
     let owner=n;while(owner&&!ts.isFunctionDeclaration(owner))owner=owner.parent;
     if(!attr.initializer||!ts.isStringLiteral(attr.initializer)){errors.push('nonliteral ID');continue;}
     const id=attr.initializer.text,c=inventory.controls.find(c=>c.helpId===id);found.set(id,(found.get(id)||0)+1);
     if(!c){errors.push('unknown ID '+id);continue;}
     if(c.source!==record.source)errors.push('wrong file '+id);
     if(owner?.name?.text!==c.sourceFunction)errors.push('wrong scope '+id);
     if(c.tag!==tag)errors.push('wrong tag '+id);
     const element=ts.isJsxOpeningElement(n)?n.parent:n;
     if(sha(strip(element.getText(file)))!==c.nodeSha256)errors.push('wrong node '+id);
    }
   }
   ts.forEachChild(n,visit);
  }visit(file);total+=declarations;
  if(declarations!==record.declarations)errors.push('declaration count drift '+record.source);
  if(JSON.stringify(Object.entries(counts).sort())!==JSON.stringify(Object.entries(record.tagCounts).sort()))errors.push('tag count drift '+record.source);
 }
 if(total!==inventory.declarations)errors.push('total count drift');
 for(const c of inventory.controls)if(found.get(c.helpId)!==1)errors.push('missing or duplicate '+c.helpId);
 return errors;
}
test('finite unpublished inventory specifies one complete source file and 29 unique control declarations',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.files.length,1);assert.equal(inventory.controls.length,29);assert.equal(new Set(inventory.controls.map(c=>c.helpId)).size,29);assert.equal(new Set(inventory.files.map(f=>f.source)).size,1);
 assert.deepEqual(inventory.files.map(f=>f.declarations),[29]);assert.deepEqual(inventory.files[0].tagCounts,{button:19,input:4,select:1,textarea:1,summary:4});
 for(const c of inventory.controls){assert.match(c.helpId,/^(releases\.workspace)\.[a-z-]+$/);assert(inventory.files.some(f=>f.source===c.source));assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
 const headings=new Set(fs.readFileSync(path.join(root,inventory.guide),'utf8').split('\n').filter(line=>/^#{2,3} /.test(line)).map(line=>line.replace(/^#{2,3} /,'')));for(const c of inventory.controls)assert(headings.has(c.guideSection));
});
test('independently enumerates every intrinsic control and binds exact original JSX nodes',()=>assert.deepEqual(issues(sources),[]));
test('registered metadata stripping preserves the exact requalified functional baseline and raw source custody',()=>{
 assert.equal(inventory.baselineDerivation.method,'strip registered metadata from functional source commit');assert.equal(inventory.baselineDerivation.metadataAlreadyPresent,true);assert.equal(inventory.baselineDerivation.registeredAttributeCount,29);assert.equal(inventory.baselineDerivation.sourceCommit,inventory.baselineCommit);
 assert.equal(inventory.metadataOrigin.unboundSourceCommit,'88e937510aeaf7d547a75227a1187d2bd60edc15');assert.equal(inventory.metadataOrigin.mappingCommit,'f182d990e0e78555e8597705189507724a617221');
 for(const f of inventory.files){assert.equal(sha(sources[f.source]),f.functionalSourceSha256);assert.equal(f.functionalSourceSha256,inventory.baselineDerivation.rawSourceSha256);assert.equal(sha(strip(sources[f.source])),f.baselineSha256,f.source);assert.equal(f.baselineSha256,inventory.baselineDerivation.strippedSourceSha256);
 const guard='if (submissionFlight.current || !intakeMounted.current) return;';assert(sources[f.source].includes(guard));assert.notEqual(sha(strip(sources[f.source].replace(guard,'if (false) return;'))),f.baselineSha256);
 }
});
test('rejects absent, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata',()=>{
 const file='desktop/src/views/DeploymentRequestsView.tsx',attr='data-help-id="releases.workspace.closure-reference"',mutate=text=>({...sources,[file]:text}),source=sources[file];
 assert(issues(mutate(source.replace(' '+attr,''))).includes('missing or duplicate releases.workspace.closure-reference'));
 assert(issues(mutate(source.replace(attr,attr+' '+attr))).includes('missing or duplicate releases.workspace.closure-reference'));
 assert(issues(mutate(source.replace(attr,'data-help-id={"releases.workspace.closure-reference"}'))).includes('nonliteral ID'));
 assert(issues(mutate(source.replace(attr,'data-help-id="releases.workspace.unknown"'))).includes('unknown ID releases.workspace.unknown'));
 assert(issues(mutate(source.replace('<input '+attr,'<label '+attr))).includes('wrong tag releases.workspace.closure-reference'));
 const swapped=source.replace('data-help-id="releases.workspace.intake-back"','data-help-id="SWAP"').replace('data-help-id="releases.workspace.intake-continue"','data-help-id="releases.workspace.intake-back"').replace('data-help-id="SWAP"','data-help-id="releases.workspace.intake-continue"');
 assert(issues(mutate(swapped)).includes('wrong node releases.workspace.intake-back'));assert(issues(mutate(swapped)).includes('wrong node releases.workspace.intake-continue'));
});
test('rejects new unbound controls, display metadata, cross-function and outside-function bindings',()=>{
 const file='desktop/src/views/DeploymentRequestsView.tsx',source=sources[file],mutate=text=>({...sources,[file]:text});
 assert(issues(mutate(source.replace('<summary data-help-id="releases.workspace.request-identifiers"','<button type="button">Unbound</button><summary data-help-id="releases.workspace.request-identifiers"'))).includes('unbound or duplicate control metadata'));
 assert(issues(mutate(source.replace('<summary data-help-id="releases.workspace.request-identifiers"','<span data-help-id="releases.workspace.unexpected">Unexpected</span><summary data-help-id="releases.workspace.request-identifiers"'))).includes('unknown ID releases.workspace.unexpected'));
 assert(issues(mutate(source.replace('data-help-id="releases.workspace.refresh"','data-help-id="releases.workspace.intake-back"'))).includes('wrong scope releases.workspace.intake-back'));
 assert(issues(mutate(source+'\nfunction Outside(){return <button data-help-id="releases.workspace.refresh">Outside</button>}')).includes('wrong scope releases.workspace.refresh'));
});
