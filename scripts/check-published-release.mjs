import {readFileSync} from 'node:fs';
const[publishedFile,draftFile]=process.argv.slice(2),published=JSON.parse(readFileSync(publishedFile)),draft=JSON.parse(readFileSync(draftFile));
const summarize=r=>JSON.stringify(r.assets.map(a=>({id:a.id,name:a.name,size:a.size,digest:a.digest})).sort((a,b)=>a.id-b.id));
if(published.id!==draft.id||published.tag_name!==draft.tag_name||published.draft!==false||published.prerelease!==false||published.immutable!==true||summarize(published)!==summarize(draft))throw Error('Publication outcome needs manual investigation; never retry publication automatically');
