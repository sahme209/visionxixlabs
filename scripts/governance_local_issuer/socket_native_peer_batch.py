"""Fixed broker then guard static-only unit; each compile/sign step is explicit.

The approval reference is saved operator history, never authenticated issuer
identity. Callers independently review each unsigned output before key use.
"""
from pathlib import Path
import copy,hashlib,math,re
from . import socket_native_initial_batch as initial,system_preparation as prep,system_build_inputs as inputs,bounded_signing_tool as tool
from .manifest import canonical,strict_json
from .saved_profile_observation import inspect_empty_dictionary,inspect_guard_no_entitlements
BASE=initial.BASE
ROOT=BASE/'2026-11-06-stage-b-socket-peer-1'
BROKER_STAGE=ROOT/'broker-source'

SOURCE_REPO=initial.NATIVE_SOURCE_REPO
SOURCE_MANIFEST=initial.SOURCE_MANIFEST
EXPECTED_MANIFEST_SHA=initial.EXPECTED_SOURCE_MANIFEST_SHA256
PEER_BASIS=initial.PLAN.parent/'node-basis.json'
EXPECTED_BASIS_SHA='66ac4eea3ae2545d35ba144c9c7fb2d9c6300a4452cc2a85bc569d17d470d47a'
REVIEW=initial.PLAN.parent/'EXECUTION-REVIEW.md'
APPROVAL='socket-native-1-conditional-approval-required'
NODE_SHA='1aa6f6936040d80d6f9c1bb75ba4af97ce596af514ab7f0157a77f461abce134'
NODE_CD='2965bacde5394d71a94682b246ad01efe316e036'

CLOSED=dict(initial.CLOSED)
_need=initial._need
_write=initial._write
_full=initial._full
_checkfull=initial._checkfull
_json=initial._json
_binding=initial._binding

def _active():
 inputs._private(ROOT);inputs._private(ROOT/'leaves');_need(not(ROOT/'unit-failure.json').exists(),'peer_unit_stopped')
def _failure(error):
 if ROOT.is_dir()and not(ROOT/'unit-failure.json').exists():_write(ROOT/'unit-failure.json',{'reason':type(error).__name__,**CLOSED})
def _closed(value):_need(all(type(value.get(k))is type(v)and value.get(k)==v for k,v in CLOSED.items()),'closed_peer_unit_required')
def _target(role):return ROOT/'leaves'/(role+'-review-copy')
def _stage(role):return BROKER_STAGE if role=='broker'else ROOT/'guard-source'
def _commands(role):
 target=str(_target(role));identifier=inputs.ROLE_IDENTIFIERS[role]
 return [['/usr/bin/codesign','--force','--sign',initial.KEY,'--identifier',identifier,'--options','runtime','--entitlements',str(ROOT/'empty.plist'),'--timestamp=none',target],['/usr/bin/codesign','--verify','--strict','--verbose=2',target],['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',target]]
def _display(role,raw):
 text=raw.decode('utf8')
 for key,value in [('Identifier',inputs.ROLE_IDENTIFIERS[role]),('TeamIdentifier','FG5N98FE6W'),('Format','Mach-O thin (arm64)'),('Info.plist','not bound'),('Sealed Resources','none')]:
  _need(re.findall('^'+re.escape(key)+'=(.*)$',text,re.M)==[value],'peer_display_profile_mismatch')
 _need(re.findall(r'flags=(0x[0-9a-f]+)\(runtime\)',text)==['0x10000'],'peer_runtime_profile_required');hashes=re.findall(r'^CDHash=([a-f0-9]{40})$',text,re.M);_need(len(hashes)==1,'one_saved_peer_cdhash_required');return hashes[0]
