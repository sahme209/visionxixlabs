const fs=require('node:fs'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const root='/private/tmp/axiom-b4-servicenow-20261104/';
const d=JSON.parse(fs.readFileSync(root+'docs/recovery/2026-11-04/servicenow-structured-knowledge-author/source-bindings.json'));
for(const s of d.sources){const raw=fs.readFileSync(root+s.path);if(hash(raw)!==s.wholeFileSha256)throw Error('whole-file mismatch '+s.path);const lines=[];let start=0;for(let i=0;i<raw.length;i++)if(raw[i]===10){lines.push(raw.subarray(start,i+1));start=i+1}if(start<raw.length)lines.push(raw.subarray(start));const r=s.range;if(r.startLine<1||r.endLine>lines.length||hash(Buffer.concat(lines.slice(r.startLine-1,r.endLine)))!==r.sha256)throw Error('range mismatch '+s.path)}
console.log(JSON.stringify({valid:true,wholeFileBindings:d.sources.length,inclusiveRawRangeBindings:d.sources.length,historicalGuidePreserved:hash(fs.readFileSync(root+d.guide.path))===d.guide.sha256,changedListedCodeFiles:d.comparison.changedListedCodeFiles},null,2));
