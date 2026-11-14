"""Source contracts only: never compiles or runs either native fixture."""
from pathlib import Path
import re
import unittest
ROOT=Path(__file__).resolve().parents[2]
C=ROOT/'scripts/linux-compile/build_ipc_fixture.c'
RUST=ROOT/'scripts/linux-compile/build_ipc_fixture.rs'
class FixtureTests(unittest.TestCase):
 def test_c_has_real_nonblocking_enable_disable_and_flag_checks(self):
  s=C.read_text();self.assertIn('ioctl(pipes[0],FIONBIO,&enabled)',s);self.assertIn('ioctl(pipes[0],FIONBIO,&disabled)',s);self.assertGreaterEqual(s.count('F_GETFL'),2);self.assertIn('O_NONBLOCK',s)
 def test_c_positive_pair_and_exact_error_channel_are_real_operations(self):
  s=C.read_text();self.assertIn('AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC,0,pair',s);self.assertIn('write(pair[0],payload,8)',s);self.assertIn('SYS_recvfrom,pair[1],buffer,8,0,NULL,NULL',s);self.assertIn('memcmp(buffer,payload,8)',s)
 def test_c_negative_receive_is_invalid_even_if_filter_broken(self):
  s=C.read_text();self.assertIn('const unsigned long invalid_fd=UINT32_MAX',s);self.assertIn('SYS_recvfrom,invalid_fd',s);self.assertIn('SYS_recvfrom,UINT64_MAX',s);self.assertIn('MSG_PEEK',s);self.assertIn('(uintptr_t)&address',s);self.assertIn('(uintptr_t)&address_length',s)
 def test_c_covers_pair_and_receive_upper_word_predicates(self):
  s=C.read_text();self.assertIn('UINT64_C(1)<<32',s)
  for name in ['domain','type','protocol','length','flags']:
   self.assertRegex(s,r'\b'+name+r'\b')
  self.assertGreaterEqual(s.count('denied_pair('),9);self.assertGreaterEqual(s.count('denied_receive('),7)
 def test_c_closes_any_unexpected_pair_and_performs_no_group_or_external_action(self):
  s=C.read_text();self.assertIn('if(result==0)',s);self.assertIn('close(pair[0])',s);self.assertIn('close(pair[1])',s)
  for forbidden in ['syscall(SYS_setsid','connect(','bind(','sendto(','recvmsg(','kill(','system(']:self.assertNotIn(forbidden,s)
 def test_c_group_probe_uses_only_impossible_negative_target(self):
  s=C.read_text();self.assertIn('syscall(SYS_setpgid,-1,-1)',s);self.assertNotIn('syscall(SYS_setsid',s)
 def test_c_evaluates_actual_frozen_array_for_group_session_denial(self):
  s=C.read_text();self.assertIn('#include "compiler_profile.h"',s);self.assertIn('compiler_filter[pc++]',s);self.assertIn('struct seccomp_data',s);self.assertIn('observed.nr=SYS_setsid',s);self.assertIn('observed.nr=SYS_setpgid',s);self.assertGreaterEqual(s.count('evaluate_filter(&observed)!=AXIOM_DENY'),2)
  for operation in ['BPF_ABS','BPF_JEQ','BPF_JGE','BPF_JSET','BPF_AND','BPF_RET']:self.assertIn(operation,s)
  self.assertIn('sizeof(*observed)-sizeof(accumulator)',s);self.assertIn('steps<count',s)
 def test_fixed_c_argument_and_success_contract(self):
  s=C.read_text();self.assertIn('argc!=1',s);self.assertIn('build-ipc-c:ok',s);self.assertNotIn('strerror',s)
 def test_rust_exact_fixed_command_and_absent_path_validation(self):
  s=RUST.read_text();self.assertIn('"/usr/bin/true"',s);self.assertIn('args.len()!=3',s);self.assertIn('build-ipc-missing-executable',s);self.assertIn('is_absolute()',s);self.assertIn('symlink_metadata',s);self.assertIn('ErrorKind::NotFound',s)
 def test_rust_output_uses_actual_two_captured_pipes(self):
  s=RUST.read_text();self.assertIn('.stdout(Stdio::piped())',s);self.assertIn('.stderr(Stdio::piped())',s);self.assertIn('.output()',s);self.assertIn('output.status.success()',s)
 def test_rust_preexec_and_failed_exec_use_actual_std_owned_children(self):
  s=RUST.read_text();self.assertIn('command.pre_exec(|| Ok(()))',s);self.assertIn('command.spawn()',s);self.assertIn('child.try_wait()',s);self.assertIn('WAIT_LIMIT',s);self.assertIn('Instant::now()',s)
  for forbidden in ['.kill(','.process_group(','.uid(','.gid(','setsid','setpgid','format!("{error','println!("{:?']:
   self.assertNotIn(forbidden,s)
 def test_rust_fixed_success_failure_and_no_raw_identity_output(self):
  s=RUST.read_text();self.assertIn('build-ipc-rust:ok',s);self.assertIn('build-ipc-rust:failed',s);self.assertNotIn('raw_os_error',s);self.assertNotIn('child.id()',s)
if __name__=='__main__':unittest.main()
