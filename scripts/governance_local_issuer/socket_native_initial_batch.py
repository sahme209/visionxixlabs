"""Fixed local four-helper compile/sign unit. No target launch; no automatic retry.

prepare only freezes ordinary files. The caller must independently review the
actual compile outputs/signing packet before explicitly calling execute_sign.
The saved approval reference describes the operator's history, not issuer identity.
"""
from pathlib import Path
import hashlib,math,os,re,stat
from . import system_preparation as prep,system_build_inputs as inputs,bounded_signing_tool as tool
from .manifest import canonical,strict_json
from .saved_profile_observation import inspect_empty_dictionary
BASE=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab')
ROOT=BASE/'2026-11-06-stage-b-socket-native-1'
SOURCE_REPO=Path(__file__).resolve().parents[2]
NATIVE_SOURCE_REPO=BASE/'2026-11-06-stage-b-socket-native-source-1/repo'
SOURCE_MANIFEST=BASE/'2026-11-06-stage-b-socket-native-source-1/source-manifest.json'
EXPECTED_SOURCE_MANIFEST_SHA256='a4416743f68c60a67ea06b0a78fb17f7033e3949919456a0e1f28fa87017d17a'
PLAN=SOURCE_REPO/'docs/recovery/2026-11-06/governance-stage-b-source-preparation/socket-native-1-prepared/NATIVE-BATCH-PLAN.json'
EXPECTED_PLAN_SHA256='102f7a58e383ea882c9c047df2db60208ee4955baac80dc9f024df7615b32c91'
APPROVAL_REFERENCE='socket-native-1-conditional-approval-required'
PRODUCER_RESULT=BASE/'2026-11-06-stage-b-socket-producer-1/packet/result.json'
PRODUCER_RESULT_SHA256='64fbe5369ab55638912da3faa4ebfbee09be3493f69f47dca47732173fa06f61'
PRODUCER_SHA256='ab6de13646a3c295bd74ee9476d0934d41f5daa6112e5b338be3fa0ebb027a52'
ROLES=('controller','owner','maintenance','bootstrap')
KEY='4C2E59F247CA275001586AE020A9269464529452'
CLOSED={'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'targetExecuted':False,'cryptographicSignatureVerifiedHere':False,'operationalIdentity':'unavailable'}
ENV={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','LC_ALL':'C','DEVELOPER_DIR':'/Library/Developer/CommandLineTools'}

def _need(ok,reason):
 if not ok:raise ValueError(reason)
def _write(path,value):prep._write(path,canonical(value)+b'\n')
def _json(path):return strict_json(prep._snapshot(path,8*1024**2)[0])
def _binding(path):return inputs.binding(path)
def _full(path,limit=2*1024**3):
 _,snapshot=prep._snapshot(path,limit);return {'path':str(path),'snapshot':snapshot}
def _checkfull(record):
 _,snapshot=prep._snapshot(Path(record['path']),2*1024**3);_need(snapshot==record['snapshot'],'frozen_input_changed')
def _bound_state(bound):
 if 'state'in bound:
  i=Path(bound['path']).lstat();_need(bound['state']==[i.st_dev,i.st_ino,i.st_uid,i.st_gid,i.st_nlink,i.st_size,i.st_mtime_ns,i.st_ctime_ns],'bound_saved_file_state_changed')
def _commands(role,identifier,target):
 return [['/usr/bin/codesign','--force','--sign',KEY,'--identifier',identifier,'--options','runtime','--entitlements',str(ROOT/'empty.plist'),'--timestamp=none',str(target)],['/usr/bin/codesign','--verify','--strict','--verbose=2',str(target)],['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',str(target)]]
def _plan():
 raw,_=prep._snapshot(PLAN,8*1024**2);_need(hashlib.sha256(raw).hexdigest()==EXPECTED_PLAN_SHA256,'fixed_plan_changed');plan=strict_json(raw)
 _need(type(plan)is dict and plan.get('format')=='axiom.stage-b-initial-leaves-design/1' and [x.get('role')for x in plan.get('roles',[])]==list(ROLES),'fixed_four_role_plan_required')
 _need(all(plan.get(k)is False for k in ('accountModification','executionAuthorized','installation','retry','targetExecution')) and plan.get('cleanupSeconds')==5 and plan.get('combinedOutputCap')==65536 and plan.get('secondsPerCommand')==10 and plan.get('implementationAndExactOutputReviewRequired')is True,'fixed_plan_limits_required')
 _need(plan.get('sourceCommit')=='1369f4837f3fde73eb873449501fb2b7c7947587','fixed_source_commit_required')
 return plan

def _phases(plan):
 result={}
 for leaf in plan['roles']:
  bound=leaf['preparation'];raw=inputs._bound(bound,8*1024**2)
  _bound_state(bound)
  r=strict_json(raw);stage=prep._path(r['staging']);phase=r['preparationPhase']
  _need(phase==('controller-first'if leaf['role']=='controller'else'independent-leaves'),'fixed_phase_required')
  _need(Path(bound['path'])==stage/prep.RECEIPT and r.get('format')=='axiom.system-preparation/1' and r.get('generation')==prep.GENERATION and all(r.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed')),'closed_source_preparation_required')
  prep._config(r['config'],phase)
  _need(r['compileRecipes']==prep._recipes(stage,phase),'fixed_compile_recipes_required')
  matches=[x for x in r['compileRecipes']if x['role']==leaf['role']];_need(matches==[leaf['compileRecipe']],'plan_recipe_mismatch')
  _need(leaf['identifier']==inputs.ROLE_IDENTIFIERS[leaf['role']] and leaf['target']==str(ROOT/'leaves'/(leaf['role']+'-review-copy')) and leaf['signingCommands']==_commands(leaf['role'],leaf['identifier'],leaf['target']),'fixed_signing_commands_required')
  _need(not any(p.suffix=='.app'for p in Path(leaf['target']).parents),'detached_target_required')
  if phase in result:_need(result[phase][0]==bound,'mixed_phase_receipts')
  result[phase]=(bound,r)
 configs=[r['config']for _,r in result.values()];_need(len(configs)==2 and configs[0]==configs[1],'coherent_initial_configuration_required')
 return result

def _stage_check(receipt,outputs):
 stage=prep._path(receipt['staging']);info=stage.lstat();_need(stat.S_ISDIR(info.st_mode) and info.st_uid==os.getuid() and stat.S_IMODE(info.st_mode)==0o700,'private_source_stage_required')
 files=receipt['files'];_need(type(files)is dict and 1<=len(files)<=5000,'source_inventory_required')
 actual=set()
 for path in stage.rglob('*'):
  i=path.lstat();_need(not stat.S_ISLNK(i.st_mode),'source_stage_alias')
  if stat.S_ISDIR(i.st_mode):_need(i.st_uid==os.getuid() and stat.S_IMODE(i.st_mode)==0o700,'private_source_directory_required')
  else:_need(stat.S_ISREG(i.st_mode),'regular_source_file_required');actual.add(path.relative_to(stage).as_posix())
 allowed={str(Path(p).relative_to(stage))for p in outputs if Path(p).is_relative_to(stage)}
 _need(actual==set(files)|{prep.RECEIPT}|allowed,'source_stage_file_set_changed')
 for name,want in files.items():
  _need(not Path(name).is_absolute() and '..'not in Path(name).parts,'source_inventory_escape');_,snap=prep._snapshot(stage/name,2*1024**3)
  _need(snap['mode']==0o600 and snap['sha256']==want['sha256'] and snap['size']==want['size'],'source_stage_bytes_changed')
 _need(prep._snapshot(stage/'config/system-preparation.h')[0]==prep._header(receipt['config'],receipt['preparationPhase']),'source_config_header_changed')

def _producer_inputs():
 raw,_=prep._snapshot(PRODUCER_RESULT,8*1024**2);_need(hashlib.sha256(raw).hexdigest()==PRODUCER_RESULT_SHA256,'fixed_producer_result_changed');value=strict_json(raw)
 _need(value['status']=='artifact_observed'and value['sourceRevision']=='1369f4837f3fde73eb873449501fb2b7c7947587'and value['executionAuthorized']is False and value['finalInputCurrentness']=='verified','observed_corrected_producer_required')
 artifact=value['producer'];_need(artifact['sha256']==PRODUCER_SHA256 and artifact['size']==772578 and artifact['mode']==0o600,'fixed_corrected_producer_required');inputs._bound(artifact)
 return [_full(PRODUCER_RESULT),_full(Path(artifact['path']))]

def _initial_inputs(phases):
 raw,_=prep._snapshot(SOURCE_MANIFEST,8*1024**2);_need(hashlib.sha256(raw).hexdigest()==EXPECTED_SOURCE_MANIFEST_SHA256,'fixed_source_manifest_changed');manifest=strict_json(raw)
 _need(manifest['sourceCommit']=='1369f4837f3fde73eb873449501fb2b7c7947587' and manifest['wholeProjectSnapshot']is False,'frozen_source_revision_required')
 inputs._bound(manifest['archive']);_bound_state(manifest['archive']);frozen={str(SOURCE_MANIFEST):_full(SOURCE_MANIFEST),manifest['archive']['path']:_full(Path(manifest['archive']['path']))};actual=set()
 for record in _producer_inputs():frozen[record['path']]=record
 for p in NATIVE_SOURCE_REPO.rglob('*'):
  _need(not p.is_symlink(),'frozen_repository_alias')
  if p.is_file():actual.add(p.relative_to(NATIVE_SOURCE_REPO).as_posix())
 _need(actual==set(manifest['files']),'frozen_repository_inventory_changed')
 for name,want in manifest['files'].items():
  _need(not Path(name).is_absolute() and '..'not in Path(name).parts,'frozen_repository_escape');p=NATIVE_SOURCE_REPO/name;_,snap=prep._snapshot(p)
  _need(all(snap[k]==want[k]for k in ('sha256','size')),'frozen_repository_bytes_changed');frozen[str(p)]=_full(p)
 for bound,r in phases.values():
  _stage_check(r,[])
  for p in Path(r['staging']).rglob('*'):
   if p.is_file():frozen[str(p)]=_full(p)
  source,node,headers=prep._inputs(NATIVE_SOURCE_REPO,r['config'])
  _need(set(source)==set(r['sourceInputs']) and set(headers)==set(r['headerInputs']),'source_header_closure_changed')
  for name,(_,snap)in source.items():
   want=r['sourceInputs'][name];_need(all(snap[k]==want[k]for k in ('sha256','size')),'source_input_changed');p=NATIVE_SOURCE_REPO/name;frozen[str(p)]=_full(p)
  _need(all(node[1][k]==r['nodeInput'][k]for k in ('sha256','size')),'node_input_changed')
  p=Path(r['config']['node']['path']);frozen[str(p)]=_full(p)
  for name,(_,snap)in headers.items():
   _need(all(snap[k]==r['headerInputs'][name][k]for k in ('sha256','size')),'node_header_changed');p=Path(r['config']['node']['headers'])/name;frozen[str(p)]=_full(p)
 return list(frozen.values())

def prepare(approval_reference):
 """Freeze the fixed conditional unit. Does not compile or sign."""
 _need(approval_reference==APPROVAL_REFERENCE,'exact_operator_approval_reference_required')
 _need(not ROOT.exists() and not ROOT.is_symlink(),'fresh_native_unit_required')
 plan=_plan();phases=_phases(plan);frozen=_initial_inputs(phases)
 # Freeze all Python files that this runner depends on before an operation.
 code=[_full(Path(module.__file__).resolve())for module in (prep,inputs,tool)]
 code.append(_full(Path(__file__).resolve()));code.append(_full(Path(__file__).with_name('socket_native_peer_batch.py').resolve()));code.append(_full(Path(__file__).with_name('manifest.py').resolve()));code.append(_full(Path(__file__).with_name('saved_profile_observation.py').resolve()))
 for record in frozen+code:_checkfull(record)
 prep._mkdir(ROOT);prep._mkdir(ROOT/'leaves');prep._write(ROOT/'empty.plist',b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>\n')
 packet={'format':'axiom.initial-native-compile-packet/1','approvalReference':approval_reference,'approvalMeaning':'historical operator reference; not authenticated issuer identity','plan':_binding(PLAN),'planValue':plan,'frozenInputs':frozen,'runnerInputs':code,'emptyEntitlements':_binding(ROOT/'empty.plist'),**CLOSED}
 _write(ROOT/'compile-packet.json',packet);return packet

def _packet(packet):
 inputs._private(ROOT);inputs._private(ROOT/'leaves')
 _need(type(packet)is dict,'compile_packet_required');saved=_json(ROOT/'compile-packet.json');_need(canonical(saved)==canonical(packet),'saved_compile_packet_mismatch')
 _need(saved.get('format')=='axiom.initial-native-compile-packet/1' and saved.get('approvalReference')==APPROVAL_REFERENCE and all(saved.get(k)==v and type(saved.get(k))is type(v)for k,v in CLOSED.items()),'closed_compile_packet_required')
 inputs._bound(saved['plan'],8*1024**2);_need(_plan()==saved['planValue'],'saved_plan_changed');inputs._bound(saved['emptyEntitlements']);inspect_empty_dictionary(inputs._bound(saved['emptyEntitlements']))
 for record in saved['frozenInputs']+saved['runnerInputs']:_checkfull(record)
 return saved,_phases(saved['planValue'])
def _current(packet,outputs):
 saved,phases=_packet(packet)
 manifest=_json(SOURCE_MANIFEST);actual=set()
 for path in NATIVE_SOURCE_REPO.rglob('*'):
  _need(not path.is_symlink(),'frozen_repository_alias')
  if path.is_file():actual.add(path.relative_to(NATIVE_SOURCE_REPO).as_posix())
 _need(actual==set(manifest['files']),'frozen_repository_inventory_changed')
 for _,receipt in phases.values():_stage_check(receipt,outputs)
 # Inventory additions in the external header tree must also be rejected.
 for _,r in phases.values():
  hroot=Path(r['config']['node']['headers']);actual=set()
  for p in hroot.rglob('*'):
   _need(not p.is_symlink(),'node_header_alias')
   if not p.is_dir():actual.add(p.relative_to(hroot).as_posix())
  _need(actual==set(r['headerInputs']),'node_header_inventory_changed')
 return saved,phases

def _claim(name,value):_write(ROOT/name,value)
def _quarantine(path):
 p=prep._path(path);before=p.lstat();_need(stat.S_ISREG(before.st_mode) and before.st_uid==os.getuid() and before.st_nlink==1,'owned_single_link_compiler_output_required')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
 try:
  opened=os.fstat(fd);_need((opened.st_dev,opened.st_ino)==(before.st_dev,before.st_ino),'compiler_output_replaced');
  if stat.S_IMODE(opened.st_mode)!=0o600:os.fchmod(fd,0o600)
  after=os.fstat(fd);current=p.lstat();_need((after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns)==(current.st_dev,current.st_ino,current.st_size,current.st_mtime_ns,current.st_ctime_ns),'compiler_output_changed')
 finally:os.close(fd)
 return _binding(p)
def _run(argv,directory,name):
 result=tool.run(argv,str(directory),dict(ENV));out=result['stdout'];err=result['stderr'];_need(type(out)is bytes and type(err)is bytes,'true_raw_streams_required')
 prep._write(ROOT/(name+'-stdout.log'),out);prep._write(ROOT/(name+'-stderr.log'),err)
 record={'argv':argv,'state':result['state'],'exit':result['exit'],'elapsed_seconds':result['elapsed_seconds'],'stdout_bytes':len(out),'stderr_bytes':len(err),'cleanup':result['cleanup'],'error':result.get('error')}
 _write(ROOT/(name+'-command.json'),record)
 elapsed=result['elapsed_seconds'];_need(result['state']=='completed' and type(result['exit'])is int and result['exit']==0 and result['cleanup']=='reaped_original_child' and result.get('error')is None and type(elapsed)in(int,float) and math.isfinite(elapsed) and 0<=elapsed<=10 and len(out)+len(err)<=65536,'native_command_failed_or_unknown')
 return record,{'stdout':_binding(ROOT/(name+'-stdout.log')),'stderr':_binding(ROOT/(name+'-stderr.log'))},out,err

def execute_compile(packet):
 """Attempt the four fixed compile commands once; stop before signing."""
 saved,phases=_current(packet,[]);_claim('compile-attempt.json',{'compilePacket':_binding(ROOT/'compile-packet.json'),**CLOSED});outputs=[];results={phase:[]for phase in phases}
 try:
  for leaf in saved['planValue']['roles']:
   _current(packet,outputs);recipe=leaf['compileRecipe'];output=Path(recipe['output']);_need(not output.exists() and not output.is_symlink(),'fresh_unsigned_output_required')
   try:record,logs,_,_=_run(recipe['argv'],Path(leaf['preparation']['path']).parent,'compile-'+leaf['role'])
   finally:
    if output.exists()or output.is_symlink():_quarantine(output)
   artifact=_binding(output);outputs.append(str(output));_current(packet,outputs)
   phase='controller-first'if leaf['role']=='controller'else'independent-leaves';results[phase].append({'role':leaf['role'],'argv':recipe['argv'],'exit':record['exit'],'artifact':artifact})
  receipts={}
  for phase,(bound,r)in phases.items():
   path=ROOT/(phase+'-compile.json');_write(path,{'stage':r['staging'],'manifestSha256':bound['sha256'],'results':results[phase]});receipts[phase]=_binding(path)
  leaves=[]
  for leaf in saved['planValue']['roles']:
   source=_binding(Path(leaf['compileRecipe']['output']));raw=inputs._bound(source);target=Path(leaf['target']);prep._write(target,raw);targetbinding=_binding(target);_need(targetbinding['sha256']==source['sha256'] and targetbinding['size']==source['size'],'detached_copy_mismatch')
   phase='controller-first'if leaf['role']=='controller'else'independent-leaves'
   leaves.append({'role':leaf['role'],'identifier':leaf['identifier'],'sourceArtifact':source,'target':targetbinding,'commands':leaf['signingCommands'],'compileReceipt':receipts[phase],'preparationReceipt':leaf['preparation']})
  _current(packet,outputs)
  sign={'format':'axiom.initial-native-signing-packet/1','compilePacket':_binding(ROOT/'compile-packet.json'),'compileAttempt':_binding(ROOT/'compile-attempt.json'),'approvalReference':APPROVAL_REFERENCE,'entitlements':saved['emptyEntitlements'],'leaves':leaves,'unsignedInputs':[_full(Path(leaf['sourceArtifact']['path']))for leaf in leaves],'detachedInputs':[_full(Path(leaf['target']['path']))for leaf in leaves],**CLOSED}
  _write(ROOT/'signing-packet.json',sign);result={'format':'axiom.initial-native-compile-result/1','compileReceipts':receipts,'signingPacket':_binding(ROOT/'signing-packet.json'),**CLOSED};_write(ROOT/'compile-result.json',result);return result
 except BaseException as error:
  _write(ROOT/'compile-failure.json',{'reason':type(error).__name__,**CLOSED});raise

def _signpacket(binding):
 _need(type(binding)is dict and binding.get('path')==str(ROOT/'signing-packet.json'),'fixed_signing_packet_required');sign=inputs.strict_json(inputs._bound(binding,8*1024**2));_need(canonical(sign)==canonical(_json(ROOT/'signing-packet.json')),'saved_signing_packet_mismatch')
 packet=inputs.strict_json(inputs._bound(sign['compilePacket'],8*1024**2));saved,phases=_current(packet,[leaf['compileRecipe']['output']for leaf in packet['planValue']['roles']]);inputs._bound(sign['compileAttempt'])
 _need(sign.get('format')=='axiom.initial-native-signing-packet/1' and sign.get('approvalReference')==APPROVAL_REFERENCE and all(sign.get(k)==v and type(sign.get(k))is type(v)for k,v in CLOSED.items()),'closed_signing_packet_required')
 _need([x['role']for x in sign['leaves']]==list(ROLES) and sign['entitlements']==saved['emptyEntitlements'],'fixed_signing_leaves_required')
 for record in sign['unsignedInputs']:_checkfull(record)
 for leaf,planned in zip(sign['leaves'],saved['planValue']['roles']):
  _need(leaf['identifier']==planned['identifier'] and leaf['commands']==planned['signingCommands'] and leaf['target']['path']==planned['target'] and leaf['sourceArtifact']['path']==planned['compileRecipe']['output'],'signing_leaf_changed')
  inputs._bound(leaf['sourceArtifact']);phase='controller-first'if leaf['role']=='controller'else'independent-leaves';_need(leaf['preparationReceipt']==phases[phase][0],'signing_preparation_changed')
  comp=inputs.strict_json(inputs._bound(leaf['compileReceipt'],8*1024**2));_need(comp['stage']==phases[phase][1]['staging'] and comp['manifestSha256']==leaf['preparationReceipt']['sha256'],'compile_receipt_changed')
  entries=[x for x in comp['results']if x['role']==leaf['role']];_need(entries==[{'role':leaf['role'],'argv':planned['compileRecipe']['argv'],'exit':0,'artifact':leaf['sourceArtifact']}],'compiled_unsigned_preimage_changed')
 return sign,packet

def execute_sign(signpacket):
 """Explicit second step after independent exact-output review by the caller."""
 sign,packet=_signpacket(signpacket)
 for leaf in sign['leaves']:inputs._bound(leaf['target'])
 for record in sign['detachedInputs']:_checkfull(record)
 _claim('signing-attempt.json',{'signingPacket':signpacket,**CLOSED});roles={};signed_states=[]
 try:
  for leaf in sign['leaves']:
   _signpacket(signpacket);inputs._bound(leaf['target']);commands=[];logs=[];lastout=b'';lasterr=b''
   signed_state=None
   for i,argv in enumerate(leaf['commands'],1):
    if signed_state is not None:_checkfull(signed_state)
    try:command,log,lastout,lasterr=_run(argv,ROOT,'sign-'+leaf['role']+'-'+str(i))
    finally:_quarantine(Path(leaf['target']['path']))
    if signed_state is None:signed_state=_full(Path(leaf['target']['path']))
    else:_checkfull(signed_state)
    commands.append(command);logs.append(log);_signpacket(signpacket)
   signed_states.append(signed_state)
   text=lasterr.decode('utf8')
   for key,value in [('Identifier',leaf['identifier']),('TeamIdentifier','FG5N98FE6W'),('Format','Mach-O thin (arm64)'),('Info.plist','not bound'),('Sealed Resources','none')]:
    _need(re.findall('^'+re.escape(key)+'=(.*)$',text,re.M)==[value],'signed_profile_display_mismatch')
   _need(re.findall(r'flags=(0x[0-9a-f]+)\(runtime\)',text)==['0x10000'] and len(re.findall(r'^CDHash=[a-f0-9]{40}$',text,re.M))==1,'signed_runtime_cdhash_required')
   _need(lastout.lstrip().startswith((b'<?xml',b'<plist')),'explicit_empty_xml_required');inspect_empty_dictionary(lastout)
   artifact=_quarantine(Path(leaf['target']['path']));commandpath=ROOT/(leaf['role']+'-commands.json');_write(commandpath,commands)
   resultpath=ROOT/(leaf['role']+'-result.json');_write(resultpath,{'artifact_after':artifact,'original_before':leaf['sourceArtifact'],'original_after':_binding(Path(leaf['sourceArtifact']['path'])),'results':commands,'profile_matches':True,**CLOSED})
   proof={'signingPacket':signpacket,'compileReceipt':leaf['compileReceipt'],'preparationReceipt':leaf['preparationReceipt']}
   if leaf['role']!='controller':proof['savedCommands']=_binding(commandpath)
   roles[leaf['role']]={'identifier':leaf['identifier'],'artifact':artifact,'resultReceipt':_binding(resultpath),'displayStdout':logs[2]['stdout'],'displayStderr':logs[2]['stderr'],'rawLogs':logs,'provenance':proof}
  _signpacket(signpacket)
  for signed_state in signed_states:_checkfull(signed_state)
  for item in roles.values():
   for key in ('artifact','resultReceipt','displayStdout','displayStderr'):inputs._bound(item[key])
   for logs in item['rawLogs']:
    for bound in logs.values():inputs._bound(bound)
   for bound in item['provenance'].values():inputs._bound(bound,8*1024**2)
  result={'format':'axiom.initial-native-signed-roles/1','roles':roles,'signingPacket':signpacket,**CLOSED};_write(ROOT/'signing-result.json',result);return result
 except BaseException as error:
  _write(ROOT/'signing-failure.json',{'reason':type(error).__name__,'completedRoles':list(roles),**CLOSED});raise
