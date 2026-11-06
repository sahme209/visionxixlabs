"""System compiler inputs: saved observations only, never signature/issuer authority."""
from pathlib import Path
import hashlib,json,os,plistlib,re,stat,math
from . import system_preparation as prep
from .manifest import canonical,strict_json
RECEIPT='_axiom_system_build_inputs.json'
PACKAGE_PATH=Path('packages/verified-issuer-runtime')
PACKAGE_FILES=('package.json','index.cjs','index.d.ts','README.md','internal/verify-package.cjs','native/origin_guard.node')
GENERATED_STAGE=tuple(str(PACKAGE_PATH/'native'/n)for n in ('origin_guard.node','origin-bootstrap'))
ROLE_IDENTIFIERS={r:'com.visionxixlabs.axiom.synthetic.'+n for r,n in {'owner':'launch-owner','broker':'broker','controller':'controller','maintenance':'provisioner','bootstrap':'bootstrap','guard':'guard'}.items()}
ROLE_IDENTIFIERS['node']='com.visionxixlabs.axiom.synthetic-node'
LAYOUT={'root':prep.ROOT,'app':prep.APP,'packageRoot':prep.PACKAGE_ROOT,'owner':prep.OWNER_PATH,'ownerService':prep.OWNER_SERVICE,'brokerService':prep.BROKER_SERVICE,'image':prep.APP+'/Contents/Resources/issuer-package.dmg'}
def binding(path):
 data,s=prep._snapshot(Path(path),2*1024**3)
 return {'path':str(path),'sha256':s['sha256'],'size':s['size'],'mode':s['mode']}

def _need(ok,reason):
 if not ok:raise ValueError(reason)
def _private(path):
 p=prep._path(path);i=p.stat()
 _need(p.is_dir() and i.st_uid==os.getuid() and stat.S_IMODE(i.st_mode)==0o700,'private_system_directory_required');return p
def _bound(want,limit=2*1024**3):
 _need(isinstance(want,dict) and {'path','sha256','size','mode'}<=set(want),'bound_input_required')
 data,snap=prep._snapshot(Path(want['path']),limit)
 mode=want['mode'];mode=int(mode,8) if isinstance(mode,str) else mode
 _need(snap['sha256']==want['sha256'] and snap['size']==want['size'] and snap['mode']==mode,'system_bound_input_changed')
 return data
def _json_bound(want):return strict_json(_bound(want,8*1024**2))
def _same_artifact(record,want):
 return isinstance(record,dict) and all(record.get(k)==want[k] for k in ('path','sha256','size'))
