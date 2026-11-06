"""Synthetic v3 target and mocked signing only; no actual child/key/host action."""
from pathlib import Path
import sys,json,hashlib,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.tests import test_fixture_final_seal as fixture
class FixtureSealSequenceTests(unittest.TestCase):
 def setUp(self):
  self.f=fixture.FixtureSealFlowTests();self.f.setUp();self.addCleanup(self.f.doCleanups)
 def module(self):
  from governance_local_issuer import fixture_seal_sequence as sequence
  return sequence
 def constants(self):
  q=self.module();before=(self.f.app/fixture.s.MAIN).read_bytes();return patch.multiple(q,APP=self.f.app,DESTINATION=self.f.destination,OUTPUT=self.f.out,BASELINE=Path(self.f.baseline['path']),PRESEAL=self.f.destination/fixture.s.assembly.RECEIPT,PRESEAL_SHA=fixture.s.old.binding(self.f.destination/fixture.s.assembly.RECEIPT)['sha256'],MAIN_SHA=hashlib.sha256(before).hexdigest(),MAIN_SIZE=len(before))
 def successful(self,kind):
  q=self.module();out=b'';err=b''
  if kind=='sign':
   main=self.f.app/fixture.s.MAIN;main.write_bytes(fixture.signed(main.read_bytes()));resource=self.f.app/'Contents/_CodeSignature/CodeResources';resource.parent.mkdir(mode=0o700);resource.write_bytes(fixture.plistlib.dumps({'files2':{}}));resource.chmod(0o600)
  if kind=='display':
   profile=fixture.s.validate_fixture_main_change(Path(self.f.baseline['path']).with_name('main-before.bin').read_bytes(),(self.f.app/fixture.s.MAIN).read_bytes());err=(f"Identifier={fixture.cp.MAIN_IDENTIFIER}\nTeamIdentifier=FG5N98FE6W\nCodeDirectory v=20500 flags=0x10000(runtime)\nCDHash={profile['cdhash']}\n").encode()
  return {'argv':q.commands()[kind],'state':'completed','exit':0,'cleanup':'reaped_original_child','errorType':None,'stdout':out,'stderr':err}
 def test_new_records_join_unchanged_actual_v3_postseal_validator(self):
  with self.constants(),patch.object(self.module(),'_run',side_effect=self.successful)as run:
   records=self.module().execute_fixture_sequence(self.f.baseline);result=fixture.s.validate_fixture_postseal(self.f.baseline,records,self.f.out)
  self.assertEqual([x.args[0]for x in run.call_args_list],['sign','verify','display']);self.assertTrue(result['allowedMutationScopeVerified']);self.assertFalse(result['executionAuthorized'])
  for bound in records.values():self.assertEqual(json.loads(Path(bound['path']).read_text())['format'],'axiom.fixture-seal-command/1')
 def test_failed_or_unknown_sign_stops_without_second_command(self):
  with self.constants(),patch.object(self.module(),'_run',return_value={'argv':[],'state':'timeout','exit':None,'cleanup':'unknown','errorType':None,'stdout':b'','stderr':b''})as run,self.assertRaises(ValueError):self.module().execute_fixture_sequence(self.f.baseline)
  self.assertEqual(run.call_count,1);self.assertTrue((self.f.out/'sign-command.json').exists());self.assertFalse((self.f.out/'verify-attempt.json').exists())
 def test_wrong_baseline_path_refuses_before_key_use(self):
  wrong=dict(self.f.baseline);wrong['path']=str(self.f.out/'other.json')
  with self.constants(),patch.object(self.module(),'_run')as run,self.assertRaises(ValueError):self.module().execute_fixture_sequence(wrong)
  run.assert_not_called()
 def test_external_node_mutation_after_capture_refuses_before_any_key_call(self):
  (self.f.destination/'fixture-tools/node').write_bytes(b'changed after baseline')
  with self.constants(),patch.object(self.module(),'_run')as run,self.assertRaises(ValueError):self.module().execute_fixture_sequence(self.f.baseline)
  run.assert_not_called()
 def test_fixture_resource_mutation_after_capture_refuses_before_any_key_call(self):
  (self.f.app/'Contents/Resources/qualification/fixture-producer.cjs').write_bytes(b'changed after baseline')
  with self.constants(),patch.object(self.module(),'_run')as run,self.assertRaises(ValueError):self.module().execute_fixture_sequence(self.f.baseline)
  run.assert_not_called()
 def test_sequence_is_once_only(self):
  with self.constants(),patch.object(self.module(),'_run',side_effect=self.successful)as run:
   self.module().execute_fixture_sequence(self.f.baseline)
   with self.assertRaises((ValueError,FileExistsError)):self.module().execute_fixture_sequence(self.f.baseline)
   self.assertEqual(run.call_count,3)
 def test_frozen_driver_baseline_failure_never_calls_key_sequence(self):
  import importlib.util
  path=Path(__file__).resolve().parents[3]/'docs/recovery/2026-11-06/governance-stage-b-source-preparation/final-seal-1-prepared/prepared-final-seal-driver.py';spec=importlib.util.spec_from_file_location('prepared_final_seal_driver_fixture',path);d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
  q=self.module();output=self.f.f.root/'driver-output';inputs=self.f.f.root/'driver-inputs.json'
  with patch.object(q,'OUTPUT',output):
   config={'procedureRepo':str(self.f.f.root),'helpers':{},'targetApp':str(q.APP),'output':str(output),'commands':q.commands(),'timeouts':q.TIMEOUTS,'presealReceipt':{'fixture':'bound proof'}};inputs.write_text(json.dumps(config));d.INPUTS=inputs;d.INPUTS_SHA256=hashlib.sha256(inputs.read_bytes()).hexdigest()
   with patch.object(d.sys,'argv',['prepared']),patch.object(fixture.s.old,'_bound',side_effect=lambda value:value),patch.object(fixture.s,'capture_fixture_seal_baseline',side_effect=ValueError('baseline refused')),patch.object(q,'execute_fixture_sequence')as no_keys,self.assertRaises(ValueError):d.main()
   no_keys.assert_not_called();self.assertEqual(json.loads((output/'result.json').read_text())['phase'],'capture-current-baseline')
if __name__=='__main__':unittest.main()
