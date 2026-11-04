const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./agent-child-bindings.json'),root=path.resolve(__dirname,'../../..');
const sources=Object.fromEntries(inventory.files.map(f=>[f.source,fs.readFileSync(path.join(root,f.source),'utf8')]));
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const strip=text=>text.replace(/ data-help-id="(?:agent\.workspace|shared)\.[a-z-]+"/g,'');
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
test('finite unpublished inventory specifies all eight whole files and 19 unique control declarations',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.files.length,8);assert.equal(inventory.controls.length,19);assert.equal(new Set(inventory.controls.map(c=>c.helpId)).size,19);assert.equal(new Set(inventory.files.map(f=>f.source)).size,8);
 assert.deepEqual(inventory.files.map(f=>f.declarations),[5,2,2,2,5,1,1,1]);
 for(const c of inventory.controls){assert.match(c.helpId,/^(agent\.workspace|shared)\.[a-z-]+$/);assert(inventory.files.some(f=>f.source===c.source));assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
 assert.equal(inventory.controls.filter(c=>c.tag==='a').length,2);assert.equal(inventory.controls.filter(c=>c.helpId.startsWith('shared.')).length,3);
});
test('independently enumerates every intrinsic control and binds exact original JSX nodes',()=>assert.deepEqual(issues(sources),[]));
test('stripping only inserted attributes restores every complete baseline source file',()=>{
 for(const f of inventory.files)assert.equal(sha(strip(sources[f.source])),f.baselineSha256,f.source);
});
test('rejects absent, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata',()=>{
 const file='desktop/src/components/ConversationRename.tsx',attr='data-help-id="agent.workspace.rename-title"',mutate=text=>({...sources,[file]:text}),source=sources[file];
 assert(issues(mutate(source.replace(' '+attr,''))).includes('missing or duplicate agent.workspace.rename-title'));
 assert(issues(mutate(source.replace(attr,attr+' '+attr))).includes('missing or duplicate agent.workspace.rename-title'));
 assert(issues(mutate(source.replace(attr,'data-help-id={"agent.workspace.rename-title"}'))).includes('nonliteral ID'));
 assert(issues(mutate(source.replace(attr,'data-help-id="agent.workspace.unknown"'))).includes('unknown ID agent.workspace.unknown'));
 assert(issues(mutate(source.replace('<input '+attr,'<label '+attr))).includes('wrong tag agent.workspace.rename-title'));
 const swapped=source.replace('data-help-id="agent.workspace.rename-save"','data-help-id="SWAP"').replace('data-help-id="agent.workspace.rename-refresh"','data-help-id="agent.workspace.rename-save"').replace('data-help-id="SWAP"','data-help-id="agent.workspace.rename-refresh"');
 assert(issues(mutate(swapped)).includes('wrong node agent.workspace.rename-save'));assert(issues(mutate(swapped)).includes('wrong node agent.workspace.rename-refresh'));
});
test('rejects newly added unbound controls, metadata on display nodes and cross-file ID moves',()=>{
 const file='desktop/src/components/Disclosure.tsx',source=sources[file],mutate=text=>({...sources,[file]:text});
 assert(issues(mutate(source.replace('<section className={className}>','<section className={className}><button type="button">Unbound</button>'))).includes('unbound or duplicate control metadata'));
 assert(issues(mutate(source.replace('<section className={className}>','<section data-help-id="shared.unexpected" className={className}>'))).includes('unknown ID shared.unexpected'));
 assert(issues(mutate(source.replace('data-help-id="shared.disclosure-toggle"','data-help-id="agent.workspace.rename-open"'))).includes('wrong file agent.workspace.rename-open'));
});
