const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),{spawnSync}=require("node:child_process");
const repo=path.resolve(__dirname,"../..");
function fixture(t){const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),"axiom-doc-build-")));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));function write(file,text){const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);}
 write("package.json",JSON.stringify({scripts:{build:"node scripts/check-vercel-build.mjs && prisma generate && next build"},dependencies:{"@aws-sdk/client-ecs":"fixture"}}));
 write("next.config.ts",'export default {typescript:{tsconfigPath: "tsconfig.next.json"},serverExternalPackages:["@aws-sdk/client-ecs"]};');write("tsconfig.next.json",JSON.stringify({exclude:["desktop","**/__tests__/**","**/*.test.ts","**/*.test.tsx","docs/recovery/**"]}));write("proxy.ts","export {};" );
 write("components/docs/DocsSidebar.tsx",'export const DOC_SECTIONS=[{items:[{href:"/docs"}]}];');write("app/docs/page.tsx",'export default function Page(){return <DocHeader title="Public guide" summary="First summary"/>;}');
 for(const f of ["scripts/check-vercel-build.mjs","scripts/generate-docs-heading-index.cjs"])write(f,fs.readFileSync(path.join(repo,f),"utf8"));fs.symlinkSync(path.join(repo,"node_modules"),path.join(root,"node_modules"));
 const generator=path.join(root,"scripts/generate-docs-heading-index.cjs");const g=spawnSync(process.execPath,[generator],{encoding:"utf8",env:{PATH:"/usr/bin:/bin"},timeout:5000});assert.equal(g.status,0,g.stderr);
 function check(){return spawnSync(process.execPath,[path.join(root,"scripts/check-vercel-build.mjs")],{encoding:"utf8",env:{PATH:"/usr/bin:/bin"},timeout:5000});}return {root,write,check};}
test("fresh public heading index passes the existing prebuild contract",t=>{const f=fixture(t),p=f.check();assert.equal(p.status,0,p.stderr);});
for(const kind of ["changed-guide","changed-index","missing-index"])test(`prebuild refuses ${kind} without regenerating`,t=>{const f=fixture(t),index=path.join(f.root,"lib/docs/guide-heading-index.json");if(kind==="changed-guide")f.write("app/docs/page.tsx",'export default function Page(){return <DocHeader title="Public guide" summary="Second summary"/>;}');else if(kind==="changed-index"){const d=JSON.parse(fs.readFileSync(index,"utf8"));d.guides[0].fields=["tampered"];fs.writeFileSync(index,JSON.stringify(d));}else fs.unlinkSync(index);const before=fs.existsSync(index)?fs.readFileSync(index):null,p=f.check();assert.notEqual(p.status,0);assert.match(p.stderr,/heading index/i);assert.deepEqual(fs.existsSync(index)?fs.readFileSync(index):null,before);});
test("migration build refusal remains enforced",t=>{const f=fixture(t);f.write("package.json",JSON.stringify({scripts:{build:"prisma migrate deploy"},dependencies:{}}));const p=f.check();assert.notEqual(p.status,0);assert.match(p.stderr,/must not mutate database migration/);});

test("prebuild refuses a missing archived-recovery production boundary",t=>{const f=fixture(t);f.write("tsconfig.next.json",JSON.stringify({exclude:["desktop","**/__tests__/**","**/*.test.ts","**/*.test.tsx"]}));const p=f.check();assert.notEqual(p.status,0);assert.match(p.stderr,/missing build-only exclusions: docs\/recovery\/\*\*/);});
test("production type roots omit recovery archives and retain application and imported-source checks",t=>{
 const ts=require("typescript"),f=fixture(t);
 for(const name of ["tsconfig.json","tsconfig.next.json"])f.write(name,fs.readFileSync(path.join(repo,name),"utf8"));
 f.write("app/page.ts",'import { archived } from "../docs/recovery/preview/source"; export const application: string = 1; void archived;');
 f.write("lib/production.ts","export const shared = 1;");f.write("packages/production/index.ts","export const packaged = 1;");f.write(".next/types/fixture.ts","export const route = 1;");
 f.write("docs/recovery/preview/source.ts","export const archived: string = 1;");
 const config=ts.readConfigFile(path.join(f.root,"tsconfig.next.json"),ts.sys.readFile);assert.equal(config.error,undefined);
 const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,f.root);assert.equal(parsed.errors.length,0);
 const relative=parsed.fileNames.map(file=>path.relative(f.root,file).split(path.sep).join("/"));
 assert.equal(relative.includes("docs/recovery/preview/source.ts"),false,"archived fixtures must not be production roots");
 for(const name of ["app/page.ts","lib/production.ts","packages/production/index.ts",".next/types/fixture.ts"])assert.equal(relative.includes(name),true,`${name} must remain checked`);
 assert.equal(parsed.options.strict,true);assert.equal(parsed.options.noEmit,true);
 const program=ts.createProgram(parsed.fileNames,{...parsed.options,incremental:false,types:[],noLib:true});
 const errors=program.getSemanticDiagnostics().filter(d=>d.code===2322).map(d=>path.relative(f.root,d.file.fileName).split(path.sep).join("/"));
 assert.equal(errors.includes("app/page.ts"),true,"application type errors remain errors");
 assert.equal(errors.includes("docs/recovery/preview/source.ts"),true,"an app import of excluded source is still checked");
});
