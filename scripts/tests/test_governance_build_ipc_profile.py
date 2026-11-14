"""Pure evaluation of the ACTUAL header's BPF expressions using frozen DATA.
No compiler, preprocessor, kernel filter, socket or executable is invoked.
Numbers below are test fixtures, NOT production definitions/ABI qualification.
Existing syscall ids/program constants come from the recorded installed runner's
CORRECTION-OBSERVED-RESULT; new ids/options from cached libc0.2.189 Linux x86_64
source as inert data. Native CI must still validate the actual installed headers.
"""
import ast,hashlib,json,re,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
HEADER=ROOT/'scripts/linux-compile/compiler_profile.h'
RECEIPT=ROOT/'docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/CORRECTION-OBSERVED-RESULT.json'
RECEIPT_SHA='00a29e8e9ed066b4c7227c3eee29091e7fda5856c6e74a12180939bf0c7e7548'
ALLOW=0x7fff0000;DENY=0x50001

def constants():
 raw=RECEIPT.read_bytes();assert hashlib.sha256(raw).hexdigest()==RECEIPT_SHA
 old=json.loads(raw)['filter'];program=old['instructions'];offset=len(program)-2*len(old['allowlist'])-1
 data={'SYS_'+name:program[offset+2*i]['k']for i,name in enumerate(old['allowlist'])}
 data.update({'BPF_LD':0,'BPF_W':0,'BPF_ABS':0x20,'BPF_JMP':5,'BPF_JEQ':0x10,'BPF_JSET':0x40,'BPF_JGE':0x30,'BPF_K':0,'BPF_RET':6,'BPF_ALU':4,'BPF_AND':0x50,
  'AUDIT_ARCH_X86_64':old['arch'],'__X32_SYSCALL_BIT':program[4]['k'],'SECCOMP_RET_ERRNO':0x50000,'SECCOMP_RET_DATA':0xffff,'SECCOMP_RET_ALLOW':ALLOW,'EPERM':1,'ENOSYS':38,
  'SYS_clone3':program[8]['k'],'SYS_clone':program[10]['k'],'SYS_prctl':program[22]['k'],'SYS_ioctl':program[29]['k'],
  'PR_GET_NO_NEW_PRIVS':39,'PR_GET_SECCOMP':21,'PR_SET_NAME':15,'TCGETS':0x5401,'TIOCGWINSZ':0x5413,'FIONREAD':0x541b,'FIONBIO':0x5421,
  'CLONE_VM':0x100,'CLONE_FS':0x200,'CLONE_FILES':0x400,'CLONE_SIGHAND':0x800,'CLONE_THREAD':0x10000,'CLONE_SYSVSEM':0x40000,'CLONE_SETTLS':0x80000,'CLONE_PARENT_SETTID':0x100000,'CLONE_CHILD_SETTID':0x1000000,'CLONE_CHILD_CLEARTID':0x200000,'CLONE_VFORK':0x4000,'CLONE_PIDFD':0x1000,'CSIGNAL':255,'SIGCHLD':17,
  'SYS_socketpair':53,'SYS_recvfrom':45,'AF_UNIX':1,'SOCK_SEQPACKET':5,'SOCK_CLOEXEC':0x80000})
 return data,old

def expression(text,data):
 text=re.sub(r'offsetof\(struct seccomp_data,\s*(arch|nr)\)',lambda m:'4'if m[1]=='arch'else'0',text)
 text=re.sub(r'ARG_(LOW|HIGH)\((\d)\)',lambda m:str(16+8*int(m[2])+(4 if m[1]=='HIGH'else 0)),text)
 text=re.sub(r'\(uint32_t\)','',text);text=re.sub(r'(?<=[0-9a-fA-F])[Uu][Ll]*\b','',text)
 node=ast.parse(text.strip(),mode='eval').body
 def value(n):
  if isinstance(n,ast.Constant)and type(n.value)is int:return n.value
  if isinstance(n,ast.Name):return data[n.id]
  if isinstance(n,ast.UnaryOp)and isinstance(n.op,ast.Invert):return ~value(n.operand)
  if isinstance(n,ast.BinOp):
   a,b=value(n.left),value(n.right)
   if isinstance(n.op,ast.BitOr):return a|b
   if isinstance(n.op,ast.BitAnd):return a&b
  raise ValueError('unsupported header expression')
 return value(node)&0xffffffff

def split_args(text):
 result=[];depth=0;start=0
 for i,c in enumerate(text):
  if c=='(':depth+=1
  elif c==')':depth-=1
  elif c==','and depth==0:result.append(text[start:i]);start=i+1
 result.append(text[start:]);return result

