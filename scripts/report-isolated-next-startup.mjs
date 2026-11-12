import {openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
import categories from './fixtures/isolatedNextStartupCategories.cjs';
import {readPublicDependencyNames} from './read-public-dependency-names.mjs';
import {pathToFileURL} from 'node:url';
export function observeIsolatedNextStartup(path='/tmp/axiom-isolated-next-http.log') {
let result={status:'unavailable',categories:[]};let fd;
try{
 fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 const before=fstatSync(fd);
 if(!before.isFile()||before.nlink!==1||before.uid!==process.getuid?.()||before.size<1||before.size>2*1024*1024)throw Error();
 const count=Math.min(before.size,65536),buffer=Buffer.alloc(count),read=readSync(fd,buffer,0,count,before.size-count),after=fstatSync(fd);
 if(read!==count||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error();
 const names=readPublicDependencyNames();
 result=categories.isolatedNextStartupCategories(buffer.toString('utf8'),names);
}catch{}finally{if(fd!==undefined){try{closeSync(fd)}catch{result={status:'unavailable',categories:[]}}}}
return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(observeIsolatedNextStartup()));
