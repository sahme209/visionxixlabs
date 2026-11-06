"""Fixed nonsecret host inventory. Import has no host-inspection side effects."""
import ctypes,errno,hashlib,json,os,re,selectors,signal,stat,subprocess,sys,time
from pathlib import Path
GEN='c3b7bf334ce56a64575183b7a66e5109'
LABELS=('com.visionxixlabs.axiom.synthetic.launch-owner.'+GEN,'com.visionxixlabs.axiom.synthetic.bootstrap.'+GEN,'com.visionxixlabs.axiom.issuer-request')
PG=tuple('/opt/homebrew/opt/postgresql@17/bin/'+x for x in ('postgres','initdb','pg_ctl'))
COMMANDS=tuple([('/usr/bin/dscl','/Local/Default','-search','/Users','UniqueID',str(i))for i in (501,65001,65002)]+[('/usr/bin/dscl','/Local/Default','-search','/Groups','PrimaryGroupID',str(i))for i in (20,65001,65002)]+[('/usr/bin/dscl','/Local/Default','-search','/Users','RecordName','_axiomissuer_synthetic')]+[('/usr/bin/otool',flag,p)for p in PG for flag in ('-L','-l')]+[('/bin/launchctl','print','system/'+x)for x in LABELS])
ROOT=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-governance-host-readiness-1')
PROTECTED=(Path('/Library/AxiomQ')/GEN/'socket',Path('/Library/Application Support/Vision XIX Labs/Axiom Synthetic Custodian/generations')/GEN)
# Exact SDK sys/acl.h constants, recorded in ACL-CONSTANTS.json; not guessed.
ACL_TYPE_EXTENDED=0x100
ACL_FIRST_ENTRY=0
class Stop(Exception):pass
def refuse(code):raise Stop(code)
class Budget:
 def __init__(self,clock=time.monotonic):self.clock=clock;self.started=clock();self.deadline=min(self.started+120,float(os.environ.get('AX_FIXED_READINESS_DEADLINE',self.started+120)))
 def remaining(self):
  r=self.deadline-self.clock()
  if r<=0:refuse('aggregate_budget')
  return r
def check_command(code,out,err,elapsed):
 if code is None or elapsed>10 or len(out)+len(err)>65536:refuse('command_bound_or_unknown')
def directory_projection(index,code,out,err):
 if code!=0:refuse('directory_unverified')
 try:lines=out.decode('ascii').splitlines()
 except UnicodeError:refuse('directory_shape')
 if not lines:return 'absent'
 if len(lines)!=1:refuse('directory_ambiguous')
 fields=lines[0].split()
 if len(fields)!=2:refuse('directory_shape')
 name,value=fields
 if index==0:
  if value!='501':refuse('directory_shape')
  return 'operator_id_present'
 if index==3:
  if value!='20':refuse('directory_shape')
  return 'operator_group_present'
 if index in (1,4)and name=='_axiomissuer_synthetic'and value=='65001':return 'issuer_candidate_present_unqualified'
 if index==6 and name=='_axiomissuer_synthetic'and value=='_axiomissuer_synthetic':return 'issuer_name_present_unqualified'
 refuse('principal_collision_or_unreviewed_occupant')
def service_projection(code,out,err,label):
 if code==0:refuse('service_collision')
 # Exact launchctl not-found grammar only; no generic substring/error passthrough.
 expected=('Could not find service "'+label+'" in domain for system').encode()
 if code==113 and err.strip()==expected and not out:return 'absent'
 refuse('service_unverified')
def category(value):
 if value.startswith('/usr/lib/')or value.startswith('/System/Library/Frameworks/')or value.startswith('/System/Library/PrivateFrameworks/'):return 'system'
 return 'nonSystem'
def otool_projection(flag,path,out):
 try:text=out.decode('utf-8')
 except UnicodeError:refuse('static_shape')
 lines=text.splitlines()
 if not lines or lines[0]!=path+':':refuse('static_shape')
 counts={'system':0,'nonSystem':0,'completeClosureQualified':False}
 if flag=='-L':
  for line in lines[1:]:
   m=re.fullmatch(r'\s+([^\s]+) \(compatibility version [0-9.]+, current version [0-9.]+\)',line)
   if not m:refuse('static_dependency_shape')
   counts[category(m[1])]+=1
 else:
  allowed={'LC_SEGMENT_64','LC_SYMTAB','LC_DYSYMTAB','LC_LOAD_DYLINKER','LC_UUID','LC_BUILD_VERSION','LC_VERSION_MIN_MACOSX','LC_SOURCE_VERSION','LC_MAIN','LC_LOAD_DYLIB','LC_LOAD_WEAK_DYLIB','LC_REEXPORT_DYLIB','LC_RPATH','LC_FUNCTION_STARTS','LC_DATA_IN_CODE','LC_CODE_SIGNATURE','LC_DYLD_INFO_ONLY','LC_DYLD_EXPORTS_TRIE','LC_DYLD_CHAINED_FIXUPS','LC_LINKER_OPTION','LC_TWOLEVEL_HINTS','LC_ENCRYPTION_INFO_64','LC_ID_DYLIB'}
  commands=[]
  for line in lines[1:]:
   m=re.fullmatch(r'\s*cmd (LC_[A-Z0-9_]+)',line)
   if m:
    if m[1]not in allowed:refuse('static_unknown_load_command')
    commands.append(m[1])
  if not commands:refuse('static_load_shape')
  counts['loadCommands']=sorted(set(commands));counts['loadCommandCount']=len(commands)
 return counts
