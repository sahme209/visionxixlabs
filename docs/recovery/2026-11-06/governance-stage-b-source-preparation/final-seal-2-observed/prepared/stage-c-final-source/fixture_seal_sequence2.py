"""Fixed current v3 seal tool adapter; explicit invocation still needs approval.
Legacy v2 executor and v3 post-seal validator remain unchanged.
"""
from pathlib import Path
import os,selectors,signal,subprocess,time
from . import fixture_final_seal as validator,container_preparation as cp,system_preparation as prep,manifest
DESTINATION=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-image-2/assembled')
APP=DESTINATION/'Axiom Synthetic Custodian.app'
OUTPUT=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-final-seal-2')
BASELINE=OUTPUT/'fixture-seal-baseline.json'
PRESEAL=DESTINATION/'fixture-container-assembly.json'
REVIEW_ROOT=OUTPUT.with_name('2026-11-06-stage-b-package-review-2')
TARGET_REVIEW=REVIEW_ROOT/'final-target.json'
SOURCE_REVISION='b8b0314c39324ba3a918fd0f6672faf0297c2041'
FINAL_TARGET_REVIEW_SHA256='f7d1709fb16b2a24a39aa1523929d440dea81a1d3837da4e16bc7a172a7b4d09'
MAIN_SHA='b3a4f59e49b2f8a172a9071a16fbcb6c0b829f8eb2cbe53c7ca6d426dbe155d8'
MAIN_SIZE=16856
EMPTY_SHA='97704a8960b4facceef54397a08fb5d0a456247c3627359215aa2a27df22656c'
KEY='4C2E59F247CA275001586AE020A9269464529452'
CAP=65536
TIMEOUTS={'sign':60,'verify':30,'display':30}
_need=validator._need
def _write(path,value):prep._write(path,manifest.canonical(value)+b'\n')
def commands():
 return {'sign':['/usr/bin/codesign','--force','--sign',KEY,'--identifier',cp.MAIN_IDENTIFIER,'--options','runtime','--entitlements',str(OUTPUT/'empty-entitlements.plist'),'--timestamp=none',str(APP)],'verify':['/usr/bin/codesign','--verify','--strict','--verbose=2',str(APP)],'display':['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',str(APP)]}

def _run(kind):
 _need(kind in TIMEOUTS,'fixed_codesign_command_required');argv=commands()[kind];seconds=TIMEOUTS[kind]
 _need(signal.getsignal(signal.SIGCHLD)==signal.SIG_DFL,'exclusive_image_child_reaping_required')
 p=None;selector=None;data={'stdout':bytearray(),'stderr':bytearray()};state='completed';error=None;start=time.monotonic()
 try:
  p=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','LC_ALL':'C'})
  selector=selectors.DefaultSelector()
  for name,pipe in (('stdout',p.stdout),('stderr',p.stderr)):os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name)
  while selector.get_map():
   if time.monotonic()-start>=seconds:state='timeout';break
   for key,_ in selector.select(.1):
    remaining=CAP-sum(map(len,data.values()));part=os.read(key.fileobj.fileno(),min(4096,remaining+1))
    if not part:selector.unregister(key.fileobj);continue
    data[key.data].extend(part[:remaining])
    if len(part)>remaining:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   try:p.wait(timeout=max(.001,seconds-(time.monotonic()-start)))
   except subprocess.TimeoutExpired:state='timeout'
 except BaseException as exc:state='monitor_or_launch_error';error=type(exc).__name__
 finally:
  if p is not None and p.returncode is None:
   try:p.kill()
   except ProcessLookupError:pass
   except BaseException as exc:error=error or type(exc).__name__
   try:p.wait(timeout=5)
   except BaseException as exc:error=error or type(exc).__name__
  if p is not None:
   for pipe in (p.stdout,p.stderr):
    try:pipe.close()
    except BaseException as exc:error=error or type(exc).__name__
  if selector is not None:
   try:selector.close()
   except BaseException as exc:error=error or type(exc).__name__
 return {'argv':argv,'state':state,'exit':p.returncode if p is not None else None,'stdout':bytes(data['stdout']),'stderr':bytes(data['stderr']),'cleanup':'reaped_original_child'if p is not None and p.returncode is not None else'unknown','errorType':error}

def prepare_target_review():
 """Pure-file packet preparation after actual unsigned assembly; never key use."""
 pre=validator.assembly.verify_fixture_assembly(DESTINATION)
 _need(pre['sourceRevision']==SOURCE_REVISION,'current_package_source_required')
 cp._private(REVIEW_ROOT.parent);REVIEW_ROOT.mkdir(mode=0o700);cp._private(REVIEW_ROOT)
 value={'format':'axiom.fixed-fixture-seal-target/2','destination':str(DESTINATION),'sourceRevision':SOURCE_REVISION,'presealReceipt':validator.old.binding(PRESEAL),'files':pre['files'],'commands':commands(),'executionAuthorized':False,'installationReady':False,'activationAllowed':False}
 _write(TARGET_REVIEW,value);return validator.old.binding(TARGET_REVIEW)

