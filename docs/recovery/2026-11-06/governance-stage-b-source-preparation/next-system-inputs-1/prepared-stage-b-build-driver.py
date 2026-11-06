"""Prepared Stage B build only. Execution requires its own reviewed decision.
No materialization, signing, installation, native payload or emitted-producer launch.
"""
import hashlib,importlib.util,json,os,sys,stat
from pathlib import Path
sys.dont_write_bytecode=True
REPO = Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
REVISION = '2c6d47935cb858d4a78cf5efc03b09b4eeedba9e'
RUN = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-system-build-1')
FIXED = {'sourceRecord': {'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-full-source-3/SOURCE.json', 'sha256': 'c9a3a9f8a87b1f7fec95bbb10f639e6f4b4e60f79a7180893bdb22c85fbb54b3', 'size': 835, 'mode': 420}, 'systemPacket': {'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-full-source-3/system-build-packet.json', 'sha256': '055d8749370c44d358a96923d76fdea5bb3d3edb7a75bbe3010f25890aa0409f', 'size': 35687, 'mode': 384}, 'buildNode': {'path': '/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node', 'sha256': 'e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b', 'size': 122129232, 'mode': 493}, 'npmCli': {'path': '/Users/samirahmed/.nvm/versions/node/v24.21.0/lib/node_modules/npm/bin/npm-cli.js', 'sha256': '8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7', 'size': 54, 'mode': 493}, 'query': {'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-detached-query-compat-3/query-review-copy.node', 'sha256': 'd9113d36ac4cfea42e5a0e329d70160b7bb5559b4cbcbd32b233bf7715d884f2', 'size': 17169584, 'mode': 384}, 'schemaEngine': {'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-system-build-0b0e8b48/engine-inputs/schema-engine', 'sha256': '57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a', 'size': 19831920, 'mode': 448}, 'schemaSql': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/governance-fixture-recipe-local/fixture-schema.sql', 'sha256': 'cba845cd656a2d6ef15b16381490dcba5f277484ae582723d5ee9427e84ce472', 'size': 177091, 'mode': 420}, 'schemaBinding': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/governance-fixture-recipe-local/fixture-schema.binding.json', 'sha256': '3b897b3100d8077b75b126c9647a6b2dc52d17d1101643eea635e650def2887c', 'size': 4183, 'mode': 420}, 'seed': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/governance-fixture-recipe-local/fixture-seed.sql', 'sha256': '664f4ab7b1b582b64b0c92fb5577e311e85ec25924e91aad82be99822c3f1750', 'size': 1378, 'mode': 420}}
HELPERS = {'scripts/build-local-issuer-package-source.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/build-local-issuer-package-source.py', 'sha256': '9f9a936bb5e6f8381483e796a24bba83b28cb3b53ee927d778f71df329dd17c0', 'size': 46531, 'mode': 420}, 'scripts/local_prisma_engine_inputs.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/local_prisma_engine_inputs.py', 'sha256': '5a692e45364745610cab6496cc2e2a9c7951069f147954b6e4eb2d571d8d55d1', 'size': 28469, 'mode': 420}, 'scripts/governance_local_issuer/__init__.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/__init__.py', 'sha256': '89b16b5e62a7f03009da2b7b09d865d8cbc6d6cf60629b203420c91b100b2878', 'size': 76, 'mode': 420}, 'scripts/governance_local_issuer/system_build_inputs.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/system_build_inputs.py', 'sha256': '0961b52f2d4b525ac47ec8b34e66ca7f840a0b02da18fa70d3db422c4cb75c0e', 'size': 21477, 'mode': 420}, 'scripts/governance_local_issuer/system_preparation.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/system_preparation.py', 'sha256': 'f22c68e1dc19319a406bb27ed22de349f290ae8ec8c7c7d51a1b85f0f233564e', 'size': 17924, 'mode': 420}, 'scripts/governance_local_issuer/system_role_profiles.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/system_role_profiles.py', 'sha256': '5acae3be191e3534e356d03523ec9b642afb79abc308033cd1128f8237b65c24', 'size': 5777, 'mode': 420}, 'scripts/governance_local_issuer/saved_profile_observation.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/saved_profile_observation.py', 'sha256': '8e9a80b344b5a5bfee9e6f748346d828fc074d41f569bc5bdc858b558da3193e', 'size': 11610, 'mode': 420}, 'scripts/governance_local_issuer/fixture_delivery_inputs.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/fixture_delivery_inputs.py', 'sha256': '7bf1f6cfb45dba6d6155a372f42381d24a42912fdd2b99da0d77f8c1449e2e02', 'size': 16675, 'mode': 420}, 'scripts/governance_local_issuer/native_overlay.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/native_overlay.py', 'sha256': '4201318ae62dc89c3eba6a4048896dede274b365fa0754ec8055cf51095373a6', 'size': 11435, 'mode': 420}, 'scripts/governance_local_issuer/manifest.py': {'path': '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/manifest.py', 'sha256': '19304f8c9e9fbe8620cf6b484fd599b6f7fc3611d55eea3339a45030f0f5e5e0', 'size': 18081, 'mode': 420}}

