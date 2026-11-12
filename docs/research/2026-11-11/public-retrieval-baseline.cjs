'use strict';
// Offline research only: fixed public source modules, no app/server/AI/provider.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),ts=require('../../../node_modules/typescript');
if(ts.version!=='5.9.3')throw Error('reviewed_compiler_api_required');
const root=path.resolve(__dirname,'../../..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources={};
function read(relative){
 const file=path.join(root,relative),fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);
 try{const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size<1||stat.size>1024*1024)throw Error('public_source_bound');const b=fs.readFileSync(fd);if(b.length!==stat.size)throw Error('public_source_changed');sources[relative]=hash(b);return b.toString('utf8');}finally{fs.closeSync(fd);}
}
const allowed=new Set(['lib/support/answerKernel.ts','lib/support/knowledgeBase.ts','lib/support/faqData.ts','lib/docs/guide-heading-index.json','lib/support/docsCorpus.json']);
const cache=new Map();
function load(relative){
 if(!allowed.has(relative))throw Error('public_module_not_allowed');
 if(cache.has(relative))return cache.get(relative);
 const source=read(relative);if(relative.endsWith('.json')){const v=JSON.parse(source);cache.set(relative,v);return v;}
 const module={exports:{}};cache.set(relative,module.exports);
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const imports={'@/lib/docs/guide-heading-index.json':'lib/docs/guide-heading-index.json','./docsCorpus.json':'lib/support/docsCorpus.json','./faqData':'lib/support/faqData.ts'};
 new Function('require','module','exports',js)(name=>{if(!Object.hasOwn(imports,name))throw Error('public_import_not_allowed');return load(imports[name]);},module,module.exports);
 return module.exports;
}
const caseSource=read('lib/support/__tests__/answerEval.test.ts');
const tree=ts.createSourceFile('cases.ts',caseSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
let cases;
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==='CASES'){
 if(!ts.isArrayLiteralExpression(n.initializer))throw Error('fixed_cases_required');
 cases=n.initializer.elements.map(row=>{if(!ts.isArrayLiteralExpression(row)||row.elements.length!==2||!row.elements.every(ts.isStringLiteral))throw Error('literal_public_cases_required');return row.elements.map(e=>e.text);});
}ts.forEachChild(n,visit);}
visit(tree);if(!cases||cases.length<1||cases.length>200)throw Error('public_cases_bound');
const {buildIndex,answerQuestion,retrieve}=load('lib/support/answerKernel.ts');
const entries=load('lib/support/knowledgeBase.ts').knowledgeEntries();
const index=buildIndex(entries);let matched=0,guarded=0;const sizes=[],misses=[];
for(const [question,expected]of cases){
 const a=answerQuestion(index,question),id=a.status==='guarded'?'guard:'+a.guard:a.status==='answered'?entries.find(e=>e.body===a.answer)?.id??'?':'suggestions';
 const page=a.status==='answered'?a.sources[0]?.href.split('#')[0]:undefined;
 if(expected.startsWith('page:')?page===expected.slice(5):id===expected||(expected.endsWith('-')&&id.startsWith(expected)))matched++;
 else misses.push({caseIndex:cases.findIndex(row=>row[0]===question),expected,cited:page??id});
 if(a.status==='guarded'){guarded++;continue;}
 const selected=retrieve(index,question);
 // Explicit research serialization, NOT the complete model/SDK request.
 const packed=selected.map(e=>({title:e.title,body:e.body,href:e.href}));
 sizes.push(Buffer.byteLength(JSON.stringify(packed),'utf8'));
}
sizes.sort((a,b)=>a-b);const percentile=p=>sizes[Math.min(sizes.length-1,Math.ceil(sizes.length*p)-1)]??0;
console.log(JSON.stringify({format:'axiom.public-retrieval-research/1',scope:'Frozen public evaluation; no model calls; selected-entry research serialization only',compilerApi:ts.version,sourceSha256:sources,knowledgeEntries:entries.length,cases:cases.length,matched,misses,guarded,nonGuarded:sizes.length,topK:5,selectedUtf8Bytes:{min:sizes[0]??0,p50:percentile(.5),p95:percentile(.95),max:sizes.at(-1)??0},tokensMeasured:false,costMeasured:false,savingsClaimed:false,productionAcceptance:false},null,2));
