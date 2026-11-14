import copy,importlib.util,unittest
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'governance_build_ipc_compile.py'
class BuildGateTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  s=importlib.util.spec_from_file_location('build_ipc',P);cls.m=importlib.util.module_from_spec(s);s.loader.exec_module(cls.m)
 def test_only_all_three_pass_can_complete(self):
  seen=[]
  def stage(n):
   def call():seen.append(n);return True
   return call
  self.assertTrue(self.m.gated_pipeline(stage('fixtures'),stage('tiny'),stage('full')))
  self.assertEqual(seen,['fixtures','tiny','full'])
 def test_failed_or_unknown_fixture_never_reaches_tiny_or_full(self):
  for value in [False,None,1]:
   seen=[]
   with self.assertRaises(ValueError):self.m.gated_pipeline(lambda:value,lambda:seen.append('tiny'),lambda:seen.append('full'))
   self.assertEqual(seen,[])
 def test_tiny_failure_never_runs_full_or_retries(self):
  seen=[]
  def tiny():seen.append('tiny');raise ValueError('not accepted')
  with self.assertRaises(ValueError):self.m.gated_pipeline(lambda:True,tiny,lambda:seen.append('full'))
  self.assertEqual(seen,['tiny'])
 def test_exact_source_transition_not_old_grant(self):
  e={'action':'synchronize','number':331,'before':'207cf145a15b87c07206027fc2e2f08511b3523a','after':'a'*40,'repository':{'full_name':'sahme209/visionxixlabs','private':False},'pull_request':{'number':331,'base':{'ref':'main','repo':{'full_name':'sahme209/visionxixlabs'}},'head':{'ref':'codex/governance-live-qualification-setup','sha':'a'*40,'repo':{'full_name':'sahme209/visionxixlabs'}}}}
  self.assertEqual(self.m.validate_event(e,'pull_request','1'),'a'*40)
  for key,value in [('before','47adbced23b378f4f4789a6bec8d836641785240'),('after','b'*40),('number',332)]:
   c=copy.deepcopy(e);c[key]=value
   with self.assertRaises(ValueError):self.m.validate_event(c,'pull_request','1')
  with self.assertRaises(ValueError):self.m.validate_event(e,'pull_request','2')
 def test_shared_budget_cannot_be_reset_per_stage(self):
  self.assertEqual(self.m.phase_budget(100,90,30),5)
  with self.assertRaises(ValueError):self.m.phase_budget(100,96,30)
  with self.assertRaises(ValueError):self.m.phase_budget(100,100,30)
 def test_changed_tool_or_standard_library_cannot_inherit_observation(self):
  saved={'toolSha256':{'rustc':'r','cargo':'c','cc':'cc','git':'g','true':'t'},'standardLibrarySha256':{'std':'s','core':'k'},'toolchain':{'target':'x86_64-unknown-linux-gnu','rustcRelease':'1.99.1'}}
  self.m.verify_observed_inputs(saved,saved['toolSha256'],saved['standardLibrarySha256'],saved['toolchain'])
  for tools,stdlib,version in [({**saved['toolSha256'],'rustc':'changed'},saved['standardLibrarySha256'],saved['toolchain']),(saved['toolSha256'],{'std':'changed','core':'k'},saved['toolchain']),(saved['toolSha256'],saved['standardLibrarySha256'],{'target':'other'})]:
   with self.assertRaises(ValueError):self.m.verify_observed_inputs(saved,tools,stdlib,version)
if __name__=='__main__':unittest.main()
