const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {extractHeadings,build}=require("../generate-docs-heading-index.cjs");
test("only literal public heading attributes in the default return are extracted",()=>{
 const source=`import PRIVATE from 'private'; const secret='SECRET'; function hidden(){return <DocHeader title="HIDDEN_FUNCTION"/>;} export default function Page(){const unused=<DocHeader title="UNRETURNED"/>; return <><toString title="PROTOTYPE_EXCLUDED"/><DocHeader title="Public" summary="Visible summary"/><DocSection title={"EXPRESSION_EXCLUDED"}><p>BODY_EXCLUDED</p></DocSection><Callout title="Warning"/><DocSection title="Task heading"/></>;}`;
 assert.deepEqual(extractHeadings(source),["Public","Visible summary","Warning","Task heading"]);
});
test("malformed, non-fixed return and oversized source refuse",()=>{
 assert.throws(()=>extractHeadings('export default function Page(){return <DocHeader title="Broken"/>'),/invalid public TSX/);
 assert.throws(()=>extractHeadings('export default function Page(){redirect("/docs");}'),/fixed public return/);
 assert.throws(()=>extractHeadings(' '.repeat(262145)),/public source bound/);
});
test("all fixed public navigation records and source hashes match checked-in index",()=>{
 const actual=build(),saved=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../lib/docs/guide-heading-index.json"),"utf8"));assert.deepEqual(actual,saved);assert.equal(actual.guides.length,23);assert.equal(new Set(actual.guides.map(x=>x.href)).size,23);for(const guide of actual.guides){assert(guide.source.startsWith('app/docs/'));assert.match(guide.sourceSha256,/^[a-f0-9]{64}$/);assert(guide.fields.length>0);}
});
