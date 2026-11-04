const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./agent-workspace-bindings.json');
const root=path.resolve(__dirname,'../../..'),source=fs.readFileSync(path.join(root,inventory.source),'utf8');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const strip=text=>text.replace(/ data-help-id="agent\.workspace\.[a-z-]+"/g,'');
function issues(text){
 const file=ts.createSourceFile(inventory.source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),errors=[],found=new Map(),counts={button:0,input:0,select:0,textarea:0,summary:0};
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
test('finite internal inventory identifies all 46 direct declarations and explicit child exclusions',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.controls.length,46);assert.equal(new Set(inventory.controls.map(c=>c.helpId)).size,46);
 assert.deepEqual(inventory.tagCounts,{button:31,input:6,select:7,textarea:1,summary:1});assert.equal(inventory.unbound.length,9);
 for(const c of inventory.controls){assert.match(c.helpId,/^agent\.workspace\.[a-z-]+$/);assert.equal(c.source,inventory.source);assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
});
test('all actual direct interactive controls bind literal metadata to their original exact nodes',()=>assert.deepEqual(issues(source),[]));
test('removing only inserted static attributes restores the complete baseline bytes',()=>assert.equal(sha(strip(source)),inventory.baselineSha256));
test('rejects missing, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata',()=>{
 const a='agent.workspace.history-search',b='agent.workspace.repository-search',attr=`data-help-id="${a}"`;
 assert(issues(source.replace(' '+attr,'')).includes('missing or duplicate '+a));
 assert(issues(source.replace(attr,attr+' '+attr)).includes('missing or duplicate '+a));
 assert(issues(source.replace(attr,'data-help-id={"'+a+'"}')).includes('nonliteral ID'));
 assert(issues(source.replace(attr,'data-help-id="agent.workspace.unknown"')).includes('unknown ID agent.workspace.unknown'));
 assert(issues(source.replace('<input '+attr,'<label '+attr)).includes('wrong tag '+a));
 const swapped=source.replace(attr,'data-help-id="SWAP"').replace('data-help-id="'+b+'"',attr).replace('data-help-id="SWAP"','data-help-id="'+b+'"');
 assert(issues(swapped).includes('wrong node '+a));assert(issues(swapped).includes('wrong node '+b));
});
test('rejects a newly added unbound control and metadata outside the finite scope',()=>{
 const extra=source.replace('<summary data-help-id="agent.workspace.chat-options">','<button type="button">Unexpected</button><summary data-help-id="agent.workspace.chat-options">');
 assert(issues(extra).includes('unbound or duplicate control metadata'));assert(issues(extra).includes('declaration count drift'));
 assert(issues(source.replace('aria-expanded={expanded}','data-help-id="agent.workspace.outside" aria-expanded={expanded}')).includes('out-of-scope metadata'));
});
