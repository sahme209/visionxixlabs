const {test}=require('node:test'),assert=require('node:assert/strict');
const {isolatedNextStartupCategories:classify}=require('../fixtures/isolatedNextStartupCategories.cjs');
test('returns only fixed categories, never raw output, paths or synthetic secrets',()=>{
 const result=classify('Error: Cannot find module /private/synthetic-secret/generated/prisma/client.js\nSECRET=synthetic-secret');
 assert.deepEqual(result,{status:'observed',categories:['module_missing','generated_prisma']});assert.equal(JSON.stringify(result).includes('synthetic-secret'),false);
});
test('retains unknown observations without inventing a cause',()=>assert.deepEqual(classify('server stopped for an unknown reason'),{status:'observed',categories:[]}));
test('rejects nonstrings and oversized observations without coercion',()=>{const evil={toString(){throw Error('must not execute')}};for(const input of[evil,null,'x'.repeat(65537)])assert.deepEqual(classify(input),{status:'unavailable',categories:[]})});
test('distinguishes loader, compiler, guard and address failures with closed labels',()=>{
 for(const [text,label]of[['ReferenceError: __dirname is not defined','esm_loading'],['error TS5097','typescript_options'],['owned_test_child_options_unsupported','child_guard'],['EADDRINUSE','address_conflict'],['PrismaClientInitializationError','prisma_initialization']])assert.ok(classify(text).categories.includes(label));
});
test('identifies only finite public missing-module tokens without returning captured strings',()=>{
 for(const[token,label]of[['.prisma/client/default','missing_legacy_prisma_client'],['@prisma/client/runtime/client','missing_prisma_runtime'],['./internal/class.js','missing_generated_class'],['/private/SECRET/.next/dev/server/vendor-chunks/foo.js','missing_next_vendor_chunk']]){
  const result=classify(`Error: Cannot find module '${token}'`);assert.ok(result.categories.includes(label));assert.equal(JSON.stringify(result).includes('SECRET'),false);
 }
 const unknown=classify("Cannot find module 'PRIVATE_SECRET_UNKNOWN'");assert.ok(unknown.categories.includes('missing_module_unknown'));assert.equal(JSON.stringify(unknown).includes('PRIVATE_SECRET_UNKNOWN'),false);
});
test('distinguishes actual generated enum requests and relative Next output chunks',()=>{
 for(const[token,label]of[['./enums.js','missing_generated_enums'],['./vendor-chunks/PRIVATE_SECRET.js','missing_next_vendor_chunk'],['pg-native','missing_pg_native']]){
  const result=classify(`Cannot find module '${token}'`);assert.ok(result.categories.includes(label));assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'),false);
 }
 const result=classify("Cannot find module '/PRIVATE_SECRET/node_modules/unknown/prisma-unknown.node'");
 assert.ok(result.categories.includes('missing_request_absolute'));assert.ok(result.categories.includes('missing_request_prisma_family'));assert.ok(result.categories.includes('missing_request_native_module'));assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'),false);
});
test('formatting codes cannot hide a whitelisted module token',()=>{
 assert.ok(classify("Cannot find module '\u001b[31m./enums.js\u001b[0m'").categories.includes('missing_generated_enums'));
});
test('returns only a package name approved by public dependency metadata, never its raw subpath',()=>{
 const result=classify("Cannot find module '@prisma/client/PRIVATE_SECRET'\nCannot find module 'PRIVATE_SECRET'",['@prisma/client']);
 assert.deepEqual(result.publicMissingPackages,['@prisma/client']);assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'),false);
 assert.equal(classify("Cannot find module 'unlisted-package'",['@prisma/client']).publicMissingPackages,undefined);
});
test('reports a Node builtin only after exact membership in the public Node builtin registry',()=>{
 const result=classify("Can't resolve 'fs'\nCannot find module 'node:net'\nCannot find module 'node:PRIVATE_SECRET'");assert.deepEqual(result.publicMissingBuiltins,['node:fs','node:net']);assert.equal(JSON.stringify(result).includes('PRIVATE_SECRET'),false);
});