def _config(config,role,broker_cd=None):
 phase='broker-leaf'if role=='broker'else'complete';prep._config(config,phase)
 expected={'principal':{'account':'_axiomissuer_synthetic','uid':65001,'gid':65001},'fixturePrincipal':{'uid':65002,'gid':65002},'controllerPrincipal':{'uid':501,'gid':20},'lifetimeNs':300000000000,'fixtureTools':{'nodeSha256':NODE_SHA,'producerSha256':'ab6de13646a3c295bd74ee9476d0934d41f5daa6112e5b338be3fa0ebb027a52'},'desktopRequirement':'cdhash H"'+_controller_current()[0]+'"'}
 _need(all(canonical(config.get(k))==canonical(v)for k,v in expected.items())and config['node']['sha256']==NODE_SHA,'fixed_peer_principal_config_required')
 requirements={'node':'cdhash H"'+NODE_CD+'"','controller':'cdhash H"'+_controller_current()[0]+'"'}
 if role=='guard':requirements['brokerForGuard']='cdhash H"'+broker_cd+'"'
 _need(config['requirements']==requirements,'actual_peer_requirements_required')
def _receipt(role,broker_cd=None):
 path=_stage(role)/prep.RECEIPT;bound=_binding(path)
 if role=='broker':_need(bound==_json(ROOT/'broker-preparation-binding.json'),'fixed_broker_preparation_changed')
 r=inputs._json_bound(bound);_need(r['format']=='axiom.system-preparation/1'and r['generation']==prep.GENERATION and r['staging']==str(_stage(role))and r['preparationPhase']==('broker-leaf'if role=='broker'else'complete')and all(r[k]is False for k in ('executionAuthorized','installationReady','activationAllowed')),'fixed_peer_preparation_required');_config(r['config'],role,broker_cd)
 _need(r['compileRecipes']==prep._recipes(_stage(role),r['preparationPhase']),'fixed_peer_recipes_required');matching=[x for x in r['compileRecipes']if x['role']==role];_need(len(matching)==1,'one_peer_recipe_required');return bound,r,matching[0]
def _inventory(root):
 result=set()
 for path in root.rglob('*'):
  _need(not path.is_symlink(),'peer_source_alias')
  if not path.is_dir():result.add(path.relative_to(root).as_posix())
 return result

def _controller_current():
 completion=_json(initial.ROOT/'four-completion.json');_closed(completion)
 for snapshot in completion['evidence']:_checkfull(snapshot)
 value=inputs._json_bound(completion['result']);_closed(value)
 _need(value['format']=='axiom.initial-native-signed-roles/1'and set(value['roles'])==set(initial.ROLES),'own_four_role_completion_required')
 packet=_json(initial.ROOT/'compile-packet.json');initial._current(packet,[x['compileRecipe']['output']for x in packet['planValue']['roles']])
 item=value['roles']['controller'];result=inputs._json_bound(item['resultReceipt']);commands=result['results']
 _need(result['profile_matches']is True and inputs._same_artifact(result['artifact_after'],item['artifact']),'own_controller_artifact_required');inputs._bound(item['artifact'])
 inputs._provenance('controller',item,result,commands,[item['provenance']['preparationReceipt']],None)
 _need(len(commands)==len(item['rawLogs'])==3,'controller_three_commands_required')
 for command,logs in zip(commands,item['rawLogs']):
  stdout=inputs._bound(logs['stdout'],65536);stderr=inputs._bound(logs['stderr'],65536)
  _need(command['state']=='completed'and command['exit']==0 and command['cleanup']=='reaped_original_child'and command['error']is None and 0<=command['elapsed_seconds']<=10 and command['stdout_bytes']==len(stdout)and command['stderr_bytes']==len(stderr)and len(stdout)+len(stderr)<=65536,'controller_saved_sequence_required')
 _need(item['rawLogs'][2]=={'stdout':item['displayStdout'],'stderr':item['displayStderr']},'controller_display_pair_required')
 inspect_empty_dictionary(inputs._bound(item['displayStdout']));return _display('controller',inputs._bound(item['displayStderr'])),completion

