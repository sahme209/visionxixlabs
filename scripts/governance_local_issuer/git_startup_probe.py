"""One reviewed diagnostic, never an issuer or artifact-run permission source."""
from pathlib import Path
import hashlib,json,os,signal,stat,subprocess,sys,time,resource
if __package__ in (None,''):sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from governance_local_issuer import fixture_recipe_packet as files
BASE=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab')
ROOT=BASE/'2026-11-06-git-startup-probe-1'
SOURCE=BASE/'2026-11-06-source-fixture-b8ced685-v2'
REVISION='b8ced685ab8d1e46ed4d23ee1b7babbecd19d20e'
GIT='/usr/bin/git';CLT='/Library/Developer/CommandLineTools/usr/bin/git'
GIT_SHA='ed6f5284033aa2aae6a58427c25ba3ab119947b40365627b24e5d51a4b70a1cd'
CLT_SHA='3121e7e4d16059539731c58d94888709c12904abe922acde8e37caef4607c1d1'
CAP=65536
SIGNATURES=tuple(('fatal: '+prefix+': '+reason).encode() for prefix in ("could not open '/dev/null' for reading and writing",'stdfds') for reason in ('Operation not permitted','Permission denied'))
DEPENDENCIES=('git_startup_probe.py','fixture_recipe_packet.py','manifest.py','__init__.py')
def encoded(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def load(path):
 def pairs(items):
  out={}
  for k,v in items:
   if k in out:raise ValueError('duplicate_key')
   out[k]=v
  return out
 if Path(path).stat().st_size>2*1024*1024:raise ValueError('input_size')
 return json.loads(Path(path).read_bytes(),object_pairs_hook=pairs)
def binding(path):
 p=Path(path);a=p.lstat()
 if p.resolve()!=p or not stat.S_ISREG(a.st_mode) or a.st_size>256*1024*1024:raise ValueError('fixed_file')
 data=p.read_bytes();b=p.lstat()
 state=lambda s:(s.st_dev,s.st_ino,s.st_uid,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
 if state(a)!=state(b):raise ValueError('changed_file')
 return {'path':str(p),'sha256':hashlib.sha256(data).hexdigest(),'size':len(data),'mode':stat.S_IMODE(a.st_mode),'state':list(state(a))}
def exclusive(path):return os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb')
def save(path,value):
 with exclusive(path) as f:f.write(encoded(value));f.flush();os.fsync(f.fileno())
def device_state():
 s=Path('/dev/null').lstat()
 if not stat.S_ISCHR(s.st_mode)or s.st_uid!=0 or (os.major(s.st_rdev),os.minor(s.st_rdev))!=(3,2):raise ValueError('device_changed')
 return [s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode,s.st_rdev]
def private(path):
 p=Path(path);s=p.lstat()
 if p.resolve()!=p or not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:raise ValueError('private_directory')
def prepare():
 if ROOT.exists():raise ValueError('fresh_preparation_required')
 ROOT.mkdir(mode=0o700);work=ROOT/'work';work.mkdir(mode=0o700)
 for name in ('home','tmp'):(work/name).mkdir(mode=0o700)
 program=Path(__file__).resolve();bindings={str(program.parent/name):binding(program.parent/name)for name in DEPENDENCIES}
 for name in ('local_prisma_engine_inputs.py','build-local-issuer-package-source.py'):bindings[str(program.parents[1]/name)]=binding(program.parents[1]/name)
 packet={'format':'axiom.git-startup-probe/1','repo':str(SOURCE/'repo'),'sourceRevision':REVISION,'receipt':binding(SOURCE/'copy-receipt.json'),'program':binding(program),'bindings':bindings,'python':binding(Path(sys.executable).resolve()),'git':binding(Path(GIT)),'cltGit':binding(Path(CLT)),'device':device_state(),'work':str(work),'childSeconds':10,'outerSeconds':30,'cleanupSeconds':5,'streamCap':CAP,'governanceQualified':False}
 if packet['git']['sha256']!=GIT_SHA or packet['cltGit']['sha256']!=CLT_SHA:raise ValueError('tool_mismatch')
 save(ROOT/'packet.json',packet);verify_inputs(packet);return ROOT/'packet.json'
def verify_inputs(p):
 if set(p)!={'format','repo','sourceRevision','receipt','program','bindings','python','git','cltGit','device','work','childSeconds','outerSeconds','cleanupSeconds','streamCap','governanceQualified'}or p['format']!='axiom.git-startup-probe/1':raise ValueError('packet_shape')
 if p['repo']!=str(SOURCE/'repo')or p['sourceRevision']!=REVISION or p['work']!=str(ROOT/'work')or (p['childSeconds'],p['outerSeconds'],p['cleanupSeconds'],p['streamCap'])!=(10,30,5,CAP)or p['governanceQualified']is not False:raise ValueError('coordinates')
 private(ROOT);private(ROOT/'work');private(SOURCE);private(SOURCE/'repo')
 expected={str(Path(__file__).resolve().parent/name)for name in DEPENDENCIES}|{str(Path(__file__).resolve().parents[1]/name)for name in ('local_prisma_engine_inputs.py','build-local-issuer-package-source.py')}
 if set(p['bindings'])!=expected or p['program']['path']!=str(Path(__file__).resolve())or p['python']['path']!='/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/bin/python3.9'or p['git']['path']!=GIT or p['cltGit']['path']!=CLT or p['receipt']['path']!=str(SOURCE/'copy-receipt.json'):raise ValueError('binding_coordinates')
 for name,item in p['bindings'].items():
  if item.get('path')!=name:raise ValueError('binding_path_mismatch')
 for item in [*p['bindings'].values(),p['program'],p['python'],p['git'],p['cltGit'],p['receipt']]:
  if binding(Path(item['path']))!=item:raise ValueError('input_changed')
 if p['git']['sha256']!=GIT_SHA or p['cltGit']['sha256']!=CLT_SHA or device_state()!=p['device']:raise ValueError('pinned_input_changed')
 receipt=load(SOURCE/'copy-receipt.json')
 if receipt['sourceRevision']!=REVISION or receipt['stagedRepo']!=p['repo']:raise ValueError('source_receipt')
 observed=set()
 for root,dirs,names in os.walk(SOURCE/'repo',followlinks=False):
  for name in dirs:
   if (Path(root)/name).is_symlink():raise ValueError('source_alias')
  for name in names:observed.add(str((Path(root)/name).relative_to(SOURCE)))
 if observed!=set(receipt['files']):raise ValueError('source_inventory')
 for name,expected_file in receipt['files'].items():
  rel=Path(name)
  if rel.is_absolute()or '..'in rel.parts or rel.parts[0]!='repo':raise ValueError('source_path')
  actual=binding(SOURCE/rel)
  if any(actual[k]!=expected_file[k]for k in ('sha256','size','mode')):raise ValueError('source_changed')
def profile(p,control):
 q=json.dumps
 base='(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+q(p['work'])+'))(deny file-write* (subpath '+q(p['repo'])+'))'
 return base+'(allow file-write-data (literal "/dev/null"))'if control else base
