"""Pure DATA evaluation of actual runtime BPF source; no compiler/kernel/filter call.
Syscall fixtures are read from already cached libc0.2.189 Linux x86_64 source;
production uses installed SYS/UAPI macros only, never these fixture numbers.
"""
import importlib.util,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HEADER=ROOT/'scripts/linux-native-behavior/runtime_profile.h'
spec=importlib.util.spec_from_file_location('existing_bpf_data',ROOT/'scripts/tests/test_governance_build_ipc_profile.py')
helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
ALLOW=0x7fff0000;DENY=0x50001
NUMBERS={'socket': 41, 'socketpair': 53, 'connect': 42, 'bind': 49, 'listen': 50, 'accept': 43, 'accept4': 288, 'shutdown': 48, 'getsockname': 51, 'getpeername': 52, 'setsockopt': 54, 'getsockopt': 55, 'sendto': 44, 'recvfrom': 45, 'sendmsg': 46, 'recvmsg': 47, 'sendmmsg': 307, 'recvmmsg': 299, 'io_uring_setup': 425, 'io_uring_enter': 426, 'io_uring_register': 427, 'pidfd_open': 434, 'pidfd_getfd': 438, 'kill': 62, 'tkill': 200, 'tgkill': 234, 'setsid': 112, 'setpgid': 109, 'setuid': 105, 'setgid': 106, 'setreuid': 113, 'setregid': 114, 'setresuid': 117, 'setresgid': 119, 'setfsuid': 122, 'setfsgid': 123, 'setgroups': 116, 'capset': 126, 'unshare': 272, 'setns': 308, 'mount': 165, 'umount2': 166, 'pivot_root': 155, 'chroot': 161, 'open_tree': 428, 'move_mount': 429, 'fsopen': 430, 'fsconfig': 431, 'fsmount': 432, 'fspick': 433, 'mount_setattr': 442, 'ptrace': 101, 'process_vm_readv': 310, 'process_vm_writev': 311, 'process_madvise': 440, 'process_mrelease': 448, 'kcmp': 312, 'bpf': 321, 'perf_event_open': 298, 'userfaultfd': 323, 'ioperm': 173, 'iopl': 172, 'modify_ldt': 154, 'init_module': 175, 'finit_module': 313, 'delete_module': 176, 'kexec_load': 246, 'kexec_file_load': 320, 'reboot': 169, 'swapon': 167, 'swapoff': 168, 'acct': 163, 'quotactl': 179, 'add_key': 248, 'request_key': 249, 'keyctl': 250, 'sethostname': 170, 'setdomainname': 171, 'settimeofday': 164, 'clock_settime': 227, 'clock_adjtime': 305, 'adjtimex': 159, 'open_by_handle_at': 304, 'name_to_handle_at': 303, 'fanotify_init': 300, 'fanotify_mark': 301, 'chown': 92, 'fchown': 93, 'lchown': 94, 'fchownat': 260, 'setxattr': 188, 'lsetxattr': 189, 'fsetxattr': 190, 'clone': 56, 'clone3': 435, 'pidfd_send_signal': 424, 'prctl': 157, 'ioctl': 16, 'eventfd2': 290, 'fgetxattr': 193, 'rt_sigtimedwait': 128, 'getpid': 39, 'read': 0, 'write': 1, 'waitid': 247, 'execveat': 322, 'mmap': 9, 'futex': 202}
DENIED=['socket', 'socketpair', 'connect', 'bind', 'listen', 'accept', 'accept4', 'shutdown', 'getsockname', 'getpeername', 'setsockopt', 'getsockopt', 'sendto', 'recvfrom', 'sendmsg', 'recvmsg', 'sendmmsg', 'recvmmsg', 'io_uring_setup', 'io_uring_enter', 'io_uring_register', 'pidfd_open', 'pidfd_getfd', 'kill', 'tkill', 'tgkill', 'setsid', 'setpgid', 'setuid', 'setgid', 'setreuid', 'setregid', 'setresuid', 'setresgid', 'setfsuid', 'setfsgid', 'setgroups', 'capset', 'unshare', 'setns', 'mount', 'umount2', 'pivot_root', 'chroot', 'open_tree', 'move_mount', 'fsopen', 'fsconfig', 'fsmount', 'fspick', 'mount_setattr', 'ptrace', 'process_vm_readv', 'process_vm_writev', 'process_madvise', 'process_mrelease', 'kcmp', 'bpf', 'perf_event_open', 'userfaultfd', 'ioperm', 'iopl', 'modify_ldt', 'init_module', 'finit_module', 'delete_module', 'kexec_load', 'kexec_file_load', 'reboot', 'swapon', 'swapoff', 'acct', 'quotactl', 'add_key', 'request_key', 'keyctl', 'sethostname', 'setdomainname', 'settimeofday', 'clock_settime', 'clock_adjtime', 'adjtimex', 'open_by_handle_at', 'name_to_handle_at', 'fanotify_init', 'fanotify_mark', 'chown', 'fchown', 'lchown', 'fchownat', 'setxattr', 'lsetxattr', 'fsetxattr']
def profile():
 assert HEADER.exists(),'new runtime restriction source is missing'
 text=HEADER.read_text();data,_=helper.constants();data.update({'SYS_'+k:v for k,v in NUMBERS.items()})
 data.update({'SIGKILL':9,'AXIOM_RUNTIME_CLONE_SIZE':88,'PR_SET_DUMPABLE':4,'PR_SET_KEEPCAPS':8,'PR_SET_SECUREBITS':28,'PR_SET_PTRACER':0x59616d61,'PR_SET_MM':35,'PR_CAP_AMBIENT':47})
 text=re.sub(r'/\*[\s\S]*?\*/','',text)
 data['AXIOM_RUNTIME_CLONE_FLAGS']=helper.expression(re.search(r'^#define AXIOM_RUNTIME_CLONE_FLAGS (.+)$',text,re.M)[1],data)
 data['AXIOM_RUNTIME_DENY']=DENY
 block=re.search(r'#define AXIOM_RUNTIME_DENIED_SYSCALLS\(X\)([\s\S]*?)\n\n',text)[1]
 names=re.findall(r'X\(([a-z0-9_]+)\)',block);assert names==DENIED
 macro=re.search(r'^#define AXIOM_RUNTIME_DENY_CALL\(name\) (.+)$',text,re.M)[1]
 body=text.split('runtime_filter[] = {',1)[1].split('};',1)[0]
 body=re.sub(r'^#(?:define|undef)[^\n]*\n','',body,flags=re.M)
 body=body.replace('AXIOM_RUNTIME_DENIED_SYSCALLS(AXIOM_RUNTIME_DENY_CALL)','\n'.join(macro.replace('SYS_##name','SYS_'+n)for n in names))
 program=[];cursor=0
 for match in re.finditer(r'BPF_(STMT|JUMP)\(',body):
  if match.start()<cursor:continue
  start=match.end();depth=1;end=start
  while depth:
   if body[end]=='(':depth+=1
   elif body[end]==')':depth-=1
   end+=1
  args=[helper.expression(v,data)for v in helper.split_args(body[start:end-1])]
  if match[1]=='STMT':code,k=args;jt=jf=0
  else:code,k,jt,jf=args
  program.append({'code':code,'k':k,'jt':jt,'jf':jf});cursor=end
 assert program[-1]=={'code':6,'k':ALLOW,'jt':0,'jf':0}
 for i,v in enumerate(program):
  if v['code']in(21,53,69):assert i+1+max(v['jt'],v['jf'])<len(program)
 return program,data
