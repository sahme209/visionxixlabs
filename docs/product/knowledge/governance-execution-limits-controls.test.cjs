const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'../../..');
const inventory=JSON.parse(fs.readFileSync(path.join(__dirname,'governance-execution-limits-controls.json'),'utf8'));
test('catalog has unique stable IDs, real source references and explicit non-authority effects',()=>{
 assert.equal(inventory.format,'axiom.product-control-inventory/1');
 assert.equal(inventory.executionAuthorized,false);
 assert.equal(inventory.availability.desktop,'DEV-only');
 const ids=new Set();
 for(const c of inventory.controls){assert.match(c.helpId,/^governance\.execution-limits\.[a-z-]+$/);assert(!ids.has(c.helpId));ids.add(c.helpId);assert(fs.statSync(path.join(root,c.source)).isFile());assert(c.purpose.length>25);assert.equal(c.executionAuthorized,false);assert(['local_only','server_read','server_mutation'].includes(c.effect));if(c.effect==='server_mutation')assert(inventory.http.mutationOperations.includes(c.operation));}
});
test('every static visible policy button, disclosure and field has a documented control',()=>{
 for(const name of ['GovernanceExecutionPolicyPanel','GovernanceExecutionPolicyProposal']){
  const relative=`desktop/src/components/${name}.tsx`;
  const file=ts.createSourceFile(relative,fs.readFileSync(path.join(root,relative),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const labels=[];
  function visit(n){if(ts.isJsxElement(n)&&['button','summary','label','legend'].includes(n.openingElement.tagName.getText(file))){const label=n.children.filter(ts.isJsxText).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();if(label&&label!=='·')labels.push(label);}ts.forEachChild(n,visit)}
  visit(file);assert(labels.length>8);
  for(const label of labels)assert(inventory.controls.some(c=>c.source===relative&&c.label===label),`Undocumented visible control: ${label}`);
 }
});
test('read operations and uncertain recovery retain explicit historical-only boundaries',()=>{
 const source=fs.readFileSync(path.join(root,inventory.http.source),'utf8');
 for(const operation of [...inventory.http.readOnlyOperations,...inventory.http.mutationOperations])assert(source.includes(`z.literal('${operation}')`));
 assert.equal(inventory.recovery.automaticResend,false);assert.equal(inventory.recovery.writeAhead,true);
 assert(inventory.recovery.historicalObservation.includes('exactProposalContentVerified:false'));
 assert(inventory.recovery.unknown.includes('session-refused'));
});

// One declaration may render many rows; these IDs describe control kinds, never row identity.
const boundKinds={
 saved:'button',decisions:'button',load:'button',pointer:'button',outcome:'button',observe:'button',
 directory:'select','policy-id':'input','receipt-select':'button',identifiers:'summary',history:'summary',locator:'summary',
 review:'input',approve:'button',activate:'button',revoke:'button',scope:'select',executors:'fieldset',level:'select',actions:'select',
 expiry:'input','proposal-review':'input',members:'button',parent:'button',save:'button','proposal-outcome':'button',
 baselines:'button','baseline-load':'button','baseline-select':'select','baseline-id':'input','baseline-rules':'summary',entry:'button',back:'button'
};
const directText=node=>node.children.filter(ts.isJsxText).map(n=>n.text).join(' ').replace(/\s+/g,' ').trim();
function bindingIssues(sources){
 const issues=[],seen=new Map();
 for(const [relative,source] of sources){
  const file=ts.createSourceFile(relative,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node){
   if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
    const attrs=node.attributes.properties.filter(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='data-help-id');
    for(const attr of attrs){
     if(!attr.initializer||!ts.isStringLiteral(attr.initializer)){issues.push('Help ID must be literal');continue;}
     const id=attr.initializer.text,control=inventory.controls.find(c=>c.helpId===id);
     seen.set(id,(seen.get(id)||0)+1);
     if(!control){issues.push(`Undocumented help ID: ${id}`);continue;}
     if(control.source!==relative)issues.push(`Wrong source: ${id}`);
     const kind=node.tagName.getText(file),expected=boundKinds[id.split('.').at(-1)];
     if(kind!==expected)issues.push(`Wrong element kind: ${id}: ${kind} expected ${expected}`);
     const element=ts.isJsxOpeningElement(node)?node.parent:node;
     let label;
     if(kind==='input'||kind==='select'){
      // The metadata belongs on the actual field, with its existing enclosing label.
      if(ts.isJsxElement(element.parent)&&element.parent.openingElement.tagName.getText(file)==='label')label=directText(element.parent);
      else issues.push(`Missing enclosing field label: ${id}`);
     }else if(kind==='fieldset'){
      const legends=element.children.filter(n=>ts.isJsxElement(n)&&n.openingElement.tagName.getText(file)==='legend');
      if(legends.length===1)label=directText(legends[0]);
     }else if(ts.isJsxElement(element))label=directText(element);
     if(label!==control.label)issues.push(`Wrong associated label: ${id}: ${label}`);
     if(kind==='input'){
      const type=node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(file)==='type');
      const expectedType=['review','proposal-review'].includes(id.split('.').at(-1))?'checkbox':id.endsWith('.expiry')?'datetime-local':undefined;
      const actualType=type&&type.initializer&&ts.isStringLiteral(type.initializer)?type.initializer.text:undefined;
      if(actualType!==expectedType)issues.push(`Wrong input type: ${id}`);
     }
    }
   }
   ts.forEachChild(node,visit);
  }
  visit(file);
 }
 for(const control of inventory.controls){const count=seen.get(control.helpId)||0;if(count!==1)issues.push(`Expected one static binding: ${control.helpId}; found ${count}`);}
 return issues;
}
const bindingSources=()=>[...new Set(inventory.controls.map(c=>c.source))].map(relative=>[relative,fs.readFileSync(path.join(root,relative),'utf8')]);
test('all 33 documented IDs bind once to the corresponding JSX control and existing label',()=>{
 assert.equal(inventory.controls.length,33);
 assert.deepEqual(bindingIssues(bindingSources()),[]);
});
test('binding validation rejects metadata on labels, wrong fields, duplicate or undocumented declarations',()=>{
 const id='governance.execution-limits.scope';
 const relative='desktop/src/components/GovernanceExecutionPolicyProposal.tsx';
 const original=`<label>Exact policy scope<select data-help-id="${id}" /></label>`;
 const issuesFor=source=>bindingIssues([[relative,source]]);
 assert(issuesFor(original.replace(`data-help-id="${id}"`,`data-help-id="${id}" data-help-id="${id}"`)).some(issue=>issue.includes(`Expected one static binding: ${id}; found 2`)));
 assert(issuesFor(original.replace(id,'undocumented')).some(issue=>issue.includes('Undocumented help ID: undocumented')));
 assert(issuesFor(original.replace('Exact policy scope','Wrong field label')).some(issue=>issue.includes(`Wrong associated label: ${id}`)));
 assert(issuesFor(`<label data-help-id="${id}">Exact policy scope<select /></label>`).some(issue=>issue.includes(`Wrong element kind: ${id}: label expected select`)));
});
