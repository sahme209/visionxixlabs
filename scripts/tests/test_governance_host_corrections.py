"""Three review corrections. Pure/mocked/source only; no native or signals run."""
import json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts'))
import governance_host_evaluation_bootstrap as boot
import governance_host_evaluation_inputs as inputs
class Ops:
 def __init__(self,where=None):self.where=where;self.cancelled=where=='before';self.calls=[]
 def checkpoint(self):
  if self.cancelled:raise ValueError('cancelled')
 def validate(self,p):self.calls.append('validate')
 def reserve(self,p):self.calls.append('reserve')
 def isolate_services(self):self.calls.append('services')
 def start_producer(self):
  self.calls.append('producer')
  if self.where=='start':self.cancelled=True
  return object()
 def await_source(self,p):self.calls.append('source')
 def assert_producer_running(self,p):self.calls.append('live')
 def read_once(self,p):
  self.calls.append('reader')
  if self.where=='reader':self.cancelled=True
  return {'event':'reader_complete','strictTimeAuthority':False}
 def stop_owned(self,p):self.calls.append('stop')
 def close_local(self):self.calls.append('close')
class HostReviewCorrections(unittest.TestCase):
 def test_runnable_recipe_compiles_then_links_actual_publisher_object(self):
  item=json.loads((ROOT/'packages/verified-issuer-runtime/linux/host-evaluation-package.json').read_text())['components']['bin/axiom-host-evaluation']
  self.assertIn('time_publication.c',item['sources']);self.assertIn('time_publication.h',item['sources'])
  compile=item['compilePublisherObject'];self.assertIn('-c',compile);self.assertIn('time_publication.c',compile)
  recipe=item['recipe'];self.assertEqual(recipe[:2],['cargo','rustc']);self.assertIn('link-arg=<TARGET_BUILD>/time_publication.o',' '.join(recipe));self.assertIn('link-arg=-Wl,--no-undefined',' '.join(recipe))
 def test_cancel_before_ownership_never_launches(self):
  ops=Ops('before');value=boot.evaluate(ops,{})
  self.assertFalse(value['observed']);self.assertEqual(value['reason'],'cancelled');self.assertEqual(ops.calls,['close'])
 def test_cancel_during_start_records_owner_then_stops(self):
  ops=Ops('start');value=boot.evaluate(ops,{})
  self.assertFalse(value['observed']);self.assertEqual(value['reason'],'cancelled');self.assertNotIn('source',ops.calls);self.assertEqual(ops.calls[-2:],['stop','close']);self.assertTrue(value['cleanupKnown'])
 def test_cancel_during_reader_retains_result_and_cleanup_ignores_flag(self):
  ops=Ops('reader');value=boot.evaluate(ops,{})
  self.assertFalse(value['observed']);self.assertEqual(value['reason'],'cancelled');self.assertIn('rawObservation',value);self.assertEqual(ops.calls[-2:],['stop','close'])
 def test_signal_callback_only_sets_flag(self):
  c=boot.DeferredCancellation();c.request(15,None);self.assertTrue(c.requested)
  with self.assertRaisesRegex(ValueError,'cancelled'):c.checkpoint()
 def test_fixed_runner_preserves_actual_error_variants(self):
  source=inputs.evaluation_files(ROOT)['clock-bound/src/daemon/io/amazon_time_sync.rs'].decode()
  selected=source.split('async fn run_host_evaluation_ipv4',1)[1].split('async fn handle_interval_tick',1)[0]
  self.assertIn('Err(error)',selected);self.assertIn('ntp_failure',selected)
  for name in ['NtpIoError::Bind','NtpIoError::SampleIo','NtpIoError::Timeout','NtpIoError::UnusableNtpResponse','NtpIoError::TscOrder','PermissionDenied','InvalidStratum','BadTimestamps','Unsynchronized','KissODeath']:self.assertIn(name,source)
  self.assertNotIn('println!("{error}',source)
 def test_fixed_failure_event_rejects_unknown_and_raw_details(self):
  value={'format':1,'event':'ntp_failure','category':'permission_refused','strictTimeAuthority':False}
  self.assertEqual(boot.source_event(value),('failure','permission_refused'))
  for key,item in [('category','raw error detail'),('raw','secret'),('strictTimeAuthority',True)]:
   bad=dict(value);bad[key]=item
   with self.assertRaises(ValueError):boot.source_event(bad)
 def test_cancellation_during_cleanup_does_not_abort_cleanup_or_report_success(self):
  class O(Ops):
   def stop_owned(self,p):self.calls.append('stop');self.cancelled=True
  ops=O();value=boot.evaluate(ops,{})
  self.assertFalse(value['observed']);self.assertEqual(value['reason'],'cancelled');self.assertTrue(value['cleanupKnown']);self.assertEqual(ops.calls[-2:],['stop','close'])
 def test_source_categories_survive_failed_observation(self):
  class O(Ops):
   source_failures=['bind_failure','permission_refused']
   def await_source(self,p):raise ValueError('source_unavailable')
  value=boot.evaluate(O(),{})
  self.assertEqual(set(value['sourceFailures']),{'bind_failure','permission_refused'});self.assertFalse(value['observed'])
if __name__=='__main__':unittest.main()
