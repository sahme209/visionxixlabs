const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./settings-workspace-bindings.json'),root=path.resolve(__dirname,'../../..');
const sources=Object.fromEntries(inventory.files.map(f=>[f.source,fs.readFileSync(path.join(root,f.source),'utf8')]));
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const strip=text=>text.replace(/ data-help-id="settings\.workspace\.[a-z-]+"/g,'');
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
     if(!attr.initializer||!ts.isStringLiteral(attr.initializer)){errors.push('nonliteral ID');continue;}
     const id=attr.initializer.text,c=inventory.controls.find(c=>c.helpId===id);found.set(id,(found.get(id)||0)+1);
     if(!c){errors.push('unknown ID '+id);continue;}
     if(c.source!==record.source)errors.push('wrong file '+id);
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
test('finite unpublished inventory separates 68 new and one preserved binding across all 69 declarations',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.files.length,1);assert.equal(inventory.controls.length,69);assert.equal(new Set(inventory.controls.map(c=>c.helpId)).size,69);
 assert.equal(inventory.controls.filter(c=>c.binding==='added').length,68);assert.equal(inventory.controls.filter(c=>c.binding==='preserved-existing').length,1);
 assert.deepEqual(inventory.files[0].tagCounts,{button:48,input:6,select:12,a:1,textarea:2});
 for(const c of inventory.controls){assert.match(c.helpId,c.binding==='added'?/^settings\.workspace\.[a-z-]+$/:/^governance\.execution-limits\.entry$/);assert.equal(c.source,inventory.files[0].source);assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
});
test('independently enumerates all whole-file intrinsic controls and validates exact original JSX nodes',()=>assert.deepEqual(issues(sources),[]));
test('stripping ONLY new settings metadata restores the full baseline including the existing Governance attribute',()=>{
 const f=inventory.files[0];assert.equal(sha(strip(sources[f.source])),f.baselineSha256);assert(strip(sources[f.source]).includes('data-help-id="governance.execution-limits.entry"'));
});
test('rejects missing, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata',()=>{
 const file=inventory.files[0].source,source=sources[file],mutate=text=>({...sources,[file]:text}),attr='data-help-id="settings.workspace.section-search"';
 assert(issues(mutate(source.replace(' '+attr,''))).includes('missing or duplicate settings.workspace.section-search'));
 assert(issues(mutate(source.replace(attr,attr+' '+attr))).includes('missing or duplicate settings.workspace.section-search'));
 assert(issues(mutate(source.replace(attr,'data-help-id={"settings.workspace.section-search"}'))).includes('nonliteral ID'));
 assert(issues(mutate(source.replace(attr,'data-help-id="settings.workspace.unknown"'))).includes('unknown ID settings.workspace.unknown'));
 assert(issues(mutate(source.replace('<input '+attr,'<label '+attr))).includes('wrong tag settings.workspace.section-search'));
 const other='data-help-id="settings.workspace.model-search"',swapped=source.replace(attr,'data-help-id="SWAP"').replace(other,attr).replace('data-help-id="SWAP"',other);
 assert(issues(mutate(swapped)).includes('wrong node settings.workspace.section-search'));assert(issues(mutate(swapped)).includes('wrong node settings.workspace.model-search'));
});
test('rejects a new unbound intrinsic control and preserves existing Governance identity, node and DEV gate',()=>{
 const file=inventory.files[0].source,source=sources[file],mutate=text=>({...sources,[file]:text});
 const extra=source.replace('<input data-help-id="settings.workspace.section-search"','<button type="button">Unexpected</button><input data-help-id="settings.workspace.section-search"');
 assert(issues(mutate(extra)).includes('unbound or duplicate control metadata'));assert(issues(mutate(extra)).includes('total count drift'));
 assert(issues(mutate(source.replace('data-help-id="governance.execution-limits.entry"','data-help-id="settings.workspace.replaced-governance"'))).includes('missing or duplicate governance.execution-limits.entry'));
 const preserved=inventory.controls.find(c=>c.binding==='preserved-existing');assert.equal(preserved.sourceFunction,'GeneralSection');
 // The existing entry's parent gate is outside its button node, so verify the
 // exact baseline whole-file hash as well as this explicit gate contract.
 assert.match(source,/\{import\.meta\.env\.DEV && <ActionRow title="Execution limits preview"[^\n]*data-help-id="governance\.execution-limits\.entry"/);
});
