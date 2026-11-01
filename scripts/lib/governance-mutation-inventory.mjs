import ts from 'typescript';
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const writePrefix = /^(create|update|delete|remove|put|patch|send|publish|dispatch|execute|invoke|start|stop|restart|terminate|apply|deploy|merge|commit|push|attach|detach|enable|disable|authorize|revoke|register|deregister|tag|untag|modify|set|reset|copy|restore|reboot|cancel|release|allocate|associate|disassociate)/i;
const httpModules = new Set(['node-fetch','undici','axios','got','ky','node:http','node:https','http','https']);
const stringValue = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
function calledName(expression) {
 if (ts.isIdentifier(expression)) return expression.text;
 if (ts.isStringLiteral(expression)) return expression.text;
 if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
 if (ts.isElementAccessExpression(expression)) return stringValue(expression.argumentExpression);
 return null;
}
function endpointHost(node) {
 const value = stringValue(node) ?? (node && ts.isTemplateExpression(node) ? node.head.text : null);
 if (!value) return 'unresolved';
 if (value.startsWith('//')) { try { return new URL(value,'https://source.invalid').hostname; } catch { return 'unresolved'; } }
 if (value.startsWith('/')) return 'relative_route';
 try { return new URL(value).hostname || 'unresolved'; } catch { return 'unresolved'; }
}
/** Candidate extraction only. Import/syntax observations never establish
 * runtime authority, scope, reachability or execution coverage. */
export function inventoryMutationSource(file,text) {
 const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,/\.[jt]sx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
 const fileHash=sha(text), imports=new Map(), namespaces=new Map(), candidates=[], ordinals=new Map();
 for (const item of source.statements) {
  if (!ts.isImportDeclaration(item) || !ts.isStringLiteral(item.moduleSpecifier)) continue;
  const module=item.moduleSpecifier.text, clause=item.importClause, bindings=clause?.namedBindings;
  if (clause?.name) imports.set(clause.name.text,{module,name:'default'});
  if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) imports.set(element.name.text,{module,name:element.propertyName?.text ?? element.name.text});
  if (bindings && ts.isNamespaceImport(bindings)) namespaces.set(bindings.name.text,module);
 }
 function add(node,kind,operation,details) {
  const fingerprint=sha(JSON.stringify([file,kind,operation,details])), ordinal=(ordinals.get(fingerprint) ?? 0)+1;
  ordinals.set(fingerprint,ordinal);
  candidates.push({candidateId:`mutation_candidate_${fingerprint.slice(0,20)}_${ordinal}`,source:{file,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,sha256:fileHash},kind,operation,...details,status:'unreviewed',authority:'none',coverageReceipt:null});
 }
 function inspect(node) {
  if (ts.isCallExpression(node)) {
   const name=calledName(node.expression), imported=ts.isIdentifier(node.expression) ? imports.get(node.expression.text) : undefined;
   if (name==='send' && (ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression))) {
    const command=node.arguments[0];let origin;
    if (command && ts.isNewExpression(command)) {
     if (ts.isIdentifier(command.expression)) origin=imports.get(command.expression.text);
     if (ts.isPropertyAccessExpression(command.expression) && ts.isIdentifier(command.expression.expression)) {
      const module=namespaces.get(command.expression.expression.text);if(module) origin={module,name:command.expression.name.text};
     }
    }
    if (origin?.module.startsWith('@aws-sdk/client-')) {
     const mode=/^(AssumeRole|GetSessionToken|GetFederationToken)/.test(origin.name) ? 'credential_broker' : /^(Get|List|Describe|Head|Lookup|BatchGet|Query|Scan|Select)/.test(origin.name) ? 'observation' : 'potential_write';
     add(node,'aws_sdk',origin.name,{module:origin.module,mode});
    } else add(node,'unresolved_send',name,{mode:'unresolved'});
   } else if (['fetch','request','gh'].includes(name) || imported && httpModules.has(imported.module)) {
    let method=null, uncertain=false, methodCount=0;
    for (const argument of node.arguments) if (ts.isObjectLiteralExpression(argument)) for (const property of argument.properties) {
     if (ts.isSpreadAssignment(property) || property.name && ts.isComputedPropertyName(property.name) || ts.isShorthandPropertyAssignment(property) && property.name.text==='method') uncertain=true;
     if (ts.isPropertyAssignment(property) && calledName(property.name)==='method') {
      methodCount++;if(methodCount>1) uncertain=true;
      const value=stringValue(property.initializer);if (value) method=value.toUpperCase();else uncertain=true;
     }
    }
    const explicit=uncertain ? null : method;
    add(node,'http_transport',name ?? 'imported_transport',{method:explicit,mode:explicit ? ['GET','HEAD','OPTIONS'].includes(explicit) ? 'observation' : 'potential_write' : 'unresolved',endpointHost:endpointHost(node.arguments[0])});
   } else if (name && (name==='graphql' || writePrefix.test(name))) add(node,'method_candidate',name,{mode:'unresolved'});
  }
  ts.forEachChild(node,inspect);
 }
 inspect(source);
 return {source:{file,sha256:fileHash,parseErrorCount:source.parseDiagnostics.length},candidates};
}
