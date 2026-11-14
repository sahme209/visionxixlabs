"""Source contracts only: no Node/C compilation, loading or native calls."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
LINUX=ROOT/'packages/verified-issuer-runtime/linux'
class NativeBehaviorSourceTests(unittest.TestCase):
 def text(self,name):
  p=LINUX/name;self.assertTrue(p.exists());return p.read_text()
 def test_private_fixed_initializer(self):
  s=self.text('time_behavior_fixture.c');self.assertIn('runOwnedFixture',s);self.assertIn('fixture_identity.h',s)
  self.assertIn('axiom_time_parent_create_private',s);self.assertIn('argc!=0',s);self.assertIn('NAPI_MODULE',s)
 def test_stall_readiness_then_no_exit(self):
  s=self.text('time_behavior_stall.c');self.assertLess(s.index('"ready"'),s.index('poll(NULL,0,-1)'));self.assertIn('O_EXCL',s);self.assertIn('O_NOFOLLOW',s)
 def test_actual_cutpoints_conditional_only(self):
  s=self.text('time_parent_binding.c');h=self.text('time_parent_binding.h')
  self.assertIn('#ifdef AXIOM_TIME_BEHAVIOR_TEST',s);self.assertIn('test_observation',h)
  for field in ['close_attempts','close_result','close_operation_refs','cancel_at','deadline','reap_code','reap_status']:
   self.assertIn(field,s)
 def test_harness_native_evidence_not_promises_only(self):
  p=ROOT/'scripts/linux-compile/native_time_behavior.mjs';self.assertTrue(p.exists());s=p.read_text()
  for term in ['factsSuccess','factsCancel','cancelReady','close_attempts','close_result','close_operation_refs','reap_code','reap_status','cancel_at','deadline','replaceCurrent','foreign']:
   self.assertIn(term,s)
  self.assertNotIn('setInterval',s);self.assertNotIn('fetch(',s)
 def test_fixed_failure_phase_and_optional_prelaunch_refusal(self):
  s=(ROOT/'scripts/linux-compile/native_time_behavior.mjs').read_text()
  self.assertIn('phase,reason',s);self.assertIn('let replacementWorker',s)
  self.assertIn('if(replacementWorker)',s);self.assertIn("phase='cleanup'",s)
  self.assertNotIn('catch(error)',s)
 def test_initializer_closes_all_setup_descriptors(self):
  s=self.text('time_behavior_fixture.c');self.assertNotIn('close(root)||close(worker)||close(stall)',s)
 def test_native_promise_failures_are_handled_without_raw_stack(self):
  s=(ROOT/'scripts/linux-compile/native_time_behavior.mjs').read_text()
  self.assertIn('void w.completed.catch',s);self.assertIn('void replacementWorker.completed.catch',s)
  self.assertIn('void kw.completed.catch',s);self.assertIn('kw.result.then(()=>false,()=>true)',s)
if __name__=='__main__':unittest.main()