def path_projection(d,leaf):
 if d is None:return 'absent'
 if leaf:refuse('selected_leaf_collision')
 if d['kind']!='directory'or d['uid']!=0 or d['gid']!=0 or d['mode']!=0o755 or d['acl']:refuse('protected_ancestry_unverified')
 return 'protected_ancestor'
def acl_present(path):
 lib=ctypes.CDLL('/usr/lib/libSystem.B.dylib',use_errno=True)
 lib.acl_get_file.argtypes=[ctypes.c_char_p,ctypes.c_int];lib.acl_get_file.restype=ctypes.c_void_p
 lib.acl_get_entry.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.POINTER(ctypes.c_void_p)];lib.acl_get_entry.restype=ctypes.c_int
 lib.acl_free.argtypes=[ctypes.c_void_p];lib.acl_free.restype=ctypes.c_int
 obj=lib.acl_get_file(os.fsencode(path),ACL_TYPE_EXTENDED)
 if not obj:refuse('acl_unverified')
 try:
  entry=ctypes.c_void_p();result=lib.acl_get_entry(obj,ACL_FIRST_ENTRY,ctypes.byref(entry))
  if result not in (0,1):refuse('acl_unverified')
  return result==1
 finally:
  if lib.acl_free(obj)!=0:refuse('acl_release_unverified')
def metadata(path,leaf,budget):
 budget.remaining()
 try:s=path.lstat()
 except FileNotFoundError:return None
 d={'kind':'directory'if stat.S_ISDIR(s.st_mode)else 'symlink'if stat.S_ISLNK(s.st_mode)else 'other','uid':s.st_uid,'gid':s.st_gid,'mode':stat.S_IMODE(s.st_mode),'acl':False}
 if d['kind']=='directory':d['acl']=acl_present(path)
 budget.remaining();return d
def pg_metadata(path,budget):
 budget.remaining();p=Path(path)
 try:r=p.resolve(strict=True)
 except OSError:refuse('postgres_candidate_absent_or_unknown')
 if not re.fullmatch(r'/opt/homebrew/Cellar/postgresql@17/[^/]+/bin/(postgres|initdb|pg_ctl)',str(r)):refuse('postgres_candidate_unreviewed_coordinate')
 s=r.lstat()
 if not stat.S_ISREG(s.st_mode)or s.st_nlink!=1 or not 0<s.st_size<=64*1024*1024:refuse('postgres_candidate_shape')
 flags=os.O_RDONLY|os.O_NOFOLLOW;fd=os.open(r,flags)
 try:
  before=os.fstat(fd)
  if before!=s:refuse('postgres_candidate_changed')
  h=hashlib.sha256();total=0
  while True:
   budget.remaining();chunk=os.read(fd,1024*1024)
   if not chunk:break
   total+=len(chunk)
   if total>64*1024*1024:refuse('postgres_candidate_shape')
   h.update(chunk)
  if os.fstat(fd)!=before or r.lstat()!=before or p.resolve(strict=True)!=r:refuse('postgres_candidate_changed')
 finally:os.close(fd)
 trust=True
 for node in [r]+list(r.parents)[:-1]:
  budget.remaining();v=node.lstat()
  if v.st_uid!=0 or stat.S_IMODE(v.st_mode)&0o022 or acl_present(node):trust=False
 return {'sha256':h.hexdigest(),'size':total,'mode':stat.S_IMODE(s.st_mode),'rootOwnedNonwritableNoAclAncestry':trust,'trustedClosureQualified':False}
