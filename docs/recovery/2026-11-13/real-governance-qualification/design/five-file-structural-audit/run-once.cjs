'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const base=__dirname,packet=JSON.parse(fs.readFileSync(path.join(base,'PREPARED.json'),'utf8'));
const resultFile=path.join(base,'OBSERVED-RESULT.json');
if(fs.existsSync(resultFile)||fs.existsSync(path.join(base,'INVOCATION.json')))throw Error('pass_already_started');
for(const [name,expected] of Object.entries(packet.files))if(createHash('sha256').update(fs.readFileSync(name)).digest('hex')!==expected)throw Error('prepared_source_changed');
fs.writeFileSync(path.join(base,'INVOCATION.json'),JSON.stringify({approval:packet.approval,startedAt:new Date().toISOString(),oneInstance:true})+'\n',{flag:'wx'});
const {createReader}=require('./reader.cjs'),reader=createReader(),observations=[];let failed=false;
try{for(let i=0;i<5;i++){const value=reader.next();const filename='PUBLIC-READ-'+(i+1)+'.txt';fs.writeFileSync(path.join(base,filename),value.body,{flag:'wx'});const {body,...metadata}=value;observations.push({...metadata,filename,sha256:createHash('sha256').update(body).digest('hex')})}}
catch{failed=true}
finally{const result={approval:packet.approval,finishedAt:new Date().toISOString(),failed,observations,state:reader.state(),scope:'public text only; no downloaded source execution or native qualification'};fs.writeFileSync(resultFile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({failed,files:observations.length,requests:result.state.requests,complete:result.state.complete})+'\n')}
if(failed)process.exitCode=1;
