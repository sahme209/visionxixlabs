const{test}=require('node:test'),assert=require('node:assert/strict');const{publicDependencyNames:names}=require('../fixtures/publicDependencyNames.cjs');
test('uses package names only, never public-lock values or arbitrary paths',()=>{
 assert.deepEqual(names({packages:{'':{dependencies:{'@prisma/client':'PRIVATE_SECRET'}},'node_modules/pg':{peerDependencies:{'pg-native':'PRIVATE_SECRET'}},'PRIVATE_SECRET':{}}}),['@prisma/client','pg','pg-native']);
 assert.deepEqual(names({packages:{'node_modules/../../PRIVATE_SECRET':{dependencies:{'https://PRIVATE_SECRET':'unused'}}}}),[]);
});
