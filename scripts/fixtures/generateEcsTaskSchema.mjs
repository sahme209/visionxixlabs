import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'../..')+'/';assert.equal(JSON.parse(fs.readFileSync(base+'node_modules/@aws-sdk/client-ecs/package.json','utf8')).version,'3.1166.0','pinned_ecs_sdk_changed');let nodes=new Map(), constants=new Map();function collect(statements,prefix=''){
 for(const n of statements){
  if(ts.isModuleDeclaration(n)){
   assert.ok(n.body&&ts.isModuleBlock(n.body),'unsupported_sdk_namespace');
   collect(n.body.statements,prefix+n.name.text+'.');
  }else if(ts.isInterfaceDeclaration(n)||ts.isTypeAliasDeclaration(n)){
   const name=prefix+n.name.text;assert.ok(!nodes.has(name),'duplicate_sdk_type');nodes.set(name,n);
  }else if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)constants.set(prefix+d.name.text,d);
 }
}
for(const f of ['models_0.d.ts','models_1.d.ts','enums.d.ts']){const s=ts.createSourceFile(f,fs.readFileSync(base+'node_modules/@aws-sdk/client-ecs/dist-types/models/'+f,'utf8'),ts.ScriptTarget.Latest,true);collect(s.statements);}
const defs={};function type(n){if(n.kind===ts.SyntaxKind.NeverKeyword)return 'never';if(ts.isUnionTypeNode(n)){let a=n.types.filter(t=>t.kind!==ts.SyntaxKind.UndefinedKeyword);return a.length===1?type(a[0]):{union:a.map(type)};}if(ts.isArrayTypeNode(n))return {array:type(n.elementType)};if([ts.SyntaxKind.StringKeyword,ts.SyntaxKind.NumberKeyword,ts.SyntaxKind.BooleanKeyword].includes(n.kind))return ts.tokenToString(n.kind);if(ts.isTypeReferenceNode(n)){const k=n.typeName.getText();if(k==='Record')return {map:type(n.typeArguments[1])};define(k);return {ref:k};}if(ts.isLiteralTypeNode(n))return {literal:n.literal.text};if(ts.isIndexedAccessTypeNode(n)){const d=constants.get((n.objectType.type??n.objectType).exprName?.text);if(!d)throw Error(n.getText());return {enum:d.type.members.map(x=>x.type.literal.text)};}throw Error('unsupported '+n.getText());}
function define(k){if(defs[k])return;const n=nodes.get(k);if(!n)throw Error(k);
// Smithy's forward-compatible unknown union member is not reviewed authority.
// Keep it explicitly uninhabitable rather than accepting its tuple/any payload.
if(k.endsWith('.$UnknownMember')){assert.ok(ts.isInterfaceDeclaration(n)&&n.members.some(m=>m.name?.text==='$unknown'&&!m.questionToken),'unsupported_unknown_union');defs[k]='never';return;}
defs[k]={};if(ts.isTypeAliasDeclaration(n)){defs[k]=type(n.type);return;}if(!ts.isInterfaceDeclaration(n))throw Error(k);const fields={};for(const m of n.members){fields[m.name.text]={schema:type(m.type),optional:!!m.questionToken};}defs[k]={fields};}
define('RegisterTaskDefinitionRequest');delete defs.RegisterTaskDefinitionRequest.fields.tags;const output=JSON.stringify({sdk:'3.1166.0',root:'RegisterTaskDefinitionRequest',definitions:defs},null,2)+'\n';const target=base+'lib/cloud/aws/ecsObservation/taskDefinitionSchema.json';if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),output,'pinned_ecs_model_schema_drift');else fs.writeFileSync(target,output);console.log(Object.keys(defs).length);