def execute_initial_sign(binding):
 """Explicit post-review call. No compile-to-sign automation."""
 value=initial.execute_sign(binding);paths={initial.ROOT/'signing-result.json',initial.ROOT/'compile-packet.json',initial.ROOT/'signing-attempt.json',initial.ROOT/'compile-attempt.json',initial.ROOT/'signing-packet.json'}
 for item in value['roles'].values():
  for bound in [item['artifact'],item['resultReceipt'],*item['provenance'].values()]:paths.add(Path(bound['path']))
  for logs in item['rawLogs']:
   for bound in logs.values():paths.add(Path(bound['path']))
 packet=_json(initial.ROOT/'compile-packet.json')
 for leaf in packet['planValue']['roles']:paths.add(Path(leaf['compileRecipe']['output']))
 evidence=[_full(path)for path in sorted(paths)]
 _write(initial.ROOT/'four-completion.json',{'result':_binding(initial.ROOT/'signing-result.json'),'evidence':evidence,**CLOSED});_controller_current();return value

def _basis():
 raw,_=prep._snapshot(PEER_BASIS,8*1024**2);_need(hashlib.sha256(raw).hexdigest()==EXPECTED_BASIS_SHA,'fixed_node_basis_changed');basis=strict_json(raw);_need(basis['historicalNodeReceiptRestamped']is False,'old_node_history_must_remain_unrestamped');frozen=[_full(PEER_BASIS)]
 for key in ('nodeCurrent','nodeDisplay','nodeResult'):
  inputs._bound(basis[key]);initial._bound_state(basis[key]);frozen.append(_full(Path(basis[key]['path'])))
 _need(_display('node',inputs._bound(basis['nodeDisplay']))==NODE_CD and basis['nodeCurrent']['sha256']==NODE_SHA,'fixed_actual_node_required');node=inputs._json_bound(basis['nodeResult']);_need(node['profile_matches_candidate']is True and all(node['copy_after'][k]==basis['nodeCurrent'][k]for k in ('sha256','size')),'saved_node_result_required')
 _,completion=_controller_current();frozen.extend(completion['evidence']);frozen.append(_full(initial.ROOT/'four-completion.json'));return frozen

def _freeze(receipt):
 raw,_=prep._snapshot(SOURCE_MANIFEST,8*1024**2);_need(hashlib.sha256(raw).hexdigest()==EXPECTED_MANIFEST_SHA,'fixed_source_manifest_changed');manifest=strict_json(raw);_need(manifest['sourceCommit']=='1369f4837f3fde73eb873449501fb2b7c7947587'and manifest['wholeProjectSnapshot']is False,'fixed_native_source_revision_required');inputs._bound(manifest['archive']);initial._bound_state(manifest['archive'])
 _need(_inventory(SOURCE_REPO)==set(manifest['files']),'frozen_native_inventory_changed');frozen={}
 for name,want in manifest['files'].items():
  _need(not Path(name).is_absolute()and'..'not in Path(name).parts,'source_manifest_escape');p=SOURCE_REPO/name;_,snapshot=prep._snapshot(p);_need(all(snapshot[k]==want[k]for k in ('sha256','size')),'frozen_native_bytes_changed');frozen[str(p)]=_full(p)
 initial._stage_check(receipt,[])
 for p in Path(receipt['staging']).rglob('*'):
  if p.is_file():frozen[str(p)]=_full(p)
 source,node,headers=prep._inputs(SOURCE_REPO,receipt['config']);_need(set(source)==set(receipt['sourceInputs'])and set(headers)==set(receipt['headerInputs']),'peer_input_closure_changed')
 for name,(_,snap)in source.items():_need(all(snap[k]==receipt['sourceInputs'][name][k]for k in ('sha256','size')),'peer_source_input_changed')
 _need(all(node[1][k]==receipt['nodeInput'][k]for k in ('sha256','size')),'peer_node_input_changed')
 for name,(_,snap)in headers.items():
  _need(all(snap[k]==receipt['headerInputs'][name][k]for k in ('sha256','size')),'peer_header_changed');p=Path(receipt['config']['node']['headers'])/name;frozen[str(p)]=_full(p)
 paths=[SOURCE_MANIFEST,Path(manifest['archive']['path']),Path(receipt['config']['node']['path']),REVIEW,Path(__file__).resolve(),Path(initial.__file__).resolve(),Path(prep.__file__).resolve(),Path(inputs.__file__).resolve(),Path(tool.__file__).resolve(),Path(__file__).with_name('manifest.py').resolve(),Path(__file__).with_name('saved_profile_observation.py').resolve()]
 for p in paths:frozen[str(p)]=_full(p)
 for record in _basis():frozen[record['path']]=record
 for record in frozen.values():_checkfull(record)
 return list(frozen.values())