def _reviewed_target():
 _need(len(FINAL_TARGET_REVIEW_SHA256)==64 and all(c in '0123456789abcdef'for c in FINAL_TARGET_REVIEW_SHA256),'actual_unsigned_review_not_frozen')
 binding=validator.old.binding(TARGET_REVIEW)
 _need(binding['sha256']==FINAL_TARGET_REVIEW_SHA256,'fixed_target_review_changed')
 _need(type(binding)is dict and binding.get('path')==str(TARGET_REVIEW),'fixed_target_review_binding_required')
 value=validator.old._json_bound(binding)
 _need(value.get('format')=='axiom.fixed-fixture-seal-target/2'and value.get('destination')==str(DESTINATION)and value.get('sourceRevision')==SOURCE_REVISION and all(value.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed'))and value.get('commands')==commands(),'fixed_current_target_review_required')
 _need(value['presealReceipt']==validator.old.binding(PRESEAL),'reviewed_preseal_changed')
 pre=validator.old._json_bound(value['presealReceipt']);_need(pre.get('sourceRevision')==SOURCE_REVISION and pre['files']==value['files'],'reviewed_source_inventory_changed');return value

def execute_fixture_sequence(baseline):
 """Consume the existing v3 baseline for this exact reviewed target, once."""
 target_packet=_reviewed_target()
 _need(type(baseline)is dict and baseline.get('path')==str(BASELINE),'fixed_fixture_baseline_path_required');cp._private(OUTPUT)
 b=validator.old._json_bound(baseline);pre=validator.old._json_bound(b['presealReceipt'])
 _need(b.get('format')=='axiom.fixture-seal-baseline/1'and b.get('destination')==str(DESTINATION)and b.get('profile')==validator.fp.PROFILE and b.get('executionAuthorized')is False and b.get('runtimeIdentityQualified')is False,'fixed_fixture_seal_baseline_required')
 _need(b['presealReceipt']['path']==str(PRESEAL)and b['presealReceipt']==target_packet['presealReceipt'] and validator.old.binding(PRESEAL)==b['presealReceipt'],'fixed_fixture_preseal_receipt_required')
 _need(b['emptyInput']['path']==str(OUTPUT/'empty-entitlements.plist')and b['emptyInput']['sha256']==EMPTY_SHA and validator.old.binding(b['emptyInput']['path'])==b['emptyInput'],'fixed_fixture_empty_input_required')
 current=validator.old.binding(APP/validator.MAIN);_need(current['sha256']==MAIN_SHA and current['size']==MAIN_SIZE and b['mainBefore']['sha256']==MAIN_SHA and b['mainBefore']['size']==MAIN_SIZE,'original_fixture_main_required_before_key_use')
 _need(set(b['files'])==set(pre['files'])and len(b['files'])==13 and all(all(b['files'][name][k]==want[k]for k in ('path','sha256','size','mode'))for name,want in pre['files'].items()),'fixed_thirteen_file_baseline_required')
 _need(validator.fixture_seal_commands(baseline)==commands(),'fixed_fixture_seal_commands_required')
 current_assembly=validator.assembly.verify_fixture_assembly(DESTINATION);_need(current_assembly==pre,'current_fixture_assembly_changed_before_key_use')
 for name,before in b['files'].items():_need(validator._metadata(DESTINATION/name)==before,'fixture_baseline_file_changed_before_key_use')
 directories={'.':validator._directory(DESTINATION)}
 for path in DESTINATION.rglob('*'):
  if path.is_dir():directories[path.relative_to(DESTINATION).as_posix()]=validator._directory(path)
 _need(directories==b['directories'],'fixture_baseline_directories_changed_before_key_use')
 _write(OUTPUT/'sequence-attempt.json',{'baseline':baseline,'commands':commands(),'attempts':1,'retryAuthorized':False,'executionAuthorized':False});records={}
 for kind in ('sign','verify','display'):
  _write(OUTPUT/(kind+'-attempt.json'),{'kind':kind,'argv':commands()[kind],'baselineSha256':baseline['sha256'],'attempts':1,'retryAuthorized':False,'executionAuthorized':False})
  result=_run(kind);record={k:v for k,v in result.items()if k not in ('stdout','stderr')};record.update({'format':'axiom.fixture-seal-command/1','kind':kind,'baselineSha256':baseline['sha256']})
  _need(type(result['stdout'])is bytes and type(result['stderr'])is bytes and len(result['stdout'])+len(result['stderr'])<=CAP,'bounded_fixture_tool_streams_required')
  for stream in ('stdout','stderr'):
   path=OUTPUT/(kind+'-'+stream+'.log');prep._write(path,result[stream]);record[stream]=validator.old.binding(path)
  try:record['targetAfter']=validator.old.binding(APP/validator.MAIN)
  except (ValueError,OSError):record['targetAfter']=None
  path=OUTPUT/(kind+'-command.json');_write(path,record);records[kind]=validator.old.binding(path)
  _need(result.get('argv')==commands()[kind]and result.get('state')=='completed'and type(result.get('exit'))is int and result['exit']==0 and result.get('cleanup')=='reaped_original_child'and result.get('errorType')is None,'fixture_seal_tool_failed_unknown_no_retry')
 return records
