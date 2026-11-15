"""Actual private file/claim code on owned temp fixtures. ACL evidence is mocked
on macOS; no authentic binding, native host, provider or real journal is issued."""
import copy,gc,hashlib,importlib.util,os,stat,sys,tempfile,threading,time,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2];SOURCE=ROOT/'scripts/governance_original_attempt.py'
M=None
if SOURCE.exists():
 spec=importlib.util.spec_from_file_location('attempt_gate_local_test',SOURCE);M=importlib.util.module_from_spec(spec);sys.modules[spec.name]=M;spec.loader.exec_module(M)
RAW=('AXIOM_ORIGINAL_ATTEMPT_V1\nowner_grant_fixture\ncontroller_fixture\nattempt_fixture\n'+'a'*64+'\n'+'b'*64+'\n'+'c'*64+'\n'+'d'*64+'\nEND\n').encode()
class OriginalAttempt(unittest.TestCase):
 def setUp(self):
  self.assertIsNotNone(M,'approved private attempt module is not implemented')
  self.tmp=tempfile.TemporaryDirectory(prefix='axiom-attempt-fixture-');self.addCleanup(self.tmp.cleanup)
  self.anchor=Path(self.tmp.name);os.chmod(self.anchor,0o700);self.journal=self.anchor/'journal';self.journal.mkdir(mode=0o700)
  self.parent=os.open(self.anchor.parent,os.O_RDONLY|os.O_DIRECTORY);self.a=os.open(self.anchor,os.O_RDONLY|os.O_DIRECTORY);self.j=os.open(self.journal,os.O_RDONLY|os.O_DIRECTORY)
  for fd in [self.parent,self.a,self.j]:self.addCleanup(os.close,fd)
  self.acl=patch.object(M,'_no_extra_access',return_value=True);self.acl.start();self.addCleanup(self.acl.stop)
  self.deadline=time.monotonic_ns()+30_000_000_000;self.cancelled=threading.Event();self.grants=[]
  self.addCleanup(self.close_grants)
  self.digest=hashlib.sha256(RAW).hexdigest();self.binding=self.bind()
 def close_grants(self):
  for g in self.grants:
   try:M.close_original_grant(g)
   except M.AttemptUnavailable:pass
 def bind(self):
  # TEST-ONLY private registry population. Runtime has no binding constructor,
  # registry enrollment API or authentic supervisor supplier.
  binding=M._OriginalJournalBinding()
  directories=(M._Directory(self.a,self.parent,self.anchor.name,os.fstat(self.a)),M._Directory(self.j,self.a,'journal',os.fstat(self.j)))
  M._BINDINGS[binding]=M._BindingState(directories,self.digest,self.deadline,self.cancelled,os.getpid(),os.getuid(),os.fstat(self.j).st_gid)
  return binding
 def consume(self,**kwargs):
  g=M.consume_original_attempt(kwargs.get('binding',self.binding),kwargs.get('raw',RAW),kwargs.get('digest',self.digest),kwargs.get('deadline',self.deadline));self.grants.append(g);return g
 def test_exact_record_then_one_local_claim_only(self):
  g=self.consume();self.assertEqual((self.journal/'consumed').read_bytes(),RAW)
  claim=M.claim_creation(g);self.assertFalse(claim.qualified)
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_raw_fd_and_structural_binding_never_enroll(self):
  for b in [self.j,SimpleNamespace(directory_fd=self.j),M._OriginalJournalBinding()]:
   with self.assertRaises(M.AttemptUnavailable):self.consume(binding=b)
  self.assertFalse((self.journal/'consumed').exists())
 def test_canonical_closed_manifest_rejects_mutations_before_marker(self):
  mutations=[RAW.replace(b'V1',b'V2'),RAW+b'junk',RAW.replace(b'\n',b'\r\n'),RAW.replace(b'attempt_fixture',b'../escape'),RAW.replace(b'controller_fixture',b'controller_fixture\nextra'),RAW.replace(b'a'*64,b'A'*64),RAW.replace(b'owner_grant_fixture',b'\x00'),b'x'*4097]
  for raw in mutations:
   with self.subTest(raw=raw[:30]):
    with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind(),raw=raw,digest=hashlib.sha256(raw).hexdigest())
  self.assertFalse((self.journal/'consumed').exists())
 def test_expected_digest_cannot_override_original_binding(self):
  changed=RAW.replace(b'attempt_fixture',b'other_attempt');digest=hashlib.sha256(changed).hexdigest()
  with self.assertRaises(M.AttemptUnavailable):self.consume(raw=changed,digest=digest)
  self.assertFalse((self.journal/'consumed').exists())
 def test_deadline_cannot_reset_and_expiry_refuses(self):
  for deadline in [True,0,self.deadline+1]:
   with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind(),deadline=deadline)
  with patch.object(M.time,'monotonic_ns',return_value=self.deadline):
   with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind())
  self.assertFalse((self.journal/'consumed').exists())
 def test_file_sync_directory_sync_then_grant(self):
  calls=[];original=os.fsync
  def sync(fd):calls.append('directory' if stat.S_ISDIR(os.fstat(fd).st_mode) else 'file');return original(fd)
  with patch.object(M.os,'fsync',side_effect=sync):self.consume()
  self.assertEqual(calls,['file','directory'])
 def test_short_writes_make_progress_without_reopen(self):
  original=os.write;calls=[]
  def write(fd,data):calls.append(len(data));return original(fd,data[:7])
  with patch.object(M.os,'write',side_effect=write):self.consume()
  self.assertGreater(len(calls),1);self.assertEqual((self.journal/'consumed').read_bytes(),RAW)
 def test_zero_and_error_write_leave_marker_and_no_retry(self):
  with patch.object(M.os,'write',return_value=0):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertTrue((self.journal/'consumed').exists())
  with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind())
 def test_write_error_leaves_marker(self):
  with patch.object(M.os,'write',side_effect=OSError('private_failure')):
   with self.assertRaises(M.AttemptUnavailable) as result:self.consume()
  self.assertNotIn('private_failure',str(result.exception));self.assertTrue((self.journal/'consumed').exists())
 def test_file_sync_failure_cannot_return_grant(self):
  with patch.object(M.os,'fsync',side_effect=OSError('lost file sync')):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
  with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind())
 def test_directory_sync_failure_cannot_return_grant(self):
  original=os.fsync
  def sync(fd):
   if stat.S_ISDIR(os.fstat(fd).st_mode):raise OSError('lost directory sync')
   return original(fd)
  with patch.object(M.os,'fsync',side_effect=sync):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertTrue((self.journal/'consumed').exists())
 def test_existing_valid_partial_corrupt_marker_never_repairs(self):
  for raw in [RAW,b'partial',b'corrupt']:
   path=self.journal/'consumed';path.write_bytes(raw);os.chmod(path,0o600)
   with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind())
   self.assertEqual(path.read_bytes(),raw);path.unlink() # Only this test removes its owned fixture between independent cases.
 def test_symlink_marker_refuses_without_touching_target(self):
  target=self.anchor/'target';target.write_bytes(b'unchanged');(self.journal/'consumed').symlink_to(target)
  with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertEqual(target.read_bytes(),b'unchanged')
 def test_directory_replacement_and_permission_change_refuse(self):
  self.journal.rename(self.anchor/'old');self.journal.mkdir(mode=0o700)
  with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertFalse((self.journal/'consumed').exists())
 def test_directory_mode_change_refuses(self):
  os.chmod(self.journal,0o770)
  with self.assertRaises(M.AttemptUnavailable):self.consume()
 def test_missing_acl_evidence_refuses(self):
  with patch.object(M,'_no_extra_access',return_value=False):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertFalse((self.journal/'consumed').exists())
 def test_cancellation_before_or_during_sync_never_returns_grant(self):
  self.cancelled.set()
  with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.cancelled.clear();original=os.fsync
  def sync(fd):original(fd);self.cancelled.set()
  with patch.object(M.os,'fsync',side_effect=sync):
   with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind())
 def test_competing_consumers_issue_at_most_one_grant(self):
  bindings=[self.bind(),self.bind()];out=[]
  def consume(b):
   try:out.append(self.consume(binding=b))
   except M.AttemptUnavailable:pass
  threads=[threading.Thread(target=consume,args=(b,)) for b in bindings]
  for t in threads:t.start()
  for t in threads:t.join(2);self.assertFalse(t.is_alive())
  self.assertEqual(len(out),1)
 def test_original_marker_mutation_retires_grant(self):
  g=self.consume();(self.journal/'consumed').write_bytes(RAW+b'changed')
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_hardlink_alias_retires_grant(self):
  g=self.consume();os.link(self.journal/'consumed',self.anchor/'alias')
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_copied_and_foreign_grants_refuse(self):
  g=self.consume()
  for other in [copy.copy(g),M._Grant(),{},None]:
   with self.assertRaises(M.AttemptUnavailable):M.claim_creation(other)
  self.assertFalse(M.claim_creation(g).qualified)
 def test_competing_claim_threads_have_one_success(self):
  g=self.consume();out=[]
  def claim():
   try:out.append(M.claim_creation(g))
   except M.AttemptUnavailable:pass
  threads=[threading.Thread(target=claim) for _ in range(12)]
  for t in threads:t.start()
  for t in threads:t.join(2);self.assertFalse(t.is_alive())
  self.assertEqual(len(out),1)
 def test_close_vs_claim_is_serialized(self):
  g=self.consume();out=[]
  def claim():
   try:out.append(M.claim_creation(g))
   except M.AttemptUnavailable:pass
  a=threading.Thread(target=claim);b=threading.Thread(target=lambda:M.close_original_grant(g));a.start();b.start();a.join(2);b.join(2)
  self.assertFalse(a.is_alive() or b.is_alive());self.assertLessEqual(len(out),1)
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_inherited_pid_refuses_before_any_lock(self):
  g=self.consume();state=M._GRANTS[g];state.lock.acquire()
  try:
   with patch.object(M.os,'getpid',return_value=os.getpid()+1):
    with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
  finally:state.lock.release()
 def test_expired_cancelled_and_closed_grants_refuse(self):
  g=self.consume();self.cancelled.set()
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
  self.cancelled.clear()
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_deadline_equality_at_claim_refuses(self):
  g=self.consume()
  with patch.object(M.time,'monotonic_ns',return_value=self.deadline):
   with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_reload_binding_after_fixture_restart_never_restores_grant(self):
  g=self.consume();M.close_original_grant(g)
  with self.assertRaises(M.AttemptUnavailable):self.consume(binding=self.bind())
 def test_repeated_close_does_not_close_a_reused_descriptor(self):
  g=self.consume();state=M._GRANTS[g];original_fd=state.fd
  M.close_original_grant(g)
  borrowed=os.open(self.journal/'consumed',os.O_RDONLY)
  try:
   self.assertEqual(borrowed,original_fd)
   M.close_original_grant(g)
   self.assertEqual(os.pread(borrowed,1,0),RAW[:1])
  finally:
   try:os.close(borrowed)
   except OSError:pass
 def test_replacement_during_directory_sync_never_issues_grant(self):
  original=os.fsync
  def sync(fd):
   original(fd)
   if stat.S_ISDIR(os.fstat(fd).st_mode):
    path=self.journal/'consumed';path.rename(self.journal/'old');path.write_bytes(RAW);os.chmod(path,0o600)
  with patch.object(M.os,'fsync',side_effect=sync):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
 def test_consumption_pid_mismatch_refuses_before_inherited_lock(self):
  state=M._BINDINGS[self.binding];state.lock.acquire()
  try:
   with patch.object(M.os,'getpid',return_value=os.getpid()+1):
    with self.assertRaises(M.AttemptUnavailable):self.consume()
  finally:state.lock.release()
 def test_foreign_equality_object_cannot_resolve_live_grant(self):
  g=self.consume()
  class Forged:
   def __hash__(self):return hash(g)
   def __eq__(self,other):return True
  with self.assertRaises(M.AttemptUnavailable):M.claim_creation(Forged())
  self.assertFalse(M.claim_creation(g).qualified)
 def test_foreign_equality_object_cannot_resolve_original_binding(self):
  binding=self.binding
  class Forged:
   def __hash__(self):return hash(binding)
   def __eq__(self,other):return True
  with self.assertRaises(M.AttemptUnavailable):self.consume(binding=Forged())
  self.assertFalse((self.journal/'consumed').exists())
 def test_foreign_equality_object_cannot_retire_original_grant(self):
  g=self.consume()
  class Forged:
   def __hash__(self):return hash(g)
   def __eq__(self,other):return True
  with self.assertRaises(M.AttemptUnavailable):M.close_original_grant(Forged())
  self.assertFalse(M.claim_creation(g).qualified)
 def test_deadline_expiring_during_final_claim_read_refuses(self):
  g=self.consume();now=[time.monotonic_ns()];original=os.pread
  def read(*args):
   value=original(*args);now[0]=self.deadline;return value
  with patch.object(M.time,'monotonic_ns',side_effect=lambda:now[0]),patch.object(M.os,'pread',side_effect=read):
   with self.assertRaises(M.AttemptUnavailable):M.claim_creation(g)
 def test_cancellation_during_final_consumption_read_refuses(self):
  original=os.pread;count=[0]
  def read(*args):
   value=original(*args);count[0]+=1
   if count[0]==2:self.cancelled.set()
   return value
  with patch.object(M.os,'pread',side_effect=read):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertTrue((self.journal/'consumed').exists())
 def test_lost_local_grant_closes_original_fd_but_keeps_marker(self):
  g=self.consume();fd=M._GRANTS[g].fd;self.grants.clear();del g;gc.collect()
  with self.assertRaises(OSError):os.fstat(fd)
  self.assertTrue((self.journal/'consumed').exists())
 def test_owner_start_is_negative_for_every_unqualified_receipt(self):
  g=self.consume();M.claim_creation(g)
  for receipt in [{},SimpleNamespace(authentic=True),object()]:
   with self.assertRaises(M.AttemptUnavailable):M.claim_owner_start(g,receipt)
 def test_failure_before_marker_does_not_claim_durable_consumption(self):
  with patch.object(M.os,'open',side_effect=OSError('before creation')):
   with self.assertRaises(M.AttemptUnavailable):self.consume()
  self.assertFalse((self.journal/'consumed').exists())
  # Same original binding cannot retry even in-memory; real cross-invocation
  # holding after no marker remains the absent authentic supervisor's duty.
  with self.assertRaises(M.AttemptUnavailable):self.consume()
if __name__=='__main__':unittest.main()
