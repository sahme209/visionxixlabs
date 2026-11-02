// Offline validation only. Does not ingest content, certify a human decision,
// execute retrieval, call providers or modify source/history.
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {createRequire}=require('node:module');
// Resolve the installed draft-2020 validator through its owning dependency.
// Missing dependencies fail closed; this script never installs them.
const formatsRequire=createRequire(require.resolve('ajv-formats'));
const Ajv2020=formatsRequire('ajv/dist/2020').default;
const addFormats=require('ajv-formats');
const ajv=new Ajv2020({allErrors:true,strict:true});addFormats(ajv);
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const articleCheck=ajv.compile(readJson(path.join(__dirname,'article-record.schema.json')));
const evaluationCheck=ajv.compile(readJson(path.join(__dirname,'retrieval-evaluation.schema.json')));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function checkedPath(root,relative){
 if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).some(p=>p==='..')||relative.includes('\\'))throw Error('unsafe path');
 const resolved=fs.realpathSync(path.resolve(root,relative));
 if(!resolved.startsWith(root+path.sep))throw Error('path outside root');
 if(!fs.statSync(resolved).isFile())throw Error('path is not a file');
 return resolved;
}
function validateBundle({root,articlePath,evaluationPath,expectedVersion,customer=false}){
 root=fs.realpathSync(root);
 const bytes=fs.readFileSync(checkedPath(root,articlePath));const article=JSON.parse(bytes);
 const evaluation=readJson(checkedPath(root,evaluationPath));
 for(const [name,check,value]of [['article',articleCheck,article],['evaluation',evaluationCheck,evaluation]]){
  if(!check(value))throw Error(`${name} schema: ${ajv.errorsText(check.errors)}`);
 }
 if(!expectedVersion||article.productVersion!==expectedVersion||article.verification.verifiedVersion!==expectedVersion)throw Error('target version mismatch');
 if(evaluation.articleId!==article.id||evaluation.revision!==article.revision||evaluation.productVersion!==expectedVersion)throw Error('evaluation article/version binding mismatch');
 if(evaluation.articleSha256!==hash(bytes))throw Error('evaluation article hash mismatch');
 if(new Set(evaluation.cases.map(c=>c.id)).size!==evaluation.cases.length)throw Error('duplicate evaluation case IDs');
 if(new Set(article.sources.map(s=>s.path)).size!==article.sources.length)throw Error('duplicate source path');
 for(const source of [...article.sources,...article.media]){
  if(hash(fs.readFileSync(checkedPath(root,source.path)))!==source.sha256)throw Error(`source/media hash mismatch: ${source.path}`);
 }
 for(const evidence of article.verification.evidencePaths)checkedPath(root,evidence);
 for(const media of article.media)if(media.transcriptPath!==null)checkedPath(root,media.transcriptPath);
 const customerBlockers=[];
 if(article.status!=='approved')customerBlockers.push('article_not_approved');
 if(article.classification!=='public')customerBlockers.push('article_not_public');
 if(article.media.some(media=>!media.publicReviewApproved))customerBlockers.push('media_not_public_reviewed');
 if(expectedVersion.startsWith('local-source-preview:'))customerBlockers.push('local_preview_not_shipped');
 if(customer&&customerBlockers.length)throw Error(`customer retrieval ineligible: ${customerBlockers.join(', ')}`);
 return{valid:true,articleId:article.id,revision:article.revision,productVersion:expectedVersion,sourceFiles:article.sources.length,evaluationCases:evaluation.cases.length,customerEligible:customerBlockers.length===0,customerBlockers,evaluationStatus:evaluation.status};
}
module.exports={validateBundle};
if(require.main===module){
 try{
  const args=process.argv.slice(2);const allowed=['--root','--article','--evaluation','--version','--customer'];
  for(let i=0;i<args.length;i++){if(!allowed.includes(args[i]))throw Error('unknown argument');if(args[i]!=='--customer'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('missing argument value');i++;}}
  const value=(flag,fallback)=>args.includes(flag)?args[args.indexOf(flag)+1]:fallback;
  const result=validateBundle({root:value('--root',process.cwd()),articlePath:value('--article','docs/product/documentation-coverage/articles/agent-reviewed-action.r2.json'),evaluationPath:value('--evaluation','docs/product/documentation-coverage/agent-reviewed-action-evaluation.json'),expectedVersion:value('--version'),customer:args.includes('--customer')});
  console.log(JSON.stringify(result,null,2));
 }catch(error){console.error(`Support knowledge validation failed: ${error.message}`);process.exitCode=1;}
}
