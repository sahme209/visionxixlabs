import {afterEach,expect,it,vi} from "vitest";
import {openPullRequest} from "../githubWriteClient";
const sha="a".repeat(40),root="b".repeat(40),nested="c".repeat(40),blob="d".repeat(40);
afterEach(()=>vi.unstubAllGlobals());
async function exercise(mode:string,type="blob",options:{nested?:boolean;truncated?:boolean;deleted?:boolean;missing?:boolean;parentMode?:string;parentType?:string;twoFiles?:boolean}={}){
 const writes:Array<{url:string;body:any}>=[];
 const fetcher=vi.fn(async(url:string,init:any)=>{
  if(init.method!=="GET"){const body=JSON.parse(init.body);writes.push({url,body});return Response.json(url.endsWith("/pulls")?{number:1,html_url:"https://github.com/owned/repo/pull/1"}:{sha:blob});}
  if(url.includes("/git/ref/"))return Response.json({object:{sha}});
  if(url.includes("/git/commits/"))return Response.json({tree:{sha:root}});
  if(url.endsWith(`/git/trees/${root}`))return Response.json({truncated:options.truncated??false,tree:options.missing?[]:options.nested?[{path:"bin",mode:options.parentMode??"040000",type:options.parentType??"tree",sha:nested}]:[{path:"script.sh",mode,type,sha:blob}]});
  if(url.endsWith(`/git/trees/${nested}`))return Response.json({truncated:false,tree:[{path:"script.sh",mode,type,sha:blob},...(options.twoFiles?[{path:"other.sh",mode,type,sha:blob}]:[])]});
  throw Error("unexpected fixture request");
 });vi.stubGlobal("fetch",fetcher);
 const result=await openPullRequest({resolveToken:async()=>({ok:true,token:"synthetic_tenant_token"}),owner:"owned",repo:"repo",baseBranch:"main",expectedBaseSha:sha,newBranch:"ai/fixture",files:[{path:options.nested?"bin/script.sh":"script.sh",content:options.deleted?null:"echo reviewed\n"},...(options.twoFiles?[{path:"bin/other.sh",content:"echo other\n"}]:[])],commitMessage:"fixture",prTitle:"fixture",prBody:"fixture"});
 return{result,writes,fetcher};
}
it.each(["100644","100755"])("preserves reviewed regular-file mode %s",async mode=>{const {result,writes}=await exercise(mode);expect(result).toMatchObject({ok:true});expect(writes.find(x=>x.url.endsWith('/git/trees'))?.body.tree).toEqual([{path:"script.sh",mode,type:"blob",sha:blob}]);});
it("preserves executable mode in a pinned nested tree",async()=>{const {result,writes}=await exercise("100755","blob",{nested:true});expect(result).toMatchObject({ok:true});expect(writes.find(x=>x.url.endsWith('/git/trees'))?.body.tree[0]).toMatchObject({path:"bin/script.sh",mode:"100755"});});
it.each([["120000","blob"],["160000","commit"],["040000","tree"],["100755","tree"],["999999","blob"]])("refuses unsupported mode/type %s %s before any write",async(mode,type)=>{const {result,writes}=await exercise(mode,type);expect(result).toMatchObject({ok:false,writeMayHaveOccurred:false});expect(writes).toHaveLength(0);});
it("refuses a truncated tree rather than assuming missing paths",async()=>{const {result,writes}=await exercise("100644","blob",{truncated:true});expect(result).toMatchObject({ok:false,writeMayHaveOccurred:false});expect(writes).toHaveLength(0);});
it("uses regular mode for a genuinely absent added path",async()=>{const {result,writes}=await exercise("100644","blob",{missing:true});expect(result).toMatchObject({ok:true});expect(writes.find(x=>x.url.endsWith('/git/trees'))?.body.tree[0]).toMatchObject({mode:"100644"});});
it("refuses deleting a missing path before any write",async()=>{const {result,writes}=await exercise("100644","blob",{missing:true,deleted:true});expect(result).toMatchObject({ok:false,writeMayHaveOccurred:false});expect(writes).toHaveLength(0);});
it("uses the pinned executable mode when deleting a reviewed script",async()=>{const {result,writes}=await exercise("100755","blob",{deleted:true});expect(result).toMatchObject({ok:true});expect(writes.find(x=>x.url.endsWith('/git/trees'))?.body.tree[0]).toMatchObject({mode:"100755",sha:null});});

it.each([["120000","blob"],["160000","commit"]])("refuses a %s parent instead of traversing its target",async(parentMode,parentType)=>{const {result,writes}=await exercise("100644","blob",{nested:true,parentMode,parentType});expect(result).toMatchObject({ok:false,writeMayHaveOccurred:false});expect(writes).toHaveLength(0);});
it("uses one pinned subtree read for multiple files without losing their modes",async()=>{const {result,writes,fetcher}=await exercise("100755","blob",{nested:true,twoFiles:true});expect(result).toMatchObject({ok:true});expect(fetcher.mock.calls.filter(([url])=>url.endsWith(`/git/trees/${nested}`))).toHaveLength(1);expect(writes.find(x=>x.url.endsWith('/git/trees'))?.body.tree).toEqual([{path:"bin/script.sh",mode:"100755",type:"blob",sha:blob},{path:"bin/other.sh",mode:"100755",type:"blob",sha:blob}]);});