class RuntimeProfileTests(unittest.TestCase):
 def setUp(self):self.p,self.k=profile()
 def call(self,n,args=()):return helper.evaluate(self.p,self.k['SYS_'+n],args)
 def test_architecture_constants_come_from_explicit_installed_uapi(self):
  self.assertIn('#include <asm/unistd.h>',HEADER.read_text())
  self.assertNotRegex(HEADER.read_text(),r'#define\s+SYS_')
 def test_all_explicit_dangerous_classes_refuse(self):
  for n in DENIED:self.assertEqual(self.call(n),DENY,n)
 def test_explicit_default_allow_for_ordinary_trusted_node_resources(self):
  for n in ['read','write','eventfd2','fgetxattr','rt_sigtimedwait','waitid','execveat','mmap','futex','getpid']:self.assertEqual(self.call(n),ALLOW,n)
  self.assertEqual(helper.evaluate(self.p,999999),ALLOW)
 def test_arch_x32_and_negative_numbers_refuse(self):
  for nr,arch in [(0,0),(0x40000000,3221225534),(0xffffffff,3221225534)]:self.assertEqual(helper.evaluate(self.p,nr,arch=arch),DENY)
 def test_classic_clone_is_closed_to_known_non_namespace_flags(self):
  self.assertEqual(self.call('clone',[17]),ALLOW)
  for flags in [17|0x20000000,17|0x10000000,17|0x800000,17|(1<<32),1]:self.assertEqual(self.call('clone',[flags]),DENY)
 def test_clone3_shape_is_not_claimed_as_pointed_flag_attestation(self):
  self.assertEqual(self.call('clone3',[0x1234,88]),ALLOW)
  self.assertEqual(self.call('clone3',[1<<32,88]),ALLOW)
  for args in [[0,88],[1,0],[1,87],[1,89],[1,88|(1<<32)]]:self.assertEqual(self.call('clone3',args),DENY)
  self.assertIn('source-trusted-not-inspected',HEADER.read_text())
 def test_pidfd_signal_only_exact_sigkill_null_info_and_zero_flags(self):
  good=[8,9,0,0];self.assertEqual(self.call('pidfd_send_signal',good),ALLOW)
  for i,v in [(0,8|(1<<32)),(1,0),(1,15),(1,9|(1<<32)),(2,1),(2,1<<32),(3,1),(3,1<<32)]:
   args=good.copy();args[i]=v;self.assertEqual(self.call('pidfd_send_signal',args),DENY)
 def test_privileged_prctl_and_unknown_ioctl_refuse(self):
  for op in [4,8,28,35,47,0x59616d61]:self.assertEqual(self.call('prctl',[op]),DENY)
  for op in [15,16,21,39]:self.assertEqual(self.call('prctl',[op]),ALLOW)
  for op in [0x5401,0x5413,0x541b,0x5421]:self.assertEqual(self.call('ioctl',[1,op]),ALLOW)
  self.assertEqual(self.call('ioctl',[1,0xffffffff]),DENY)
if __name__=='__main__':unittest.main()
