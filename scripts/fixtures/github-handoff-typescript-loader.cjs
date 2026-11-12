'use strict';
// Fixed compile-only loader. No source execution or configuration discovery.
const ts=require('typescript');
module.exports=function(source){
 const result=ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:false,sourceMap:false}});
 return result.outputText;
};
