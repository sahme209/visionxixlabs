"""New composition uses real coordinators with mocked command effects only."""
from pathlib import Path
import json,hashlib,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.tests.test_socket_native_initial_batch import SocketNativeInitialBatchTests
from governance_local_issuer import socket_native_peer_batch as peer,system_preparation as prep,system_build_inputs as inputs
from governance_local_issuer.saved_profile_observation import inspect_guard_no_entitlements
from governance_local_issuer.tests.test_native_peer_batch import guard_bytes
class SocketNativeComposition(unittest.TestCase):
 def setUp(self):
  self.f=SocketNativeInitialBatchTests();self.f.setUp();self.addCleanup(self.f.doCleanups);self.root=self.f.base/'peer';self.nodehash=hashlib.sha256(self.f.fixture.node.read_bytes()).hexdigest()
  config=dict(self.f.config);config.update(principal={'account':'_axiomissuer_synthetic','uid':65001,'gid':65001},fixturePrincipal={'uid':65002,'gid':65002},controllerPrincipal={'uid':501,'gid':20},lifetimeNs=300000000000,fixtureTools={'nodeSha256':self.nodehash,'producerSha256':'ab6de13646a3c295bd74ee9476d0934d41f5daa6112e5b338be3fa0ebb027a52'})
  (self.f.fixture.repo.parent/'config.json').write_text(json.dumps(config))
  self.review=self.f.base/'review.md';self.review.write_text('mock conditional source review')
  def put(name,value):
   p=self.f.base/name;p.write_bytes(value);p.chmod(0o600);return inputs.binding(p)
  node=inputs.binding(self.f.fixture.node);display=put('node-display',b'Identifier='+inputs.ROLE_IDENTIFIERS['node'].encode()+b'\nTeamIdentifier=FG5N98FE6W\nFormat=Mach-O thin (arm64)\nCodeDirectory flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\nCDHash=2965bacde5394d71a94682b246ad01efe316e036\n');result=put('node-result',json.dumps({'copy_after':node,'profile_matches_candidate':True}).encode());self.basis=put('basis.json',json.dumps({'nodeCurrent':node,'nodeDisplay':display,'nodeResult':result,'historicalNodeReceiptRestamped':False}).encode())
 def context(self):return patch.multiple(peer,ROOT=self.root,BROKER_STAGE=self.root/'broker-source',SOURCE_REPO=self.f.fixture.repo,SOURCE_MANIFEST=self.f.manifest,EXPECTED_MANIFEST_SHA=hashlib.sha256(self.f.manifest.read_bytes()).hexdigest(),PEER_BASIS=Path(self.basis['path']),EXPECTED_BASIS_SHA=self.basis['sha256'],REVIEW=self.review,NODE_SHA=self.nodehash)
 def effects(self,argv,cwd,env):
  if argv[0]=='/usr/bin/xcrun':return self.f.successful(argv,cwd,env)
  role=Path(argv[-1]).name.removesuffix('-review-copy')
  if role!='guard':return self.f.successful(argv,cwd,env)
  if '--force'in argv:Path(argv[-1]).write_bytes(guard_bytes())
  out=b'';err=b''
  if '--display'in argv:
   cd=inspect_guard_no_entitlements(guard_bytes(),inputs.ROLE_IDENTIFIERS['guard'],'FG5N98FE6W')['cdhash'];err=f'Identifier={inputs.ROLE_IDENTIFIERS["guard"]}\nTeamIdentifier=FG5N98FE6W\nFormat=Mach-O thin (arm64)\nCodeDirectory flags=0x10000(runtime)\nInfo.plist=not bound\nSealed Resources=none\nCDHash={cd}\n'.encode()
  return {'exit':0,'state':'completed','cleanup':'reaped_original_child','error':None,'elapsed_seconds':.01,'stdout':out,'stderr':err,'output':out+err}
 def four(self):
  initial=self.f.module();packet=initial.prepare(initial.APPROVAL_REFERENCE);compiled=initial.execute_compile(packet);return peer.execute_initial_sign(compiled['signingPacket'])
 def test_full_six_role_graph_each_compile_requires_separate_sign_call(self):
  with self.f.context(),self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.effects)as run:
   self.assertRaises(Exception,peer.prepare,peer.APPROVAL);self.four();self.assertEqual(run.call_count,16)
   broker=peer.prepare(peer.APPROVAL);self.assertEqual(run.call_count,16);self.assertEqual(json.loads((self.root/'broker-source'/prep.RECEIPT).read_text())['config']['requirements']['controller'],'cdhash H"'+'1'*40+'"')
   compiled=peer.execute_broker_compile(broker);self.assertEqual(run.call_count,17);peer.execute_broker_sign(compiled['signingPacket']);self.assertEqual(run.call_count,20)
   guard=peer.prepare_guard();self.assertEqual(run.call_count,20);compiled=peer.execute_guard_compile(guard);self.assertEqual(run.call_count,21);peer.execute_guard_sign(compiled['signingPacket']);self.assertEqual(run.call_count,24)
 def test_changed_actual_controller_stops_before_broker_preparation_or_key(self):
  with self.f.context(),self.context(),patch('governance_local_issuer.bounded_signing_tool.run',side_effect=self.effects)as run:
   value=self.four();Path(value['roles']['controller']['artifact']['path']).write_bytes(b'changed');self.assertRaises(Exception,peer.prepare,peer.APPROVAL);self.assertEqual(run.call_count,16);self.assertFalse(self.root.exists())
class CorrectedProducerBinding(unittest.TestCase):
 def test_fixed_saved_producer_current_bytes_are_required(self):
  import tempfile
  from governance_local_issuer import socket_native_initial_batch as initial
  with tempfile.TemporaryDirectory()as raw:
   root=Path(raw).resolve();artifact=root/'producer.cjs';artifact.write_bytes(b'p'*772578);artifact.chmod(0o600);binding=inputs.binding(artifact);result=root/'result.json';result.write_text(json.dumps({'status':'artifact_observed','sourceRevision':'1369f4837f3fde73eb873449501fb2b7c7947587','executionAuthorized':False,'finalInputCurrentness':'verified','producer':binding}));result.chmod(0o600)
   with patch.multiple(initial,PRODUCER_RESULT=result,PRODUCER_RESULT_SHA256=hashlib.sha256(result.read_bytes()).hexdigest(),PRODUCER_SHA256=binding['sha256']):
    self.assertEqual(len(initial._producer_inputs()),2);artifact.write_bytes(b'q'*772578);self.assertRaises(Exception,initial._producer_inputs)
if __name__=='__main__':unittest.main()
