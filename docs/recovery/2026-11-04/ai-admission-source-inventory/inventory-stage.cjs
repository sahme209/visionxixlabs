'use strict';
// Analysis only: load the installed TypeScript compiler, never application modules.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds/axiom-security-containment-build-201f5e77-emidm655/stage';
const ts = require(path.join(ROOT, 'node_modules/typescript/lib/typescript.js'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = file => path.relative(ROOT, file).split(path.sep).join('/');
const ordinal = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const excluded = file => /(?:^|\/)(?:__tests__|__smoke__)(?:\/|$)/.test(relative(file)) || /\.(?:test|spec|smoke)\.tsx?$/.test(file) || file.endsWith('.d.ts');
const started=process.hrtime.bigint();
function phase(name,detail){console.error(JSON.stringify({phase:name,...(detail||{}),elapsedMs:Number((process.hrtime.bigint()-started)/BigInt(1000000))}));}
const roots = ['app','lib'].flatMap(dir => ts.sys.readDirectory(path.join(ROOT,dir), ['.ts','.tsx'], undefined, ['**/*'])).filter(file => !excluded(file)).sort(ordinal);
phase('roots',{rootFileCount:roots.length});
const configFile = path.join(ROOT,'tsconfig.json');
const config = ts.readConfigFile(configFile, ts.sys.readFile);
if(config.error) throw new Error('tsconfig_read_failed');
const parsed = ts.parseJsonConfigFileContent({...config.config,files:roots,include:[],exclude:[]}, ts.sys, ROOT);
if(parsed.errors.length) throw new Error('tsconfig_parse_failed');
phase('config');
const program = ts.createProgram({rootNames:roots, options:{...parsed.options,noEmit:true,incremental:false,composite:false,plugins:[]}});
phase('program');
const checker = program.getTypeChecker();
phase('checker');
const sdkDeclarationRealpath = fs.realpathSync(path.join(ROOT,'node_modules/ai/dist/index.d.ts'));
const manager = new Set(['generateText','summarize','classify','extractStructuredData','generateTextWithAdmission','streamTextWithAdmission','extractStructuredDataWithAdmission','extractStructuredDataStreamingWithAdmission','streamText','healthCheckAll']);
const provider = new Set(['generateText','generateTextWithRetries','streamText','streamTextOnce','summarize','classify','extractStructuredData','generateTextOnce','generateStructuredTextOnce','healthCheck']);
const orchestration = new Set(['generate','orchestrateGenerate','orchestrateChat']);
const sdk = new Set(['generateText','streamText','generateObject','streamObject','embed','embedMany','rerank','experimental_generateImage','generateImage','experimental_generateSpeech','generateSpeech','experimental_transcribe','transcribe']);
const candidates = new Set([...manager,...provider,...orchestration,...sdk]);
function nameOf(node){return ts.isIdentifier(node)?node.text:ts.isPropertyAccessExpression(node)?node.name.text:ts.isElementAccessExpression(node)&&node.argumentExpression&&ts.isStringLiteral(node.argumentExpression)?node.argumentExpression.text:null;}
function classify(decl,method){
 const p=relative(decl.getSourceFile().fileName);
 if(p==='lib/ai/AIProvider.ts'&&provider.has(method))return 'provider-interface-method';
 if(p==='lib/ai/AIProviderManager.ts'&&manager.has(method))return method.endsWith('WithAdmission')?'manager-admitted-method':'manager-normal-or-health-method';
 if(p==='lib/ai/orchestrator.ts'&&orchestration.has(method))return 'orchestrator-wrapper';
 if(p==='lib/ai/providers/VercelGatewayProvider.ts'&&provider.has(method))return 'gateway-provider-direct';
 if(fs.realpathSync(decl.getSourceFile().fileName)===sdkDeclarationRealpath&&sdk.has(method))return 'external-ai-sdk';
 return null;
}
function enclosingName(node){for(let p=node.parent;p;p=p.parent){if(ts.isFunctionDeclaration(p)||ts.isMethodDeclaration(p)||ts.isFunctionExpression(p)){return p.name?nameOf(p.name):'<anonymous-function>';}if(ts.isArrowFunction(p)){return ts.isVariableDeclaration(p.parent)?nameOf(p.parent.name):'<anonymous-arrow>';}}return '<module>'; }
const resolved=[],ambiguous=[],sources=[];
let totalCallExpressionCount=0,staticallyUnnameableCallCount=0,unresolvedOutsideKeywordBucketCount=0;
const declarationHashes=new Map();
function declarationHash(file){if(!declarationHashes.has(file))declarationHashes.set(file,digest(fs.readFileSync(file)));return declarationHashes.get(file);}
let visitedFiles=0;
for(const file of roots){
 const sf=program.getSourceFile(file);if(!sf)throw new Error('root_source_missing');
 const bytes=fs.readFileSync(file),sha256=digest(bytes);sources.push({path:relative(file),sha256});
 function visit(node){
  if(ts.isCallExpression(node)){
   totalCallExpressionCount++;
   const calledName=nameOf(node.expression);if(!calledName)staticallyUnnameableCallCount++;let signature;
   try{signature=checker.getResolvedSignature(node);}catch{signature=undefined;}
   const decl=signature?.declaration;
   if(!decl&&(!calledName||!(candidates.has(calledName)||/generate|extract|classif|summar|stream|health/i.test(calledName))))unresolvedOutsideKeywordBucketCount++;
   const declaredName=decl?.name?nameOf(decl.name):null;
   const method=declaredName||calledName;
   const classification=decl&&method?classify(decl,method):null;
   const loc=sf.getLineAndCharacterOfPosition(node.getStart(sf));
   if(classification){
    const ds=decl.getSourceFile(),dl=ds.getLineAndCharacterOfPosition(decl.getStart(ds));
    resolved.push({path:relative(file),sourceSha256:sha256,line:loc.line+1,column:loc.character+1,method,enclosingFunction:enclosingName(node),declarationPath:relative(ds.fileName),declarationSourceSha256:declarationHash(ds.fileName),declarationLine:dl.line+1,classification});
   }else if(calledName&&(candidates.has(calledName)||/generate|extract|classif|summar|stream|health/i.test(calledName))){
    ambiguous.push({path:relative(file),sourceSha256:sha256,line:loc.line+1,column:loc.character+1,method:calledName,enclosingFunction:enclosingName(node),resolvedDeclarationPath:decl?relative(decl.getSourceFile().fileName):null,reason:decl?'method-name candidate resolved outside selected declaration origins':'unresolved method-name candidate'});
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(sf);
 if(++visitedFiles%100===0)phase('files',{visitedFiles});
}
phase('calls-complete',{visitedFiles});
const sort=(a,b)=>ordinal(a.path,b.path)||a.line-b.line||a.column-b.column||ordinal(a.method,b.method);
resolved.sort(sort);ambiguous.sort(sort);
const counts={};for(const row of resolved)counts[row.classification]=(counts[row.classification]||0)+1;
const syntacticDiagnosticCount=program.getSyntacticDiagnostics().length;
const directInputs=['tsconfig.json','node_modules/typescript/lib/typescript.js','node_modules/typescript/package.json','node_modules/ai/dist/index.d.ts','node_modules/ai/package.json'].map(p=>({path:p,sha256:digest(fs.readFileSync(path.join(ROOT,p)))}));
console.log(JSON.stringify({format:'axiom.ai-admission-source-inventory/1',scope:'app/lib non-test TS/TSX call expressions; resolved signature origins only; no argument/prompt contents',typescriptVersion:ts.version,rootFileCount:roots.length,totalCallExpressionCount,staticallyUnnameableCallCount,unresolvedOutsideKeywordBucketCount,resolvedCallCount:resolved.length,ambiguousMethodNameCandidateCount:ambiguous.length,classificationCounts:counts,syntacticDiagnosticCount,diagnosticsMeaning:'syntactic count only; not a semantic typecheck or type pass',qualification:'lexical declaration classification does not establish current authorization, reservation, runtime reachability, completeness or financial correctness; normal methods may already have upstream ledger/admission and require caller review',directInputs,sources,resolved,ambiguous},null,2));