def _provenance(role,item,result,commands,preparations,build_node):
 proof=item['provenance'];sign=_json_bound(proof['signingPacket'])
 expected=sign.get('commands')
 if isinstance(sign.get('leaves'),list):
  matching=[x for x in sign['leaves']if x.get('role')==role]
  _need(len(matching)==1,'signed_leaf_role_required');leaf=matching[0];expected=leaf['commands'];unsigned=leaf['sourceArtifact']
  _need(leaf['identifier']==ROLE_IDENTIFIERS[role] and leaf['target']['path']==item['artifact']['path'] and leaf['target']['sha256']==unsigned['sha256'],'signed_leaf_preimage_required')
 else:
  unsigned=sign.get('artifact')
  _need(sign.get('target',item['artifact']['path'])==item['artifact']['path'],'signed_target_mismatch')
 _need(expected==[x.get('argv')for x in commands],'saved_signing_commands_mismatch')
 _need(all(isinstance(x,list)and x and x[-1]==item['artifact']['path']for x in expected),'signed_command_target_mismatch')
 if role=='node':
  _need(sign.get('target')==item['artifact']['path'],'explicit_node_signing_target_required')
  _need(set(proof)=={'signingPacket'} and result.get('original_unchanged')is True,'node_original_preservation_required')
  current=binding(build_node)
  for key in ('original_before','original_after'):
   _need(all(result.get(key,{}).get(k)==current[k]for k in ('sha256','size')),'original_build_tool_changed')
  return
 _need(set(proof)==({'signingPacket','compileReceipt','preparationReceipt','savedCommands'}if role in ('owner','maintenance','bootstrap','guard')else{'signingPacket','compileReceipt','preparationReceipt'}),'native_compile_provenance_required')
 _need(proof['preparationReceipt']in preparations,'role_preparation_not_selected')
 preparation=_json_bound(proof['preparationReceipt']);comp=_json_bound(proof['compileReceipt'])
 _need(comp.get('stage')==preparation.get('staging') and comp.get('manifestSha256',comp.get('preparationManifestSha256'))==proof['preparationReceipt']['sha256'],'compile_preparation_mismatch')
 entry=comp
 if isinstance(comp.get('results'),list):
  entries=[x for x in comp['results']if x.get('role')==role];_need(len(entries)==1,'compiled_role_required');entry=entries[0]
 _need(type(entry.get('exit'))is int and entry['exit']==0 and isinstance(unsigned,dict) and entry.get('artifact')==unsigned,'signed_unsigned_compile_mismatch')
 recipes=[x for x in preparation.get('compileRecipes',[])if x.get('role')==role]
 _need(len(recipes)==1 and entry.get('argv')==recipes[0]['argv'] and unsigned.get('path')==recipes[0]['output'],'compiled_recipe_mismatch')
def _preparation_closure(r,bound,roles):
 stage=_private(Path(r['staging']));phase=r['preparationPhase'];config=r['config']
 _need(r.get('compileRecipes')==prep._recipes(stage,phase),'prepared_recipe_graph_changed')
 _need((stage/'config/system-preparation.h').read_bytes()==prep._header(config,phase),'prepared_config_header_changed')
 files=r.get('files');_need(isinstance(files,dict) and 1<=len(files)<=5000,'prepared_files_required')
 required={'source/'+name for name in r['sourceInputs']}|{'headers/'+name for name in r['headerInputs']}|{'config/system-preparation.h','compile-plan.json','payload/__axiom_runtime__/node'}
 required|={'payload/node_modules/@axiom/verified-issuer-runtime/'+str(Path(name).relative_to(PACKAGE_PATH))for name in prep.PACKAGE_SOURCE_PATHS}
 _need(required<=set(files),'prepared_required_file_inventory_incomplete')
 for name,want in files.items():
  _need(not Path(name).is_absolute()and '..'not in Path(name).parts,'prepared_file_escape')
  _,snap=prep._snapshot(stage/name,2*1024**3)
  _need(snap['mode']==0o600 and snap['sha256']==want['sha256']and snap['size']==want['size'],'frozen_preparation_input_changed')
 allowed=set(files)|{prep.RECEIPT}
 for role,item in roles.items():
  proof=item.get('provenance',{})
  if proof.get('preparationReceipt')!=bound:continue
  comp=_json_bound(proof['compileReceipt']);entry=comp
  if isinstance(comp.get('results'),list):
   matching=[x for x in comp['results']if x.get('role')==role];_need(len(matching)==1,'compiled_role_required');entry=matching[0]
  output=Path(entry['artifact']['path'])
  _need(output.is_relative_to(stage),'compiled_output_stage_escape');allowed.add(output.relative_to(stage).as_posix())
 current=set()
 for p in stage.rglob('*'):
  _need(not p.is_symlink(),'prepared_stage_alias')
  if p.is_file():current.add(p.relative_to(stage).as_posix())
 _need(current<=allowed and set(files)|{prep.RECEIPT}<=current,'unexpected_preparation_output')
