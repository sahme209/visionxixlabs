"""Pure controller tests: synthetic fixtures only; no child/native/SDK reads."""
import importlib.util,sys,json,hashlib,tempfile,unittest,ast
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts'))
SPEC=importlib.util.spec_from_file_location('native_time_behavior_controller',ROOT/'scripts/governance_native_time_behavior.py')
c=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(c)
HEAD='a'*40;REPO='sahme209/visionxixlabs'
def event():return {'action':'opened','number':334,'repository':{'full_name':REPO,'private':False},'pull_request':{'number':334,'base':{'ref':'main','repo':{'full_name':REPO}},'head':{'ref':'codex/governance-native-time-behavior','sha':HEAD,'repo':{'full_name':REPO}}}}
class BehaviorController(unittest.TestCase):
 def refuse(self,fn,*args):
  with self.assertRaises(Exception):fn(*args)
 def test_exact_branch_open_event(self):self.assertEqual(c.validate_event(event(),'pull_request','1'),HEAD)
 def test_no_sync_rerun_or_foreign_coordinates(self):
  for path,value in [(('action',),'synchronize'),(('number',),335),(('repository','private'),True),(('repository','full_name'),'x/y'),(('pull_request','head','ref'),'codex/other'),(('pull_request','head','repo','full_name'),'x/y'),(('pull_request','base','ref'),'dev'),(('pull_request','base','repo','full_name'),'x/y'),(('pull_request','number'),0)]:
   with self.subTest(path=path):
    e=event();d=e
    for key in path[:-1]:d=d[key]
    d[path[-1]]=value;self.refuse(c.validate_event,e,'pull_request','1')
  self.refuse(c.validate_event,event(),'pull_request','2');self.refuse(c.validate_event,event(),'workflow_dispatch','1')
 def test_result_is_closed_and_honest(self):
  data={'format':'axiom-native-time-behavior-v1','cases':['joined','replacement','cancellation','foreign'],'accepted':True,'timeAuthority':False}
  c.validate_result(json.dumps(data)+'\n')
  for key,value in [('accepted',False),('timeAuthority',True),('cases',['joined']),('unexpected',True)]:
   bad=dict(data);bad[key]=value;self.refuse(c.validate_result,json.dumps(bad))
  self.refuse(c.validate_result,json.dumps(data)+'\n'+json.dumps(data))
 def test_critical_compiler_diagnostics_refuse(self):
  for body in [b'warning: implicit declaration of function',b'error: incompatible pointer type',b'warning: integer to pointer conversion',b'warning: return type mismatch',b'warning: unknown type name napi_env']:
   self.refuse(c.check_compiler_warnings,body)
  c.check_compiler_warnings(b'warning: misleading indentation\n')
 def test_identity_header_uses_only_numbers(self):
  text=c.identity_header({'root':(1,2),'worker':(3,4,100),'stall':(5,6,200)})
  for macro,value in [('ROOT_DEV',1),('ROOT_INO',2),('WORKER_SIZE',100),('STALL_SIZE',200)]:self.assertIn('#define '+macro+' '+str(value),text)
  self.assertNotIn('/owned',text);self.refuse(c.identity_header,{'root':(-1,2),'worker':(3,4,100),'stall':(5,6,200)})
 def test_packet_closed_set(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);files={}
   for name in c.REQUIRED_INPUTS:
    p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('test '+name);files[name]=hashlib.sha256(p.read_bytes()).hexdigest()
   packet=root/c.PACKET;packet.parent.mkdir(parents=True,exist_ok=True);data={'kind':c.KIND,'event':'opened','branch':c.BRANCH,'files':files};packet.write_text(json.dumps(data));frozen=packet.read_bytes()
   c.verify_packet(root,frozen)
   target=root/sorted(files)[0];target.write_text('mutated');self.refuse(c.verify_packet,root,frozen)
 def test_fixed_failure_categories_retained_but_never_accepted(self):
  data={'format':'axiom-native-time-behavior-v1','accepted':False,'error':'fixture_failed','phase':'cancellation','reason':'ready','timeAuthority':False};text=json.dumps(data)
  self.assertEqual(c.native_observation(text),data);self.refuse(c.validate_result,text)
  data['reason']='raw /private/path';self.refuse(c.native_observation,json.dumps(data))
 def test_module_imports_must_have_sdk_declarations(self):
  c.validate_module_imports(' U napi_create_promise\n U close@GLIBC_2.2.5\n w __gmon_start__\n','napi_status napi_create_promise(napi_env env);')
  self.refuse(c.validate_module_imports,' U napi_nonexistent\n','')
  self.refuse(c.validate_module_imports,' U axiom_time_capture_v2\n','')
  self.refuse(c.validate_module_imports,'not a symbol row','')
 def profile(self):
  return {'format':1,'scope':'trusted-fixed-native-behavior-only','target':'linux-x86_64','arch':0xc000003e,'defaultAction':'allow-trusted-source','defaultErrno':1,'clone3Flags':'source-trusted-not-inspected','deniedSyscalls':['socket','setsid'],'instructions':[{'code':6,'jt':0,'jf':0,'k':0x7fff0000}]}
 def test_actual_profile_instruction_wire_digest(self):
  import struct
  data=self.profile();result=c.validate_runtime_description(json.dumps(data),'#define AXIOM_RUNTIME_DENIED_SYSCALLS(X) X(socket) X(setsid)\n\n')
  self.assertEqual(result['programSha256'],hashlib.sha256(struct.pack('<HBBI',6,0,0,0x7fff0000)).hexdigest())
 def test_profile_closed_fields_and_program_bounds(self):
  header='#define AXIOM_RUNTIME_DENIED_SYSCALLS(X) X(socket) X(setsid)\n\n'
  for field,value in [('scope','production'),('clone3Flags','qualified'),('deniedSyscalls',['socket']),('arch',0),('instructions',[]),('extra',True)]:
   data=self.profile();data[field]=value;self.refuse(c.validate_runtime_description,json.dumps(data),header)
  for value in [-1,True,4294967296]:
   data=self.profile();data['instructions'][0]['k']=value;self.refuse(c.validate_runtime_description,json.dumps(data),header)
 def test_main_guards_precede_helper_imports_and_one_node_case(self):
  tree=ast.parse((ROOT/'scripts/governance_native_time_behavior.py').read_text());main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
  first_verify=min(n.lineno for n in ast.walk(main) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='verify_packet')
  for node in main.body:
   if isinstance(node,ast.ImportFrom):self.assertGreater(node.lineno,first_verify)
  calls=[n for n in ast.walk(main) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='run' and n.args and isinstance(n.args[0],ast.Constant) and n.args[0].value=='native-four-cases']
  self.assertEqual(len(calls),1);self.assertIn("'--'",ast.unparse(calls[0].args[1]));self.assertEqual(next(k.value.value for k in calls[0].keywords if k.arg=='maximum'),10)
 def test_workflow_one_opened_free_job(self):
  text=(ROOT/'.github/workflows/linux-native-time-behavior.yml').read_text()
  for value in ['types: [opened]','runs-on: ubuntu-24.04','timeout-minutes: 15','contents: read','persist-credentials: false','github.run_attempt == 1','codex/governance-native-time-behavior',"github.event.number == github.event.pull_request.number",'--approved-ci-once']:self.assertIn(value,text)
  for forbidden in ['workflow_dispatch','synchronize','matrix:','upload-artifact','setup-node','npm install']:self.assertNotIn(forbidden,text)
if __name__=='__main__':unittest.main()
