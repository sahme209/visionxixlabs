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
