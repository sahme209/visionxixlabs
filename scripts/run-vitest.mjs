import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Keep Node's optional storage global from shadowing jsdom's browser storage.
const flags=process.allowedNodeEnvironmentFlags.has('--no-experimental-webstorage')
 ? ['--no-experimental-webstorage'] : [];
const entry=fileURLToPath(new URL('../node_modules/vitest/vitest.mjs',import.meta.url));
// Vitest may clear execArgv in its workers; NODE_OPTIONS also covers them.
const env={...process.env};
if(flags.length)env.NODE_OPTIONS=[env.NODE_OPTIONS,flags[0]].filter(Boolean).join(' ');
const child=spawn(process.execPath,[...flags,entry,'run',...process.argv.slice(2)],{stdio:'inherit',env});
const handlers=new Map();
for(const signal of ['SIGINT','SIGTERM','SIGHUP']){
 const handler=()=>{if(child.exitCode===null&&child.signalCode===null)child.kill(signal)};
 handlers.set(signal,handler);process.on(signal,handler);
}
function cleanup(){for(const [signal,handler] of handlers)process.removeListener(signal,handler)}
child.once('error',()=>{cleanup();process.exitCode=1});
child.once('exit',(code,signal)=>{
 cleanup();
 if(signal)process.kill(process.pid,signal);
 else process.exitCode=code??1;
});