def _make_packet(role,broker=None):
 bound,receipt,recipe=_receipt(role,None if broker is None else broker['cdhash']);packet={'format':'axiom.peer-native-compile-packet/1','approvalReference':APPROVAL,'approvalMeaning':'historical operator reference; not authenticated issuer identity','role':role,'preparationReceipt':bound,'recipe':recipe,'commands':_commands(role),'target':str(_target(role)),'entitlements':_binding(ROOT/'empty.plist'),'frozenInputs':_freeze(receipt),**CLOSED}
 if broker is not None:packet['brokerCompletion']=_binding(ROOT/'broker-completion.json')
 _write(ROOT/(role+'-compile-packet.json'),packet);return packet

def prepare(approval_reference):
 """Create broker recipe from this unit's actual controller, never caller CDHash."""
 _need(approval_reference==APPROVAL,'exact_operator_approval_reference_required');cd,_=_controller_current();_need(not ROOT.exists()and not ROOT.is_symlink(),'fresh_peer_unit_required')
 prep._mkdir(ROOT);prep._mkdir(ROOT/'leaves');prep._write(ROOT/'empty.plist',b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>\n')
 try:
  config=copy.deepcopy(_json(initial.NATIVE_SOURCE_REPO.parent/'config.json'));config['requirements']={'node':'cdhash H"'+NODE_CD+'"','controller':'cdhash H"'+cd+'"'};config['desktopRequirement']=config['requirements']['controller'];_config(config,'broker');prep.prepare_system(SOURCE_REPO,BROKER_STAGE,config,phase='broker-leaf');_write(ROOT/'broker-preparation-binding.json',_binding(BROKER_STAGE/prep.RECEIPT));_controller_current();return _make_packet('broker')
 except BaseException as error:_failure(error);raise

def _packet(role,packet,output_exists):
 _active();_need(type(packet)is dict and canonical(packet)==canonical(_json(ROOT/(role+'-compile-packet.json'))),'saved_peer_compile_packet_required');_closed(packet);_need(packet['role']==role and packet['format']=='axiom.peer-native-compile-packet/1'and packet['approvalReference']==APPROVAL,'fixed_peer_compile_packet_required')
 for record in packet['frozenInputs']:_checkfull(record)
 broker=None
 if role=='guard':
  inputs._bound(packet['brokerCompletion']);broker=_broker_current()
 bound,r,recipe=_receipt(role,None if broker is None else broker['cdhash']);_need(packet['preparationReceipt']==bound and packet['recipe']==recipe and packet['commands']==_commands(role)and packet['target']==str(_target(role)),'peer_packet_recipe_changed')
 inputs._bound(packet['entitlements']);inspect_empty_dictionary(inputs._bound(packet['entitlements']));initial._stage_check(r,[recipe['output']]if output_exists else[])
 manifest=_json(SOURCE_MANIFEST);_need(_inventory(SOURCE_REPO)==set(manifest['files']),'frozen_native_inventory_changed');_need(_inventory(Path(r['config']['node']['headers']))==set(r['headerInputs']),'peer_header_inventory_changed');return r

def _run(role,kind,index,argv,cwd):
 name=role+'-'+kind+'-'+str(index);result=tool.run(argv,str(cwd),dict(initial.ENV));out=result['stdout'];err=result['stderr'];_need(type(out)is bytes and type(err)is bytes,'true_peer_streams_required');prep._write(ROOT/(name+'-stdout.log'),out);prep._write(ROOT/(name+'-stderr.log'),err)
 record={'argv':argv,'state':result['state'],'exit':result['exit'],'cleanup':result['cleanup'],'error':result.get('error'),'elapsed_seconds':result['elapsed_seconds'],'stdout_bytes':len(out),'stderr_bytes':len(err)};_write(ROOT/(name+'-command.json'),record);elapsed=record['elapsed_seconds'];_need(record['state']=='completed'and type(record['exit'])is int and record['exit']==0 and record['cleanup']=='reaped_original_child'and record['error']is None and type(elapsed)in(int,float)and math.isfinite(elapsed)and 0<=elapsed<=10 and len(out)+len(err)<=65536,'peer_command_failed_or_unknown');logs={'stdout':_binding(ROOT/(name+'-stdout.log')),'stderr':_binding(ROOT/(name+'-stderr.log'))}
 _need(logs['stdout']['sha256']==hashlib.sha256(out).hexdigest()and logs['stderr']['sha256']==hashlib.sha256(err).hexdigest(),'peer_raw_stream_changed_during_save');states=[_full(ROOT/(name+suffix))for suffix in ('-stdout.log','-stderr.log','-command.json')];return record,logs,out,err,states

def _compile(role,packet):
 try:
  r=_packet(role,packet,False);_write(ROOT/(role+'-compile-attempt.json'),{'compilePacket':_binding(ROOT/(role+'-compile-packet.json')),**CLOSED});recipe=packet['recipe'];output=Path(recipe['output']);_need(not output.exists()and not output.is_symlink(),'fresh_peer_output_required');_packet(role,packet,False)
  try:record,logs,_,_,stream_states=_run(role,'compile',1,recipe['argv'],_stage(role))
  finally:
   if output.exists()or output.is_symlink():initial._quarantine(output)
  source=_binding(output);source_state=_full(output);_packet(role,packet,True);compilepath=ROOT/(role+'-compile-result.json');_write(compilepath,{'stage':str(_stage(role)),'manifestSha256':packet['preparationReceipt']['sha256'],'results':[{'role':role,'argv':recipe['argv'],'exit':record['exit'],'artifact':source}]});compilebound=_binding(compilepath)
  target=_target(role);_need(not any(p.suffix=='.app'for p in target.parents),'detached_peer_target_required');prep._write(target,inputs._bound(source));targetbound=_binding(target);_need(all(source[k]==targetbound[k]for k in ('sha256','size')),'peer_detached_copy_mismatch');_checkfull(source_state);_packet(role,packet,True)
  for snapshot in stream_states:_checkfull(snapshot)
  sign={'format':'axiom.peer-native-signing-packet/1','role':role,'approvalReference':APPROVAL,'compilePacket':_binding(ROOT/(role+'-compile-packet.json')),'compileAttempt':_binding(ROOT/(role+'-compile-attempt.json')),'leaves':[{'role':role,'identifier':inputs.ROLE_IDENTIFIERS[role],'sourceArtifact':source,'target':targetbound,'commands':packet['commands']}],'compileReceipt':compilebound,'preparationReceipt':packet['preparationReceipt'],'unsignedState':source_state,'detachedState':_full(target),**CLOSED};_write(ROOT/(role+'-signing-packet.json'),sign);return {'signingPacket':_binding(ROOT/(role+'-signing-packet.json')),'compileReceipt':compilebound,**CLOSED}
 except BaseException as error:_failure(error);raise

def execute_broker_compile(packet):return _compile('broker',packet)
def execute_guard_compile(packet):return _compile('guard',packet)

def _signstate(role,binding):
 _active();_need(type(binding)is dict and binding['path']==str(ROOT/(role+'-signing-packet.json')),'fixed_peer_signing_packet_required');sign=inputs._json_bound(binding);_closed(sign);_need(sign['format']=='axiom.peer-native-signing-packet/1'and sign['role']==role and sign['approvalReference']==APPROVAL and len(sign['leaves'])==1,'fixed_peer_signing_unit_required');packet=inputs._json_bound(sign['compilePacket']);_packet(role,packet,True);inputs._bound(sign['compileAttempt']);_checkfull(sign['unsignedState']);leaf=sign['leaves'][0]
 _need(leaf['role']==role and leaf['identifier']==inputs.ROLE_IDENTIFIERS[role]and leaf['commands']==_commands(role)and leaf['target']['path']==str(_target(role))and leaf['sourceArtifact']['path']==packet['recipe']['output']and leaf['target']['sha256']==leaf['sourceArtifact']['sha256']and sign['preparationReceipt']==packet['preparationReceipt'],'peer_signing_leaf_changed');inputs._bound(leaf['sourceArtifact']);comp=inputs._json_bound(sign['compileReceipt']);_need(comp=={'stage':str(_stage(role)),'manifestSha256':packet['preparationReceipt']['sha256'],'results':[{'role':role,'argv':packet['recipe']['argv'],'exit':0,'artifact':leaf['sourceArtifact']}]},'peer_compile_proof_changed');return sign,packet,leaf

def _observe(role,item):
 inputs._bound(item['artifact']);result=inputs._json_bound(item['resultReceipt']);commands=result['results'];_need(type(commands)is list and len(commands)==3,'three_peer_commands_required');sign,packet,leaf=_signstate(role,item['provenance']['signingPacket']);_need(commands==[inputs._json_bound(_binding(ROOT/(role+'-sign-'+str(i)+'-command.json')))for i in range(1,4)],'peer_saved_commands_changed');_need(result['artifact_after']==item['artifact']and result['profile_matches']is True,'peer_result_artifact_mismatch');_closed(result)
 outputs=[]
 for command,logs,argv in zip(commands,item['rawLogs'],leaf['commands']):
  out=inputs._bound(logs['stdout'],65536);err=inputs._bound(logs['stderr'],65536);elapsed=command['elapsed_seconds'];_need(command['argv']==argv and command['state']=='completed'and type(command['exit'])is int and command['exit']==0 and command['cleanup']=='reaped_original_child'and command['error']is None and type(elapsed)in(int,float)and math.isfinite(elapsed)and 0<=elapsed<=10 and type(command['stdout_bytes'])is int and type(command['stderr_bytes'])is int and command['stdout_bytes']==len(out)and command['stderr_bytes']==len(err)and len(out)+len(err)<=65536,'peer_raw_static_sequence_mismatch');outputs.append((out,err))
 _need(len(item['rawLogs'])==3 and item['rawLogs'][2]=={'stdout':item['displayStdout'],'stderr':item['displayStderr']},'peer_display_log_pair_mismatch');out,err=outputs[2];cd=_display(role,err)
 if role=='broker':_need(out.lstrip().startswith((b'<?xml',b'<plist')),'broker_explicit_xml_required');inspect_empty_dictionary(out)
 else:
  _need(out==b'','guard_absent_display_required');obs=inspect_guard_no_entitlements(inputs._bound(item['artifact']),inputs.ROLE_IDENTIFIERS['guard'],'FG5N98FE6W');_need(obs['cdhash']==cd,'guard_saved_cdhash_mismatch')
 proof=item['provenance'];_need(proof['compileReceipt']==sign['compileReceipt']and proof['preparationReceipt']==sign['preparationReceipt'],'same_peer_provenance_required');inputs._provenance(role,item,result,commands,[sign['preparationReceipt']],None)
 if role=='guard':_need(inputs._json_bound(proof['savedCommands'])==commands,'guard_saved_commands_changed')
 return cd

def _sign(role,binding):
 try:
  sign,packet,leaf=_signstate(role,binding);inputs._bound(leaf['target']);_checkfull(sign['detachedState']);_write(ROOT/(role+'-sign-attempt.json'),{'signingPacket':binding,**CLOSED});commands=[];logs=[];signed_state=None;stream_states=[]
  for i,argv in enumerate(leaf['commands'],1):
   _signstate(role,binding)
   if signed_state is not None:_checkfull(signed_state)
   try:record,log,_,_,states=_run(role,'sign',i,argv,ROOT)
   finally:initial._quarantine(_target(role))
   if signed_state is None:signed_state=_full(_target(role))
   else:_checkfull(signed_state)
   commands.append(record);logs.append(log);stream_states.extend(states);_signstate(role,binding)
   for snapshot in stream_states:_checkfull(snapshot)
  artifact=_binding(_target(role));proof={'signingPacket':binding,'compileReceipt':sign['compileReceipt'],'preparationReceipt':sign['preparationReceipt']};commandpath=ROOT/(role+'-commands.json');_write(commandpath,commands)
  if role=='guard':proof['savedCommands']=_binding(commandpath)
  # Profile acceptance precedes result creation. A failure never claims profile_matches.
  out=inputs._bound(logs[2]['stdout']);cd=_display(role,inputs._bound(logs[2]['stderr']))
  if role=='broker':_need(out.lstrip().startswith((b'<?xml',b'<plist')),'broker_explicit_xml_required');inspect_empty_dictionary(out)
  else:
   _need(out==b'','guard_absent_display_required');obs=inspect_guard_no_entitlements(inputs._bound(artifact),inputs.ROLE_IDENTIFIERS['guard'],'FG5N98FE6W');_need(obs['cdhash']==cd,'guard_saved_cdhash_mismatch')
  resultpath=ROOT/(role+'-result.json');_write(resultpath,{'artifact_after':artifact,'original_before':leaf['sourceArtifact'],'original_after':_binding(Path(leaf['sourceArtifact']['path'])),'results':commands,'profile_matches':True,**CLOSED});item={'identifier':inputs.ROLE_IDENTIFIERS[role],'artifact':artifact,'resultReceipt':_binding(resultpath),'displayStdout':logs[2]['stdout'],'displayStderr':logs[2]['stderr'],'rawLogs':logs,'provenance':proof};_need(_observe(role,item)==cd,'peer_profile_observation_changed');_checkfull(signed_state)
  value={'format':'axiom.peer-native-signed-role/1','roles':{role:item},'cdhash':cd,**CLOSED};path=ROOT/(role+'-signing-result.json');_write(path,value)
  evidence=[_full(path),signed_state,_full(resultpath),_full(commandpath)]+stream_states
  for pair in logs:
   for bound in pair.values():evidence.append(_full(Path(bound['path'])))
  for bound in proof.values():evidence.append(_full(Path(bound['path'])))
  for snapshot in evidence:_checkfull(snapshot)
  _write(ROOT/(role+'-completion.json'),{'result':_binding(path),'evidence':evidence,**CLOSED});return value
 except BaseException as error:_failure(error);raise

def execute_broker_sign(binding):return _sign('broker',binding)
def execute_guard_sign(binding):return _sign('guard',binding)

def _broker_current():
 _active();completion=_json(ROOT/'broker-completion.json');_closed(completion)
 for snapshot in completion['evidence']:_checkfull(snapshot)
 value=inputs._json_bound(completion['result']);_closed(value);_need(value['format']=='axiom.peer-native-signed-role/1'and set(value['roles'])=={'broker'},'own_completed_broker_required');cd=_observe('broker',value['roles']['broker']);_need(value['cdhash']==cd,'same_broker_cdhash_required');return value

def prepare_guard():
 """Derive the guard's broker requirement only from this unit's bound proof."""
 try:
  broker=_broker_current();_write(ROOT/'guard-prepare-attempt.json',{'brokerCompletion':_binding(ROOT/'broker-completion.json'),**CLOSED});_,r,_=_receipt('broker');config=copy.deepcopy(r['config']);config['requirements']['brokerForGuard']='cdhash H"'+broker['cdhash']+'"';_config(config,'guard',broker['cdhash']);prep.prepare_system(SOURCE_REPO,_stage('guard'),config,phase='complete');_broker_current();return _make_packet('guard',broker)
 except BaseException as error:_failure(error);raise
