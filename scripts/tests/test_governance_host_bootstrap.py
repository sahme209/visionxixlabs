"""Pure/mocked controller and actual source contracts. No host/native execution."""
import sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts'))
import governance_host_evaluation_bootstrap as boot
class Fake:
 def __init__(self,fail=None):self.calls=[];self.fail=fail
 def call(self,name,*args):
  self.calls.append(name)
  if name==self.fail:raise ValueError('source_unavailable')
  return {'event':'reader_complete','strictTimeAuthority':False}
 def validate(self,p):self.call('validate',p)
 def reserve(self,p):self.call('reserve',p)
 def isolate_services(self):self.call('services')
 def start_producer(self):return self.call('producer')
 def await_source(self,p):return self.call('source',p)
 def assert_producer_running(self,p):self.call('live',p)
 def read_once(self,p):return self.call('reader',p)
 def stop_owned(self,p):self.call('stop',p)
class HostBootstrap(unittest.TestCase):
 def test_actual_orchestration_source_before_reader_cleanup_last(self):
  f=Fake();value=boot.evaluate(f,{})
  self.assertEqual(f.calls,['validate','reserve','services','producer','source','live','reader','live','stop'])
  self.assertTrue(value['observed']);self.assertFalse(value['strictTimeAuthority'])
 def test_source_failure_never_reads_or_restarts_and_still_reaps(self):
  f=Fake('source');value=boot.evaluate(f,{})
  self.assertEqual(f.calls,['validate','reserve','services','producer','source','stop']);self.assertFalse(value['observed']);self.assertEqual(value['reason'],'source_unavailable')
 def test_unknown_cleanup_never_success(self):
  f=Fake('stop');value=boot.evaluate(f,{})
  self.assertFalse(value['observed']);self.assertEqual(value['reason'],'cleanup_unknown')
 def test_preownership_failure_never_kills(self):
  f=Fake('producer');value=boot.evaluate(f,{})
  self.assertNotIn('stop',f.calls);self.assertNotIn('reader',f.calls);self.assertFalse(value['observed'])
 def test_actual_private_binding_and_harness_have_no_fixture_publication(self):
  c=ROOT/'packages/verified-issuer-runtime/linux/time_host_evaluation_binding.c';self.assertTrue(c.exists());s=c.read_text()
  self.assertIn('axiom_time_parent_create_private',s);self.assertIn('host-evaluation-1',s)
  self.assertNotIn('write(',s);self.assertNotIn('O_CREAT',s)
  js=(ROOT/'scripts/linux-compile/host_evaluation_reader.mjs').read_text();self.assertIn('observeResourceCurrent',js);self.assertIn('completed.catch',js)
 def test_fixed_bootstrap_and_reader_ownership(self):
  s=(ROOT/'scripts/governance_host_evaluation_bootstrap.py').read_text()
  for x in ['mask','chronyd.service','ntpd.service','systemd-timesyncd.service','ecs.service','start_new_session=True','extra_groups=()','O_EXCL','O_NOFOLLOW']:self.assertIn(x,s)
  self.assertNotIn('shell=True',s);self.assertNotIn('dnf ',s);self.assertNotIn('time_behavior_fixture',s)
 def test_package_total_budget(self):
  row={'format':1,'assurance':'trusted-operational-host-evaluation-only','ami':'ami-001cbfee94278a792','readerUid':123,'readerGid':123,'files':{n:{'sha256':'a'*64,'bytes':200*1024*1024} for n in boot.FIXED_FILES}}
  with self.assertRaises(ValueError):boot.validate_packet(row)
 def test_io_is_bounded_during_capture(self):
  s=(ROOT/'scripts/governance_host_evaluation_bootstrap.py').read_text()
  self.assertIn('def _capture_owned',s);self.assertNotIn('.communicate(',s);self.assertNotIn('subprocess.run(',s)
 def test_local_descriptors_close_after_preproducer_failure(self):
  class F(Fake):
   def close_local(self):self.calls.append('local_close')
  f=F('services');boot.evaluate(f,{})
  self.assertEqual(f.calls[-1],'local_close');self.assertNotIn('stop',f.calls)
 def test_retired_during_read_refuses_but_retains_original_observation(self):
  class F(Fake):
   def assert_producer_running(self,p):
    self.call('live',p)
    if self.calls.count('live')==2:raise ValueError('producer_exited')
  f=F();value=boot.evaluate(f,{})
  self.assertFalse(value['observed']);self.assertEqual(value['reason'],'producer_exited');self.assertIn('rawObservation',value);self.assertTrue(value['cleanupKnown']);self.assertEqual(f.calls.count('reader'),1)
 def test_actual_capture_loop_refuses_chunk_before_buffering_over_budget(self):
  from unittest.mock import patch,MagicMock
  mux=MagicMock();pipe=MagicMock();pipe.fileno.return_value=7
  key=type('Key',(),{'fileobj':pipe,'data':0})()
  process=MagicMock();process.stdout=pipe;process.stderr=None
  mux.get_map.return_value={7:key};mux.select.return_value=[(key,1)]
  with patch.object(boot.selectors,'DefaultSelector',return_value=mux),patch.object(boot.os,'set_blocking'),patch.object(boot.os,'read',return_value=b'12345'),patch.object(boot.time,'monotonic',return_value=0):
   with self.assertRaisesRegex(ValueError,'resource_refused'):boot.HostOps._capture_owned(process,1,4)
  process.wait.assert_not_called();mux.close.assert_called_once()
 def test_actual_capture_deadline_refuses_before_read(self):
  from unittest.mock import patch,MagicMock
  mux=MagicMock();pipe=MagicMock();process=MagicMock();process.stdout=pipe;process.stderr=None
  mux.get_map.return_value={7:object()}
  with patch.object(boot.selectors,'DefaultSelector',return_value=mux),patch.object(boot.os,'set_blocking'),patch.object(boot.os,'read') as read,patch.object(boot.time,'monotonic',side_effect=[0,2]):
   with self.assertRaisesRegex(ValueError,'timeout'):boot.HostOps._capture_owned(process,1,4)
  read.assert_not_called();process.wait.assert_not_called()
 def test_exact_raw_reader_output_domains(self):
  record={'format':1,'event':'reader_complete','strictTimeAuthority':False,'sourceGeneration':'host-evaluation-1','publication':'1','disruptionMarker':'0','device':'1','inode':'2','realtimeNs':'5','p0Ns':'1','p1Ns':'2','p2Ns':'3'}
  self.assertEqual(boot.validate_reader_result(record),record)
  for key,value in [('publication','0'),('p2Ns','1'),('p1Ns','01'),('device','18446744073709551616'),('realtimeNs','9223372036854775808'),('strictTimeAuthority',True),('extra','field')]:
   changed=dict(record);changed[key]=value
   with self.subTest(key=key):
    with self.assertRaises(ValueError):boot.validate_reader_result(changed)
 def test_artifact_privilege_bits_refuse_before_native_attribute_read(self):
  from unittest.mock import patch,MagicMock
  import stat
  value=type('Meta',(),{'st_mode':stat.S_IFREG|0o4755,'st_uid':0})()
  with patch.object(boot.os,'lstat',return_value=value),patch.object(boot.HostOps,'_no_acl') as attributes:
   with self.assertRaises(ValueError):boot.HostOps._root_path('/fixed/nonexistent-test')
  attributes.assert_not_called()
if __name__=='__main__':unittest.main()
