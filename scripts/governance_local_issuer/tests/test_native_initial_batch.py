"""Mocked supervisor only: tests never compile, sign, or execute native bytes."""
from pathlib import Path
import copy,hashlib,json,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.tests import test_system_preparation as preparation_tests
from governance_local_issuer import system_preparation as prep
from governance_local_issuer import system_build_inputs as inputs

class NativeInitialBatchTests(unittest.TestCase):
 def setUp(self):
  self.fixture=preparation_tests.SystemPreparationTests();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups);self.base=self.fixture.root;self.root=self.base/'native';self.planpath=self.base/'plan.json'
  self.config=self.fixture.config;self.config['requirements']={};self.roles=[]
  for phase in ('controller-first','independent-leaves'):
   stage=self.base/phase;r=prep.prepare_system(self.fixture.repo,stage,self.config,phase=phase)
   for recipe in r['compileRecipes']:
    role=recipe['role'];target=self.root/'leaves'/(role+'-review-copy');ident=inputs.ROLE_IDENTIFIERS[role]
    commands=[['/usr/bin/codesign','--force','--sign','4C2E59F247CA275001586AE020A9269464529452','--identifier',ident,'--options','runtime','--entitlements',str(self.root/'empty.plist'),'--timestamp=none',str(target)],['/usr/bin/codesign','--verify','--strict','--verbose=2',str(target)],['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',str(target)]]
    self.roles.append({'role':role,'identifier':ident,'compileRecipe':recipe,'preparation':inputs.binding(stage/prep.RECEIPT),'target':str(target),'signingCommands':commands})
  self.plan={'format':'axiom.stage-b-initial-leaves-design/1','roles':self.roles,'sourceCommit':'3fd8fcb37367401e870898265f7f5a5bd475a6a8','accountModification':False,'cleanupSeconds':5,'combinedOutputCap':65536,'executionAuthorized':False,'implementationAndExactOutputReviewRequired':True,'installation':False,'retry':False,'secondsPerCommand':10,'targetExecution':False};self.planpath.write_text(json.dumps(self.plan));self.planpath.chmod(0o600)
  self.archive=self.base/'source.tar';self.archive.write_bytes(b'synthetic archive evidence not executable');self.archive.chmod(0o600);self.manifest=self.base/'source-manifest.json';self.manifest.write_text(json.dumps({'sourceCommit':self.plan['sourceCommit'],'wholeProjectSnapshot':False,'archive':inputs.binding(self.archive),'files':{p.relative_to(self.fixture.repo).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size}for p in self.fixture.repo.rglob('*')if p.is_file()}}));self.manifest.chmod(0o600)
 def module(self):
  from governance_local_issuer import native_initial_batch as batch
  return batch
 def context(self):
  batch=self.module();return patch.multiple(batch,ROOT=self.root,PLAN=self.planpath,EXPECTED_PLAN_SHA256=hashlib.sha256(self.planpath.read_bytes()).hexdigest(),SOURCE_REPO=self.fixture.repo,NATIVE_SOURCE_REPO=self.fixture.repo,SOURCE_MANIFEST=self.manifest,EXPECTED_SOURCE_MANIFEST_SHA256=hashlib.sha256(self.manifest.read_bytes()).hexdigest())
 def successful(self,argv,cwd,environment):
  if argv[0]=='/usr/bin/xcrun':
   out=Path(argv[argv.index('-o')+1]);out.write_bytes(b'unsigned '+out.name.encode());out.chmod(0o755);stdout=b'';stderr=b''
  else:
   target=Path(argv[-1]);role=target.name.removesuffix('-review-copy');stdout=b'';stderr=b''
   if '--force'in argv:target.write_bytes(target.read_bytes()+b' signed')
   if '--display'in argv:
    stdout=b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>'
    stderr=(f'Identifier={inputs.ROLE_IDENTIFIERS[role]}\nTeamIdentifier=FG5N98FE6W\nFormat=Mach-O thin (arm64)\nCodeDirectory flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\nCDHash='+('1'*40)+'\n').encode()
  return {'exit':0,'state':'completed','cleanup':'reaped_original_child','error':None,'stdout':stdout,'stderr':stderr,'elapsed_seconds':.01,'output':stdout+stderr}
 def test_prepare_freezes_inputs_and_compile_is_not_automatic(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('operation forbidden')):
   packet=self.module().prepare('call_y7LNwrapWdVjM4XODORO2VUU');self.assertFalse(packet['executionAuthorized']);self.assertTrue((self.root/'empty.plist').is_file());self.assertRaises(ValueError,self.module().prepare,'call_y7LNwrapWdVjM4XODORO2VUU')
 def test_compile_and_sign_are_separate_once_only_and_keep_unsigned(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.successful) as run:
   batch=self.module();packet=batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU');compiled=batch.execute_compile(packet);self.assertEqual(run.call_count,4);self.assertRaises((ValueError,FileExistsError),batch.execute_compile,packet)
   signed=batch.execute_sign(compiled['signingPacket']);self.assertEqual(run.call_count,16);self.assertEqual(set(signed['roles']),{'controller','owner','maintenance','bootstrap'});self.assertRaises((ValueError,FileExistsError),batch.execute_sign,compiled['signingPacket'])
   for entry in self.roles:
    self.assertNotIn(b' signed',Path(entry['compileRecipe']['output']).read_bytes());self.assertEqual(Path(entry['target']).stat().st_mode&0o777,0o600)
 def test_compiler_failure_claims_unit_and_stops_after_first(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',return_value={'exit':1,'state':'completed','cleanup':'reaped_original_child','stdout':b'','stderr':b'error','elapsed_seconds':.01,'error':None}) as run:
   batch=self.module();packet=batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU');self.assertRaises(ValueError,batch.execute_compile,packet);self.assertEqual(run.call_count,1);self.assertRaises((ValueError,FileExistsError),batch.execute_compile,packet);self.assertEqual(run.call_count,1)
 def test_changed_header_refuses_before_compiler(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('operation forbidden')):
   batch=self.module();packet=batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU');(self.fixture.headers/'node_api.h').write_bytes(b'changed');self.assertRaises(Exception,batch.execute_compile,packet)
 def test_changed_source_or_extra_stage_file_refuses_before_prepare(self):
  with self.context():
   (self.base/'controller-first'/'extra').write_bytes(b'extra');self.assertRaises(Exception,self.module().prepare,'call_y7LNwrapWdVjM4XODORO2VUU');self.assertFalse(self.root.exists())
 def test_changed_unsigned_or_detached_copy_refuses_key_use(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.successful) as run:
   batch=self.module();compiled=batch.execute_compile(batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));source=Path(self.roles[0]['compileRecipe']['output']);source.write_bytes(b'replaced unsigned')
   self.assertRaises(Exception,batch.execute_sign,compiled['signingPacket']);self.assertEqual(run.call_count,4)
 def test_unsigned_same_bytes_replacement_refuses_before_key_use(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.successful) as run:
   batch=self.module();compiled=batch.execute_compile(batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));source=Path(self.roles[0]['compileRecipe']['output']);raw=source.read_bytes();source.unlink();source.write_bytes(raw);source.chmod(0o600)
   self.assertRaises(Exception,batch.execute_sign,compiled['signingPacket']);self.assertEqual(run.call_count,4)
 def test_modified_packet_dict_refuses_before_compiler(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('operation forbidden')):
   batch=self.module();packet=batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU');packet['planValue']['roles'][0]['compileRecipe']['argv'][0]='/tmp/other';self.assertRaises(Exception,batch.execute_compile,packet)
 def test_compiler_cannot_mutate_nonoutput_stage_input(self):
  def mutate(argv,cwd,environment):
   result=self.successful(argv,cwd,environment);(self.base/'controller-first/config/system-preparation.h').write_bytes(b'changed');return result
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=mutate) as run:
   batch=self.module();self.assertRaises(Exception,batch.execute_compile,batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));self.assertEqual(run.call_count,1);self.assertFalse((self.root/'signing-packet.json').exists())
 def test_failed_signing_preserves_changed_copy_and_never_retries(self):
  def fail_sign(argv,cwd,environment):
   result=self.successful(argv,cwd,environment)
   if argv[0]=='/usr/bin/codesign':result.update(exit=1)
   return result
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=fail_sign) as run:
   batch=self.module();compiled=batch.execute_compile(batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));self.assertRaises(ValueError,batch.execute_sign,compiled['signingPacket']);self.assertEqual(run.call_count,5);self.assertIn(b' signed',Path(self.roles[0]['target']).read_bytes());self.assertTrue((self.root/'signing-failure.json').is_file());self.assertRaises((ValueError,FileExistsError),batch.execute_sign,compiled['signingPacket']);self.assertEqual(run.call_count,5)
 def test_missing_entitlement_xml_stops_whole_unit_after_first_role(self):
  def missing(argv,cwd,environment):
   result=self.successful(argv,cwd,environment)
   if '--display'in argv:result['stdout']=b''
   return result
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=missing) as run:
   batch=self.module();compiled=batch.execute_compile(batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));self.assertRaises(ValueError,batch.execute_sign,compiled['signingPacket']);self.assertEqual(run.call_count,7);self.assertFalse((self.root/'controller-result.json').exists())
 def test_unknown_cleanup_stops_even_zero_exit(self):
  def unknown(argv,cwd,environment):
   result=self.successful(argv,cwd,environment);result['cleanup']='unknown';return result
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=unknown) as run:
   batch=self.module();self.assertRaises(ValueError,batch.execute_compile,batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));self.assertEqual(run.call_count,1)
 def test_extra_header_refuses_before_compiler(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('operation forbidden')):
   batch=self.module();packet=batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU');(self.fixture.headers/'extra.h').write_bytes(b'extra');self.assertRaises(Exception,batch.execute_compile,packet)
 def test_static_verify_cannot_rewrite_signed_copy(self):
  def rewrite(argv,cwd,environment):
   result=self.successful(argv,cwd,environment)
   if '--verify'in argv:Path(argv[-1]).write_bytes(b'replaced during verify')
   return result
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=rewrite) as run:
   batch=self.module();compiled=batch.execute_compile(batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU'));self.assertRaises(Exception,batch.execute_sign,compiled['signingPacket']);self.assertEqual(run.call_count,6)
 def test_extra_frozen_repo_file_refuses_before_compiler(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('operation forbidden')):
   batch=self.module();packet=batch.prepare('call_y7LNwrapWdVjM4XODORO2VUU');(self.fixture.repo/'extra.c').write_bytes(b'extra');self.assertRaises(ValueError,batch.execute_compile,packet)
if __name__=='__main__':unittest.main()
