"""Synthetic owned files and mocked tool only; no native operation runs."""
from pathlib import Path
import copy,hashlib,json,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.tests import test_system_preparation as fixture_module
from governance_local_issuer.tests.test_saved_profile_observation import fixture as guard_bytes
from governance_local_issuer import system_preparation as prep,system_build_inputs as inputs
from governance_local_issuer.saved_profile_observation import inspect_guard_no_entitlements

class NativePeerBatchTests(unittest.TestCase):
 def setUp(self):
  self.fixture=fixture_module.SystemPreparationTests();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups);self.base=self.fixture.root;self.root=self.base/'peer-unit';self.stage=self.base/'broker-leaf';self.config=self.fixture.config
  self.node_sha=hashlib.sha256(self.fixture.node.read_bytes()).hexdigest();self.config.update({'principal':{'account':'_axiomissuer_synthetic','uid':65001,'gid':65001},'fixturePrincipal':{'uid':65002,'gid':65002},'controllerPrincipal':{'uid':501,'gid':20},'lifetimeNs':300000000000,'desktopRequirement':'cdhash H"459c28699bb7ebc8383bba905b15882d54dda005"','fixtureTools':{'nodeSha256':self.node_sha,'producerSha256':'681a5b12c7e16bf5e84022b98ac0be00a12942d20ec210f5091ae2bf2f451fbf'}})
  self.config['requirements']={'node':'cdhash H"2965bacde5394d71a94682b246ad01efe316e036"','controller':self.config['desktopRequirement']};prep.prepare_system(self.fixture.repo,self.stage,self.config,phase='broker-leaf')
  self.archive=self.put('archive.tar',b'archive fixture no execution');self.manifest=self.putjson('source-manifest.json',{'sourceCommit':'3fd8fcb37367401e870898265f7f5a5bd475a6a8','wholeProjectSnapshot':False,'archive':self.archive,'files':{p.relative_to(self.fixture.repo).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size}for p in self.fixture.repo.rglob('*')if p.is_file()}})
  controller=self.put('controller',b'signed controller fixture');controller_display=self.put('controller-display',self.display('controller','459c28699bb7ebc8383bba905b15882d54dda005'));controller_result=self.putjson('controller-result',{'artifact_after':controller,'profile_matches':True})
  node_display=self.put('node-display',self.display('node','2965bacde5394d71a94682b246ad01efe316e036'));node_result=self.putjson('node-result',{'copy_after':inputs.binding(self.fixture.node),'profile_matches_candidate':True})
  self.basis=self.putjson('peer-basis.json',{'controllerArtifact':controller,'controllerDisplay':controller_display,'controllerResult':controller_result,'nodeCurrent':inputs.binding(self.fixture.node),'nodeDisplay':node_display,'nodeResult':node_result,'historicalNodeReceiptRestamped':False});self.review=self.put('review.md',b'fixed synthetic conditional review')
 def put(self,name,raw):
  p=self.base/name;p.write_bytes(raw);p.chmod(0o600);return inputs.binding(p)
 def putjson(self,name,value):return self.put(name,json.dumps(value).encode())
 def display(self,role,cd):
  return (f'Identifier={inputs.ROLE_IDENTIFIERS[role]}\nTeamIdentifier=FG5N98FE6W\nFormat=Mach-O thin (arm64)\nCodeDirectory flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\nCDHash={cd}\n').encode()
 def module(self):
  from governance_local_issuer import native_peer_batch as batch
  return batch
 def context(self):
  batch=self.module();return patch.multiple(batch,ROOT=self.root,BROKER_STAGE=self.stage,SOURCE_REPO=self.fixture.repo,SOURCE_MANIFEST=Path(self.manifest['path']),EXPECTED_MANIFEST_SHA=self.manifest['sha256'],PEER_BASIS=Path(self.basis['path']),EXPECTED_BASIS_SHA=self.basis['sha256'],EXPECTED_BROKER_SHA=inputs.binding(self.stage/prep.RECEIPT)['sha256'],REVIEW=Path(self.review['path']),NODE_SHA=self.node_sha)
 def fake_run(self,argv,cwd,environment):
  out=b'';err=b''
  if argv[0]=='/usr/bin/xcrun':
   p=Path(argv[argv.index('-o')+1]);p.write_bytes(b'unsigned '+p.name.encode());p.chmod(0o755)
  else:
   p=Path(argv[-1]);role=p.name.removesuffix('-review-copy')
   if '--force'in argv:p.write_bytes(guard_bytes()if role=='guard'else p.read_bytes()+b' signed')
   if '--display'in argv:
    cd=inspect_guard_no_entitlements(guard_bytes(),inputs.ROLE_IDENTIFIERS['guard'],'FG5N98FE6W')['cdhash']if role=='guard'else'4'*40;out=b''if role=='guard'else b'<?xml version="1.0"?><plist version="1.0"><dict/></plist>';err=self.display(role,cd)
  return {'exit':0,'state':'completed','cleanup':'reaped_original_child','error':None,'elapsed_seconds':.01,'stdout':out,'stderr':err,'output':out+err}
 def prepare(self):return self.module().prepare('call_PXsGlUWps7G3i9yiMijpobQ1')
 def broker(self):
  b=self.module();return b.execute_broker_sign(b.execute_broker_compile(self.prepare())['signingPacket'])
 def test_prepare_freezes_without_operations_and_guard_cannot_come_first(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('forbidden')):
   packet=self.prepare();self.assertFalse(packet['executionAuthorized']);self.assertRaises(Exception,self.module().prepare_guard)
 def test_complete_two_phase_journey_keeps_every_operation_separate(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run)as run:
   b=self.module();packet=self.prepare();compiled=b.execute_broker_compile(packet);self.assertEqual(run.call_count,1);broker=b.execute_broker_sign(compiled['signingPacket']);self.assertEqual(run.call_count,4);self.assertEqual(set(broker['roles']),{'broker'});guard_packet=b.prepare_guard();self.assertEqual(run.call_count,4)
   config=json.loads((self.root/'guard-source'/prep.RECEIPT).read_bytes())['config'];self.assertEqual(config['requirements']['brokerForGuard'],'cdhash H"'+('4'*40)+'"');guard_compiled=b.execute_guard_compile(guard_packet);self.assertEqual(run.call_count,5);guard=b.execute_guard_sign(guard_compiled['signingPacket']);self.assertEqual(run.call_count,8);self.assertEqual(set(guard['roles']),{'guard'});self.assertFalse(guard['installationReady']);self.assertIn('savedCommands',guard['roles']['guard']['provenance']);self.assertNotIn('savedCommands',broker['roles']['broker']['provenance'])
 def test_broker_compile_once(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run)as run:
   b=self.module();p=self.prepare();b.execute_broker_compile(p);self.assertRaises(Exception,b.execute_broker_compile,p);self.assertEqual(run.call_count,1)
 def test_compile_failure_stops_whole_unit_and_cannot_retry(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',return_value={'exit':1,'state':'completed','cleanup':'reaped_original_child','error':None,'elapsed_seconds':.01,'stdout':b'','stderr':b'failure'})as run:
   b=self.module();p=self.prepare();self.assertRaises(Exception,b.execute_broker_compile,p);self.assertRaises(Exception,b.execute_broker_compile,p);self.assertRaises(Exception,b.prepare_guard);self.assertEqual(run.call_count,1)
 def test_changed_header_stops_before_compiler(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('forbidden')):
   p=self.prepare();(self.fixture.headers/'node_api.h').write_bytes(b'changed');self.assertRaises(Exception,self.module().execute_broker_compile,p)
 def test_guard_derivation_refuses_changed_broker_bytes(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run)as run:
   result=self.broker();Path(result['roles']['broker']['artifact']['path']).write_bytes(b'changed');self.assertRaises(Exception,self.module().prepare_guard);self.assertEqual(run.call_count,4)
 def test_static_verify_cannot_mutate_just_signed_broker(self):
  def mutate(argv,cwd,environment):
   r=self.fake_run(argv,cwd,environment)
   if '--verify'in argv:Path(argv[-1]).write_bytes(b'changed during verify')
   return r
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=mutate)as run:
   b=self.module();compiled=b.execute_broker_compile(self.prepare());self.assertRaises(Exception,b.execute_broker_sign,compiled['signingPacket']);self.assertEqual(run.call_count,3)
 def test_missing_broker_xml_stops_guard_preparation(self):
  def missing(argv,cwd,environment):
   r=self.fake_run(argv,cwd,environment)
   if '--display'in argv:r['stdout']=b''
   return r
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=missing)as run:
   b=self.module();compiled=b.execute_broker_compile(self.prepare());self.assertRaises(Exception,b.execute_broker_sign,compiled['signingPacket']);self.assertRaises(Exception,b.prepare_guard);self.assertEqual(run.call_count,4);self.assertFalse((self.root/'broker-result.json').exists())
 def test_wrong_team_cannot_be_promoted_to_broker_result(self):
  def wrong(argv,cwd,environment):
   r=self.fake_run(argv,cwd,environment);r['stderr']=r['stderr'].replace(b'FG5N98FE6W',b'WRONGTEAMX');return r
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=wrong)as run:
   b=self.module();compiled=b.execute_broker_compile(self.prepare());self.assertRaises(Exception,b.execute_broker_sign,compiled['signingPacket']);self.assertEqual(run.call_count,4);self.assertFalse((self.root/'broker-completion.json').exists())
 def test_guard_parser_rejects_structure_even_with_matching_display(self):
  def invalid(argv,cwd,environment):
   r=self.fake_run(argv,cwd,environment)
   if '--force'in argv and 'guard-review-copy'in argv[-1]:Path(argv[-1]).write_bytes(b'not Mach-O')
   return r
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=invalid)as run:
   b=self.module();self.broker();guard=b.prepare_guard();compiled=b.execute_guard_compile(guard);self.assertRaises(Exception,b.execute_guard_sign,compiled['signingPacket']);self.assertEqual(run.call_count,8);self.assertFalse((self.root/'guard-result.json').exists())
 def test_guard_sign_once_and_no_old_helper_is_selected(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run)as run:
   b=self.module();self.broker();compiled=b.execute_guard_compile(b.prepare_guard());b.execute_guard_sign(compiled['signingPacket']);self.assertRaises(Exception,b.execute_guard_sign,compiled['signingPacket']);self.assertEqual(run.call_count,8)
   commands=[call.args[0]for call in run.call_args_list];self.assertEqual([argv[-1].split('/')[-1]for argv in commands if argv[0]=='/usr/bin/codesign'],['broker-review-copy']*3+['guard-review-copy']*3)
 def test_changed_unsigned_copy_refuses_before_broker_key_use(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run)as run:
   b=self.module();compiled=b.execute_broker_compile(self.prepare());(self.root/'leaves/broker-review-copy').write_bytes(b'changed');self.assertRaises(Exception,b.execute_broker_sign,compiled['signingPacket']);self.assertEqual(run.call_count,1)
 def test_wrong_peer_requirement_rejected_before_packet(self):
  receiptpath=self.stage/prep.RECEIPT;r=json.loads(receiptpath.read_bytes());r['config']['requirements']['controller']='cdhash H"'+('9'*40)+'"';receiptpath.write_text(json.dumps(r))
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=AssertionError('forbidden')):
   self.assertRaises(Exception,self.prepare);self.assertFalse(self.root.exists())
 def test_source_mutation_after_broker_signature_prevents_guard_prepare(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run)as run:
   self.broker();(self.fixture.repo/'packages/verified-issuer-runtime/native/origin_broker.c').write_bytes(b'changed');self.assertRaises(Exception,self.module().prepare_guard);self.assertEqual(run.call_count,4)
 def test_guard_preparation_receipt_is_full_complete_phase_but_compile_selects_only_guard(self):
  with self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.fake_run):
   self.broker();packet=self.module().prepare_guard();receipt=json.loads((self.root/'guard-source'/prep.RECEIPT).read_bytes());self.assertEqual(receipt['preparationPhase'],'complete');self.assertEqual({r['role']for r in receipt['compileRecipes']},{'owner','broker','controller','maintenance','bootstrap','guard'});self.assertEqual(packet['recipe']['role'],'guard');self.assertNotIn('sourceRevision',packet)
if __name__=='__main__':unittest.main()
