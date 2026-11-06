"""Actual System/fixture validators; synthetic files/static observations only."""
from pathlib import Path
import copy,json,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]));sys.path.insert(0,str(Path(__file__).parent))
from governance_local_issuer import system_build_inputs as s,system_preparation as prep
import test_system_build_inputs as fixtures
class ControllerCoherenceTests(unittest.TestCase):
 def setUp(self):
  self.f=fixtures.SystemBuildInputsTests();original=prep.prepare_system
  def selected(repo,stage,config,**kwargs):
   config['controllerPrincipal']={'uid':505,'gid':505};config['desktopRequirement']=config['requirements']['controller'];return original(repo,stage,config,**kwargs)
  with patch.object(prep,'prepare_system',side_effect=selected):self.f.setUp()
  self.addCleanup(self.f.doCleanups)
 def second(self,uid=505,desktop=None):
  c=copy.deepcopy(self.f.config);c['controllerPrincipal']={'uid':uid,'gid':505};c['requirements']={}
  if desktop is None:c.pop('desktopRequirement',None)
  else:c['desktopRequirement']=desktop
  stage=self.f.root/'early-preparation';prep.prepare_system(self.f.repo,stage,c,phase='independent-leaves');path=stage/prep.RECEIPT
  packet=json.loads(self.f.packet.read_text());packet['preparationReceipts'].append(s.binding(path));self.f.packet.write_text(json.dumps(packet))
 def test_mismatched_controller_uid_cannot_join_complete_preparations(self):
  self.second(uid=506)
  with self.assertRaisesRegex(ValueError,'controller'):self.f.record()
 def test_existing_desktop_requirement_must_match_saved_controller(self):
  self.second(desktop='cdhash H"'+'2'*40+'"')
  with self.assertRaisesRegex(ValueError,'controller'):self.f.record()
 def test_early_omitted_requirement_and_same_principal_remain_acyclic(self):
  self.second();r=self.f.record();self.assertFalse(r['executionAuthorized']);self.assertEqual(r,s.verify_system_inputs(self.f.stage))
 def test_connected_fixture_delivery_keeps_selected_controller_context(self):
  import test_fixture_delivery_inputs as delivery_fixtures
  from governance_local_issuer import fixture_delivery_inputs as delivery
  original=prep.prepare_system
  def selected(repo,stage,config,**kwargs):
   config['controllerPrincipal']={'uid':505,'gid':505};config['desktopRequirement']=config['requirements']['controller'];return original(repo,stage,config,**kwargs)
  with patch.object(prep,'prepare_system',side_effect=selected):f=delivery_fixtures.FixtureDeliveryFixture()
  try:
   observation=f.record();self.assertFalse(observation['executionAuthorized']);self.assertEqual(observation,delivery.verify_fixture_delivery_inputs(f.stage))
  finally:f.close()
