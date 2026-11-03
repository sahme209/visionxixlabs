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
