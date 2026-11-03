"""Ordinary actual N-API preimport refusals. No XPC/profile/image/identity run."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,tempfile
SOURCE=Path(__file__).resolve().parent
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
HEADERS=NODE.parent.parent/'include/node'
def run(args,seconds=20,env=None):
 result=subprocess.run(args,capture_output=True,text=True,timeout=seconds,env=env)
 if result.returncode:raise AssertionError({'exit':result.returncode,'stdout':result.stdout[:2048],'stderr':result.stderr[:2048]})
 return result

def main():
 root=Path(tempfile.mkdtemp(prefix='axiom-origin-preimport-',dir='/private/tmp'));root.chmod(0o700)
 package=root/'package';package.mkdir();backing=root/'protected-backing.fixture';backing.write_bytes(b'ordinary fixture, not disk image')
 config=root/'binding.h';config.write_text('#define AXIOM_ISSUER_PACKAGE_ROOT '+json.dumps(str(package))+'\n#define AXIOM_ISSUER_IMAGE_BACKING '+json.dumps(str(backing))+'\n#define AXIOM_ISSUER_ORIGIN_SERVICE "unexecuted.invalid.fixture"\n#define AXIOM_ISSUER_BROKER_REQUIREMENT "never"\n')
 addon=root/'origin_guard.node'
 run(['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-O1','-fblocks','-mmacosx-version-min=13.0','-I'+str(SOURCE),'-I'+str(HEADERS),'-include',str(config),'-bundle','-undefined','dynamic_lookup',str(SOURCE/'origin_guard.c'),str(SOURCE/'origin_session.c'),str(SOURCE/'origin_process_identity.c'),str(SOURCE/'protected_resource_inventory.c'),'-framework','Security','-framework','CoreFoundation','-o',str(addon)])
 ordinary="const assert=require('node:assert/strict');const file=process.argv[1];assert.throws(()=>require(file),/origin_readonly_package_required/);delete require.cache[require.resolve(file)];assert.throws(()=>require(file),/origin_fresh_constructor_required/);console.log('actual_writable_refusal_and_native_once=PASS')"
 env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C'}
 first=run([str(NODE),'-e',ordinary,str(addon)],env=env)
 worker="const{Worker}=require('node:worker_threads');const worker=new Worker(\"try{require(require('node:worker_threads').workerData)}catch(e){require('node:worker_threads').parentPort.postMessage(e.message)}\",{eval:true,workerData:process.argv[1]});worker.once('message',m=>{require('node:assert/strict').match(m,/origin_main_thread_required/);console.log('actual_worker_constructor_refusal=PASS')});worker.once('error',e=>{throw e})"
 second=run([str(NODE),'-e',worker,str(addon)],env=env)
 receipt={'scope':'actual ordinary N-API constructor refusals only; configured root is writable fixture, never a mounted image','root':str(root),'nodeVersion':run([str(NODE),'--version']).stdout.strip(),'cases':[{'case':'writable_root_refusal_before_XPC','stdout':first.stdout.strip()},{'case':'native_process_once_after_failed_constructor','sameProcess':True},{'case':'actual_worker_constructor_refusal_before_XPC','stdout':second.stdout.strip()}],'nativeSha256':hashlib.sha256(addon.read_bytes()).hexdigest(),'serviceOrProfileOrIdentityExecuted':False,'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [SOURCE/'origin_guard.c',SOURCE/'origin_session.c',SOURCE/'origin_session.h',SOURCE/'origin_process_identity.c',SOURCE/'origin_process_identity.h',SOURCE/'protected_resource_inventory.c',SOURCE/'protected_resource_inventory.h']}}
 (root/'result.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({'result':'PASS','ordinaryCases':3,'receipt':str(root/'result.json')}))
if __name__=='__main__':main()
