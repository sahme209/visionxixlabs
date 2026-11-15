"""Pure compiler plan and static diagnostic checks; no compiler/native process."""
from pathlib import Path
import importlib.util,unittest,tempfile,hashlib,json,shutil,sys,signal
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/"scripts"))
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('operational_compile',ROOT/'scripts/governance_operational_compile.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OperationalCompile(unittest.TestCase):
 def plan(self):return m.compile_plan(Path('/usr/bin/cc'),Path('/tools/cargo'),Path('/owned/source'),Path('/owned/native'),Path('/owned/outputs'),Path('/sdk/include/node'))
 def test_complete_joined_plan_has_no_native_output_invocation(self):
  plan=self.plan();self.assertEqual([x['name'] for x in plan],['status-object','publisher-object','operational-daemon','worker','operational-addon','operational-owner'])
  for phase in plan:self.assertIn(phase['argv'][0],['/usr/bin/cc','/tools/cargo']);self.assertNotIn('ldd',phase['argv']);self.assertGreater(phase['maximumSeconds'],0)
  daemon=plan[2]['argv'];self.assertIn('axiom-operational-time',daemon);self.assertIn('axiom-operational-daemon',daemon);self.assertIn('--offline',daemon);self.assertIn('--locked',daemon)
  self.assertIn('-shared',plan[4]['argv']);self.assertIn('-DNAPI_VERSION=8',plan[4]['argv']);self.assertIn('-O0',plan[5]['argv']);self.assertFalse(any('SHA256=' in x for x in plan[5]['argv']))
 def test_corrected_plan_only_preserves_daemon_symbols_and_other_commands(self):
  # Exact reviewed recipe, including all six phase arguments and original limits.
  expected=[{'name': 'status-object', 'argv': ['/usr/bin/cc', '-std=c11', '-Wall', '-Wextra', '-I', '/owned/native', '-O0', '-fPIC', '-pthread', '-c', '/owned/native/time_operational_status.c', '-o', '/owned/outputs/time_operational_status.o'], 'output': '/owned/outputs/time_operational_status.o', 'maximumSeconds': 30, 'runtimeQualified': False, 'installed': False}, {'name': 'publisher-object', 'argv': ['/usr/bin/cc', '-std=c11', '-Wall', '-Wextra', '-I', '/owned/native', '-O0', '-fPIC', '-c', '/owned/native/time_publication.c', '-o', '/owned/outputs/time_publication.o'], 'output': '/owned/outputs/time_publication.o', 'maximumSeconds': 30, 'runtimeQualified': False, 'installed': False}, {'name': 'operational-daemon', 'argv': ['/tools/cargo', '--config', 'profile.release.strip=false', 'rustc', '--locked', '--offline', '--target', 'x86_64-unknown-linux-gnu', '--package', 'clock-bound', '--bin', 'axiom-operational-daemon', '--no-default-features', '--features', 'axiom-operational-time', '--release', '--', '-C', 'link-arg=/owned/outputs/time_operational_status.o', '-C', 'link-arg=/owned/outputs/time_publication.o', '-C', 'link-arg=-Wl,--no-undefined', '-C', 'link-arg=-lpthread', '-C', 'link-arg=-lrt'], 'output': '/owned/outputs/rust/x86_64-unknown-linux-gnu/release/axiom-operational-daemon', 'maximumSeconds': 1500, 'runtimeQualified': False, 'installed': False}, {'name': 'worker', 'argv': ['/usr/bin/cc', '-std=c11', '-Wall', '-Wextra', '-I', '/owned/native', '-O2', '-fPIE', '-pie', '/owned/native/time_worker.c', '/owned/native/time_worker_protocol.c', '/owned/native/time_publication.c', '-o', '/owned/outputs/time_worker'], 'output': '/owned/outputs/time_worker', 'maximumSeconds': 30, 'runtimeQualified': False, 'installed': False}, {'name': 'operational-addon', 'argv': ['/usr/bin/cc', '-std=c11', '-Wall', '-Wextra', '-I', '/owned/native', '-O0', '-DNAPI_VERSION=8', '-DNODE_GYP_MODULE_NAME=axiom_operational', '-I', '/sdk/include/node', '-fPIC', '-shared', '-pthread', '/owned/native/time_operational_binding.c', '/owned/native/time_parent_binding.c', '/owned/native/time_worker_protocol.c', '/owned/native/time_publication.c', '/owned/native/time_operational_status.c', '-lrt', '-o', '/owned/outputs/operational.node'], 'output': '/owned/outputs/operational.node', 'maximumSeconds': 30, 'runtimeQualified': False, 'installed': False}, {'name': 'operational-owner', 'argv': ['/usr/bin/cc', '-std=c11', '-Wall', '-Wextra', '-I', '/owned/native', '-O0', '-fPIE', '-pie', '-pthread', '/owned/native/time_operational_owner.c', '/owned/native/time_operational_status.c', '-o', '/owned/outputs/operational-owner-compile-only'], 'output': '/owned/outputs/operational-owner-compile-only', 'maximumSeconds': 30, 'runtimeQualified': False, 'installed': False}]
  self.assertEqual(self.plan(),expected)
 def test_empty_full_daemon_symbol_output_still_refuses(self):
  with self.assertRaisesRegex(ValueError,'operational_symbol_output_limit'):
   m.verify_operational_symbols('',('main','axiom_operational_daemon_initialize','axiom_operational_daemon_publish'),'daemon')
 def test_preserves_refusing_owner_hash_defaults_and_is_not_a_qualified_package(self):
  owner=self.plan()[-1];self.assertFalse(owner['runtimeQualified']);self.assertEqual(owner['installed'],False)
  self.assertNotIn('AXIOM_OPERATIONAL_PROFILE_SHA256',' '.join(owner['argv']))
 def test_node_api_import_check_distinguishes_host_imports_from_missing_native_symbols(self):
  used={'napi_create_function','napi_get_cb_info'}
  text='                 U napi_create_function\n                 U napi_get_cb_info\n                 U close@GLIBC_2.2.5\n                 w __gmon_start__\n'
  self.assertEqual(m.validate_addon_imports(text,used),{'napi_create_function','napi_get_cb_info'})
  for bad in [text+'                 U axiom_operational_daemon_publish\n',text+'                 U napi_unreviewed_host_call\n',text+'                 U external_unknown\n',text+'                 T malicious_definition\n']:
   with self.assertRaises(ValueError):m.validate_addon_imports(bad,used)
 def test_symbol_output_truncation_duplicate_and_missing_host_api_refuse(self):
  for text in ['', ' U napi_create_function\n U napi_create_function\n',' U napi_create_function\x00\n',' U napi_create_function\n'+' '*262144]:
   with self.assertRaises(ValueError):m.validate_addon_imports(text,{'napi_create_function','napi_get_cb_info'})
 def test_feature_tree_must_select_only_operational_daemon_without_strict_evaluation(self):
  m.validate_operational_features('clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) axiom-operational-time,daemon,tracing-subscriber\nlibc v0.2.176 default,std\n')
  for features in ['daemon','axiom-operational-time,daemon','axiom-host-evaluation,axiom-operational-time,daemon','algorithm,axiom-operational-time,daemon']:
   with self.assertRaises(ValueError):m.validate_operational_features('clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) '+features+'\n')
 def test_actual_operational_feature_includes_the_daemon_implicit_optional_dependency(self):
  # Current pinned daemon feature uses the bare optional dependency rather than dep:.
  from governance_host_evaluation_inputs import evaluation_files
  cargo=evaluation_files(ROOT)['clock-bound/Cargo.toml'].decode()
  self.assertIn('"tracing-subscriber",',cargo)
  m.validate_operational_features('clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) axiom-operational-time,daemon,tracing-subscriber\n')
 def test_existing_real_elf_header_requires_current_linux_x64_kind(self):
  proof=json.loads((ROOT/'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-SYMBOL-FORMAT-PRIMARY-EVIDENCE.json').read_text())
  elf=proof['elfHeader'];m.validate_operational_elf(elf,'daemon')
  for broken in [elf.replace('ELF64','ELF32'),elf.replace('little endian','big endian'),elf.replace('Advanced Micro Devices X86-64','AArch64'),elf.replace('DYN (Position-Independent Executable file)','REL (Relocatable file)')]:
   with self.assertRaises(ValueError):m.validate_operational_elf(broken,'daemon')
  with self.assertRaises(ValueError):m.validate_operational_elf(elf,'addon')
 def test_native_host_call_inventory_is_source_bound_not_an_arbitrary_napi_prefix(self):
  import re
  names=set()
  for name in ['time_operational_binding.c','time_parent_binding.c']:
   names.update(re.findall(r'\b(napi_[a-z0-9_]+)\s*\(', (ROOT/'packages/verified-issuer-runtime/linux'/name).read_text()))
  self.assertEqual(names,m.NODE_API_IMPORTS);self.assertEqual(len(names),31)
 def test_preparation_gate_refuses_before_host_effects(self):
  with self.assertRaises(ValueError):m.validate_event({},'pull_request','1')
class OperationalMaterialization(unittest.TestCase):
 def test_materializes_actual_closed_tree_and_native_inputs_without_running_output(self):
  with tempfile.TemporaryDirectory() as d:
   result=m.prepare_sources(ROOT,Path(d)/'assembly')
   self.assertEqual(len(result['sourceManifest']),327);self.assertEqual(result['rustModules'],172)
   for name,item in result['sourceManifest'].items():
    data=(Path(result['sourceRoot'])/name).read_bytes();self.assertEqual(hashlib.sha256(data).hexdigest(),item['sha256'])
   self.assertTrue((Path(result['nativeRoot'])/'runtime_profile.h').is_file())
   self.assertFalse(result['nativeCompiled']);self.assertFalse(result['qualified'])
   with self.assertRaises(ValueError):m.prepare_sources(ROOT,Path(d)/'assembly')
 def test_changed_native_input_refuses_before_creating_output(self):
  with tempfile.TemporaryDirectory() as d:
   shadow=Path(d)/'repo';shadow.mkdir();dest=Path(d)/'assembly'
   report=ROOT/'docs/recovery/2026-11-15/operational-source-assembly/SOURCE-ASSEMBLY-RESULT.json'
   inputs=json.loads(report.read_text())['sourceInputSha256']
   for name in [*inputs,'docs/recovery/2026-11-15/operational-source-assembly/SOURCE-ASSEMBLY-RESULT.json','docs/recovery/2026-11-15/operational-source-assembly/ASSEMBLED-RUST-SOURCE.json','docs/recovery/2026-11-15/operational-source-assembly/audit.py']:
    target=shadow/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,target)
   p=shadow/'packages/verified-issuer-runtime/linux/time_operational_owner.c';p.write_text(p.read_text()+'\n/* changed */\n')
   with self.assertRaises(ValueError):m.prepare_sources(shadow,dest)
   self.assertFalse(dest.exists())
