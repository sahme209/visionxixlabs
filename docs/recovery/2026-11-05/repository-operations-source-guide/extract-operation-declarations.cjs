// Static TypeScript parsing only. Never imports application/native code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..'),ts=require(path.join(root,'node_modules/typescript'));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const specs=[{path:'desktop/src/components/RepositoryWorktrees.tsx',wholeFile:true},{path:'desktop/src/views/RepositoryWorkspaceView.tsx',openingLineScopes:[{name:'checks-output-handoffs',start:788,end:802},{name:'branch-sync',start:834,end:844},{name:'commit-publication',start:878,end:885},{name:'shared-operation-confirmation',start:897,end:898}]}];
const tags=new Set(['button','input','select','textarea','summary','details','pre','ExternalLink']);
const files=specs.map(spec=>{
 const raw=fs.readFileSync(path.join(root,spec.path)),tree=ts.createSourceFile(spec.path,raw.toString('utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(tree.parseDiagnostics.length)throw Error('valid_source_required');
 const declarations=[];function visit(node){const opening=ts.isJsxElement(node)?node.openingElement:ts.isJsxSelfClosingElement(node)?node:null,tag=opening?.tagName.getText(tree);if(tags.has(tag)){
 const start=node.getStart(tree),end=node.getEnd(),line=tree.getLineAndCharacterOfPosition(start).line+1,scope=spec.wholeFile?'whole-worktree-component':spec.openingLineScopes.find(s=>line>=s.start&&line<=s.end)?.name;
 const focusableOutput=tag==='pre'&&opening.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(tree)==='tabIndex');
 if(scope&&(tag!=='pre'||focusableOutput)){const kind=tag==='details'?'structural-disclosure-container':tag==='ExternalLink'?'custom-link-boundary':tag==='pre'?'focusable-output':'intrinsic-interactive';declarations.push({tag,kind,scope,startLine:line,endLine:tree.getLineAndCharacterOfPosition(end-1).line+1,nodeSha256:hash(tree.text.slice(start,end)),opening:opening.getText(tree),sourceText:tree.text.slice(start,end)});}}
 ts.forEachChild(node,visit);}
 visit(tree);return{...spec,sha256:hash(raw),declarations};
});
const all=files.flatMap(f=>f.declarations),counts={selectedDeclarations:all.length,intrinsicInteractive:all.filter(d=>d.kind==='intrinsic-interactive').length,focusableOutput:all.filter(d=>d.kind==='focusable-output').length,customLinkBoundaries:all.filter(d=>d.kind==='custom-link-boundary').length,structuralDisclosureContainers:all.filter(d=>d.kind==='structural-disclosure-container').length};
process.stdout.write(JSON.stringify({scope:'Whole RepositoryWorktrees plus fixed opening-line operation ranges of mounted RepositoryWorkspaceView; prior acquisition/editor controls excluded. AST nodes are source declarations, not runtime instances, permissions or native acceptance.',counts,files},null,2)+'\n');