def allow_control(r):
 return r.get('status')=='completed'and r.get('exit')==128 and r.get('stdout')==b''and r.get('stderr')in (*SIGNATURES,*(s+b'\n'for s in SIGNATURES))
_interrupted=False
def _request_stop(signum,frame):
 global _interrupted
 _interrupted=True
def _hold_for_outer_cleanup():
 # Stay unreaped while an inner child may be alive. The outer parent retains
 # its original Python process-group ownership until outer group SIGKILL.
 while True:time.sleep(.05)
def _stop_owned(proc,deadline):
 try:
  if proc.poll()is not None:return True
  for sig in (signal.SIGTERM,signal.SIGKILL):
   if proc.poll()is not None:return True
   proc.send_signal(sig)
   left=deadline-time.monotonic()
   if left<=0:return False
   try:proc.wait(timeout=min(1,left));return True
   except subprocess.TimeoutExpired:pass
  return proc.poll()is not None
 except Exception:return False
def run_revision(p,control,deadline):
 phase='control'if control else'denied';work=Path(p['work']);outpath=work/(phase+'.stdout');errpath=work/(phase+'.stderr');proc=None
 end=min(deadline,time.monotonic()+10);status='completed'
 def limits():resource.setrlimit(resource.RLIMIT_FSIZE,(CAP,CAP));os.umask(0o077)
 with exclusive(outpath)as out,exclusive(errpath)as err:
  try:
   if _interrupted:raise ValueError('interrupted')
   null=os.open('/dev/null',os.O_RDONLY|os.O_CLOEXEC|os.O_NOFOLLOW)
   try:
    proc=subprocess.Popen(['/usr/bin/sandbox-exec','-p',profile(p,control),GIT,'-C',p['repo'],'rev-parse',p['sourceRevision']+'^{commit}'],cwd=work,env={'PATH':'/usr/bin:/bin','GIT_NO_LAZY_FETCH':'1'},stdin=null,stdout=out,stderr=err,start_new_session=False,preexec_fn=limits)
   finally:os.close(null)
   while proc.poll()is None:
    if _interrupted or time.monotonic()>=end or outpath.stat().st_size>=CAP or errpath.stat().st_size>=CAP:status='unknown';break
    time.sleep(.01)
   if outpath.stat().st_size>=CAP or errpath.stat().st_size>=CAP:status='unknown'
  except Exception:status='unknown'
  finally:
   if proc is not None and not _stop_owned(proc,min(deadline,time.monotonic()+2)):_hold_for_outer_cleanup()
 return {'status':status,'exit':proc.returncode if proc is not None else None,'stdout':outpath.read_bytes()[:CAP],'stderr':errpath.read_bytes()[:CAP]}