class CompilerPhaseOwnership(unittest.TestCase):
 def fixture(self,root,clock,result=None):
  calls=[]
  def supervisor(argv,**kw):
   calls.append((argv,kw));kw['stdout_path'].write_bytes(b'ok\n');kw['stderr_path'].write_bytes(b'')
   return result or {'status':'success','returncode':0,'cleanup_confirmed':True,'stdout_bytes':3,'stderr_bytes':0}
  return m.CompileContext(root,{'/usr/bin/cc'},lambda:None,supervisor,lambda:clock[0]),calls
 def test_exact_phase_once_and_no_governance_output_execution(self):
  with tempfile.TemporaryDirectory() as d:
   context,calls=self.fixture(Path(d),[0.]);self.assertEqual(context.run('owner-compile',['/usr/bin/cc','-c','fixed.c'],30),'ok\n')
   with self.assertRaises(ValueError):context.run('owner-compile',['/usr/bin/cc','fixed.c'],30)
   self.assertEqual(len(calls),1)
  with tempfile.TemporaryDirectory() as d:
   context,calls=self.fixture(Path(d),[0.])
   with self.assertRaises(ValueError):context.run('owner-run',['/owned/outputs/operational-owner-compile-only'],30)
   self.assertEqual(calls,[])
 def test_failure_or_unknown_cleanup_stops_all_following_commands_and_keeps_result(self):
  for status,clean in [('exit_nonzero',True),('cleanup_unknown',False),('terminated',True)]:
   with tempfile.TemporaryDirectory() as d:
    context,calls=self.fixture(Path(d),[0.],{'status':status,'returncode':1,'cleanup_confirmed':clean,'stdout_bytes':3,'stderr_bytes':0})
    with self.assertRaises(ValueError):context.run('first',['/usr/bin/cc'],30)
    self.assertEqual(context.records[0]['result']['status'],status)
    with self.assertRaises(ValueError):context.run('next',['/usr/bin/cc'],30)
    self.assertEqual(len(calls),1)
 def test_whole_deadline_and_late_cleanup_cannot_become_success(self):
  with tempfile.TemporaryDirectory() as d:
   clock=[0.];context,calls=self.fixture(Path(d),clock);clock[0]=2400.
   with self.assertRaises(ValueError):context.run('late',['/usr/bin/cc'],30)
   self.assertEqual(calls,[])
  with tempfile.TemporaryDirectory() as d:
   clock=[0.];context,calls=self.fixture(Path(d),clock);original=context.supervisor
   def late(*a,**kw):
    result=original(*a,**kw);clock[0]=2401.;return result
   context.supervisor=late
   with self.assertRaises(ValueError):context.run('late-result',['/usr/bin/cc'],30)
   self.assertEqual(len(context.records),1);self.assertTrue(context.retired)
 def test_source_recheck_failure_retains_original_command_outcome(self):
  with tempfile.TemporaryDirectory() as d:
   context,calls=self.fixture(Path(d),[0.]);checks=[0]
   def verify():
    checks[0]+=1
    if checks[0]>1:raise ValueError('changed')
   context.verify=verify
   with self.assertRaises(ValueError):context.run('compile',['/usr/bin/cc'],30)
   self.assertEqual(context.records[0]['result']['status'],'success');self.assertTrue(context.retired)
 def test_verification_time_cannot_extend_the_shared_command_deadline(self):
  with tempfile.TemporaryDirectory() as d:
   clock=[0.];context,calls=self.fixture(Path(d),clock)
   context.verify=lambda:clock.__setitem__(0,2400.)
   with self.assertRaises(ValueError):context.run('expired-before-spawn',['/usr/bin/cc'],30)
   self.assertEqual(calls,[])
 def test_signal_handlers_restore_without_permitting_another_phase(self):
  with tempfile.TemporaryDirectory() as d:
   context,calls=self.fixture(Path(d),[0.]);old={sig:signal.getsignal(sig) for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP)}
   with context:
    with self.assertRaises(BaseException):signal.getsignal(signal.SIGINT)(signal.SIGINT,None)
   self.assertEqual({sig:signal.getsignal(sig) for sig in old},old)
   with self.assertRaises(ValueError):context.run('after-cancel',['/usr/bin/cc'],30)
   self.assertEqual(calls,[])