def write_new(path,data):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as out:out.write(data)
def write_json(path,value):write_new(path,(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode())
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main():
 if len(sys.argv)!=1:raise RuntimeError('no_stage_b_driver_selectors')
 # Same fixed helper/input checks as the earlier one-run build driver.
 for name,bound in HELPERS.items():
  if hashlib.sha256((REPO/name).read_bytes()).hexdigest()!=bound['sha256']:raise RuntimeError('frozen_stage_b_helper_changed')
 sys.path.insert(0,str(REPO/'scripts'))
 from governance_local_issuer import system_build_inputs as system,system_preparation as prep,fixture_delivery_inputs as fixture
 from governance_local_issuer.manifest import strict_json
 for bound in [*HELPERS.values(),*FIXED.values()]:system._bound(bound)
 source=strict_json(system._bound(FIXED['sourceRecord']));packet=strict_json(system._bound(FIXED['systemPacket']))
 if source['sourceRevision']!=REVISION or source['sourceRepo']!=str(REPO) or packet['sourceRevision']!=REVISION or packet['format']!='axiom.system-build-packet/2':raise RuntimeError('fixed_stage_b_source_packet_mismatch')
 if RUN.resolve()!=RUN or any(p.is_symlink()for p in RUN.parents):raise RuntimeError('canonical_stage_b_run_required')
 parent=RUN.parent.lstat()
 if not stat.S_ISDIR(parent.st_mode)or parent.st_uid!=os.getuid()or stat.S_IMODE(parent.st_mode)!=0o700:raise RuntimeError('private_stage_b_parent_required')
 if RUN.exists()or RUN.is_symlink():raise RuntimeError('fresh_stage_b_run_required_no_retry')
 b=load('axiom_selected_stage_b_builder',REPO/'scripts/build-local-issuer-package-source.py');e=load('axiom_selected_stage_b_engines',REPO/'scripts/local_prisma_engine_inputs.py')
 node=Path(FIXED['buildNode']['path']);npm=Path(FIXED['npmCli']['path']);cache=Path('/Users/samirahmed/.npm/_cacache');stage=RUN/'stage';build=RUN/'build-run';generation=RUN/'generation-run';bound=RUN/'engine-inputs'
 RUN.mkdir(mode=0o700)
 if stat.S_IMODE(RUN.stat().st_mode)!=0o700:raise RuntimeError('stage_b_run_creation_mode_unavailable')
 write_json(RUN/'attempt.json',{'format':'axiom.stage-b-build-attempt/1','sourceRevision':REVISION,'driverSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'fixedInputs':FIXED,'scope':'one offline preparation/generation/full compiler pass; no materialization','executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False})
 phase='offline-preparation'
 try:
  print('PHASE',phase,flush=True)
  prepared=b.prepare_optional_probe(REPO,REVISION,cache,node,npm,RUN);write_json(RUN/'preparation.json',prepared)
  if prepared.get('npmOutcome')!='succeeded':raise RuntimeError('offline_dependency_install_did_not_succeed')
  phase='system-input-record';print('PHASE',phase,flush=True);build.mkdir(mode=0o700)
  system.record_system_inputs(stage,REPO,REVISION,build,node,Path(FIXED['systemPacket']['path']))
  phase='signed-engine-source-and-binding';print('PHASE',phase,flush=True)
  engine_source=RUN/'engine-source';engine_source.mkdir(mode=0o700)
  write_new(engine_source/'libquery-engine',system._bound(FIXED['query']));write_new(engine_source/'schema-engine',system._bound(FIXED['schemaEngine']))
  engines=e.bind_local_engines(engine_source,RUN);write_json(RUN/'engine-binding.json',engines)
  if engines['inputs']['query']['sha256']!=FIXED['query']['sha256']or engines['inputs']['schema']['sha256']!=FIXED['schemaEngine']['sha256']:raise RuntimeError('selected_signed_engine_copy_mismatch')
  phase='matching-generation';print('PHASE',phase,flush=True);generation.mkdir(mode=0o700)
  e.execute_generation(stage,bound,REPO,REVISION,cache,node,generation,timeout=120)
  phase='fixture-input-record';print('PHASE',phase,flush=True);resources=RUN/'recipe';resources.mkdir(mode=0o700)
  names={'schema':('schemaSql','fixture-schema.sql'),'binding':('schemaBinding','fixture-schema.binding.json'),'seed':('seed','fixture-seed.sql')};selected={}
  for role,(key,name)in names.items():
   target=resources/name;write_new(target,system._bound(FIXED[key]));selected[role]=system.binding(target)
  fixture_packet={'format':'axiom.fixture-delivery-inputs/1','profile':fixture.PROFILE,'generation':prep.GENERATION,'sourceRevision':REVISION,'stage':str(stage),'schemaSource':system.binding(stage/'prisma/schema.prisma'),'engine':system.binding(bound/'schema-engine'),'resources':selected,'toolNode':packet['roles']['node']['artifact'],'generationInputs':{'run':str(generation),'boundInputs':str(bound),'cache':str(cache)}}
  fixture_path=RUN/'fixture-input-packet.json';write_json(fixture_path,fixture_packet);fixture.record_fixture_delivery_inputs(stage,fixture_path)
  phase='ordinary-full-compiler';print('PHASE',phase,flush=True)
  result=b.execute_build(stage,REPO,REVISION,cache,bound,generation,node,build,timeout=600)
  phase='completed-output-observation';print('PHASE',phase,flush=True)
  attempt=strict_json((build/'attempt.json').read_bytes());raw=(build/'result.json').read_bytes()
  if strict_json(raw)!=result or result.get('exit')!=0 or result.get('buildOutputsVerified')is not True:raise RuntimeError('completed_stage_b_compiler_required')
  current=b.prepare_build_inputs(stage,REPO,REVISION,cache,bound,generation,node,phase='after_build')
  if current!=attempt['inputs']:raise RuntimeError('completed_stage_b_inputs_changed')
  outputs=b.verify_build_outputs(stage);producer=system.binding(stage/fixture.HELPER)
  if producer['sha256']!='681a5b12c7e16bf5e84022b98ac0be00a12942d20ec210f5091ae2bf2f451fbf':raise RuntimeError('accepted_stage_a_producer_mismatch')
  observation={'format':'axiom.local-completed-build-observation/1','sourceRevision':REVISION,'status':'build_outputs_observed_unqualified','compilerExit':0,'compilerRerun':False,'generationRerun':False,'originalResult':result,'originalResultSha256':hashlib.sha256(raw).hexdigest(),'observerSourceSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'inputs':current,'outputs':outputs,'producer':producer,'buildOutputsVerified':True,'buildCompatibilityVerified':False,'completeExecutableClosure':'unavailable','descendantQuiescence':'unavailable','executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False,'installationReady':False,'activationAllowed':False}
  write_json(RUN/'completed-observation.json',observation)
  # Original source/tool inputs remain observations; no target or materializer runs.
  for value in FIXED.values():system._bound(value)
  write_json(RUN/'terminal-summary.json',{'sourceRevision':REVISION,'phase':phase,'status':'ordinary_full_build_observed_unqualified','completedObservation':system.binding(RUN/'completed-observation.json'),'producer':producer,'signedQuerySha256':engines['inputs']['query']['sha256'],'materializationPerformed':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False})
  print('COMPLETE ordinary_full_build_observed_unqualified',flush=True)
 except BaseException as error:
  write_json(RUN/'terminal-summary.json',{'sourceRevision':REVISION,'phase':phase,'status':'failed_no_retry','errorType':type(error).__name__,'error':str(error),'materializationPerformed':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False});raise
if __name__=='__main__':main()