def _observe(stage,repo,revision,run,build_node,packet_path,after_build=False):
 stage=_private(stage);repo=prep._path(repo);run=_private(run);build_node=prep._path(build_node);packet_path=prep._path(packet_path)
 _need(not((stage/'_axiom_native_overlay.json').exists()or(stage/'_axiom_native_overlay.json').is_symlink()),'mixed_native_profiles_refused')
 _need(re.fullmatch('[a-f0-9]{40}',revision) is not None,'source_revision_required')
 packet_binding=binding(packet_path);packet=_json_bound(packet_binding)
 _need(packet.get('format')in('axiom.system-build-packet/1','axiom.system-build-packet/2') and packet.get('generation')==prep.GENERATION and packet.get('sourceRevision')==revision,'system_packet_revision_generation_required')
 _need(packet.get('layout')==LAYOUT and packet.get('executionAuthorized')is False and packet.get('installationReady')is False,'fixed_closed_system_layout_required')
 roles=packet.get('roles');_need(isinstance(roles,dict) and set(roles)==set(ROLE_IDENTIFIERS),'complete_system_roles_required')
 receipts=packet.get('preparationReceipts');_need(isinstance(receipts,list) and 1<=len(receipts)<=8,'preparation_receipts_required')
 sources={};configs=[];phases=[];preparations=[]
 for bound in receipts:
  r=_json_bound(bound)
  _need(r.get('format')=='axiom.system-preparation/1' and r.get('generation')==prep.GENERATION and all(r.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed')),'closed_system_preparation_required')
  c=r.get('config',{});prep._config(c,r.get('preparationPhase'));_preparation_closure(r,bound,roles);principal=c.get('principal',{})
  if configs:
   _need(all(c[k]==configs[0][k]for k in ('principal','lifetimeNs','team','systemProfile','nativeProfile','node')),'mixed_system_configuration')
   _need(c.get('controllerPrincipal')==configs[0].get('controllerPrincipal'),'mixed_controller_configuration')
  _need(c.get('generation')==prep.GENERATION and c.get('systemProfile')=='trusted-owner-root-journal/1' and c.get('nativeProfile')=='hardened-runtime-no-exceptions/1' and c.get('team')=='FG5N98FE6W','system_preparation_profile_required')
  _need(principal.get('account')=='_axiomissuer_synthetic' and all(type(principal.get(k))is int and 0<principal[k]<2**31 for k in ('uid','gid')),'declared_nonroot_principal_required')
  configs.append(c);phases.append(r['preparationPhase']);preparations.append(bound)
  _need(isinstance(r.get('sourceInputs'),dict) and len(r['sourceInputs'])<=256 and sum(x.get('size',0)for x in r['sourceInputs'].values())<=prep.MAX_TOTAL,'source_inventory_bound')
  for name,want in r.get('sourceInputs',{}).items():
   _need(not Path(name).is_absolute() and '..'not in Path(name).parts,'system_source_escape')
   data,snap=prep._snapshot(repo/name)
   _need(snap['sha256']==want['sha256'] and snap['size']==want['size'],'system_source_changed')
   if name in sources:_need(sources[name]==snap,'mixed_source_preparations')
   sources[name]=snap
  _need(isinstance(r.get('headerInputs'),dict) and {'node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'}<=set(r['headerInputs']),'complete_node_header_inventory_required')
  if r.get('headerInputs'):
   _need(len(r['headerInputs'])<=4096 and sum(x.get('size',0)for x in r['headerInputs'].values())<=64*1024**2,'header_inventory_bound')
   hroot=prep._path(Path(c['node']['headers']))
   _need(not any(p.is_symlink()for p in hroot.rglob('*')),'header_inventory_alias')
   _need({p.relative_to(hroot).as_posix()for p in hroot.rglob('*')if not p.is_dir()}==set(r['headerInputs']),'header_inventory_changed')
   for name,want in r['headerInputs'].items():
    _need(not Path(name).is_absolute() and '..'not in Path(name).parts,'header_escape')
    _,snap=prep._snapshot(hroot/name)
    _need(snap['sha256']==want['sha256'] and snap['size']==want['size'],'system_headers_changed')
 _need((set(prep.PACKAGE_SOURCE_PATHS)|set(prep.ROLE_SOURCE_PATHS))<=set(sources),'runtime_native_source_closure_required')
 for name in list(sources):
  if Path(name).suffix in ('.c','.m','.h'):
   data,_=prep._snapshot(repo/name)
   for raw in re.findall(rb'^\s*#(?:include|import)\s+"([^"\r\n]+)"',data,re.M):
    header=raw.decode('ascii')
    if header in ('node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'):continue
    target=Path(name).parent/header
    if not(repo/target).exists()and '/'not in header:target=Path(prep.NATIVE)/header
    _need(not target.is_absolute()and '..'not in target.parts and target.as_posix()in sources,'incomplete_native_include_closure')
 for name in prep.PACKAGE_SOURCE_PATHS:
  _,snap=prep._snapshot(stage/name);_need(snap['sha256']==sources[name]['sha256'],'compiler_runtime_source_changed')
 artifacts={};evidence={};cdhashes={}
 for role,item in roles.items():
  _need(set(item)=={'identifier','artifact','resultReceipt','displayStdout','displayStderr','provenance','rawLogs'} and item['identifier']==ROLE_IDENTIFIERS[role],'fixed_role_identifier_required')
  data=_bound(item['artifact']);_need(int(str(item['artifact']['mode']),8)==0o600 if isinstance(item['artifact']['mode'],str) else item['artifact']['mode']==0o600,'quarantined_role_mode_required')
  r=_json_bound(item['resultReceipt']);actual=r.get('artifact_after',r.get('copy_after'))
  if role=='node'and 'artifact_after'not in r and isinstance(actual,dict)and 'path'not in actual:
   node_sign=_json_bound(item['provenance']['signingPacket'])
   _need(node_sign.get('target')==item['artifact']['path'],'explicit_node_signing_target_required')
   mode=actual.get('mode');mode=int(mode,8)if isinstance(mode,str)else mode
   _need(all(actual.get(k)==item['artifact'][k]for k in ('sha256','size'))and mode==0o600,'saved_node_copy_mismatch')
  else:_need(_same_artifact(actual,item['artifact']),'saved_role_artifact_mismatch')
  commands=r.get('results',r.get('actualCommandsCompleted'));_need(isinstance(commands,list) and len(commands)==3 and all(x.get('state')=='completed' and type(x.get('exit',x.get('exit_code')))is int and x.get('exit',x.get('exit_code'))==0 for x in commands),'saved_static_sequence_required')
  if role!='guard':_need(r.get('profile_matches',r.get('profile_matches_candidate'))is True,'saved_profile_required')
  rawlogs=item['rawLogs'];_need(isinstance(rawlogs,list)and len(rawlogs)==3,'three_raw_command_log_pairs_required')
  _need(rawlogs[2]=={'stdout':item['displayStdout'],'stderr':item['displayStderr']},'display_log_pair_mismatch')
  for command,logs in zip(commands,rawlogs):
   _need(isinstance(logs,dict)and set(logs)=={'stdout','stderr'},'exact_raw_log_pair_required')
   out=_bound(logs['stdout'],65536);err=_bound(logs['stderr'],65536);elapsed=command.get('elapsed_seconds')
   _need(type(elapsed)in(int,float)and math.isfinite(elapsed)and 0<=elapsed<=10,'bounded_saved_command_required')
   _need(type(command.get('stdout_bytes'))is int and type(command.get('stderr_bytes'))is int and len(out)==command['stdout_bytes']and len(err)==command['stderr_bytes']and len(out)+len(err)<=65536,'saved_raw_log_counts_mismatch')
  _provenance(role,item,r,commands,preparations,build_node)
  text=_bound(item['displayStderr'],65536).decode('utf8')
  for key,value in [('Identifier',item['identifier']),('TeamIdentifier','FG5N98FE6W')]:
   _need(re.findall('^'+re.escape(key)+'=(.*)$',text,re.M)==[value],'saved_role_identity_mismatch')
  hashes=re.findall('^CDHash=([a-f0-9]{40})$',text,re.M);_need(len(hashes)==1,'saved_cdhash_required');cdhashes[role]=hashes[0]
  out=_bound(item['displayStdout'],65536)
  if role=='guard':_need(out==b'','guard_empty_entitlement_display_required')
  if role!='guard':
   profile=plistlib.loads(out)
   exact_node=(type(profile)is dict and set(profile)=={'com.apple.security.cs.allow-jit'} and type(profile['com.apple.security.cs.allow-jit'])is bool and profile['com.apple.security.cs.allow-jit']is True)
   _need(exact_node if role=='node'else type(profile)is dict and not profile,'saved_entitlement_profile_mismatch')
  artifacts[role]=binding(Path(item['artifact']['path']));evidence[role]={k:item[k]for k in ('resultReceipt','displayStdout','displayStderr','provenance','rawLogs')}
 for c,phase in zip(configs,phases):
  if 'controllerPrincipal'in c:
   expected_controller='cdhash H"'+cdhashes['controller']+'"'
   if phase in ('complete','native-leaves','broker-leaf'):
    _need(c.get('desktopRequirement')==expected_controller,'fixture_controller_requirement_role_mismatch')
   elif phase in ('controller-first','independent-leaves'):
    _need('desktopRequirement'not in c or c['desktopRequirement']==expected_controller,'fixture_controller_requirement_role_mismatch')
   else:_need(False,'unsupported_controller_preparation_phase')
  for key,req in c['requirements'].items():
   role={'node':'node','controller':'controller','brokerForGuard':'broker'}[key]
   _need(req=='cdhash H"'+cdhashes[role]+'"','preparation_requirement_role_mismatch')
 if packet['format']=='axiom.system-build-packet/2':
  _need('guardSupplement'not in packet and 'guardHistoricalResult'not in packet and isinstance(packet.get('profileObservations'),dict),'explicit_v2_profile_observations_required')
  from .system_role_profiles import observe_role_profiles
  observed=_json_bound(packet['profileObservations'])
  expected=observe_role_profiles({role:roles[role]for role in ('owner','maintenance','bootstrap','guard')},preparations)
  _need(canonical(observed)==canonical(expected),'same_role_profile_observations_mismatch')
 else:
  supplement=_json_bound(packet['guardSupplement'])
  _need(supplement.get('format')=='axiom.saved-static-profile-supplement/1' and supplement.get('historicalBatchAccepted')is False and supplement.get('allFourRepresentationsObserved')is True and all(supplement.get(k)is False for k in ('executionAuthorized','installationReady','cryptographicSignatureVerifiedHere')),'unpromoted_guard_supplement_required')
  historical=_json_bound(packet['guardHistoricalResult'])
  _need(historical.get('allFourStaticSequencesAccepted')is False and supplement.get('historicalResultSha256')==packet['guardHistoricalResult']['sha256'],'historical_result_chain_mismatch')
  representations=supplement.get('representations',[])
  _need(len(representations)==4 and {x.get('role')for x in representations}=={'owner','maintenance','bootstrap','guard'} and all(x.get('artifactSha256')==artifacts[x['role']]['sha256']for x in representations),'guard_supplement_artifact_mismatch')
  for representation in representations:
   obs=representation.get('observation',{});role=representation['role'];proof=roles[role]['provenance']
   _need(supplement.get('packetSha256')==proof['signingPacket']['sha256'] and representation.get('commandsSha256')==proof['savedCommands']['sha256'],'supplement_provenance_chain_mismatch')
   saved=_json_bound(proof['savedCommands']);record=_json_bound(roles[role]['resultReceipt'])
   _need(saved==record.get('results',record.get('actualCommandsCompleted')),'supplement_saved_commands_mismatch')
   _need(obs.get('executionAuthorized')is False and obs.get('installationReady')is False,'closed_profile_observation_required')
   if role=='guard':_need(obs.get('representation')=='no_encoded_entitlement_payload_observed' and obs.get('cdhash')==cdhashes['guard'] and obs.get('cryptographicSignatureVerifiedHere')is False,'exact_guard_representation_required')
   else:_need(obs.get('representation')=='explicit_empty_dictionary_observed','exact_empty_dictionary_observation_required')
 _need(configs[0]['node']['sha256']==artifacts['node']['sha256'],'prepared_runtime_node_mismatch')
 generated={}
 for name,role in zip(GENERATED_STAGE,('guard','bootstrap')):
  p=stage/name
  if p.exists():
   current=binding(p);_need(current['sha256']==artifacts[role]['sha256'] and current['mode']==0o600,'generated_system_artifact_changed');generated[name]=current
  else:_need(not after_build,'system_generated_artifact_missing');generated[name]={'path':str(p),'sha256':artifacts[role]['sha256'],'size':artifacts[role]['size'],'mode':0o600}
 _need(binding(build_node)['sha256']!=artifacts['node']['sha256'],'build_runtime_node_must_be_distinct')
 return {'format':'axiom.prebuild-system-inputs/1','sourceRevision':revision,'plannedBuildRun':str(run),'repo':str(repo),'buildNode':binding(build_node),'runtimeNode':artifacts['node'],'stageArtifacts':generated,'companionArtifacts':{k:artifacts[k]for k in ('owner','broker','controller','maintenance')},'roleArtifacts':artifacts,'roleEvidence':evidence,'runtimePackageFiles':list(PACKAGE_FILES),'systemPacket':packet_binding,'preparationReceipts':preparations,'sourceInputs':sources,'layout':LAYOUT,'proposedOutputModeMap':{'__axiom_runtime__/node':0o755,'__axiom_runtime__/origin-bootstrap':0o755,'node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node':0o644},'modeMappingApplied':False,'unresolved':['final_outer_app_seal_broker_cdhash_dependency','actual_compiled_consumer_execution_unqualified','installation_and_resource_custody_unqualified'],'historicalBatchAccepted':False,'cryptographicSignatureVerifiedHere':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False}
def record_system_inputs(stage,repo,revision,build_run,build_node,packet_path):
 stage=_private(stage);run=_private(build_run)
 _need(not any(run.iterdir()) and not(stage/'.next').exists() and not(stage/RECEIPT).exists(),'fresh_system_build_required')
 _need(all(not(stage/p).exists() for p in GENERATED_STAGE),'fresh_system_generated_inputs_required')
 value=_observe(stage,repo,revision,run,build_node,packet_path)
 for name,role in zip(GENERATED_STAGE,('guard','bootstrap')):
  target=stage/name
  target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
  for parent in target.parents:
   if parent==stage:break
   i=parent.lstat();_need(stat.S_ISDIR(i.st_mode) and i.st_uid==os.getuid() and not(i.st_mode&0o022),'owned_source_directory_required')
  fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb')as out:out.write(_bound(value['roleArtifacts'][role]))
 _need(_observe(stage,repo,revision,run,build_node,packet_path)==value,'system_inputs_changed_during_copy')
 prep._write(stage/RECEIPT,canonical(value)+b'\n');return value
def verify_system_inputs(stage,*,after_build=False):
 stage=_private(stage);p=stage/RECEIPT
 if not p.exists()and not p.is_symlink():return None
 raw,snap=prep._snapshot(p,8*1024**2);_need(snap['mode']==0o600,'private_system_receipt_required');value=strict_json(raw)
 _need(raw==canonical(value)+b'\n' and value.get('format')=='axiom.prebuild-system-inputs/1','canonical_system_receipt_required')
 _need(all((stage/name).is_file()for name in GENERATED_STAGE),'system_generated_artifact_missing')
 current=_observe(stage,Path(value['repo']),value['sourceRevision'],Path(value['plannedBuildRun']),Path(value['buildNode']['path']),Path(value['systemPacket']['path']),after_build=after_build)
 _need(current==value,'system_inputs_changed');return value