class RegistryClosure(unittest.TestCase):
 def test_unlocked_or_outside_registry_metadata_refuses_without_reading_it(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();(root/'registry/src').mkdir(parents=True);source=root/'workspace';source.mkdir()
   for package in [{'name':'outside','version':'1','source':None,'manifest_path':'/unrelated/Cargo.toml'},{'name':'outside','version':'1','source':'git+https://evil.test/repo','manifest_path':'/unrelated/Cargo.toml'}]:
    with self.assertRaises(ValueError):m.freeze_registry_sources({'packages':[package]},b'version = 4\n',root,lambda *args:None,source)
 def test_selected_registry_archive_matches_its_named_locked_checksum(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();source=root/'workspace';source.mkdir();directory=root/'registry/src/index/fixture-1.0.0';directory.mkdir(parents=True);(directory/'Cargo.toml').write_text('[package]\nname="fixture"\nversion="1.0.0"\n')
   archive=root/'registry/cache/index/fixture-1.0.0.crate';archive.parent.mkdir(parents=True);archive.write_bytes(b'synthetic archive bytes, not executable code');digest=hashlib.sha256(archive.read_bytes()).hexdigest()
   lock=('version = 4\n[[package]]\nname = "fixture"\nversion = "1.0.0"\nsource = "registry+https://github.com/rust-lang/crates.io-index"\nchecksum = "'+digest+'"\n').encode()
   def freeze(path,expected=None):
    if expected is not None and hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError('changed')
   package={'name':'fixture','version':'1.0.0','source':'registry+https://github.com/rust-lang/crates.io-index','manifest_path':str(directory/'Cargo.toml'),'license':'MIT'}
   self.assertEqual(m.freeze_registry_sources({'packages':[package]},lock,root,freeze,source)[0]['archiveSha256'],digest)
   archive.write_bytes(b'changed')
   with self.assertRaises(ValueError):m.freeze_registry_sources({'packages':[package]},lock,root,freeze,source)
class PreparedEventGate(unittest.TestCase):
 def event(self):return {'action':'synchronize','number':337,'before':'a'*40,'after':'b'*40,'repository':{'full_name':'sahme209/visionxixlabs','private':False},'pull_request':{'number':337,'base':{'ref':'main','repo':{'full_name':'sahme209/visionxixlabs'}},'head':{'ref':'codex/governance-operational-package','sha':'b'*40,'repo':{'full_name':'sahme209/visionxixlabs'}}}}
 def test_valid_synthetic_event_does_not_grant_any_real_preparation_approval(self):
  original=m.OWNER_DECISION
  with patch.multiple(m,APPROVED_PR=337,APPROVED_BEFORE='a'*40,OWNER_DECISION='call_synthetic_test_only'):
   self.assertEqual(m.validate_event(self.event(),'pull_request','1'),'b'*40)
  self.assertEqual(m.OWNER_DECISION,original)
 def test_malformed_context_forks_retry_and_wrong_head_refuse(self):
  with patch.multiple(m,APPROVED_PR=337,APPROVED_BEFORE='a'*40,OWNER_DECISION='call_synthetic_test_only'):
   events=[self.event() for _ in range(7)];events[0]['pull_request']=None;events[1]['repository']['private']=True;events[2]['pull_request']['head']['repo']['full_name']='foreign/fork';events[3]['after']='c'*40;events[4]['before']='d'*40;events[5]['pull_request']['base']['ref']='develop';events[6]['pull_request']['head']=[]
   for event in events:
    with self.assertRaises(ValueError):m.validate_event(event,'pull_request','1')
   with self.assertRaises(ValueError):m.validate_event(self.event(),'pull_request','2')
class ReceiptConsistency(unittest.TestCase):
 def test_oversized_receipt_cannot_leave_a_true_local_result(self):
  result=json.loads(m.primary_receipt({'accepted':True,'detail':'x'*(1024*1024)}));self.assertFalse(result['accepted']);self.assertEqual(result['errorCategory'],'compiler_receipt_limit')
 def test_normal_compiler_scope_stays_explicit_in_the_primary_receipt(self):
  result=json.loads(m.primary_receipt({'accepted':True,'nativeRuntimeExecuted':False,'scope':'compiler-only'}));self.assertEqual(result['scope'],'compiler-only');self.assertTrue(result['accepted'])
class SourceTopology(unittest.TestCase):
 def test_added_file_replaced_directory_and_symlink_are_detected(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'src').mkdir();(root/'src/main.rs').write_text('fixed')
   snapshot=m.source_topology(root)
   (root/'extra.rs').write_text('extra')
   with self.assertRaises(ValueError):m.verify_topology(root,snapshot)
   (root/'extra.rs').unlink();m.verify_topology(root,snapshot)
   (root/'src/main.rs').unlink();(root/'src').rmdir();(root/'src').symlink_to('/tmp')
   with self.assertRaises(ValueError):m.verify_topology(root,snapshot)
 def test_dynamic_search_paths_and_unknown_libraries_refuse(self):
  base=' 0x0000000000000001 (NEEDED) Shared library: [libc.so.6]\n'
  self.assertEqual(m.validate_dynamic_libraries(base),['libc.so.6'])
  for suffix in [' 0x1 (RUNPATH) Library runpath: [/tmp]\n',' 0x1 (RPATH) Library rpath: [/tmp]\n',' 0x1 (NEEDED) Shared library: [libunknown.so]\n']:
   with self.assertRaises(ValueError):m.validate_dynamic_libraries(base+suffix)
 def test_artifact_identity_binds_exact_bytes(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'artifact';path.write_bytes(b'synthetic ELF fixture, never executed')
   evidence=m.artifact_identity(path)
   self.assertEqual(evidence['bytes'],path.stat().st_size);self.assertEqual(evidence['sha256'],hashlib.sha256(path.read_bytes()).hexdigest())
class WholeControllerPreparation(unittest.TestCase):
 def test_complete_packet_detects_source_change_and_matches_enrolled_approval(self):
  files={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in m.packet_inputs(ROOT)}
  packet={'format':'axiom.operational-compiler-preparation/1','approval':{'pr':m.APPROVED_PR,'before':m.APPROVED_BEFORE,'ownerDecision':m.OWNER_DECISION},'files':files}
  m.verify_packet(ROOT,json.dumps(packet))
  files['scripts/governance_operational_compile.py']='0'*64
  with self.assertRaises(ValueError):m.verify_packet(ROOT,json.dumps(packet))
  self.assertIn("github.event.before == '"+m.APPROVED_BEFORE+"'",(ROOT/'.github/workflows/linux-operational-compile.yml').read_text())
 def test_closed_main_refuses_before_reading_host_context(self):
  import io,contextlib
  with patch.multiple(m,APPROVED_PR=None,APPROVED_BEFORE=None,OWNER_DECISION=None),patch.object(sys,'argv',['fixed','--approved-ci-once']),patch.object(m,'_read_regular',side_effect=AssertionError('unexpected read')),contextlib.redirect_stdout(io.StringIO()) as out:
   self.assertEqual(m.main(),1)
  self.assertEqual(json.loads(out.getvalue())['errorCategory'],'native_compile_not_approved')
 def test_joined_commands_are_fixed_order_restricted_and_failure_stops(self):
  for fail in (False,True):
   with tempfile.TemporaryDirectory() as d:
    root=Path(d).resolve();source=root/'source';source.mkdir();(source/'Cargo.lock').write_bytes(b'fixed lock');native=root/'native';native.mkdir();calls=[]
    class FakeContext:
     def __init__(self):self.root=root
     def run(self,name,argv,maximum,**kwargs):
      calls.append((name,argv,kwargs))
      if name=='locked-fetch':return ''
      if name=='locked-metadata':return '{"packages":[]}'
      if name=='operational-features':return 'clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) axiom-operational-time,daemon,tracing-subscriber\n'
      if name=='status-object' and fail:raise ValueError('synthetic failure')
      if '-o' in argv:Path(argv[argv.index('-o')+1]).write_bytes(b'fixed synthetic object')
      return ''
    tools={'cc':Path('/usr/bin/cc'),'cargo':Path('/tools/cargo')};env={'CARGO_HOME':str(root/'cargo')};assembly={'sourceRoot':str(source),'nativeRoot':str(native)}
    with patch.object(m,'freeze_registry_sources',return_value=[]),patch.object(m,'inspect_artifact',return_value={'runtimeExecuted':False}),patch('governance_build_ipc_compile.header_dependencies',return_value={}):
     if fail:
      with self.assertRaises(ValueError):m.compile_joined(FakeContext(),ROOT,assembly,tools,Path('/sdk'),env,Path('/launcher'),lambda *args:None)
      self.assertEqual(calls[-1][0],'status-object')
     else:
      result=m.compile_joined(FakeContext(),ROOT,assembly,tools,Path('/sdk'),env,Path('/launcher'),lambda *args:None)
      self.assertFalse(result['governanceEnabled']);self.assertFalse(result['nativeRuntimeExecuted'])
      self.assertEqual([name for name,_,_ in calls if name in [x['name'] for x in self_plan(tools,source,native,root)]],['status-object','publisher-object','operational-daemon','worker','operational-addon','operational-owner'])
    self.assertNotIn('launcher',calls[0][2])
    self.assertTrue(all(kw.get('launcher')==Path('/launcher') for _,_,kw in calls[1:]))
def self_plan(tools,source,native,root):return m.compile_plan(tools['cc'],tools['cargo'],source,native,root/'outputs',Path('/sdk'))
class ReviewRegressions(unittest.TestCase):
 def test_sigint_during_deferred_popen_handoff_keeps_supervisor_ownership(self):
  with tempfile.TemporaryDirectory() as d:
   context,_=CompilerPhaseOwnership().fixture(Path(d),[0.]);pending=[]
   def deferred(signum,frame):pending.append(signum)
   with patch('signal.getsignal',return_value=deferred):context._forward(signal.SIGINT,None)
   self.assertEqual(pending,[signal.SIGTERM]);self.assertTrue(context.cancelled)
 def test_full_daemon_symbols_above_256k_are_checked_without_truncation(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'daemon';path.write_bytes(b'synthetic artifact')
   elf=json.loads((ROOT/m.TOOL_PROOF).read_text())['elfHeader']
   symbols='00000001 T unrelated_rust_symbol\n'*10000+'00000002 T main\n00000003 T axiom_operational_daemon_initialize\n00000004 T axiom_operational_daemon_publish\n'
   class Context:
    def run(self,name,*args,**kw):
     if name.endswith('-elf'):return elf
     if name.endswith('-symbols'):return symbols
     return ' 0x1 (NEEDED) Shared library: [libc.so.6]\n'
   result=m.inspect_artifact(Context(),{'name':'operational-daemon','output':str(path)},{'nm':'/nm','readelf':'/readelf'},{},Path('/launcher'),lambda *args:None)
   self.assertEqual(len(result['requiredSymbols']),3)
 def test_symbol_policy_still_refuses_oversize_missing_duplicate_and_wrong_type(self):
  good='00000001 T main\n'
  for bad in [good+'x'*(16*1024*1024),'00000001 D main\n',good+good,'00000001 T other\n']:
   with self.assertRaises(ValueError):m.verify_operational_symbols(bad,('main',),'daemon')
 def test_failed_phase_retains_diagnostic_content_and_identity(self):
  with tempfile.TemporaryDirectory() as d:
   context,_=CompilerPhaseOwnership().fixture(Path(d),[0.])
   def failed(argv,**kw):
    kw['stdout_path'].write_bytes(b'');kw['stderr_path'].write_bytes(b'synthetic compiler error\n')
    return {'status':'exit_nonzero','returncode':1,'cleanup_confirmed':True,'stdout_bytes':0,'stderr_bytes':25}
   emitted=[];context.emit=emitted.append;context.supervisor=failed
   with self.assertRaises(ValueError):context.run('failed',['/usr/bin/cc'],30)
   self.assertEqual(json.loads(m.primary_receipt({'accepted':False,'records':emitted}))['records'],context.records)
   diagnostic=context.records[0]['diagnostics']['stderr']
   self.assertEqual(diagnostic['text'],'synthetic compiler error\n');self.assertEqual(diagnostic['sha256'],hashlib.sha256(b'synthetic compiler error\n').hexdigest())
 def test_successful_warning_is_retained_before_postcheck(self):
  with tempfile.TemporaryDirectory() as d:
   context,_=CompilerPhaseOwnership().fixture(Path(d),[0.]);emitted=[];context.emit=emitted.append
   def warned(argv,**kw):
    kw['stdout_path'].write_bytes(b'ok\n');kw['stderr_path'].write_bytes(b'warning: synthetic\n')
    return {'status':'success','returncode':0,'cleanup_confirmed':True}
   context.supervisor=warned;context.run('warned',['/usr/bin/cc'],30)
   self.assertEqual(emitted[0]['diagnostics']['stderr']['text'],'warning: synthetic\n')
 def test_diagnostic_prefix_is_explicitly_bounded_and_binds_the_complete_stream(self):
  raw=b'warning\n'*10000;result=m.diagnostic_evidence(raw,16*1024)
  self.assertTrue(result['truncated']);self.assertLessEqual(len(result['text'].encode()),16*1024);self.assertEqual(result['bytes'],len(raw));self.assertEqual(result['sha256'],hashlib.sha256(raw).hexdigest())
 def test_existing_or_symlink_root_is_never_claimed_for_result_writes(self):
  import io,os,contextlib
  for symlink in (False,True):
   with tempfile.TemporaryDirectory() as d:
    temporary=Path(d).resolve();existing=temporary/'axiom-operational-compiler-once';outside=temporary/'outside';outside.mkdir()
    if symlink:existing.symlink_to(outside,target_is_directory=True)
    else:existing.mkdir()
    event=temporary/'event.json';event.write_text('{}')
    env={'RUNNER_TEMP':str(temporary),'GITHUB_EVENT_PATH':str(event),'GITHUB_EVENT_NAME':'pull_request','GITHUB_RUN_ATTEMPT':'1','AXIOM_PR_HEAD_SHA':'b'*40,'RUNNER_OS':'Linux','RUNNER_ARCH':'X64'}
    with patch.multiple(m,APPROVED_PR=337,APPROVED_BEFORE='a'*40,OWNER_DECISION='call_synthetic_test_only'),patch.object(m,'verify_packet',return_value={}),patch.object(m,'validate_event',return_value='b'*40),patch.object(sys,'argv',['fixed','--approved-ci-once']),patch.dict(os.environ,env,clear=True),contextlib.redirect_stdout(io.StringIO()):
     self.assertEqual(m.main(),1)
    self.assertFalse((existing/'RESULT.json').exists());self.assertFalse((outside/'RESULT.json').exists())
class ApprovedEnrollment(unittest.TestCase):
 def test_exact_owner_decision_and_before_head_are_enrolled(self):
  self.assertEqual((m.APPROVED_PR,m.APPROVED_BEFORE,m.OWNER_DECISION),(337,'35b88cba5aae932aa53f9aa08bc87810a1ce0697','call_53b0ce938750472db5f024371d7db8ce'))
  event=PreparedEventGate().event();event['before']=m.APPROVED_BEFORE
  self.assertEqual(m.validate_event(event,'pull_request','1'),'b'*40)
  with self.assertRaises(ValueError):m.validate_event(event,'pull_request','2')
 def test_workflow_enforces_the_exact_public_same_repo_transition(self):
  workflow=(ROOT/'.github/workflows/linux-operational-compile.yml').read_text()
  for required in ["github.repository == 'sahme209/visionxixlabs'",'github.event.repository.private == false',"github.event.action == 'synchronize'",'github.event.number == 337','github.event.pull_request.number == 337',"github.event.pull_request.base.ref == 'main'",'github.event.pull_request.base.repo.full_name == github.repository','github.event.pull_request.head.repo.full_name == github.repository',"github.event.pull_request.head.ref == 'codex/governance-operational-package'","github.event.before == '35b88cba5aae932aa53f9aa08bc87810a1ce0697'",'github.event.after == github.event.pull_request.head.sha','github.run_attempt == 1','runs-on: ubuntu-24.04','timeout-minutes: 42','persist-credentials: false','contents: read']:
   self.assertIn(required,workflow)
  self.assertNotIn('workflow_dispatch',workflow);self.assertEqual(workflow.count('run: python3 scripts/governance_operational_compile.py --approved-ci-once'),1)
if __name__=='__main__':unittest.main()
