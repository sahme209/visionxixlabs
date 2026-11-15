"""Source-only policy/owner regressions. No C compilation or native execution.

These checks protect the reviewed authority boundary and ordering. Actual codec,
getrandom, filesystem, privilege-drop and host behavior require native qualification.
"""
from pathlib import Path
import unittest
BASE=Path(__file__).resolve().parents[2]/'packages/verified-issuer-runtime/linux'
class PolicySplitSource(unittest.TestCase):
 def setUp(self):
  self.h=(BASE/'time_operational_status.h').read_text()
  self.c=(BASE/'time_operational_status.c').read_text()
  self.owner=(BASE/'time_operational_owner.c').read_text()
 def function(self,source,name,next_name):
  if name not in source or next_name not in source:return ''
  return source[source.index(name):source.index(next_name,source.index(name))]
 def test_policy_has_closed_separate_format_and_no_host_selector(self):
  p=self.function(self.c,'int axiom_operational_policy_decode(', 'int axiom_operational_accept_derive(')
  for value in ['AXIOM_OPERATIONAL_POLICY_V1','aws-linux-operational-v1','aws-time-sync-ntp','9007199254740991','UINT32_MAX','end(&c)']:
   self.assertIn(value,p)
  for field in ['host','boot','profile','source_generation','directory_inode']:
   self.assertNotIn('p->'+field,p)
  self.assertNotIn('axiom_operational_accept_decode',p)
 def test_policy_excludes_root_sentinel_and_zero_revision(self):
  p=self.function(self.c,'int axiom_operational_policy_decode(', 'int axiom_operational_accept_derive(')
  for check in ['!p->revision','!p->reader_uid','!p->reader_gid','p->reader_uid>=UINT32_MAX','p->reader_gid>=UINT32_MAX']:
   self.assertIn(check,p)
 def test_derivation_binds_verified_digest_and_exact_nonce_domain(self):
  d=self.function(self.c,'int axiom_operational_accept_derive(', 'int axiom_operational_accept_decode(')
  for check in ['strlen(digest)!=64','nonce_length!=32','!nonzero','"host_"','"source_"','a->reader_gid=p->reader_gid','a->revision=p->revision','axiom_operational_accept_encode']:
   self.assertIn(check,d)
  self.assertIn('memcpy(a->profile,digest,65)',d)
 def test_owner_uses_held_hashed_policy_instead_of_reopening_selector(self):
  s=self.owner[self.owner.index('int main('):]
  self.assertIn('policy=frozen[0].fd',s)
  self.assertIn('axiom_operational_policy_decode(bytes,(size_t)n,&semantic)',s)
  self.assertNotIn('axiom_operational_accept_decode(bytes',s)
  self.assertIn('AXIOM_OPERATIONAL_PROFILE_SHA256',s)
 def test_policy_read_requires_all_original_hashed_bytes(self):
  self.assertIn('n!=frozen[0].original.st_size',self.owner)
 def test_exact_uid_and_gid_before_materialization(self):
  s=self.owner[self.owner.index('int main('):]
  self.assertIn('uid!=semantic.reader_uid',s)
  self.assertIn('ds.st_gid!=semantic.reader_gid',s)
  self.assertLess(s.index('uid!=semantic.reader_uid'),s.index('getrandom('))
  self.assertLess(s.index('!no_acl(directory)'),s.index('getrandom('))
 def test_one_nonblocking_nonce_without_retry_before_exclusive_marker(self):
  s=self.owner[self.owner.index('int main('):]
  self.assertEqual(s.count('getrandom('),1)
  self.assertIn('getrandom(nonce,sizeof nonce,GRND_NONBLOCK)!=(ssize_t)sizeof nonce',s)
  self.assertLess(s.index('getrandom('),s.index('O_RDWR|O_CREAT|O_EXCL'))
  self.assertNotIn('unlink(',s)
 def test_capture_rechecked_before_and_after_nonce_and_before_daemon(self):
  s=self.owner[self.owner.index('int main('):]
  before=s[:s.index('getrandom(')]
  after=s[s.index('getrandom('):s.index('dpid=fork()')]
  for piece in [before,after]:
   self.assertIn('same_boot_suspend(boot,suspend)',piece)
   self.assertIn('frozen_current()',piece)
   self.assertIn('unchanged(directory_path,directory)',piece)
 def test_capture_compares_held_directory_to_original_snapshot(self):
  self.assertIn('static int captured_directory_current(',self.owner)
  for field in ['st_dev','st_ino','st_mode','st_uid','st_gid','st_ctim.tv_sec','st_ctim.tv_nsec']:
   self.assertIn('s.'+field+'!=original->'+field,self.owner)
  s=self.owner[self.owner.index('getrandom('):self.owner.index('dpid=fork()')]
  self.assertIn('captured_directory_current(directory,&ds)',s)
 def test_acceptance_is_encoded_separately_not_policy_bytes(self):
  s=self.owner[self.owner.index('int main('):]
  self.assertLess(s.index('axiom_operational_accept_derive('),s.index('axiom_operational_accept_encode(&a,bytes,&accept_length)'))
  self.assertIn('write(accepted,bytes,accept_length)!=(ssize_t)accept_length',s)
  self.assertNotIn('write(accepted,bytes,(size_t)n)',s)
 def test_all_real_effective_saved_reader_ids_checked_before_filter(self):
  s=self.owner[self.owner.index('npid=fork()'):]
  for check in ['getresuid(&ruid,&euid,&suid)','getresgid(&rgid,&egid,&sgid)','ruid!=(uid_t)uid','euid!=(uid_t)uid','suid!=(uid_t)uid','rgid!=(gid_t)a.reader_gid','egid!=(gid_t)a.reader_gid','sgid!=(gid_t)a.reader_gid']:
   self.assertIn(check,s)
  self.assertLess(s.index('getresuid('),s.index('PR_SET_SECCOMP'))
 def test_original_protocol_consumers_remain_acceptance_only(self):
  binding=(BASE/'time_operational_binding.c').read_text()
  rust=(BASE/'operational_publication.rs').read_text()
  self.assertIn('axiom_operational_accept_decode',binding)
  self.assertIn('AXIOM_ACCEPT_V1',rust)
  self.assertNotIn('axiom_operational_policy_decode',binding)
  self.assertNotIn('AXIOM_OPERATIONAL_POLICY_V1',rust)
