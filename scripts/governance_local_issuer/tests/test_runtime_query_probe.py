"""Synthetic owned files + mocked child; never executes Node/native library."""
from pathlib import Path
import os,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import runtime_query_probe as p
class RuntimeQueryTests(unittest.TestCase):
 def fixture(self):
  t=tempfile.TemporaryDirectory(prefix='axiom-runtime-mode-',dir='/private/tmp');self.addCleanup(t.cleanup);f=Path(t.name)/'node';f.write_bytes(b'SYNTHETIC NOT A NODE BINARY');f.chmod(0o600);return f,{'node':p.binding(f)}
 def test_exception_restores_original_descriptor_mode_and_bytes(self):
  f,packet=self.fixture();before=f.read_bytes()
  with patch.object(p,'execute_child',side_effect=RuntimeError('PRIVATE')):r=p.run_candidate(packet)
  self.assertEqual(f.stat().st_mode&0o777,0o600);self.assertEqual(f.read_bytes(),before);self.assertEqual(r['status'],'unknown');self.assertEqual(r['modeRestoration'],'verified');self.assertNotIn('PRIVATE',str(r))
 def test_unknown_child_still_restores_without_retry(self):
  f,packet=self.fixture();calls=[]
  with patch.object(p,'execute_child',side_effect=lambda _:calls.append('once') or {'status':'unknown','reason':'child_cleanup_unknown'}):r=p.run_candidate(packet)
  self.assertEqual(calls,['once']);self.assertEqual(r['status'],'unknown');self.assertEqual(r['modeRestoration'],'verified');self.assertEqual(f.stat().st_mode&0o777,0o600)
 def test_success_is_still_not_governance_qualification(self):
  f,packet=self.fixture()
  def child(_):
   self.assertEqual(f.stat().st_mode&0o777,0o700);return {'status':'module_load_observed'}
  with patch.object(p,'execute_child',side_effect=child):r=p.run_candidate(packet)
  self.assertEqual(r['status'],'module_load_observed');self.assertFalse(r['governanceQualified']);self.assertEqual(r['modeRestoration'],'verified')
 def test_replacement_path_never_receives_restore_chmod(self):
  f,packet=self.fixture();original=f.with_name('original')
  def child(_):f.rename(original);f.write_bytes(b'REPLACEMENT');f.chmod(0o644);return {'status':'module_load_observed'}
  with patch.object(p,'execute_child',side_effect=child):r=p.run_candidate(packet)
  self.assertEqual(original.stat().st_mode&0o777,0o600);self.assertEqual(f.stat().st_mode&0o777,0o644);self.assertEqual(r['status'],'unknown');self.assertEqual(r['pathCurrentness'],'unavailable')
 def test_restore_failure_is_separately_unknown(self):
  f,packet=self.fixture();real=os.fchmod;calls=[]
  def chmod(fd,mode):
   calls.append(mode)
   if mode==0o600:raise OSError('PRIVATE')
   real(fd,mode)
  with patch.object(p,'execute_child',return_value={'status':'refused'}),patch.object(p.os,'fchmod',side_effect=chmod):r=p.run_candidate(packet)
  self.assertEqual(r['status'],'unknown');self.assertEqual(r['modeRestoration'],'unavailable');self.assertEqual(calls,[0o700,0o600]);real_fd=os.open(f,os.O_RDONLY);real(real_fd,0o600);os.close(real_fd)
 def test_output_classification_is_exact_and_secret_free(self):
  self.assertEqual(p.classify(0,None,p.SUCCESS)['status'],'module_load_observed')
  self.assertEqual(p.classify(73,None,b'AXIOM_QUERY_LOAD_REFUSED library_validation_refused\n')['reason'],'library_validation_refused')
  self.assertEqual(p.classify(0,None,b'PRIVATE '+p.SUCCESS)['status'],'refused')
  self.assertEqual(p.classify(None,'timeout',b'PRIVATE')['status'],'unknown')
 def test_interrupt_after_chmod_cannot_leave_copy_executable(self):
  f,packet=self.fixture();real=os.fchmod
  def chmod(fd,mode):
   real(fd,mode)
   if mode==0o700:raise KeyboardInterrupt()
  with patch.object(p.os,'fchmod',side_effect=chmod),patch.object(p,'execute_child',side_effect=AssertionError('NO CHILD')):r=p.run_candidate(packet)
  self.assertEqual(f.stat().st_mode&0o777,0o600);self.assertEqual(r['modeRestoration'],'verified');self.assertEqual(r['status'],'unknown')
 def test_attempt_is_consumed_once_even_for_unknown_result(self):
  temp=tempfile.TemporaryDirectory(prefix='axiom-runtime-ledger-',dir='/private/tmp');self.addCleanup(temp.cleanup);root=Path(temp.name);(root/'work').mkdir();p.save(root/'packet.json',{})
  calls=[]
  with patch.object(p,'ROOT',root),patch.object(p,'verify_inputs'),patch.object(p,'run_candidate',side_effect=lambda _:calls.append('once') or {'status':'unknown'}):
   r=p.execute(root/'packet.json');before=(root/'attempt.json').read_bytes()
   with self.assertRaises(ValueError):p.execute(root/'packet.json')
   self.assertEqual((root/'attempt.json').read_bytes(),before)
  self.assertEqual(calls,['once']);self.assertEqual(r['status'],'unknown')
 def test_postrun_input_failure_cannot_accept_success(self):
  temp=tempfile.TemporaryDirectory(prefix='axiom-runtime-ledger-',dir='/private/tmp');self.addCleanup(temp.cleanup);root=Path(temp.name);(root/'work').mkdir();p.save(root/'packet.json',{})
  with patch.object(p,'ROOT',root),patch.object(p,'verify_inputs',side_effect=[None,ValueError('PRIVATE')]),patch.object(p,'run_candidate',return_value={'status':'module_load_observed','modeRestoration':'verified'}):r=p.execute(root/'packet.json')
  self.assertEqual(r['status'],'unknown');self.assertEqual(r['finalInputCurrentness'],'unavailable');self.assertEqual(r['modeRestoration'],'verified')
if __name__=='__main__':unittest.main()
