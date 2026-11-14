"""Source contracts only. Never compiles or executes C/Rust/native clocks."""
from pathlib import Path
import unittest,sys,re
ROOT=Path(__file__).resolve().parents[2]
BASE=ROOT/'packages/verified-issuer-runtime/linux'
class OperationalNativeSource(unittest.TestCase):
 def read(self,name):return (BASE/name).read_text()
 def test_closed_fd_and_wire_contract(self):
  s=self.read('time_operational_status.h');self.assertIn('AXIOM_OPERATIONAL_ACCEPT_FD 8',s);self.assertIn('AXIOM_OPERATIONAL_CHECK_FD 9',s);self.assertIn('AXIOM_OPERATIONAL_STATUS_FD 10',s);self.assertIn('4096',s)
 def test_parser_canonical_and_no_json(self):
  s=self.read('time_operational_status.c');self.assertIn('UINT64_MAX',s);self.assertIn('AXIOM_CHECK_V1',s);self.assertIn('AXIOM_STATUS_V1',s);self.assertNotIn('strtoull',s)
 def test_native_bracket_between_status_checks(self):
  s=self.read('time_operational_binding.c');start=s.index('static int sample_original(');s=s[start:s.index('\n}',start)];self.assertLess(s.index('check_owner'),s.index('axiom_operational_monotonic(&s->before)'));self.assertLess(s.index('realtime(&s->realtime)'),s.rindex('check_owner'));self.assertIn('axiom_time_parent_pin_original',s);self.assertIn('axiom_time_parent_original_current',s)
 def test_original_sample_private_tag_and_no_constructor(self):
  s=self.read('time_operational_binding.c');self.assertIn('napi_check_object_type_tag',s);self.assertIn('axiom_time_operational_create_private',s);self.assertIn('NAPI_MODULE(NODE_GYP_MODULE_NAME,initialize_operational)',s);self.assertNotIn('\"createPrivate\"',s);self.assertNotIn('getenv(',s)
 def test_daemon_ready_requires_source_and_ack(self):
  s=self.read('operational_publication.rs');self.assertIn('ClockStatus::Synchronized',s);self.assertIn('OriginSourceKind::Ntp',s);self.assertIn('publication_acknowledged',s);self.assertIn('Unknown',s);self.assertNotIn('AcceptedPreciseTimePolicy',s)
 def test_owner_checks_real_services_and_original_child(self):
  s=self.read('time_operational_owner.c');self.assertIn('/proc',s);self.assertIn('/sys/power/suspend_stats/success',s);self.assertIn('pidfd',s);self.assertIn('chronyd.service',s);self.assertNotIn('system(',s)
 def test_patch_hooks_actual_publication_and_invalidation(self):
  s=self.read('clockbound-operational-time.patch');self.assertIn('publish_precise_then_delegate',s);self.assertIn('publication_acknowledged',s);self.assertIn('invalidate_then_delegate',s)
 def test_original_worker_deadline_is_not_reset(self):
  s=self.read('time_operational_binding.c');execute=s[s.index('static void execute('):s.index('static int bigint(')];self.assertIn('uint64_t deadline=t->sample->deadline',execute);self.assertNotIn('deadline=now+AXIOM_OPERATIONAL_DEADLINE_NS',execute)
  parent=self.read('time_parent_binding.c');self.assertIn('*deadline=c->deadline',parent);self.assertIn('c->state==REAPED&&c->reaped&&c->io_done',parent)
 def test_original_lease_retires_and_releases(self):
  s=self.read('time_operational_binding.c');self.assertIn('napi_wrap(e,out,s,sample_finalizer',s);self.assertIn('axiom_time_parent_unpin_original',s);self.assertIn('s->owner!=o||s->consumed',s);self.assertIn('o->active->consumed=1',s)
 def test_ready_never_mints_strict_policy(self):
  patch=self.read('clockbound-operational-time.patch');self.assertIn('let mut operational=self.operational.take()',patch);self.assertIn('accepted_policy:None,operational:None',patch)
  rust=self.read('operational_publication.rs');self.assertIn('publication <= self.last',rust);self.assertIn('State::Unknown',rust)
 def test_actual_layered_patch_applies_exact_source(self):
  sys.path.insert(0,str(ROOT/'scripts'))
  from governance_host_evaluation_inputs import evaluation_files
  files=evaluation_files(ROOT);lines=self.read('clockbound-operational-time.patch').splitlines(True);i=0;changed={}
  while i<len(lines):
   self.assertTrue(lines[i].startswith('--- a/'));path=lines[i][6:].strip();i+=1
   self.assertEqual(lines[i],'+++ b/'+path+'\n');i+=1;original=files.get(path,b'').decode().splitlines(True);out=[];cursor=0
   while i<len(lines) and lines[i].startswith('@@ '):
    h=re.match(r'@@ -(\d+),(\d+) \+(\d+),(\d+) @@',lines[i]);self.assertIsNotNone(h);at=max(0,int(h[1])-1);old=int(h[2]);new=int(h[4]);i+=1;out+=original[cursor:at];cursor=at;removed=added=0
    while removed<old or added<new:
     line=lines[i];i+=1
     if line[0] in ' -':self.assertEqual(original[cursor],line[1:]);cursor+=1;removed+=1
     if line[0] in ' +':out.append(line[1:]);added+=1
    self.assertEqual((removed,added),(old,new))
   out+=original[cursor:];changed[path]=''.join(out)
  self.assertIn('construct_operational',changed['clock-bound/src/daemon.rs'])
  self.assertIn('run_host_evaluation_ipv4',changed['clock-bound/src/daemon/io/amazon_time_sync.rs'])
  self.assertNotIn('accepted_policy:Some',changed['clock-bound/src/daemon/time_publication_adapter.rs'])
  self.assertIn('/run/axiom-operational-time/compat/v2',changed['clock-bound/src/daemon/clock_state.rs'])
 def test_n1_execute_and_delivery_recheck_original_deadline(self):
  s=self.read('time_operational_binding.c')
  execute=s[s.index('static void execute('):s.index('static int bigint(')]
  self.assertIn('axiom_operational_monotonic(&finished)||finished>=t->sample->deadline',execute)
  self.assertGreater(execute.index('axiom_operational_monotonic(&finished)'),execute.rindex('axiom_time_parent_original_current'))
  complete=s[s.index('static void complete('):s.index('static napi_value queue(')]
  self.assertIn('axiom_operational_monotonic(&delivered)||delivered>=t->sample->deadline',complete)
  self.assertLess(complete.index('axiom_operational_monotonic(&delivered)'),complete.index('napi_create_object'))
  self.assertIn('if(t->current||!t->success)',complete);self.assertIn('dispose_sample(t->sample)',complete)
 def test_n2_discontinuity_sticky_retires_after_startup(self):
  s=self.read('time_operational_owner.c');startup=s[s.index('while(actual.state!=AXIOM_OP_READY)'):s.index('/* The production consumer')]
  self.assertIn('event.state!=AXIOM_OP_UNKNOWN',startup)
  steady=s[s.index('while(!withdrawing&&alive(npidfd))'):s.index('done:withdrawing=1')]
  self.assertIn('int retire_generation=event.state!=AXIOM_OP_READY',steady)
  self.assertIn('if(retire_generation)withdrawing=1',steady)
  self.assertIn('if(retire_generation)break',steady)
  self.assertLess(steady.index('if(retire_generation)withdrawing=1'),steady.index('axiom_operational_write_frame(ack[1]'))
  self.assertLess(steady.index('if(retire_generation)break'),steady.index('if(fds[1].revents)'))
 def test_n3_native_context_and_sample_are_frozen_before_exposure(self):
  s=self.read('time_operational_binding.c');complete=s[s.index('static void complete('):s.index('static napi_value queue(')]
  self.assertIn('napi_object_freeze(e,out)!=napi_ok',complete)
  self.assertLess(complete.index('napi_object_freeze(e,out)'),complete.index('napi_wrap(e,out,s,sample_finalizer'))
  create=s[s.index('napi_status axiom_time_operational_create_private('):s.index('static napi_value initialize_operational(')]
  self.assertIn('napi_object_freeze(e,context)!=napi_ok',create)
  self.assertLess(create.index('napi_object_freeze(e,context)'),create.index('napi_create_reference(e,context'))
 def test_n4_whole_invocation_budget_begins_before_hold(self):
  s=self.read('time_operational_binding.c')
  self.assertIn('static napi_value begin_cb(',s);self.assertIn('now>UINT64_MAX-AXIOM_OPERATIONAL_DEADLINE_NS',s)
  self.assertIn('o->invocation_deadline=now+AXIOM_OPERATIONAL_DEADLINE_NS',s)
  self.assertIn('!o->retired&&!o->busy&&!o->active&&!o->invocation',s)
  self.assertIn('s->deadline>invocation_deadline',s);self.assertIn('s->deadline=invocation_deadline',s)
  self.assertIn('{"beginObservation",NULL,begin_cb',s)
  self.assertIn('if(t->current&&t->success)o->invocation=0',s)
if __name__=='__main__':unittest.main()