def run_command(argv,budget):
 started=time.monotonic();limit=min(10,budget.remaining());out=bytearray();err=bytearray()
 # Children inherit the controller-owned worker group, never escape it.
 p=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LC_ALL':'C','LANG':'C'},close_fds=True)
 sel=selectors.DefaultSelector()
 for stream,buf in [(p.stdout,out),(p.stderr,err)]:os.set_blocking(stream.fileno(),False);sel.register(stream,selectors.EVENT_READ,buf)
 try:
  while sel.get_map():
   elapsed=time.monotonic()-started
   if elapsed>=limit or len(out)+len(err)>65536:
    # Abort whole owned worker group; controller retains unreaped leader and owns cleanup.
    os.killpg(os.getpgrp(),signal.SIGTERM);refuse('command_bound_or_unknown')
   for key,_ in sel.select(min(.05,limit-elapsed)):
    data=os.read(key.fd,min(4096,65536-len(out)-len(err)+1))
    if len(data)>65536-len(out)-len(err):os.killpg(os.getpgrp(),signal.SIGTERM);refuse('command_bound_or_unknown')
    if data:key.data.extend(data)
    else:sel.unregister(key.fileobj)
  remaining=limit-(time.monotonic()-started)
  if remaining<=0:os.killpg(os.getpgrp(),signal.SIGTERM);refuse('command_bound_or_unknown')
  try:code=p.wait(timeout=remaining)
  except subprocess.TimeoutExpired:os.killpg(os.getpgrp(),signal.SIGTERM);refuse('command_bound_or_unknown')
  elapsed=time.monotonic()-started;check_command(code,out,err,elapsed);return code,bytes(out),bytes(err),elapsed
 finally:sel.close();p.stdout.close();p.stderr.close()
def inspect(*,run=run_command,metadata=metadata,pg=pg_metadata,operator=lambda:(os.getuid(),os.getgid()),budget=None):
 budget=budget or Budget();result={'format':'axiom.nonsecret-host-readiness/1','state':'stopped','commands':[],'paths':[],'postgres':[],'installationReady':False,'custodyQualified':False,'executionAuthorized':False}
 try:
  if operator()!=(501,20):refuse('operator_identity_unverified')
  for i in range(7):
   result['lastBoundary']={'phase':'command','index':i};budget.remaining();code,out,err,elapsed=run(COMMANDS[i],budget);check_command(code,out,err,elapsed)
   projection=directory_projection(i,code,out,err);del out,err
   result['commands'].append({'index':i,'status':projection})
  for target in PROTECTED:
   nodes=list(reversed(target.parents))[1:]+[target]
   for node in nodes:
    result['lastBoundary']={'phase':'protected_path','coordinate':str(node)};budget.remaining();d=metadata(node,node==target,budget)
    row={'coordinate':str(node),'metadata':d};result['paths'].append(row)
    row['status']=path_projection(d,node==target)
  for label in LABELS:
   node=Path('/Library/LaunchDaemons')/(label+'.plist');result['lastBoundary']={'phase':'daemon_file','coordinate':str(node)};budget.remaining()
   if metadata(node,True,budget)is not None:refuse('daemon_file_collision')
  for j,path in enumerate(PG):
   result['lastBoundary']={'phase':'postgres_metadata','candidate':('postgres','initdb','pg_ctl')[j]};observed=pg(path,budget)
   for n,flag in enumerate(('-L','-l')):
    i=7+j*2+n;result['lastBoundary']={'phase':'command','index':i};budget.remaining();code,out,err,elapsed=run(COMMANDS[i],budget);check_command(code,out,err,elapsed)
    if code!=0:refuse('static_command_unverified')
    projection=otool_projection(flag,path,out);del out,err
    result['commands'].append({'index':i,'status':'static_observed','projection':projection})
   # Rehash current bytes after both static reads; no transitive hashing.
   if pg(path,budget)!=observed:refuse('postgres_candidate_changed')
   result['postgres'].append({'candidate':('postgres','initdb','pg_ctl')[j],**observed})
  for n,label in enumerate(LABELS):
   i=13+n;result['lastBoundary']={'phase':'command','index':i};budget.remaining();code,out,err,elapsed=run(COMMANDS[i],budget);check_command(code,out,err,elapsed)
   projection=service_projection(code,out,err,label);del out,err
   result['commands'].append({'index':i,'status':projection})
  budget.remaining();result['state']='observed_unqualified';result['postgresTrustedClosure']='not_qualified'
 except Stop as error:result['reason']=str(error)
 except BaseException:result['reason']='unverified_internal_failure'
 return result
if __name__=='__main__':
 # Only the fixed frozen controller may invoke this entry; no selectors/options.
 if len(sys.argv)!=2 or sys.argv[1]!='--fixed-private-worker':sys.exit(2)
 value=inspect();sys.stdout.write(json.dumps(value,separators=(',',':'))+'\n');sys.stdout.flush();sys.exit(0 if value['state']=='observed_unqualified'else 1)