class PolicyScenarioSimulation(unittest.TestCase):
 """Executable specification scenarios ONLY; this does not execute C.
 Kernel return values and capture observations below are synthetic inputs.
 """
 @staticmethod
 def capture(nonce_result, nonce, *, current=True, collision=False):
  calls=['verify-policy','capture-originals','getrandom-32-nonblock']
  if nonce_result!=32 or len(nonce)!=32 or not any(nonce) or not current:
   return None,calls
  calls.append('exclusive-marker')
  if collision:return None,calls
  return ('host_'+nonce.hex(),'source_'+nonce.hex()),calls
 def test_nonce_short_error_and_zero_refuse_without_retry_or_launch(self):
  for result,data in [(31,b'x'*32),(0,b'x'*32),(-1,b'x'*32),(-4,b'x'*32),(-11,b'x'*32),(32,bytes(32))]:
   with self.subTest(result=result):
    value,calls=self.capture(result,data)
    self.assertIsNone(value);self.assertEqual(calls.count('getrandom-32-nonblock'),1)
    self.assertNotIn('exclusive-marker',calls)
 def test_distinct_domain_labels_and_generation_substitution(self):
  a,_=self.capture(32,bytes(range(32)));b,_=self.capture(32,b'x'*32)
  self.assertNotEqual(a,b);self.assertNotEqual(a[0],a[1]);self.assertEqual(len(a[0]),69);self.assertEqual(len(a[1]),71)
 def test_changed_capture_and_marker_collision_never_repair_or_retry(self):
  for scenario in [dict(current=False),dict(collision=True)]:
   value,calls=self.capture(32,b'x'*32,**scenario)
   self.assertIsNone(value);self.assertEqual(calls.count('getrandom-32-nonblock'),1)
   self.assertLessEqual(calls.count('exclusive-marker'),1)
 def test_pre_marker_failure_is_not_durable_attempt_consumption(self):
  _,calls=self.capture(-11,b'x'*32)
  self.assertNotIn('exclusive-marker',calls)
  # A separate new invocation can try again: the missing external durable
  # consume-before-start controller remains an explicit qualification gate.
  value,_=self.capture(32,b'x'*32)
  self.assertIsNotNone(value)
if __name__=='__main__':unittest.main()
