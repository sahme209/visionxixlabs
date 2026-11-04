'use strict';
// Compiler-only loader. Does not execute the application module being emitted.
module.exports = function (source) {
  const ts = require('typescript');
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, esModuleInterop: true } }).outputText;
};
