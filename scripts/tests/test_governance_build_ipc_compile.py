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
  e={'action':'synchronize','number':331,'before':'8aefbd599cd921eff685295ae8eacb89e59499a4','after':'a'*40,'repository':{'full_name':'sahme209/visionxixlabs','private':False},'pull_request':{'number':331,'base':{'ref':'main','repo':{'full_name':'sahme209/visionxixlabs'}},'head':{'ref':'codex/governance-live-qualification-setup','sha':'a'*40,'repo':{'full_name':'sahme209/visionxixlabs'}}}}
  self.assertEqual(self.m.validate_event(e,'pull_request','1'),'a'*40)
  for key,value in [('before','7c35aec14a424caab5c4a52cb0d163a5583ad0fa'),('before','47adbced23b378f4f4789a6bec8d836641785240'),('after','b'*40),('number',332)]:
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
 def test_symbol_observation_keeps_actual_rows_before_strict_acceptance(self):
  text='00000001 T <clock_bound[abc]::daemon::Daemon>::construct_axiom\n00000002 T unrelated\n00000003 T axiom_time_capture_v2\n00000004 T axiom_time_publish_or_die\n00000005 T axiom_time_capture_current\n00000006 T axiom_time_capture_release\n'
  observed=self.m.collect_symbol_evidence(text)
  self.assertEqual(observed['candidateRows'],['00000001 T <clock_bound[abc]::daemon::Daemon>::construct_axiom','00000003 T axiom_time_capture_v2','00000004 T axiom_time_publish_or_die','00000005 T axiom_time_capture_current','00000006 T axiom_time_capture_release'])
  self.assertTrue(observed['complete']);self.assertEqual(observed['stdoutBytes'],len(text.encode()))
  # Observing an unfamiliar spelling must NOT turn it into an accepted path.
  with self.assertRaises(ValueError):self.m.verify_symbols(text,text)
 def test_symbol_observation_overflow_cannot_appear_complete(self):
  text=('00000001 T construct_axiom\n')*257
  observed=self.m.collect_symbol_evidence(text)
  self.assertFalse(observed['complete']);self.assertEqual(observed['candidateCount'],257)
  self.assertLessEqual(len(observed['candidateRows']),256)
 def test_large_unrelated_metadata_cannot_discard_symbol_receipt(self):
  import json
  result={'accepted':False,'head':'a'*40,'packetSha256':'b'*64,'packages':'x'*(3*1024*1024),'outputs':{'linked':{'sha256':'c'*64}},'rawSymbolEvidence':{'candidateRows':['T construct_axiom'],'complete':True},'demangledSymbolEvidence':{'candidateRows':['T <clock_bound[abc]::daemon::Daemon>::construct_axiom'],'complete':True},'finalSourceChecksPassed':True,'finalFrozenInputsMatched':True}
  data=json.loads(self.m.render_symbol_receipt(result))
  self.assertEqual(data['rawSymbolEvidence']['candidateRows'],['T construct_axiom']);self.assertNotIn('packages',data)
  self.assertLess(len(self.m.render_symbol_receipt(result)),1024*1024)
 def test_symbol_receipt_wire_overflow_is_explicitly_unaccepted(self):
  import json
  data=json.loads(self.m.render_symbol_receipt({'accepted':True,'outputs':'x'*(2*1024*1024)}))
  self.assertFalse(data['accepted']);self.assertFalse(data['evidenceComplete']);self.assertEqual(data['reason'],'wire-limit')
 def actual_symbols(self):
  import json
  evidence=Path(__file__).resolve().parents[2]/'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-SYMBOL-PRIMARY-EVIDENCE.json'
  data=json.loads(evidence.read_text())
  return '\n'.join(data['demangledSymbolEvidence']['candidateRows']), '\n'.join(data['rawSymbolEvidence']['candidateRows'])
 def test_actual_primary_pairs_accept_while_old_failure_stays_preserved(self):
  text,raw=self.actual_symbols();self.m.verify_symbols(text,raw)
 def test_primary_pair_rejects_missing_closure_only_wrong_receiver_and_suffix(self):
  text,raw=self.actual_symbols()
  primary='000000000020a440 T <clock_bound::daemon::Daemon>::construct_axiom'
  for replacement in ['',primary+'::{closure#0}',primary.replace('::Daemon>','::Other>'),primary+'suffix']:
   with self.subTest(replacement=replacement),self.assertRaises(ValueError):self.m.verify_symbols(text.replace(primary,replacement),raw)
 def test_primary_pair_rejects_duplicate_data_undefined_and_case_drift(self):
  text,raw=self.actual_symbols();primary='000000000020a440 T <clock_bound::daemon::Daemon>::construct_axiom'
  for replacement in [primary+'\n'+primary,primary.replace(' T ',' D '),primary.replace(' T ',' U '),primary.replace('construct_axiom','Construct_axiom')]:
   with self.subTest(replacement=replacement),self.assertRaises(ValueError):self.m.verify_symbols(text.replace(primary,replacement),raw)
 def test_primary_pair_rejects_raw_address_type_identity_and_duplicate(self):
  text,raw=self.actual_symbols();primary=next(x for x in raw.splitlines() if x.startswith('000000000020a440 T '))
  for replacement in ['',primary.replace('20a440','20a441'),primary.replace(' T ',' t '),primary+'suffix',primary+'\n'+primary]:
   with self.subTest(replacement=replacement),self.assertRaises(ValueError):self.m.verify_symbols(text,raw.replace(primary,replacement))
 def test_c_pair_rejects_wrong_type_duplicate_or_unpaired(self):
  text,raw=self.actual_symbols();primary='0000000000751103 T axiom_time_capture_current'
  for changed,raw_changed in [(text.replace(primary,primary.replace(' T ',' D ')),raw),(text+'\n'+primary,raw),(text,raw.replace(primary,'')),(text,raw.replace(primary,primary.replace('751103','751104')))]:
   with self.subTest(changed=changed[-90:]),self.assertRaises(ValueError):self.m.verify_symbols(changed,raw_changed)
 def test_pair_rejects_oversize_and_missing_raw_table(self):
  text,raw=self.actual_symbols()
  for changed,raw_changed in [(text,None),(text,'x'*(16*1024*1024+1)),('x'*(16*1024*1024+1),raw)]:
   with self.assertRaises(ValueError):self.m.verify_symbols(changed,raw_changed)
if __name__=='__main__':unittest.main()