def compile_header(text):
 data,old=constants()
 text=re.sub(r'/\*[\s\S]*?\*/','',text)
 clone=re.search(r'^#define AXIOM_CLONE_FLAGS (.+)$',text,re.M);data['AXIOM_CLONE_FLAGS']=expression(clone[1],data)
 data['AXIOM_DENY']=expression(re.search(r'^#define AXIOM_DENY (.+)$',text,re.M)[1],data)
 normal=re.search(r'#define AXIOM_ALLOWED_SYSCALLS\(X\)([\s\S]*?)\n\n',text)[1]
 names=re.findall(r'X\(([a-z0-9_]+)\)',normal)
 assert names==old['allowlist'],'unrelated positive allowlist changed'
 macro=re.search(r'^#define AXIOM_ALLOW\(name\) (.+)$',text,re.M)[1]
 body=text.split('compiler_filter[] = {',1)[1].split('};',1)[0]
 body=re.sub(r'^#(?:define|undef)[^\n]*\n','',body,flags=re.M)
 body=body.replace('AXIOM_ALLOWED_SYSCALLS(AXIOM_ALLOW)','\n'.join(macro.replace('SYS_##name','SYS_'+name)for name in names))
 program=[];cursor=0
 for match in re.finditer(r'BPF_(STMT|JUMP)\(',body):
  if match.start()<cursor:continue
  start=match.end();depth=1;end=start
  while depth:
   if body[end]=='(':depth+=1
   elif body[end]==')':depth-=1
   end+=1
  args=split_args(body[start:end-1]);vals=[expression(a,data)for a in args]
  if match[1]=='STMT':assert len(vals)==2;code,k=vals;jt=jf=0
  else:assert len(vals)==4;code,k,jt,jf=vals
  assert jt<=255 and jf<=255
  program.append({'code':code,'k':k,'jt':jt,'jf':jf});cursor=end
 assert program and program[-1]=={'code':6,'k':DENY,'jt':0,'jf':0}
 for i,v in enumerate(program):
  if v['code']in(21,53,69):assert i+1+max(v['jt'],v['jf'])<len(program),'jump outside actual program'
 return program,data

def evaluate(program,nr,args=(),arch=3221225534):
 args=list(args)+[0]*(6-len(args));words={0:nr&0xffffffff,4:arch}
 for i,arg in enumerate(args):words[16+i*8]=arg&0xffffffff;words[20+i*8]=(arg>>32)&0xffffffff
 pc=0;a=0
 for _ in range(2048):
  v=program[pc];code=v['code'];k=v['k'];pc+=1
  if code==32:a=words[k]
  elif code==21:pc+=v['jt']if a==k else v['jf']
  elif code==53:pc+=v['jt']if a>=k else v['jf']
  elif code==69:pc+=v['jt']if a&k else v['jf']
  elif code==84:a&=k
  elif code==6:return k
  else:raise ValueError('unsupported actual BPF opcode')
 raise ValueError('BPF did not terminate')

class BuildIpcProfileTests(unittest.TestCase):
 def setUp(self):self.p,self.k=compile_header(HEADER.read_text())
 def call(self,name,args=()):return evaluate(self.p,self.k['SYS_'+name],args)
 def test_fionbio_selector_only(self):
  self.assertEqual(self.call('ioctl',[1,self.k['FIONBIO'],0]),ALLOW)
  self.assertEqual(self.call('ioctl',[1,0xffffffff,0]),DENY)
 def test_exact_anonymous_pair(self):self.assertEqual(self.call('socketpair',[1,5|0x80000,0,0x1234]),ALLOW)
 def test_pair_rejects_wrong_values_and_every_upper_word(self):
  good=[1,5|0x80000,0,0x1234]
  for i,value in [(0,2),(0,10),(1,1|0x80000),(1,2|0x80000),(1,5),(1,5|0x80000|0x800),(2,1)]+[(i,good[i]|(1<<32))for i in range(3)]:
   case=good.copy();case[i]=value
   self.assertEqual(self.call('socketpair',case),DENY,(i,value))
 def test_exact_read_eight(self):self.assertEqual(self.call('recvfrom',[5,0x1234,8,0,0,0]),ALLOW)
 def test_recv_rejects_sizes_flags_addresses_fd_upper(self):
  good=[5,0x1234,8,0,0,0]
  cases=[(2,0),(2,7),(2,9),(3,1),(4,1),(5,1),(0,5|(1<<32))]+[(i,good[i]|(1<<32))for i in (2,3,4,5)]
  for i,value in cases:
   case=good.copy();case[i]=value
   self.assertEqual(self.call('recvfrom',case),DENY,(i,value))
 def test_other_network_import_and_group_calls_remain_denied(self):
  for nr in [41,42,43,44,46,47,49,50,288,425,426,427,438,101,310,311,272,308,165,321,109,112,200,234,62]:self.assertEqual(evaluate(self.p,nr),DENY,nr)
 def test_all_original_normal_permissions_and_ioctls_unchanged(self):
  _,old=constants()
  for name in old['allowlist']:self.assertEqual(self.call(name),ALLOW,name)
  for selector in [0x5401,0x5413,0x541b]:self.assertEqual(self.call('ioctl',[1,selector,0]),ALLOW)
 def test_arch_x32_negative_and_unknown(self):
  for nr,arch in [(0,0),(0|0x40000000,3221225534),(0xffffffff,3221225534),(999999,3221225534)]:self.assertEqual(evaluate(self.p,nr,arch=arch),DENY)
 def test_clone_prctl_and_existing_reads_unchanged(self):
  self.assertEqual(self.call('read',[0,0,1]),ALLOW);self.assertEqual(self.call('clone3'),0x50000|38)
  self.assertEqual(self.call('clone',[17]),ALLOW);self.assertEqual(self.call('clone',[17|(1<<32)]),DENY)
  self.assertEqual(self.call('clone',[17|0x20000000]),DENY)
  for op in [39,21,15]:self.assertEqual(self.call('prctl',[op]),ALLOW)
  self.assertEqual(self.call('prctl',[1]),DENY)
if __name__=='__main__':unittest.main()
