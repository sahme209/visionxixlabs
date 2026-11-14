"""Source-contract checks ONLY: do not compile, interpret BPF or invoke syscalls."""
from pathlib import Path
import re,unittest
ROOT=Path(__file__).resolve().parents[2]
class LauncherSourceTests(unittest.TestCase):
 def setUp(self):
  self.c=(ROOT/'scripts/linux-compile/network_launcher.c').read_text();self.h=(ROOT/'scripts/linux-compile/compiler_profile.h').read_text()
 def test_target_architecture_and_x32_reject(self):
  for value in ['__linux__','__x86_64__','__ILP32__','__BYTE_ORDER__','AUDIT_ARCH_X86_64','__X32_SYSCALL_BIT']:self.assertIn(value,self.h)
  self.assertIn('offsetof(struct seccomp_data, arch)',self.h);self.assertIn('BPF_JSET',self.h)
 def test_closed_positive_profile_and_default(self):
  for value in ['AXIOM_ALLOWED_SYSCALLS','SYS_##name','SECCOMP_RET_ERRNO','EPERM','SYS_clone3','ENOSYS']:self.assertIn(value,self.h)
  for name in ['socket','socketpair','connect','io_uring_setup','ptrace','pidfd_getfd','process_vm_writev','unshare','mount','kill','tgkill']:
   self.assertNotRegex(self.h,r'X\('+name+r'\)')
  self.assertNotIn('SECCOMP_RET_TRACE',self.h);self.assertNotIn('SECCOMP_RET_USER_NOTIF',self.h)
 def test_exact_approved_named_profile(self):
  plan=(ROOT/'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/SECCOMP-COMPILER-CORRECTION-PROPOSAL.md').read_text()
  expected=plan.split('```')[1].split()
  block=self.h.split('#define AXIOM_ALLOWED_SYSCALLS(X)',1)[1].split('\n\n',1)[0]
  self.assertEqual(re.findall(r'X\(([a-z0-9_]+)\)',block),expected)
  self.assertNotRegex(self.h,r'#define\s+SYS_')
 def test_predicate_contracts(self):
  for value in ['CLONE_VM','CLONE_PIDFD','CSIGNAL','SIGCHLD','PR_GET_NO_NEW_PRIVS','PR_GET_SECCOMP','PR_SET_NAME','TCGETS','TIOCGWINSZ','FIONREAD','ARG_HIGH(0)','ARG_LOW(0)','ARG_LOW(1)']:self.assertIn(value,self.h)
  self.assertNotIn('CLONE_NEWNET',self.h);self.assertNotIn('CLONE_PARENT |',self.h)
 def test_exec_order_and_no_fallback(self):
  self.assertIn('int main(',self.c);body=self.c.split('int main(',1)[1]
  markers=['validate_stdio()','SYS_close_range','PR_SET_NO_NEW_PRIVS','PR_GET_NO_NEW_PRIVS','SYS_seccomp','PR_GET_SECCOMP','execve(']
  positions=[body.index(v)for v in markers];self.assertEqual(positions,sorted(positions))
  self.assertNotIn('execvp(',self.c);self.assertNotIn('system(',self.c)
 def test_stdio_and_identity_are_checked(self):
  for v in ['S_ISCHR','S_ISFIFO','/dev/null','O_ACCMODE','O_RDONLY','O_RDWR','O_WRONLY','getresuid','getresgid']:self.assertIn(v,self.c)
  self.assertIn('output.st_uid!=getuid()',self.c);self.assertIn('error.st_uid!=getuid()',self.c)
 def test_describe_uses_same_program(self):
  self.assertIn('compiler_filter',self.c);self.assertIn('AXIOM_ALLOWED_SYSCALLS',self.c);self.assertIn('"--describe"',self.c)
if __name__=='__main__':unittest.main()
