import {readFileSync} from 'node:fs';
export function checkPublicationDraft(protection,draft,expected,prior){
 const rule=protection?.protection_rules?.find(r=>r.type==='required_reviewers');
 if(!rule||!Array.isArray(rule.reviewers)||!rule.reviewers.some(r=>r.type==='User'&&Number.isSafeInteger(r.reviewer?.id)&&r.reviewer.id>0))throw Error('Actual human reviewer protection required');
 if(!/^\d+$/.test(expected.releaseId??'')||!/^desktop-v\d+\.\d+\.\d+$/.test(expected.releaseTag??'')||draft.id!==Number(expected.releaseId)||draft.draft!==true||draft.prerelease!==false||draft.tag_name!==expected.releaseTag||!Array.isArray(draft.assets)||draft.assets.length<12||draft.assets.length>62)throw Error('Frozen unpublished draft required');
 const names=new Set(),ids=new Set();let size=0;
 for(const a of draft.assets){if(!Number.isSafeInteger(a.id)||a.id<=0||ids.has(a.id)||typeof a.name!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._ -]{0,203}$/.test(a.name)||a.name!==a.name.trim()||names.has(a.name)||!Number.isSafeInteger(a.size)||a.size<=0||a.size>2*1024**3||! /^sha256:[a-f0-9]{64}$/.test(a.digest??'')||a.state!=='uploaded')throw Error('Invalid draft asset');names.add(a.name);ids.add(a.id);size+=a.size}
 if(size>6*1024**3)throw Error('Draft exceeds bounded download');
 const identity=d=>JSON.stringify({id:d.id,tag:d.tag_name,body:d.body,assets:d.assets.map(a=>({id:a.id,name:a.name,size:a.size,digest:a.digest})).sort((a,b)=>a.id-b.id)});
 if(prior&&identity(prior)!==identity(draft))throw Error('Draft changed after review');return draft;
}
if(process.argv[1]?.endsWith('/check-publication-draft.mjs')){const[protection,draft,prior]=process.argv.slice(2);checkPublicationDraft(JSON.parse(readFileSync(protection)),JSON.parse(readFileSync(draft)),{releaseId:process.env.RELEASE_ID,releaseTag:process.env.RELEASE_TAG},prior?JSON.parse(readFileSync(prior)):undefined)}
