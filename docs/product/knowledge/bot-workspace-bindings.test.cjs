const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./bot-workspace-bindings.json');
const root=path.resolve(__dirname,'../../..'),source=fs.readFileSync(path.join(root,inventory.source),'utf8');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const strip=text=>text.replace(/ data-help-id="bot\.workspace\.[a-z-]+"/g,'');
function issues(text){
 const file=ts.createSourceFile(inventory.source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),errors=[],found=new Map(),counts={button:0,input:0,select:0,textarea:0,summary:0,a:0};
 if(file.parseDiagnostics.length)errors.push('invalid TSX');
 const fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===inventory.scopeFunction);
 if(!fn)return ['missing scope function'];
 let declarations=0;
 function visit(n){
  if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
   const tag=n.tagName.getText(file),interactive=Object.hasOwn(counts,tag),attrs=n.attributes.properties.filter(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='data-help-id');
   if(interactive){declarations++;counts[tag]++;if(attrs.length!==1)errors.push('unbound or duplicate control metadata');}
   for(const attr of attrs){
    if(!attr.initializer||!ts.isStringLiteral(attr.initializer)){errors.push('nonliteral ID');continue;}
    const id=attr.initializer.text,control=inventory.controls.find(c=>c.helpId===id);found.set(id,(found.get(id)||0)+1);
    if(!control){errors.push('unknown ID '+id);continue;}
    if(tag!==control.tag)errors.push('wrong tag '+id);
    const element=ts.isJsxOpeningElement(n)?n.parent:n;
    if(sha(strip(element.getText(file)))!==control.nodeSha256)errors.push('wrong node '+id);
   }
  }
  ts.forEachChild(n,visit);
 }
 visit(fn);
 if(declarations!==inventory.declarations)errors.push('declaration count drift');
 if(JSON.stringify(counts)!==JSON.stringify(inventory.tagCounts))errors.push('tag count drift');
 for(const c of inventory.controls)if(found.get(c.helpId)!==1)errors.push('missing or duplicate '+c.helpId);
 // No binding is permitted in another component/function in this source file.
 function outside(n){if(n===fn)return;if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='data-help-id'))errors.push('out-of-scope metadata');ts.forEachChild(n,outside)}outside(file);
 return errors;
}
test('finite internal inventory identifies all 24 direct declarations and explicit child exclusions',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.controls.length,24);assert.equal(new Set(inventory.controls.map(c=>c.helpId)).size,24);
 assert.deepEqual(inventory.tagCounts,{button:22,input:1,select:0,textarea:0,summary:1,a:0});assert.equal(inventory.unbound.length,10);
 const headings=new Set(fs.readFileSync(path.join(root,inventory.guide),'utf8').split('\n').filter(line=>/^#{2,3} /.test(line)).map(line=>line.replace(/^#{2,3} /,'')));
 for(const c of inventory.controls){assert(headings.has(c.guideSection),'unknown guide section '+c.guideSection);assert.match(c.helpId,/^bot\.workspace\.[a-z-]+$/);assert.equal(c.source,inventory.source);assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
});
test('all actual direct interactive controls bind literal metadata to their original exact nodes',()=>assert.deepEqual(issues(source),[]));
test('removing only inserted static attributes restores the complete baseline bytes',()=>assert.equal(sha(strip(source)),inventory.baselineSha256));
test('rejects missing, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata',()=>{
 const a='bot.workspace.tasks-refresh',b='bot.workspace.tasks-close',attr=`data-help-id="${a}"`;
 assert(issues(source.replace(' '+attr,'')).includes('missing or duplicate '+a));
 assert(issues(source.replace(attr,attr+' '+attr)).includes('missing or duplicate '+a));
 assert(issues(source.replace(attr,'data-help-id={"'+a+'"}')).includes('nonliteral ID'));
 assert(issues(source.replace(attr,'data-help-id="bot.workspace.unknown"')).includes('unknown ID bot.workspace.unknown'));
 assert(issues(source.replace('<button '+attr,'<label '+attr)).includes('wrong tag '+a));
 const swapped=source.replace(attr,'data-help-id="SWAP"').replace('data-help-id="'+b+'"',attr).replace('data-help-id="SWAP"','data-help-id="'+b+'"');
 assert(issues(swapped).includes('wrong node '+a));assert(issues(swapped).includes('wrong node '+b));
});
test('rejects a newly added unbound control and metadata outside the finite scope',()=>{
 const extra=source.replace('<summary data-help-id="bot.workspace.history-version">','<button type="button">Unexpected</button><summary data-help-id="bot.workspace.history-version">');
 assert(issues(extra).includes('unbound or duplicate control metadata'));assert(issues(extra).includes('declaration count drift'));
 assert(issues(source+'\nfunction Outside(){return <button data-help-id="bot.workspace.outside" type="button">Outside</button>}').includes('out-of-scope metadata'));
});
