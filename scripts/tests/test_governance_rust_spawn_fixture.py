"""Static source contracts only; these do not compile/run Rust or prove native behavior."""
from pathlib import Path
import unittest
SOURCE=Path(__file__).resolve().parents[1]/'linux-compile/rust_spawn_fixture.rs'
class RustSpawnFixtureSourceTests(unittest.TestCase):
 def setUp(self):self.s=SOURCE.read_text()
 def test_fixed_tool_and_no_user_selected_command(self):
  self.assertIn('const TOOL: &str = "/usr/bin/true";',self.s)
  self.assertNotIn('args()',self.s);self.assertNotIn('args_os()',self.s)
 def test_exact_two_owned_spawn_paths(self):
  self.assertIn('run_path("ordinary", false)',self.s);self.assertIn('run_path("preexec", true)',self.s)
  self.assertEqual(self.s.count('command.spawn()'),1)
  self.assertIn('command.pre_exec(|| Ok(()))',self.s)
 def test_inherited_stdio_without_shell_or_group_changes(self):
  self.assertIn('Stdio::inherit()',self.s)
  for banned in ['.output(','.kill(','.process_group(', 'setsid','setpgid','Command::new("sh")','Stdio::piped()']:self.assertNotIn(banned,self.s)
 def test_bounded_owned_wait_and_stop(self):
  for text in ['child.try_wait()','WAIT_LIMIT','started.elapsed()','wait-timeout','wait-error','std::process::exit(70)']:self.assertIn(text,self.s)
 def test_fixed_error_rows_no_debug_or_raw_error(self):
  self.assertIn('error.raw_os_error()',self.s);self.assertIn('spawn-error:',self.s)
  self.assertIn('exit-ok',self.s);self.assertIn('exit-failed',self.s)
  self.assertNotIn('{:?}',self.s);self.assertNotIn('{error}',self.s)
 def test_fail_stop_between_paths(self):
  self.assertLess(self.s.index('run_path("ordinary", false)'),self.s.index('run_path("preexec", true)'))
  self.assertIn('stop(label, "wait-error")',self.s);self.assertIn('stop(label, "wait-timeout")',self.s)
if __name__=='__main__':unittest.main()
