"""Prepare ad-hoc signed diagnostic bundle only. No registration, XPC or identity."""
from pathlib import Path
import hashlib,json,os,plistlib,re,shutil,subprocess,tempfile
source=Path(__file__).resolve().parent
root=Path(tempfile.mkdtemp(prefix='axiom-origin-unit-prepared-',dir='/private/tmp'));root.chmod(0o700)
app=root/'Axiom Origin Unit.app';contents=app/'Contents';mac=contents/'MacOS';resources=contents/'Resources';agents=contents/'Library/LaunchAgents'
for p in (mac,resources,agents):p.mkdir(parents=True,exist_ok=True)
node=mac/'node';shutil.copy2('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node',node)
main=resources/'candidate-main.cjs';shutil.copyfile(source/'candidate-main.cjs',main)
config=root/'config.h';service='com.visionxixlabs.axiom.origin-unit'
def command(args):
 result=subprocess.run(args,capture_output=True,text=True,timeout=60)
 if result.returncode:raise RuntimeError(json.dumps({'argv':args,'exit':result.returncode,'stderr':result.stderr[-4096:]}))
 return result

def sign(path):command(['/usr/bin/codesign','--force','--sign','-',str(path)])
def requirement(path):
 result=command(['/usr/bin/codesign','--display','--verbose=4',str(path)]);match=re.search(r'^CDHash=([0-9a-f]{40})$',result.stderr,re.M)
 if not match:raise RuntimeError('exact_cdhash_unavailable')
 return 'cdhash H"'+match.group(1)+'"'
def config_write(controller='never',broker='never'):
 entries={'UNIT_ROOT':str(root),'UNIT_SERVICE':service,'UNIT_NODE':str(node),'UNIT_MAIN':str(main),'UNIT_ADDON':str(resources/'origin-client.node'),'CONTROLLER_REQUIREMENT':controller,'NODE_REQUIREMENT':requirement(node),'BROKER_REQUIREMENT':broker,'PEER_REQUIREMENT':'('+controller+') or ('+requirement(node)+')'}
 config.write_text('\n'.join('#define '+key+' '+json.dumps(value) for key,value in entries.items())+'\n')
flags=['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-O1','-fblocks','-mmacosx-version-min=13.0','-I'+str(root),'-I'+str(source),'-framework','CoreFoundation']
sign(node);config_write()
controller=mac/'AxiomOriginController';command(flags+[str(source/'controller.m'),'-framework','Foundation','-framework','ServiceManagement','-framework','Security','-o',str(controller)]);sign(controller)
config_write(controller=requirement(controller))
broker=mac/'AxiomOriginBroker';command(flags+[str(source/'broker.c'),str(source/'protocol.c'),'-framework','Security','-o',str(broker)]);sign(broker)
config_write(controller=requirement(controller),broker=requirement(broker))
addon=resources/'origin-client.node';headers='/Users/samirahmed/.nvm/versions/node/v24.21.0/include/node';command(flags+['-I'+headers,str(source/'client.c'),'-bundle','-undefined','dynamic_lookup','-framework','Security','-o',str(addon)]);sign(addon)
registration=mac/'AxiomOriginRegistrationHost';command(flags+[str(source/'registration_host.m'),'-framework','Foundation','-framework','ServiceManagement','-o',str(registration)])
(contents/'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier':'com.visionxixlabs.axiom.origin-unit.app','CFBundleExecutable':'AxiomOriginRegistrationHost','CFBundlePackageType':'APPL','CFBundleVersion':'1','CFBundleName':'Axiom Origin Unit','LSMinimumSystemVersion':'13.0'}))
(agents/(service+'.plist')).write_bytes(plistlib.dumps({'Label':service,'BundleProgram':'Contents/MacOS/AxiomOriginBroker','MachServices':{service:True},'RunAtLoad':False}))
# The outer main is registration-only. Controller is a separately signed nested tool, avoiding a mutual-codehash/resource-seal cycle.
sign(app)
# Do not silently ship a controller requirement invalidated by the outer resource seal.
actual_controller=requirement(controller);configured=re.search(r'^#define CONTROLLER_REQUIREMENT (.*)$',config.read_text(),re.M)
controller_match=configured is not None and json.loads(configured.group(1))==actual_controller
files={str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file()}
manifest={'scope':'signed_component_preparation_only','root':str(root),'app':str(app),'files':files,'brokerRequirement':requirement(broker),'controllerRequirementMatchesBrokerConfig':controller_match,'executingIssuerIdentity':'unavailable','registrationPerformed':False,'xpcProtocolExecuted':False,'profileOrMountExecuted':False,'actualCanonicalUnchanged':True,'remaining':['actual message/registration unit unexecuted','current origin liveness admission unimplemented','actual canonical NAPI integration unimplemented','same compiled consumer unqualified']}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'root':str(root),'manifestSha256':hashlib.sha256((root/'manifest.json').read_bytes()).hexdigest(),'controllerRequirementMatchesBrokerConfig':controller_match}))
