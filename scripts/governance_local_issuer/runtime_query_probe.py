"""Fixed local compatibility probe. No issuer/resource/production authority."""
from pathlib import Path
import hashlib,json,os,stat,sys
if __package__ in (None,''):sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from governance_local_issuer import fixture_recipe_packet as files
BASE=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab')
ROOT=BASE/'2026-11-06-runtime-query-load-1'
NODE=BASE/'2026-11-05-private-node-profile/node-review-copy'
QUERY=BASE/'2026-11-05-real-system-build-0b0e8b48/engine-inputs/libquery_engine-darwin-arm64.dylib.node'
ORIGINAL=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
NODE_SHA='1aa6f6936040d80d6f9c1bb75ba4af97ce596af514ab7f0157a77f461abce134'
QUERY_SHA='e0f4077c48e80b36425e6b0295803593eed753988c5f31adfab966b739d4809d'
ORIGINAL_SHA='e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b'
CAP=65536;SUCCESS=b'AXIOM_QUERY_MODULE_LOADED_NO_ENGINE\n'
REASONS=('library_validation_refused','native_loader_refused','runtime_mismatch','export_mismatch','load_refused')
SCRIPT=("'use strict';\ntry {\nif(process.platform!=='darwin'||process.arch!=='arm64'||process.version!=='v24.21.0')throw Error('unexpected_runtime');\nconst moduleValue=require("+json.dumps(str(QUERY))+");\nif(typeof moduleValue.QueryEngine!=='function')throw Error('unexpected_export');\nprocess.stdout.write('AXIOM_QUERY_MODULE_LOADED_NO_ENGINE\\n');process.exit(0);\n}catch(error){let category='load_refused';\nif(error&&typeof error.message==='string'&&/code signature|different Team IDs|library validation/i.test(error.message))category='library_validation_refused';\nelse if(error&&error.code==='ERR_DLOPEN_FAILED')category='native_loader_refused';\nelse if(error&&error.message==='unexpected_runtime')category='runtime_mismatch';\nelse if(error&&error.message==='unexpected_export')category='export_mismatch';\nprocess.stdout.write('AXIOM_QUERY_LOAD_REFUSED '+category+'\\n');process.exit(73);}\n").encode()
def encoded(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def state(s):return [s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns]
def binding(path):
 p=Path(path);a=p.lstat()
 if p.resolve()!=p or not stat.S_ISREG(a.st_mode)or a.st_size>256*1024*1024:raise ValueError('fixed_file')
 data=p.read_bytes();b=p.lstat()
 if state(a)!=state(b)or a.st_mode!=b.st_mode:raise ValueError('input_changed')
 return {'path':str(p),'sha256':hashlib.sha256(data).hexdigest(),'size':len(data),'mode':stat.S_IMODE(a.st_mode),'state':state(a)}
def exclusive(path):return os.fdopen(os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb')
def save(path,value):
 with exclusive(path)as f:f.write(encoded(value));f.flush();os.fsync(f.fileno())
def load(path):
 def pairs(items):
  out={}
  for k,v in items:
   if k in out:raise ValueError('duplicate_key')
   out[k]=v
  return out
 if Path(path).stat().st_size>1024*1024:raise ValueError('input_bound')
 return json.loads(Path(path).read_bytes(),object_pairs_hook=pairs)
def private(p):
 s=Path(p).lstat()
 if Path(p).resolve()!=Path(p)or not stat.S_ISDIR(s.st_mode)or s.st_uid!=os.getuid()or stat.S_IMODE(s.st_mode)!=0o700:raise ValueError('private_directory')
def device():
 s=os.lstat('/dev/null')
 if not stat.S_ISCHR(s.st_mode)or s.st_uid!=0 or (os.major(s.st_rdev),os.minor(s.st_rdev))!=(3,2):raise ValueError('null_sink')
 return [s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode,s.st_rdev]
def source_paths():
 here=Path(__file__).resolve()
 return [here,here.with_name('fixture_recipe_packet.py'),here.with_name('manifest.py'),here.with_name('__init__.py'),here.parents[1]/'local_prisma_engine_inputs.py',here.parents[1]/'build-local-issuer-package-source.py']
def prepare():
 if ROOT.exists():raise ValueError('fresh_preparation_required')
 ROOT.mkdir(mode=0o700);(ROOT/'work').mkdir(mode=0o700)
 for name in ('home','tmp'):(ROOT/'work'/name).mkdir(mode=0o700)
 with exclusive(ROOT/'fixture.cjs')as f:f.write(SCRIPT)
 p={'format':'axiom.runtime-query-probe/1','node':binding(NODE),'query':binding(QUERY),'originalNode':binding(ORIGINAL),'script':binding(ROOT/'fixture.cjs'),'sources':{str(x):binding(x)for x in source_paths()},'device':device(),'work':str(ROOT/'work'),'seconds':10,'cleanupSeconds':5,'combinedCap':CAP,'governanceQualified':False}
 save(ROOT/'packet.json',p);verify_inputs(p);return ROOT/'packet.json'
def same_candidate(actual,want,mode):
 return actual['path']==want['path']and actual['sha256']==want['sha256']and actual['size']==want['size']and actual['mode']==mode and actual['state'][:-1]==want['state'][:-1]
def verify_inputs(p,after=None):
 if set(p)!={'format','node','query','originalNode','script','sources','device','work','seconds','cleanupSeconds','combinedCap','governanceQualified'}or p['format']!='axiom.runtime-query-probe/1'or p['work']!=str(ROOT/'work')or(p['seconds'],p['cleanupSeconds'],p['combinedCap'])!=(10,5,CAP)or p['governanceQualified']is not False:raise ValueError('packet')
 private(ROOT);private(ROOT/'work');private(NODE.parent)
 for key,path,sha in (('node',NODE,NODE_SHA),('query',QUERY,QUERY_SHA),('originalNode',ORIGINAL,ORIGINAL_SHA)):
  if p[key]['path']!=str(path)or p[key]['sha256']!=sha:raise ValueError('pinned_input')
  now=binding(path)
  if key=='node'and after is not None:
   if now!=after or not same_candidate(now,p[key],0o600):raise ValueError('candidate_currentness')
  elif now!=p[key]:raise ValueError('input_changed')
 if p['node']['mode']!=0o600 or p['node']['state'][2]!=os.getuid()or p['node']['state'][4]!=1:raise ValueError('candidate_owner')
 if p['script']['path']!=str(ROOT/'fixture.cjs')or p['script']['sha256']!=hashlib.sha256(SCRIPT).hexdigest()or binding(ROOT/'fixture.cjs')!=p['script']:raise ValueError('fixed_script')
 if set(p['sources'])!={str(x)for x in source_paths()}:raise ValueError('source_set')
 for name,want in p['sources'].items():
  if want['path']!=name or binding(Path(name))!=want:raise ValueError('source_changed')
 if device()!=p['device']:raise ValueError('device_changed')
def descriptor_binding(fd,path):
 a=os.fstat(fd)
 if not stat.S_ISREG(a.st_mode)or a.st_size>256*1024*1024:raise ValueError('descriptor')
 os.lseek(fd,0,os.SEEK_SET);h=hashlib.sha256();count=0
 while True:
  b=os.read(fd,1024*1024)
  if not b:break
  h.update(b);count+=len(b)
  if count>a.st_size:raise ValueError('candidate_grew')
 z=os.fstat(fd)
 if state(a)!=state(z)or a.st_mode!=z.st_mode or count!=a.st_size:raise ValueError('descriptor_changed')
 return {'path':str(path),'sha256':h.hexdigest(),'size':count,'mode':stat.S_IMODE(a.st_mode),'state':state(a)}
def classify(code,error,data):
 if error or len(data)>=CAP:return {'status':'unknown','reason':'child_cleanup_or_limit_unknown','exit':code}
 if code==0 and data==SUCCESS:return {'status':'module_load_observed','exit':code}
 for reason in REASONS:
  if code==73 and data==('AXIOM_QUERY_LOAD_REFUSED '+reason+'\n').encode():return {'status':'refused','reason':reason,'exit':code}
 return {'status':'refused','reason':'unclassified_load_failure','exit':code}
def execute_child(p):
 work=ROOT/'work';q=json.dumps
 policy='(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+q(str(work))+'))(allow file-write-data (literal "/dev/null"))'
 env={'PATH':'/usr/bin:/bin','HOME':str(work/'home'),'TMPDIR':str(work/'tmp'),'LANG':'C','TZ':'UTC'}
 logpath=work/'output.log'
 with exclusive(logpath)as log:code,error=files.engine_tools._run_generation_child(['/usr/bin/sandbox-exec','-p',policy,str(NODE),str(ROOT/'fixture.cjs')],work,env,log,10,file_size_limit=CAP,creation_mask=0o077)
 return classify(code,error,logpath.read_bytes())
