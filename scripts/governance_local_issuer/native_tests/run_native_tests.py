"""Focused local native compile + pure classifiers + readonly own-PID metadata.
Never links the restriction initializer into executables or loads the .node file.
"""
from pathlib import Path
import os,subprocess,tempfile,json,hashlib
root=Path(tempfile.mkdtemp(prefix='axiom-native-capability-test-',dir='/private/tmp'));os.chmod(root,0o700)
repo=Path.cwd();native=repo/'packages/verified-issuer-runtime/native';tests=repo/'scripts/governance_local_issuer/native_tests'
compiler=['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-O1','-I'+str(native)]
commands=[]
def compile(argv,output):
 r=subprocess.run(argv,capture_output=True,text=True);commands.append({'argv':argv,'exit':r.returncode,'log':r.stdout+r.stderr})
 if r.returncode:raise RuntimeError(r.stderr)
 return str(root/output)
classifier=compile(compiler+[str(native/'capability_inventory.c'),str(tests/'classifier_tests.c'),'-o',str(root/'classifier-tests')],'classifier-tests')
smoke=compile(compiler+[str(native/'capability_inventory.c'),str(tests/'inventory_smoke.c'),'-o',str(root/'inventory-smoke')],'inventory-smoke')
headers=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/include/node')
addon=compile(compiler+['-Wno-deprecated-declarations','-fvisibility=hidden','-I'+str(headers),'-bundle','-undefined','dynamic_lookup',str(native/'capability_inventory.c'),str(native/'capability_guard.c'),'-o',str(root/'capability_guard.node')],'capability_guard.node')
os.chmod(addon,0o600) # compile-only, never require/dlopen or chmod executable here
null=os.open('/dev/null',os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
def run(binary,args=(),passed=()):
 r=subprocess.run([binary,*args],stdin=null,stdout=subprocess.PIPE,stderr=subprocess.PIPE,close_fds=True,pass_fds=passed,cwd=root,env={'PATH':'/usr/bin:/bin','LANG':'C'},timeout=5,text=True)
 if r.returncode:raise RuntimeError(r.stderr or 'focused_native_child_failed')
 return {'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
try:
 pure=run(classifier)
 own=run(smoke,('--own-metadata-only',))
 assert 'descriptors=3 ' in own['stdout'] and 'fd_complete=1 ' in own['stdout'] and 'regions=0 ' not in own['stdout']
 # Owned retained file capability is inspected only; child never writes its bytes.
 path=root/'owned-retained';fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_RDWR|os.O_CLOEXEC,0o600)
 try:
  retained=run(smoke,('--own-metadata-only',),(fd,))
  assert 'decision=1 reason=descriptor_capability_refused' in retained['stdout']
 finally:os.close(fd)
 assert path.stat().st_size==0
finally:os.close(null)
result={'state':'local_source_and_metadata_only','buildRoot':str(root),'commands':commands,'pureClassifiers':pure,'ownProcessMetadata':own,'ownedRetainedDescriptorMetadata':retained,'ownedRetainedBytes':0,'initializerAddon':'compiled_only_not_loaded','profileApiExecuted':False,'identity':'unavailable','nativeQualification':'unavailable','hashes':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [root/'classifier-tests',root/'inventory-smoke',root/'capability_guard.node',headers/'node_api.h']}}
Path('work/native-capability/focused-result.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
