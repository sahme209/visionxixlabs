const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('typescript');
const inventory=require('./releases-intake-fields.json'),root=path.resolve(__dirname,'../../..'),source=fs.readFileSync(path.join(root,inventory.source),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex'),helpers=['Field','TextArea','SelectField','Check'];
function inspect(text,records=inventory.fields){
 const file=ts.createSourceFile(inventory.source,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),fn=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='DeploymentIntakeForm'),errors=[],nodes=[];
 if(file.parseDiagnostics.length)errors.push('invalid source');if(!fn)return ['missing function'];
 function attr(n,name){const a=n.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(file)===name);if(!a)return null;if(!a.initializer)return true;return ts.isStringLiteral(a.initializer)?a.initializer.text:ts.isJsxExpression(a.initializer)?a.initializer.expression?.getText(file):a.initializer.getText(file)}
 function conditions(node){const result=[];for(let a=node.parent;a&&a!==fn;a=a.parent){if(ts.isBinaryExpression(a)&&a.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken&&node.pos>=a.right.pos&&node.end<=a.right.end)result.push({kind:'render-if',expression:a.left.getText(file)});if(ts.isConditionalExpression(a)){for(const [branch,part] of [['ternary-true',a.whenTrue],['ternary-false',a.whenFalse]])if(node.pos>=part.pos&&node.end<=part.end)result.push({kind:branch,expression:a.condition.getText(file)})}if(ts.isJsxElement(a)){const hidden=attr(a.openingElement,'hidden');if(hidden!==null)result.push({kind:'ancestor-hidden',expression:hidden})}}return result.reverse()}
 function walk(n){if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&helpers.includes(n.tagName.getText(file)))nodes.push(n);ts.forEachChild(n,walk)}walk(fn);
 if(nodes.length!==52||records.length!==nodes.length)errors.push('incomplete inventory');
 if(new Set(records.map(c=>c.sourceId)).size!==records.length)errors.push('duplicate source ID');
 const found=new Set();
 for(const n of nodes){const helper=n.tagName.getText(file),checked=attr(n,'checked'),value=checked??attr(n,'value');if(typeof value!=='string'){errors.push('unsupported value');continue}const key=value.startsWith('draft.')?value.slice(6):value,id='releases.intake.'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),c=records.find(c=>c.sourceId===id);if(!c){errors.push('unmapped callsite '+id);continue}found.add(id);
  if(c.modelKey!==(value.startsWith('draft.')?key:null)||c.localState!==(value==='workflowRef'?'workflowRef':null))errors.push('model identity drift '+id);
  if(c.sourceLine!==file.getLineAndCharacterOfPosition(n.getStart(file)).line+1)errors.push('source locator drift '+id);
  if(c.source!==inventory.source||c.sourceFunction!=='DeploymentIntakeForm')errors.push('wrong scope '+id);
  if(c.helper!==helper||c.label!==attr(n,'label'))errors.push('label/helper drift '+id);
  if(c.valueBinding!==value||c.updateBinding!==attr(n,'onChange')||c.valueAttribute!==(checked!==null?'checked':'value'))errors.push('value/update drift '+id);
  if(c.staticRequired!==(attr(n,'required')===true)||c.requiredAttribute!==attr(n,'required'))errors.push('required drift '+id);
  const type=attr(n,'type')??(helper==='Field'?'text':helper==='Check'?'checkbox':helper==='TextArea'?'textarea':'select');if(c.inputType!==type||c.optionsExpression!==attr(n,'options'))errors.push('type/options drift '+id);
  if(JSON.stringify(c.visibleContext)!==JSON.stringify(conditions(n)))errors.push('condition drift '+id);
  const disabled=[];for(let a=n.parent;a&&a!==fn;a=a.parent)if(ts.isJsxElement(a)){const d=attr(a.openingElement,'disabled');if(d!==null)disabled.push({ancestor:a.openingElement.tagName.getText(file),expression:d})}if(JSON.stringify(c.disabledContext)!==JSON.stringify(disabled.reverse()))errors.push('disabled context drift '+id);
  const element=ts.isJsxOpeningElement(n)?n.parent:n;if(sha(element.getText(file))!==c.nodeSha256)errors.push('node drift '+id);
 }
 for(const c of records)if(!found.has(c.sourceId))errors.push('unknown inventory callsite '+c.sourceId);
 return errors;
}
test('source-only inventory describes all 52 named callsites with finite helper counts and real guide headings',()=>{
 assert.equal(inventory.customerEligible,false);assert.equal(inventory.publicationApproved,false);assert.equal(inventory.domBinding,false);assert.equal(inventory.runtimeMetadataAdded,false);assert.equal(inventory.fields.length,52);assert.deepEqual(inventory.helperCounts,{Field:30,TextArea:8,SelectField:8,Check:6});
 const headings=new Set(fs.readFileSync(path.join(root,inventory.guide),'utf8').split('\n').filter(s=>/^#{2,3} /.test(s)).map(s=>s.replace(/^#{2,3} /,'')));
 for(const c of inventory.fields){assert.match(c.sourceId,/^releases\.intake\.[a-z-]+$/);assert.equal(c.mappingKind,'source-callsite-only');assert(headings.has(c.guideSection));assert(c.purpose&&c.constraintsAndRecovery&&c.sourceRefs.length);assert.match(c.nodeSha256,/^[a-f0-9]{64}$/)}
});
test('independently discovers every actual named helper callsite and verifies exact props and enclosing conditions',()=>assert.deepEqual(inspect(source),[]));
test('source custody and constraint/recovery function references bind actual unchanged source bytes',()=>{
 assert.equal(sha(source),inventory.sourceSha256);
 const file=ts.createSourceFile(inventory.source,source,99,true,4),functions=new Map(),variables=new Map();function walk(n){if(ts.isFunctionDeclaration(n)&&n.name)functions.set(n.name.text,n);if(ts.isVariableDeclaration(n))variables.set(n.name.getText(file),n);ts.forEachChild(n,walk)}walk(file);
 for(const ref of [...inventory.fields.flatMap(c=>c.sourceRefs),...inventory.contextOwnershipSourceRefs]){const fn=(ref.nodeKind==='variable-declaration'?variables:functions).get(ref.role);assert(fn);assert.equal(sha(fn.getText(file)),ref.nodeSha256);assert.equal(file.getLineAndCharacterOfPosition(fn.getStart(file)).line+1,ref.startLine);assert.equal(file.getLineAndCharacterOfPosition(fn.end).line+1,ref.endLine)}
});
test('rejects changed label, value, update, required flag, condition and declared options',()=>{
 for(const [from,to] of [['label="Request title"','label="Wrong title"'],['value={draft.title}','value={draft.clients}'],['update("title", value)','update("clients", value)'],['update("title", value)} required','update("title", value)}'],['{isAdHoc &&','{!isAdHoc &&'],['hidden={step !== 2}','hidden={step !== 3}'],['disabled={submitting} aria-label="Release intake fields"','disabled={false} aria-label="Release intake fields"'],['"planned_biweekly_release", "planned_release"','"invented_class", "planned_release"']]){assert(source.includes(from),from);assert(inspect(source.replace(from,to)).length>0,from)}
});
test('rejects incomplete/duplicate/unknown/swapped records and an extra actual field callsite',()=>{
 assert(inspect(source,inventory.fields.slice(0,-1)).includes('incomplete inventory'));
 assert(inspect(source,[...inventory.fields,inventory.fields[0]]).includes('duplicate source ID'));
 assert(inspect(source,[...inventory.fields,{...inventory.fields[0],sourceId:'releases.intake.unknown'}]).some(e=>e.startsWith('unknown inventory')));
 const swapped=inventory.fields.map(c=>({...c}));[swapped[0].sourceId,swapped[1].sourceId]=[swapped[1].sourceId,swapped[0].sourceId];assert(inspect(source,swapped).some(e=>e.startsWith('label/helper drift')));
 const extra=source.replace('<Field label="Request title"','<Field label="Unexpected" value={draft.extraField} onChange={()=>{}}/><Field label="Request title"');assert(inspect(extra).includes('incomplete inventory'));assert(inspect(extra).includes('unmapped callsite releases.intake.extra-field'));
});