def run_candidate(p):
 want=p['node'];fd=None;activated=False;r={'status':'unknown','reason':'runtime_or_input_unavailable'};restoration='not_changed';after=None;path_current='unavailable';descriptor_cleanup='not_opened'
 try:
  fd=os.open(want['path'],os.O_RDONLY|os.O_CLOEXEC|os.O_NOFOLLOW)
  if descriptor_binding(fd,want['path'])!=want or binding(Path(want['path']))!=want:raise ValueError('candidate_changed')
  activated=True;os.fchmod(fd,0o700);active=descriptor_binding(fd,want['path'])
  if not same_candidate(active,want,0o700)or binding(Path(want['path']))!=active:raise ValueError('candidate_activation_changed')
  r=execute_child(p)
 except BaseException:r={'status':'unknown','reason':'runtime_or_input_unavailable'}
 finally:
  if fd is not None:
   try:
    if activated:
     current=os.fstat(fd)
     if(current.st_dev,current.st_ino)!=(want['state'][0],want['state'][1])or not stat.S_ISREG(current.st_mode):raise ValueError('descriptor_identity')
     os.fchmod(fd,0o600)
     after=descriptor_binding(fd,want['path'])
     if not same_candidate(after,want,0o600):raise ValueError('restore_content')
     restoration='verified'
     if binding(Path(want['path']))==after:path_current='verified'
    else:restoration='not_activated'
   except BaseException:restoration='unavailable'
   try:os.close(fd);descriptor_cleanup='closed'
   except OSError:descriptor_cleanup='unavailable'
 r.update(modeRestoration=restoration,pathCurrentness=path_current,descriptorCleanup=descriptor_cleanup,governanceQualified=False,descendantQuiescence='unavailable')
 if after is not None:r['nodeAfter']=after
 if restoration!='verified'or path_current!='verified'or descriptor_cleanup!='closed':r['status']='unknown'
 return r
def execute(path):
 if Path(path)!=ROOT/'packet.json':raise ValueError('fixed_packet_path')
 p=load(path);verify_inputs(p)
 for name in ('attempt.json','result.json','work/output.log'):
  if (ROOT/name).exists()or(ROOT/name).is_symlink():raise ValueError('unused_attempt')
 save(ROOT/'attempt.json',{'packetSha256':binding(path)['sha256'],'invocations':1,'retryAuthorized':False,'status':'reserved'})
 with exclusive(ROOT/'result.json')as result:
  r=run_candidate(p)
  try:verify_inputs(p,after=r.get('nodeAfter'));r['finalInputCurrentness']='verified'
  except BaseException:r.update(status='unknown',finalInputCurrentness='unavailable')
  result.write(encoded(r));result.flush();os.fsync(result.fileno())
 return r
