"""Source contracts only: do not compile/load native code or invoke OS APIs."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
C=ROOT/'packages/verified-issuer-runtime/linux/time_parent_binding.c'
H=C.with_suffix('.h')
class ParentSource(unittest.TestCase):
 def test_private_initializer_only(self):
  s=C.read_text();h=H.read_text()
  self.assertIn('axiom_time_parent_create_private',s);self.assertIn('axiom_time_parent_create_private',h)
  for bad in ['NAPI_MODULE(', 'napi_register_module_v1','waitpid(-1','kill(child->pid','fork(']:self.assertNotIn(bad,s)
 def test_owned_atomic_child_and_exact_reap(self):
  s=C.read_text()
  for expected in ['CLONE_PIDFD','SYS_clone3','SYS_pidfd_send_signal','waitid(P_PIDFD','WEXITED|WNOHANG','ECHILD','RETIRED_UNKNOWN']:self.assertIn(expected,s)
 def test_nonblocking_work_and_lifetime(self):
  s=C.read_text()
  for expected in ['active_hold','napi_type_tag_object','napi_check_object_type_tag','child_reference_finalizer','method_finalizer','bootstrap_write','SIGPIPE','napi_create_async_work','napi_queue_async_work','eventfd(','poll(','O_NONBLOCK','operation_refs','release_requested','napi_create_reference','napi_delete_reference']:self.assertIn(expected,s)
 def test_fixed_descriptor_child(self):
  s=C.read_text()
  for expected in ['SYS_dup3','SYS_close_range','SYS_execveat','AT_EMPTY_PATH','_exit(70)','child_exec_only']:self.assertIn(expected,s)
 def test_no_qualification_or_number_roundtrip(self):
  s=C.read_text()
  self.assertIn('napi_create_bigint_uint64',s)
  for bad in ['napi_get_value_double','qualified:true','lambdaMin','TimePremises','CLOCK_REALTIME']:self.assertNotIn(bad,s)
 def test_original_hold_identity_and_cleanup(self):
  s=C.read_text()
  for expected in ['axiom_time_capture_current','original_source_fd','memcmp(','CLOCK_MONOTONIC','reaped','normal_exit','frame_eof','pidfd','cancel_fd']:self.assertIn(expected,s)
 def test_raw_method_names(self):
  s=C.read_text()
  for name in ['hold','release','assertResourceCurrent','start','observeResourceCurrent','retire']:self.assertIn('"'+name+'"',s)
if __name__=='__main__':unittest.main()
