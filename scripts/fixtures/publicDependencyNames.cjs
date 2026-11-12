'use strict';
// Only names already present in the public committed lockfile. No package code,
// environment, credential or remote metadata is loaded.
function publicDependencyNames(lock){
 if(!lock||typeof lock!=='object'||!lock.packages||typeof lock.packages!=='object'||Array.isArray(lock.packages))return[];
 const entries=Object.entries(lock.packages);if(entries.length>10000)return[];
 let inspected=0;const names=new Set(),valid=/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
 function add(name){if(typeof name==='string'&&name.length<=214&&valid.test(name)&&!name.startsWith('.')&&!name.endsWith('.'))names.add(name)}
 for(const[location,pkg]of entries){
  if(!pkg||typeof pkg!=='object')continue;
  const marker='node_modules/',index=location.lastIndexOf(marker);if(index>=0)add(location.slice(index+marker.length));
  for(const key of ['dependencies','optionalDependencies','peerDependencies']){
   const value=pkg[key];if(!value||typeof value!=='object'||Array.isArray(value))continue;
   const keys=Object.keys(value);if(keys.length>10000||(inspected+=keys.length)>50000)return[];for(const name of keys)add(name);
  }
 }
 return[...names].sort();
}
module.exports=Object.freeze({publicDependencyNames});
