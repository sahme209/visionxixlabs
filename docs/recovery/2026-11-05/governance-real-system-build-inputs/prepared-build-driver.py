"""Prepared one-run ordinary build/package driver. NOT AUTHORIZED TO RUN YET.
No issuer/consumer activation, installed resources, signing or provider work.
"""
import hashlib,importlib.util,json,os,sys,stat
sys.dont_write_bytecode=True
from pathlib import Path
REPO = Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
REVISION = '0b0e8b48aa3469c1146bc2db38cdce4b2dc1a43d'
PACKET = Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/governance-real-system-build-inputs/system-build-packet-0b0e8b48.json')
PACKET_SHA256 = '8b3e95635e610cfeb2af13b1680a5cff0929612a92d5fc8253170c86b88fa6fc'
HELPERS = {'scripts/build-local-issuer-package-source.py': '6b8445a8ecf84a25ca43b5d3a7ca738a4d3b2d6c89d4c54a48833c129f4290a5', 'scripts/local_prisma_engine_inputs.py': '82e56a85c386ba735a5237c87546e1b41576c37a8f34fdab6769cee36f8743a0', 'scripts/governance_local_issuer/system_build_inputs.py': '54a5552179f2aef7f15fbb1eb646b61b1febd7922852faec1a6a83edf435d980', 'scripts/governance_local_issuer/materialize.py': '438416de2e4b54f6a88479f229c46f7678fc66d066ae354f9088e522ab1b1a54', 'scripts/governance_local_issuer/system_preparation.py': '1cdf90d0b9ad38bc8849d567036db8a83ce26cd0f0c74b2fe5ba5a30024e141e', 'scripts/governance_local_issuer/native_linkage.py': '027a0f78c0341112fee376a828aeec5e62cbbdd2c9445873b7ed997af9be7490', 'scripts/governance_local_issuer/manifest.py': '19304f8c9e9fbe8620cf6b484fd599b6f7fc3611d55eea3339a45030f0f5e5e0'}
RUN_ROOT = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-system-build-0b0e8b48')

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as out:json.dump(value,out,sort_keys=True);out.write('\n')
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def main():
 if len(sys.argv)!=1:raise RuntimeError('no_driver_selectors')
 if sha(REPO/'scripts/governance_local_issuer/__init__.py')!='89b16b5e62a7f03009da2b7b09d865d8cbc6d6cf60629b203420c91b100b2878':raise RuntimeError('helper_initializer_changed')
 if sha(PACKET)!=PACKET_SHA256 or any(sha(REPO/name)!=digest for name,digest in HELPERS.items()):raise RuntimeError('frozen_driver_inputs_changed')
 if RUN_ROOT.resolve()!=RUN_ROOT or any(p.is_symlink()for p in RUN_ROOT.parents):raise RuntimeError('canonical_run_parent_required')
 parent=RUN_ROOT.parent.lstat()
 if not stat.S_ISDIR(parent.st_mode)or parent.st_uid!=os.getuid()or stat.S_IMODE(parent.st_mode)!=0o700:raise RuntimeError('private_owned_run_parent_required')
 if RUN_ROOT.exists()or RUN_ROOT.is_symlink():raise RuntimeError('fresh_run_required_no_retry')
 sys.path.insert(0,str(REPO/'scripts'))
 from governance_local_issuer import system_build_inputs as system,materialize
 packet=json.loads(PACKET.read_text())
 if system.binding(Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'))['sha256']!='e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b':raise RuntimeError('original_build_tool_node_changed')
 def bound_inputs(value):
  if isinstance(value,dict):
   if {'path','sha256','size','mode'}<=set(value):system._bound(value)
   for item in value.values():bound_inputs(item)
  elif isinstance(value,list):
   for item in value:bound_inputs(item)
 bound_inputs(packet)
 b=load('axiom_fixed_system_builder',REPO/'scripts/build-local-issuer-package-source.py')
 e=load('axiom_fixed_system_engines',REPO/'scripts/local_prisma_engine_inputs.py')
 node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node');cache=Path.home()/'.npm/_cacache'
 RUN_ROOT.mkdir(mode=0o700)
 if stat.S_IMODE(RUN_ROOT.stat().st_mode)!=0o700:raise RuntimeError('run_root_creation_mode_unavailable')
 write_new(RUN_ROOT/'attempt.json',{'sourceRevision':REVISION,'driverSha256':sha(__file__),'packetSha256':PACKET_SHA256,'scope':'one offline preparation/generation/compiler/materializer attempt','executionAuthorized':False})
 phase='offline-preparation'
 try:
  print('PHASE',phase,flush=True)
  preparation=b.prepare_optional_probe(REPO,REVISION,cache,node,node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js',RUN_ROOT)
  write_new(RUN_ROOT/'preparation.json',preparation)
  if preparation.get('npmOutcome')!='succeeded':raise RuntimeError('offline_dependency_install_did_not_succeed')
  phase='system-input-record';print('PHASE',phase,flush=True)
  build=RUN_ROOT/'build-run';build.mkdir(mode=0o700)
  system.record_system_inputs(RUN_ROOT/'stage',REPO,REVISION,build,node,PACKET)
  phase='cached-engine-binding';print('PHASE',phase,flush=True)
  write_new(RUN_ROOT/'binding.json',e.bind_local_engines(Path.home()/'.cache/prisma/master'/e.REQUESTED_COMMIT/'darwin-arm64',RUN_ROOT))
  phase='isolated-generation';print('PHASE',phase,flush=True)
  generation=RUN_ROOT/'generation-run';generation.mkdir(mode=0o700)
  e.execute_generation(RUN_ROOT/'stage',RUN_ROOT/'engine-inputs',REPO,REVISION,cache,node,generation,timeout=120)
  phase='ordinary-compiler';print('PHASE',phase,flush=True)
  original=b.execute_build(RUN_ROOT/'stage',REPO,REVISION,cache,RUN_ROOT/'engine-inputs',generation,node,build,timeout=600)
  phase='completed-output-observation';print('PHASE',phase,flush=True)
  attempt=json.loads((build/'attempt.json').read_text());original_raw=(build/'result.json').read_bytes()
  if json.loads(original_raw)!=original or original.get('exit')!=0 or original.get('buildOutputsVerified')is not True:raise RuntimeError('completed_compiler_required')
  inputs=b.prepare_build_inputs(RUN_ROOT/'stage',REPO,REVISION,cache,RUN_ROOT/'engine-inputs',generation,node,phase='after_build')
  if inputs!=attempt['inputs']:raise RuntimeError('completed_inputs_changed')
  observed={'format':'axiom.local-completed-build-observation/1','sourceRevision':REVISION,'status':'build_outputs_observed_unqualified','compilerExit':0,'compilerRerun':False,'generationRerun':False,'originalResult':original,'originalResultSha256':hashlib.sha256(original_raw).hexdigest(),'observerSourceSha256':sha(__file__),'inputs':inputs,'outputs':b.verify_build_outputs(RUN_ROOT/'stage'),'buildOutputsVerified':True,'buildCompatibilityVerified':False,'completeExecutableClosure':'unavailable','descendantQuiescence':'unavailable','executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False}
  observation=RUN_ROOT/'completed-observation.json';write_new(observation,observed)
  phase='canonical-materialization';print('PHASE',phase,flush=True)
  output=RUN_ROOT/'materialized';output.mkdir(mode=0o700)
  result=materialize.materialize_isolated(observation,build,RUN_ROOT/'stage',REPO,cache,RUN_ROOT/'engine-inputs',generation,node,output/'package',system_mode_map=materialize.SYSTEM_MODE_MAP)
  write_new(RUN_ROOT/'terminal-summary.json',{'sourceRevision':REVISION,'phase':phase,'status':'ordinary_package_observed_unqualified','result':result,'executionAuthorized':False,'installationReady':False,'activationAllowed':False})
  print('COMPLETE ordinary_package_observed_unqualified',flush=True)
 except BaseException as error:
  write_new(RUN_ROOT/'terminal-summary.json',{'sourceRevision':REVISION,'phase':phase,'status':'failed_no_retry','errorType':type(error).__name__,'error':str(error),'executionAuthorized':False,'installationReady':False,'activationAllowed':False})
  raise
if __name__=='__main__':main()
