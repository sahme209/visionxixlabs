const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./bot-composer-action-bindings.json'),root=path.resolve(__dirname,'../../..');
const sources=Object.fromEntries(inventory.files.map(f=>[f.source,fs.readFileSync(path.join(root,f.source),'utf8')]));
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const strip=text=>text.replace(/ data-help-id="(?:bot\.composer|bot\.app-launcher)\.[a-z-]+"/g,'');
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
     let owner=n;while(owner&&!ts.isFunctionDeclaration(owner))owner=owner.parent;if(owner?.name?.text!==record.scopeFunction)errors.push('out-of-scope metadata');
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
test('finite unpublished inventory specifies all two whole files and 11 unique control declarations',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.files.length,2);assert.equal(inventory.controls.length,11);assert.equal(new Set(inventory.controls.map(c=>c.helpId)).size,11);assert.equal(new Set(inventory.files.map(f=>f.source)).size,2);
 assert.deepEqual(inventory.files.map(f=>f.declarations),[6,5]);
 for(const c of inventory.controls){assert.match(c.helpId,/^(bot\.composer|bot\.app-launcher)\.[a-z-]+$/);assert(inventory.files.some(f=>f.source===c.source));assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
 const headings=new Set(fs.readFileSync(path.join(root,inventory.guide),'utf8').split('\n').filter(line=>/^#{2,3} /.test(line)).map(line=>line.replace(/^#{2,3} /,'')));for(const c of inventory.controls)assert(headings.has(c.guideSection));
});
test('independently enumerates every intrinsic control and binds exact original JSX nodes',()=>assert.deepEqual(issues(sources),[]));
test('stripping only inserted attributes restores every complete baseline source file',()=>{
 for(const f of inventory.files)assert.equal(sha(strip(sources[f.source])),f.baselineSha256,f.source);
});
test('rejects absent, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata',()=>{
 const file='desktop/src/components/BotTaskComposer.tsx',attr='data-help-id="bot.composer.title"',mutate=text=>({...sources,[file]:text}),source=sources[file];
 assert(issues(mutate(source.replace(' '+attr,''))).includes('missing or duplicate bot.composer.title'));
 assert(issues(mutate(source.replace(attr,attr+' '+attr))).includes('missing or duplicate bot.composer.title'));
 assert(issues(mutate(source.replace(attr,'data-help-id={"bot.composer.title"}'))).includes('nonliteral ID'));
 assert(issues(mutate(source.replace(attr,'data-help-id="bot.composer.unknown"'))).includes('unknown ID bot.composer.unknown'));
 assert(issues(mutate(source.replace('<input '+attr,'<label '+attr))).includes('wrong tag bot.composer.title'));
 const swapped=source.replace('data-help-id="bot.composer.save"','data-help-id="SWAP"').replace('data-help-id="bot.composer.send"','data-help-id="bot.composer.save"').replace('data-help-id="SWAP"','data-help-id="bot.composer.send"');
 assert(issues(mutate(swapped)).includes('wrong node bot.composer.save'));assert(issues(mutate(swapped)).includes('wrong node bot.composer.send'));
});
test('rejects new unbound controls, display metadata, cross-file and outside-function bindings',()=>{
 const file='desktop/src/components/BotAppActionLauncher.tsx',source=sources[file],mutate=text=>({...sources,[file]:text});
 assert(issues(mutate(source.replace('<summary data-help-id="bot.app-launcher.workflow-details"','<button type="button">Unbound</button><summary data-help-id="bot.app-launcher.workflow-details"'))).includes('unbound or duplicate control metadata'));
 assert(issues(mutate(source.replace('<section aria-label="Bot app actions"','<section data-help-id="bot.app-launcher.unexpected" aria-label="Bot app actions"'))).includes('unknown ID bot.app-launcher.unexpected'));
 assert(issues(mutate(source.replace('data-help-id="bot.app-launcher.workspace-report"','data-help-id="bot.composer.save"'))).includes('wrong file bot.composer.save'));
 assert(issues(mutate(source+'\nfunction Outside(){return <button data-help-id="bot.app-launcher.outside">Outside</button>}')).includes('out-of-scope metadata'));
});
