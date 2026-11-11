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
