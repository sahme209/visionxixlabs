"""Source-only launcher contracts; no compilation, syscall/filter or Node run."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
FILE=ROOT/'scripts/linux-native-behavior/runtime_launcher.c'
class RuntimeLauncherTests(unittest.TestCase):
 def text(self):
  self.assertTrue(FILE.exists(),'fixed pre-Node launcher source is missing');return FILE.read_text()
 def test_only_fixed_node_and_compile_bound_harness(self):
  s=self.text();self.assertIn('/opt/hostedtoolcache/node/24.22.2/x64/bin/node',s);self.assertIn('#ifndef AXIOM_NATIVE_BEHAVIOR_HARNESS',s);self.assertIn('argc!=2',s);self.assertIn('strcmp(argv[1],"--")',s);self.assertIn('execve(fixed_node,child_argv,child_env)',s)
  self.assertNotIn('execvp(',s);self.assertNotIn('environ',s);self.assertNotIn('argv+2',s)
 def test_stdio_identity_and_inherited_fds_checked_before_restriction(self):
  s=self.text()
  for required in ['/dev/null','S_ISFIFO','output.st_uid!=getuid()','error.st_uid!=getuid()','O_RDWR','O_RDONLY','O_WRONLY','getresuid','getresgid','SYS_close_range']:self.assertIn(required,s)
 def test_install_before_exec_without_fallback(self):
  body=self.text().split('int main(',1)[1];markers=['validate_stdio()','SYS_close_range','PR_SET_NO_NEW_PRIVS','PR_GET_NO_NEW_PRIVS','SYS_seccomp','PR_GET_SECCOMP','execve(fixed_node']
  self.assertEqual([body.index(m)for m in markers],sorted(body.index(m)for m in markers))
 def test_clean_literal_environment(self):
  s=self.text();self.assertIn('"PATH=/usr/bin:/bin"',s);self.assertIn('"LANG=C.UTF-8"',s);self.assertIn('"LC_ALL=C.UTF-8"',s)
  self.assertNotIn('getenv(',s);self.assertNotIn('NODE_OPTIONS=',s);self.assertNotIn('LD_PRELOAD=',s)
 def test_describe_reports_actual_default_allow_program_and_source_trust_limit(self):
  s=self.text()
  for required in ['runtime_filter','AXIOM_RUNTIME_DENIED_SYSCALLS','allow-trusted-source','trusted-fixed-native-behavior-only','source-trusted-not-inspected','"--describe"']:self.assertIn(required,s)
if __name__=='__main__':unittest.main()
