import {openSync,closeSync,fstatSync,readSync,constants} from 'node:fs';
import names from './fixtures/publicDependencyNames.cjs';
/** Trusted public checkout input only; never follows links or blocks on FIFO. */
export function readPublicDependencyNames(path=new URL('../package-lock.json',import.meta.url)) {
 let fd;
 try {
  fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const before=fstatSync(fd);
  if(!before.isFile()||before.nlink!==1||before.size<1||before.size>4*1024*1024)throw Error();
  const buffer=Buffer.alloc(before.size+1);let length=0;
  while(length<buffer.length){const n=readSync(fd,buffer,length,buffer.length-length,null);if(!n)break;length+=n;}
  const after=fstatSync(fd);
  if(length!==before.size||after.size!==before.size||after.mtimeMs!==before.mtimeMs||after.ctimeMs!==before.ctimeMs)throw Error();
  return names.publicDependencyNames(JSON.parse(buffer.subarray(0,length).toString('utf8')));
 }catch{throw new Error('public_dependency_names_unavailable');}
 finally{if(fd!==undefined)closeSync(fd)}
}
