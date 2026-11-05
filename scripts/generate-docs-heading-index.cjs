"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),ts=require("typescript");
const hash=s=>crypto.createHash("sha256").update(s).digest("hex");
function parse(source,name){if(Buffer.byteLength(source)>262144)throw Error("public source bound");const tree=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);if(tree.parseDiagnostics.length)throw Error("invalid public TSX");return tree;}
function extractHeadings(source){
 const tree=parse(source,"public-guide.tsx"),fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword));
 const returns=fn?.body?.statements.filter(ts.isReturnStatement);if(!returns||returns.length!==1||!returns[0].expression)throw Error("fixed public return required");
 const fields=[];const allowed={DocHeader:new Set(["title","summary"]),DocSection:new Set(["title"]),Callout:new Set(["title"])};
 function visit(n){if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){const tag=n.tagName.getText(tree),attrs=Object.hasOwn(allowed,tag)?allowed[tag]:null;if(attrs)for(const a of n.attributes.properties)if(ts.isJsxAttribute(a)&&attrs.has(a.name.getText(tree))&&a.initializer&&ts.isStringLiteral(a.initializer)){const text=a.initializer.text.trim();if(text.length>4096)throw Error("public field bound");if(text)fields.push(text);}}ts.forEachChild(n,visit);}
 visit(returns[0].expression);if(fields.length>200||fields.join(" ").length>32768)throw Error("public heading bound");return [...new Set(fields)];
}
function build(){
 const root=path.resolve(__dirname,".."),nav=path.join(root,"components/docs/DocsSidebar.tsx");
 function read(file){if(fs.realpathSync(file)!==file||!fs.statSync(file).isFile())throw Error("canonical public file required");return fs.readFileSync(file,"utf8");}
 const text=read(nav),tree=parse(text,nav);let init;function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==="DOC_SECTIONS")init=n.initializer;ts.forEachChild(n,find);}find(tree);if(!init)throw Error("public navigation absent");
 const routes=[];function route(n){if(ts.isPropertyAssignment(n)&&n.name.getText(tree)==="href"){if(!ts.isStringLiteral(n.initializer)||!/^\/docs(?:\/[a-z0-9-]+)*$/.test(n.initializer.text))throw Error("fixed public route required");routes.push(n.initializer.text);}ts.forEachChild(n,route);}route(init);if(!routes.length||new Set(routes).size!==routes.length)throw Error("unique public routes required");
 const guides=routes.map(href=>{const relative="app"+href+"/page.tsx",source=read(path.join(root,relative));return {href,source:relative,sourceSha256:hash(source),fields:extractHeadings(source)};});
 return {format:"axiom.public-guide-headings/1",scope:"Literal summaries and headings only; no body, private knowledge or answers",navigationSha256:hash(text),guides};
}
module.exports={extractHeadings,build};
if(require.main===module){const args=process.argv.slice(2);if(args.length>1||(args.length===1&&args[0]!=="--check"))throw Error("only --check accepted");const file=path.resolve(__dirname,"../lib/docs/guide-heading-index.json"),bytes=JSON.stringify(build(),null,2)+"\n";if(args[0]==="--check"){if(fs.readFileSync(file,"utf8")!==bytes)throw Error("public guide heading index stale");console.log("public guide heading index current");}else{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);console.log("public guide heading index generated");}}
