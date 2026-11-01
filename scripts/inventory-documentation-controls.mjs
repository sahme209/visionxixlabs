/** Source candidates for documentation review. Never claims rendered coverage. */
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=execFileSync('git',['ls-files','-z','app','components','desktop/src'],{cwd:root,encoding:'utf8'}).split('\0').filter(p=>p.endsWith('.tsx')&&!p.includes('/__tests__/')&&!/\.(test|spec)\.tsx$/.test(p)&&!p.startsWith('app/api/'));
const tags=new Set(['button','input','textarea','select','a','Link','ActionRow','ToggleRow','WebButton']);
const hash=s=>createHash('sha256').update(s).digest('hex');
const attr=(attrs,name)=>{
 const value=attrs.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText()===name)?.initializer;
 if(!value)return null;
 if(ts.isStringLiteral(value))return value.text;
 if(ts.isJsxExpression(value)&&value.expression&&(ts.isStringLiteral(value.expression)||ts.isNoSubstitutionTemplateLiteral(value.expression)))return value.expression.text;
 return '<dynamic>';
};
const records=[];const sourceFiles=[];
for(const file of files){
 const text=readFileSync(path.join(root,file),'utf8'),source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),digest=hash(text),occurrences=new Map();
 const visit=node=>{
  if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
   const tag=node.tagName.getText(source);
   if(tags.has(tag)){
    const children=ts.isJsxOpeningElement(node)?node.parent.children:[];
    const literal=children.filter(ts.isJsxText).map(n=>n.text).join(' ').replace(/\s+/g,' ').trim();
    const label=attr(node.attributes,'aria-label')??attr(node.attributes,'label')??attr(node.attributes,'title')??(literal||null);
    const destination=attr(node.attributes,'href'),type=attr(node.attributes,'type'),fingerprint=hash(JSON.stringify([file,tag,label,destination,type]));
    const occurrence=(occurrences.get(fingerprint)??0)+1;occurrences.set(fingerprint,occurrence);
    records.push({candidateId:'control_candidate_'+fingerprint.slice(0,20)+'_'+occurrence,surface:file.startsWith('desktop/')?'desktop':'website',source:{file,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,sha256:digest},tag,label,destination,inputType:type,dynamicLabel:label===null||label==='<dynamic>',status:'needs_runtime_and_documentation_review',stableHelpId:null,article:null,media:[],reviewedStates:[]});
   }
  }
  ts.forEachChild(node,visit);
 };
 visit(source);sourceFiles.push({file,sha256:digest});
}
const result={schema:1,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),scope:'Tracked TSX app/components/desktop source candidates; not runtime acceptance or exhaustive native/custom/dynamic control coverage.',limitations:['Native Swift/Rust/OS controls require a separate inventory.','Custom component names outside the explicit extraction set and generated controls may be absent.','Conditional branches are candidates, not proof that a user can reach them.','Source hashes bind individual files; sourceCommit does not assert a clean worktree.','Candidate IDs are matching aids, not permanent customer help identifiers; duplicates and dynamic labels need manual resolution.','No article, permission, outcome, recovery or screenshot coverage is inferred from a source occurrence.'],sourceFiles,counts:{files:files.length,controls:records.length,dynamicLabels:records.filter(r=>r.dynamicLabel).length,desktop:records.filter(r=>r.surface==='desktop').length,website:records.filter(r=>r.surface==='website').length},controls:records};
const output=path.join(root,'docs/product/documentation-coverage/source-control-candidates.json');mkdirSync(path.dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({output,counts:result.counts,completionClaim:false}));
