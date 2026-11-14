"""Exercise real compiler-controller decisions with synthetic text/files only.
No compiler, project native binary, SDK discovery, subprocess or network runs.
"""
import importlib.util
import json
import hashlib
import ast
from pathlib import Path
import tempfile
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
MODULE=ROOT/'scripts/governance_native_worker_compile.py'
SPEC=importlib.util.spec_from_file_location('native_worker_compile_under_test',MODULE)
controller=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(controller)
BEFORE='048882304e05c4d77ab766f8f2b39db33e676251'
HEAD='a'*40
REPO='sahme209/visionxixlabs'
def event():
 return {'action':'synchronize','number':332,'before':BEFORE,'after':HEAD,
  'repository':{'full_name':REPO,'private':False},'pull_request':{'number':332,
  'base':{'ref':'main','repo':{'full_name':REPO}},
  'head':{'sha':HEAD,'ref':'codex/governance-native-worker','repo':{'full_name':REPO}}}}
def elf(kind='DYN',entry='0x1050'):
 return f'ELF Header:\n  Class: ELF64\n  Machine: Advanced Micro Devices X86-64\n  Type: {kind} (test)\n  Entry point address: {entry}\n'
class NativeWorkerController(unittest.TestCase):
 def refuses(self,fn,*args):
  with self.assertRaises(Exception):fn(*args)
 def test_exact_event(self):
  self.assertEqual(controller.validate_event(event(),'pull_request','1'),HEAD)
 def test_refuses_wrong_event_coordinates(self):
  for path,value in [(('number',),331),(('before',),'b'*40),(('after',),'c'*40),(('action',),'opened'),(('repository','private'),True),(('repository','full_name'),'other/repo'),(('pull_request','number'),331),(('pull_request','base','ref'),'dev'),(('pull_request','base','repo','full_name'),'other/repo'),(('pull_request','head','ref'),'codex/other'),(('pull_request','head','repo','full_name'),'other/repo')]:
   with self.subTest(path=path):
    value_event=event();target=value_event
    for key in path[:-1]:target=target[key]
    target[path[-1]]=value;self.refuses(controller.validate_event,value_event,'pull_request','1')
 def test_refuses_wrong_event_or_rerun(self):
  for name,attempt in [('push','1'),('workflow_dispatch','1'),('pull_request','2'),('pull_request','0')]:
   self.refuses(controller.validate_event,event(),name,attempt)
 def test_worker_compile_is_exact_sources_and_never_launch(self):
  command=controller.worker_command('/usr/bin/cc',ROOT,Path('/owned/worker'))
  self.assertEqual(command[0],'/usr/bin/cc');self.assertIn('-fPIE',command);self.assertIn('-pie',command)
  for filename in ['time_worker.c','time_worker_protocol.c','time_publication.c']:
   self.assertEqual(sum(str(x).endswith('/'+filename) for x in command),1)
  for forbidden in ['sh','bash','-shared','-c','&&',';']:self.assertNotIn(forbidden,command)
  self.assertEqual(command[-2:],['-o','/owned/worker'])
 def test_parent_is_object_only_and_pinned_napi(self):
  command=controller.parent_command('/usr/bin/cc',ROOT,Path('/owned/sdk'),Path('/owned/parent.o'))
  for flag in ['-DNAPI_VERSION=8','-fPIC','-pthread','-c']:self.assertIn(flag,command)
  self.assertEqual(sum(str(x).endswith('/time_parent_binding.c') for x in command),1)
  self.assertFalse(any(str(x).endswith('/time_worker.c') for x in command));self.assertNotIn('-shared',command)
  self.assertEqual(command[-2:],['-o','/owned/parent.o'])
 def test_exact_text_symbols(self):
  controller.verify_symbols('0000000000010000 T expected_a\n0000000000020000 t expected_b\n',['expected_a','expected_b'])
 def test_symbol_negative_shapes(self):
  for text in ['0001 T expected_a_suffix\n0002 T expected_b\n','0001 U expected_a\n0002 T expected_b\n','0001 D expected_a\n0002 T expected_b\n','0001 T expected_a\n0001 T expected_a\n0002 T expected_b\n','0001 T expected_a\n']:
   self.refuses(controller.verify_symbols,text,['expected_a','expected_b'])
 def test_worker_and_parent_elf(self):
  controller.validate_elf(elf(),'worker');controller.validate_elf(elf('EXEC'),'worker')
  controller.validate_elf(elf('REL','0x0'),'parent')
 def test_elf_kind_arch_and_entry_refusals(self):
  for text,kind in [(elf('REL','0x0'),'worker'),(elf('DYN','0x0'),'worker'),(elf('REL','0x10'),'parent'),(elf('DYN','0x10'),'parent'),(elf().replace('ELF64','ELF32'),'worker'),(elf().replace('Advanced Micro Devices X86-64','AArch64'),'worker')]:
   self.refuses(controller.validate_elf,text,kind)
 def sdk(self,root):
  headers=root/'include/node';headers.mkdir(parents=True)
  for name in ['node_api.h','js_native_api.h','js_native_api_types.h','node_api_types.h']:(headers/name).write_text('/* synthetic empty test header */\n')
  (headers/'node_version.h').write_text('#define NODE_MAJOR_VERSION 24\n#define NODE_MINOR_VERSION 22\n#define NODE_PATCH_VERSION 2\n')
  return headers
 def test_synthetic_sdk(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);headers=self.sdk(root);result=controller.validate_sdk(headers);self.assertEqual(result["version"],"24.22.2");self.assertEqual(set(result["headers"]),{"node_api.h","js_native_api.h","js_native_api_types.h","node_api_types.h","node_version.h"})
 def test_sdk_directory_symlink(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);headers=self.sdk(root);alias=root/'alias';alias.symlink_to(headers,target_is_directory=True)
   self.refuses(controller.validate_sdk,alias)
 def test_sdk_missing_wrong_version_symlink_oversize(self):
  for fault in ['missing','version','symlink','oversize']:
   with self.subTest(fault=fault),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);headers=self.sdk(root)
    if fault=='missing':(headers/'node_api.h').unlink()
    if fault=='version':(headers/'node_version.h').write_text('#define NODE_MAJOR_VERSION 24\n#define NODE_MINOR_VERSION 22\n#define NODE_PATCH_VERSION 1\n')
    if fault=='symlink':
     (headers/'node_api.h').unlink();(headers/'node_api.h').symlink_to(headers/'js_native_api.h')
    if fault=='oversize':(headers/'node_api.h').write_bytes(b'x'*(2*1024*1024+1))
    self.refuses(controller.validate_sdk,headers)
 def packet_fixture(self,root):
  files={}
  for name in controller.REQUIRED_INPUTS:
   path=root/name;path.parent.mkdir(parents=True,exist_ok=True);content=('synthetic '+name).encode();path.write_bytes(content);files[name]=hashlib.sha256(content).hexdigest()
  packet=root/controller.PACKET;packet.parent.mkdir(parents=True,exist_ok=True)
  data={'kind':controller.KIND,'before':BEFORE,'pr':332,'files':files};packet.write_text(json.dumps(data));return packet,data
 def test_exact_closed_packet(self):
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);packet,data=self.packet_fixture(root);self.assertEqual(controller.verify_packet(root,packet.read_bytes()),data)
 def test_packet_refuses_changed_or_missing_bytes(self):
  for fault in ['mutated','missing','symlink','frozen']:
   with self.subTest(fault=fault),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);packet,data=self.packet_fixture(root);frozen=packet.read_bytes();name=sorted(data['files'])[0];target=root/name
    if fault=='mutated':target.write_bytes(b'changed')
    if fault=='missing':target.unlink()
    if fault=='symlink':
     target.unlink();replacement=root/'replacement';replacement.write_text('synthetic '+name);target.symlink_to(replacement)
    if fault=='frozen':packet.write_text(json.dumps(data,indent=2))
    self.refuses(controller.verify_packet,root,frozen)
 def test_packet_scope_and_closed_set(self):
  for fault in ['kind','before','pr','missing-key','extra-key','malformed-hash']:
   with self.subTest(fault=fault),tempfile.TemporaryDirectory() as temp:
    root=Path(temp);packet,data=self.packet_fixture(root)
    if fault in ['kind','before','pr']:data[fault]='invalid'
    if fault=='missing-key':data['files'].pop(sorted(data['files'])[0])
    if fault=='extra-key':data['files']['unexpected']='0'*64
    if fault=='malformed-hash':data['files'][sorted(data['files'])[0]]='not-a-digest'
    packet.write_text(json.dumps(data));self.refuses(controller.verify_packet,root)
 def test_shared_deadline_refuses_cleanup_overrun(self):
  self.assertEqual(controller.phase_budget(100,10,30),30)
  self.assertEqual(controller.phase_budget(100,90,30),5)
  self.refuses(controller.phase_budget,100,95,30)
 def diagnostic(self,raw):
  return controller.compiler_diagnostic(raw,Path('/owned/source checkout'),Path('/owned/private-work'),Path('/installed/sdk'))
 def test_diagnostic_retains_full_hash_and_redacts_paths(self):
  raw=b'/owned/source checkout/file.c: /owned/private-work/output /installed/sdk/node_api.h /other/private/file.h\nerror: bad "type"\n'
  result=self.diagnostic(raw)
  self.assertEqual(result['bytes'],len(raw));self.assertEqual(result['sha256'],hashlib.sha256(raw).hexdigest())
  self.assertEqual(result['encoding'],'utf8');self.assertFalse(result['truncated'])
  for path in ['/owned/source checkout','/owned/private-work','/installed/sdk','/other/private/file.h']:self.assertNotIn(path,result['text'])
  for tag in ['<source>','<work>','<sdk>','<path>']:self.assertIn(tag,result['text'])
  self.assertEqual(json.loads(json.dumps(result)),result)
  self.assertNotIn('\nerror',json.dumps(result));self.assertIn('\\nerror',json.dumps(result))
 def test_diagnostic_utf8_prefix_never_splits_character(self):
  raw=b'a'*16383+'€'.encode()+b'tail';result=self.diagnostic(raw)
  self.assertTrue(result['truncated']);self.assertEqual(result['text'],'a'*16383)
  self.assertEqual(result['sha256'],hashlib.sha256(raw).hexdigest());self.assertNotIn('�',result['text'])
 def test_diagnostic_invalid_suffix_never_exposes_prefix(self):
  raw=b'valid prefix'+b'a'*16384+b'\xff';result=self.diagnostic(raw)
  self.assertEqual(result['encoding'],'invalid-utf8');self.assertIsNone(result['text'])
  self.assertTrue(result['truncated']);self.assertEqual(result['bytes'],len(raw))
 def test_diagnostic_empty_exact_cap_and_overflow(self):
  self.assertEqual(self.diagnostic(b'')['text'],'')
  raw=b'x'*(256*1024);result=self.diagnostic(raw)
  self.assertEqual(result['bytes'],256*1024);self.assertEqual(len(result['text']),16384)
  self.assertEqual(result['sha256'],hashlib.sha256(raw).hexdigest())
  self.refuses(self.diagnostic,raw+b'x');self.refuses(self.diagnostic,'not bytes')
 def test_diagnostic_exact_prefix_boundary(self):
  self.assertFalse(self.diagnostic(b'x'*16384)['truncated'])
  self.assertTrue(self.diagnostic(b'x'*16385)['truncated'])
 def test_project_imports_follow_packet_and_fixture_has_real_arguments(self):
  tree=ast.parse(MODULE.read_text());main=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='main')
  project={'governance_build_ipc_compile','governance_linux_compile_supervisor'}
  self.assertFalse(any(isinstance(n,ast.ImportFrom) and n.module in project for n in tree.body))
  imports=[n for n in main.body if isinstance(n,ast.ImportFrom) and n.module in project]
  verify=next(n for n in ast.walk(main) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='verify_packet')
  self.assertEqual(len(imports),2);self.assertTrue(all(n.lineno>verify.lineno for n in imports))
  fixture=next(n for n in ast.walk(main) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='run' and n.args and isinstance(n.args[0],ast.Constant) and n.args[0].value=='isolation-preflight')
  self.assertIsInstance(fixture.args[1],ast.List);self.assertEqual(len(fixture.args[1].elts),3)
  self.assertIn('fixture-owned-file',ast.unparse(fixture.args[1].elts[1]));self.assertIn("tools['true']",ast.unparse(fixture.args[1].elts[2]))
if __name__=='__main__':unittest.main()