def brief(r):return {'status':r['status'],'exit':r['exit'],'stdoutBytes':len(r['stdout']),'stderrBytes':len(r['stderr'])}
def run_experiment(p):
 end=time.monotonic()+27;verify_inputs(p)
 if _interrupted or time.monotonic()>=end:raise ValueError('budget_expired')
 denied=run_revision(p,False,end);r={'status':'unknown'if denied['status']=='unknown'else'prerequisite_unresolved','denied':brief(denied),'controlPerformed':False,'governanceQualified':False,'descendantQuiescence':'unavailable'}
 if allow_control(denied):
  verify_inputs(p)
  if _interrupted or time.monotonic()>=end:raise ValueError('budget_expired')
  control=run_revision(p,True,end);r.update(controlPerformed=True,control=brief(control))
  if control['status']=='unknown':r['status']='unknown'
  if control['status']=='completed'and control['exit']==0 and control['stdout']==p['sourceRevision'].encode()+b'\n'and control['stderr']==b'':r['status']='null_sink_startup_observed'
 verify_inputs(p)
 if _interrupted:r['status']='unknown'
 return r
def execute(path):
 path=Path(path)
 if path!=ROOT/'packet.json':raise ValueError('fixed_packet_path')
 p=load(path);verify_inputs(p)
 for name in ('attempt.json','result.json','outer.log','work/child-result.json','work/denied.stdout','work/control.stdout'):
  if (ROOT/name).exists()or(ROOT/name).is_symlink():raise ValueError('unused_experiment_required')
 save(ROOT/'attempt.json',{'packetSha256':binding(path)['sha256'],'status':'reserved','invocations':1,'retryAuthorized':False})
 with exclusive(ROOT/'result.json')as result:
  value={'status':'unknown','reason':'experiment_unavailable','governanceQualified':False,'descendantQuiescence':'unavailable'}
  try:
   env={'PATH':'/usr/bin:/bin','HOME':str(ROOT/'work/home'),'TMPDIR':str(ROOT/'work/tmp'),'PYTHONDONTWRITEBYTECODE':'1','LANG':'C'}
   with exclusive(ROOT/'outer.log')as log:code,error=files.engine_tools._run_generation_child([p['python']['path'],p['program']['path'],'--child',str(path)],ROOT/'work',env,log,30,file_size_limit=CAP,creation_mask=0o077)
   if not error and code==0:
    child=load(ROOT/'work/child-result.json')
    if child.get('status')in ('unknown','prerequisite_unresolved','null_sink_startup_observed')and child.get('governanceQualified')is False:value=child
  except Exception:pass
  result.write(encoded(value));result.flush();os.fsync(result.fileno())
 return value
if __name__=='__main__':
 signal.signal(signal.SIGTERM,_request_stop)
 if len(sys.argv)!=3 or sys.argv[1]!='--child'or Path(sys.argv[2])!=ROOT/'packet.json':sys.exit(74)
 try:
  packet=load(ROOT/'packet.json');value=run_experiment(packet);save(ROOT/'work/child-result.json',value);sys.exit(0)
 except Exception:sys.stderr.write('git_startup_probe_unavailable\n');sys.exit(74)
