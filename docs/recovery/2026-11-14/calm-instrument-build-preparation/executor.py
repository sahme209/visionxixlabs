"""One frozen offline website -> desktop build. Import is inert; no installs.

prepare_packet() reads files only. execute() is the separately reviewed sole
attempt. A supplied packet never selects commands, a source tree, or a tool.
"""
import hashlib,json,os,selectors,signal,stat,subprocess,tarfile,tempfile,time
from pathlib import Path,PurePosixPath

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[3]
SNAPSHOT=Path('/Users/samirahmed/.codex/axiom-local-backups/calm-instrument-build-source-20261114-153158/source.tar.gz')
MANIFEST=SNAPSHOT.with_name('SOURCE-MANIFEST.json')
SNAPSHOT_SHA='96a7d10c6190e30a4f7ecf2ad2bff18bb70a117e00314269c68307bb7a9d0c46'
MANIFEST_SHA='ac3fb341c9f7508662054cbab04f51d921e70e2f18d211b8226ee7d91495126b'
ENGINE_SHA='6032ea1bdbd6dc3d453c36a22838d1d3b3554053083bf7695c104e9993637ba1'
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
NPM=NODE.parent.parent/'lib/node_modules/npm/bin/npm-cli.js'
SANDBOX=Path('/usr/bin/sandbox-exec')
SYSTEM_TOOLS=(Path('/bin/sh'),Path('/usr/bin/env'))
ACTIVE_SECONDS=1800
CLEANUP_SECONDS=5
LOG_BYTES=32*1024*1024
PACKET_FILES=('executor.py','test_executor.py','REVIEW.md','DESIGN-REVIEW.md','CANDIDATE.json','PROVENANCE.json','OBSERVED-TOOLS.json','OBSERVED-DELEGATED-TOOLS.json','OWNER-AUTHORIZATION.json')
class Refusal(Exception):pass

def refuse(reason='input_unavailable'):raise Refusal(reason)
def digest_bytes(data):return hashlib.sha256(data).hexdigest()
def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def write_json(path,value):
 with Path(path).open('x',encoding='utf8') as f:
  os.chmod(path,0o600);json.dump(value,f,indent=2);f.write('\n');f.flush();os.fsync(f.fileno())
def source_name(name):
 p=PurePosixPath(name)
 if not name or p.is_absolute() or str(p)!=name or any(x in ('..','.') for x in p.parts) or '\\' in name or '\x00' in name:refuse('archive_path')
 if p.parts[0] in ('work','node_modules','.git') or 'node_modules' in p.parts or '.git' in p.parts:refuse('archive_excluded')
 if any(x.startswith('.env') and x!='.env.example' for x in p.parts):refuse('archive_environment')
 if p.suffix.lower() in ('.pem','.key','.p12','.pfx'):refuse('archive_credential_extension')
 return name

def extract_snapshot(archive,expected,destination,total_bytes):
 """No generic extract: exact regular members, exclusive fresh output files."""
 seen=set();count=0
 with tarfile.open(archive,'r:gz') as t:
  for member in t:
   name=source_name(member.name)
   if not member.isfile() or name in seen or name not in expected or member.size<0:refuse('archive_member')
   count+=member.size
   if count>total_bytes:refuse('archive_size')
   seen.add(name);target=destination/name;target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
   # Owned stage is never exposed until extraction and full verification finish.
   h=hashlib.sha256();copied=0;stream=t.extractfile(member)
   if stream is None:refuse('archive_member')
   with stream,target.open('xb') as out:
    os.chmod(target,0o700 if member.mode&0o111 else 0o600)
    for chunk in iter(lambda:stream.read(1024*1024),b''):
     copied+=len(chunk);h.update(chunk);out.write(chunk)
   if copied!=member.size or h.hexdigest()!=expected[name]:refuse('archive_content')
 if seen!=set(expected) or count!=total_bytes:refuse('archive_incomplete')

def inventory(roots):
 """Freeze complete reachable cached files, links AND directory membership.

 @axiom is intentionally not read through: the only runtime dependency is
 rebuilt to archived stage source. Other symlinks must resolve in dependency
 caches or the pinned npm installation, never an arbitrary source checkout.
 """
 result={};visited=set()
 def visit(p):
  p=Path(p).absolute();key=str(p)
  if key in visited:return
  visited.add(key);s=p.lstat()
  if stat.S_ISLNK(s.st_mode):
   target=p.resolve(strict=True);result[key]={'kind':'link','target':os.readlink(p),'realpath':str(target)}
   if 'node_modules' not in target.parts:refuse('cache_link_outside_dependency_tree')
   visit(target)
  elif stat.S_ISDIR(s.st_mode):
   names=sorted(x.name for x in p.iterdir() if not (p.name=='node_modules' and x.name=='@axiom'))
   result[key]={'kind':'directory','names':names}
   for name in names:visit(p/name)
  elif stat.S_ISREG(s.st_mode):result[key]={'kind':'file','sha256':sha(p),'bytes':s.st_size,'mode':stat.S_IMODE(s.st_mode)}
  else:refuse('cache_special_file')
 for root in roots:visit(root)
 return result

def verify_inventory(expected):
 # Verify both content and topology, including otherwise-unnoticed additions.
 for path,record in expected.items():
  p=Path(path);s=p.lstat();kind=record['kind']
  if kind=='link':
   if not stat.S_ISLNK(s.st_mode) or os.readlink(p)!=record['target'] or str(p.resolve(strict=True))!=record['realpath']:refuse('cache_changed')
  elif kind=='directory':
   if not stat.S_ISDIR(s.st_mode) or sorted(x.name for x in p.iterdir() if not(p.name=='node_modules' and x.name=='@axiom'))!=record['names']:refuse('cache_changed')
  elif not stat.S_ISREG(s.st_mode) or s.st_size!=record['bytes'] or stat.S_IMODE(s.st_mode)!=record['mode'] or sha(p)!=record['sha256']:refuse('cache_changed')

def read_inputs():
 if sha(SNAPSHOT)!=SNAPSHOT_SHA or sha(MANIFEST)!=MANIFEST_SHA:refuse('snapshot_changed')
 candidate=json.loads((HERE/'CANDIDATE.json').read_text());manifest=json.loads(MANIFEST.read_text());provenance=json.loads((HERE/'PROVENANCE.json').read_text())
 if candidate['snapshotPath']!=str(SNAPSHOT) or candidate['snapshotSha256']!=SNAPSHOT_SHA or candidate['fileCount']!=13933 or candidate['sourceBytes']!=183932294 or manifest['fileCount']!=13933 or len(manifest['files'])!=13933:refuse('candidate_mismatch')
 merged={}
 for entry in provenance['manifests']:
  p=REPO/entry['manifest']
  if sha(p)!=entry['sha256']:refuse('provenance_changed')
  values=json.loads(p.read_text())[entry['field']]
  if len(values)!=entry['count']:refuse('provenance_count')
  merged.update(values)
 if merged!=provenance['acceptedSourceFiles'] or len(merged)!=80 or any(manifest['files'].get(p)!=h or sha(REPO/p)!=h for p,h in merged.items()):refuse('provenance_union')
 for p in manifest['files']:source_name(p)
 # The tracked npm config is pinned source, not an inherited auth config.
 return candidate,manifest

def observed_tools():
 observation=json.loads((HERE/'OBSERVED-TOOLS.json').read_text())
 if observation['tools']['node']['path']!=str(NODE) or observation['tools']['npmLauncher']['realpath']!=str(NPM) or observation['tools']['sandboxExec']['path']!=str(SANDBOX) or observation['tools']['schemaEngine']['sha256']!=ENGINE_SHA:refuse('tool_selection')
 delegated=json.loads((HERE/'OBSERVED-DELEGATED-TOOLS.json').read_text())
 for entry in list(observation['tools'].values())+list(observation['packages'].values())+list(delegated['tools'].values()):
  path=Path(entry.get('path',entry['realpath']))
  if str(path.resolve(strict=True))!=entry['realpath'] or sha(path)!=entry['sha256']:refuse('tool_changed')
 return observation

def prepare_packet():
 """File-only preparation; caller saves output and obtains independent review."""
 candidate,manifest=read_inputs();tools=observed_tools()
 files={str(HERE/name):sha(HERE/name) for name in PACKET_FILES}
 for p in (SNAPSHOT,MANIFEST)+SYSTEM_TOOLS:files[str(p)]=sha(p)
 for entry in json.loads((HERE/'PROVENANCE.json').read_text())['manifests']:
  files[str(REPO/entry['manifest'])]=entry['sha256']
 roots=[Path(tools['rootCache']),Path(tools['desktopCache']),NPM.parent.parent]
 return {'format':1,'purpose':'calm_instrument_offline_build_once','snapshotSha256':SNAPSHOT_SHA,'files':files,'tools':tools,'cacheInventory':inventory(roots),'limits':{'activeSeconds':1800,'cleanupSeconds':5,'logBytesPerPhase':LOG_BYTES},'commands':[['npm','run','build'],['npm','run','build']],'candidate':candidate,'scope':'ordinary website and desktop frontend only; not native/runtime/visual acceptance'}

def verify_packet(packet):
 if packet.get('format')!=1 or packet.get('purpose')!='calm_instrument_offline_build_once' or packet.get('snapshotSha256')!=SNAPSHOT_SHA or packet.get('limits')!={'activeSeconds':1800,'cleanupSeconds':5,'logBytesPerPhase':LOG_BYTES} or packet.get('commands')!=[['npm','run','build'],['npm','run','build']]:refuse('packet_contract')
 candidate,_=read_inputs();tools=observed_tools()
 required={str(HERE/x) for x in PACKET_FILES}|{str(SNAPSHOT),str(MANIFEST)}|{str(p) for p in SYSTEM_TOOLS}|{str(REPO/x['manifest']) for x in json.loads((HERE/'PROVENANCE.json').read_text())['manifests']}
 if set(packet['files'])!=required or tools!=packet['tools'] or candidate!=packet['candidate']:refuse('packet_inputs')
 for p,h in packet['files'].items():
  if sha(p)!=h:refuse('packet_file_changed')
 # Reject incomplete inventory as well as mismatches in an accepted inventory.
 actual=inventory([Path(tools['rootCache']),Path(tools['desktopCache']),NPM.parent.parent])
 if actual!=packet['cacheInventory']:refuse('cache_changed')
 return tools

def stage_namespace(cache,destination,source,physical_zod=False):
 destination.mkdir(mode=0o700)
 for item in sorted(cache.iterdir()):
  if item.name in ('.bin','@axiom','.cache','.prisma'):continue
  target=destination/item.name
  if item.name=='zod' and physical_zod:
   # Physical identity is necessary for closed webpack source manifests.
   copy_regular_tree(item.resolve(strict=True),target)
  else:target.symlink_to(item.resolve(strict=True),target_is_directory=item.is_dir())
 bins=destination/'.bin';bins.mkdir(mode=0o700)
 if not (cache/'.bin').is_dir():refuse('missing_cached_bins')
 for entry in (cache/'.bin').iterdir():
  target=entry.resolve(strict=True)
  if not target.is_file():refuse('bad_cached_bin')
  (bins/entry.name).symlink_to(target)
 axiom=destination/'@axiom';axiom.mkdir(mode=0o700)
 (axiom/'verified-issuer-runtime').symlink_to(source/'packages/verified-issuer-runtime',target_is_directory=True)

def copy_regular_tree(src,dst):
 dst.mkdir(mode=0o700)
 for p in sorted(src.iterdir()):
  s=p.lstat()
  if stat.S_ISDIR(s.st_mode):copy_regular_tree(p,dst/p.name)
  elif stat.S_ISREG(s.st_mode):
   with (dst/p.name).open('xb') as f:f.write(p.read_bytes())
   os.chmod(dst/p.name,0o700 if s.st_mode&0o111 else 0o600)
  else:refuse('physical_package_nonregular')

def sandbox_profile(stage):
 return '(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+json.dumps(str(stage))+'))(allow file-write-data (literal "/dev/null"))'

def child_environment(stage,node,engine):
 return {'PATH':str(stage/'bin')+':'+str(node.parent)+':/usr/bin:/bin','HOME':str(stage/'home'),'TMPDIR':str(stage/'tmp'),'XDG_CACHE_HOME':str(stage/'cache'),'LANG':'en_US.UTF-8','LC_ALL':'en_US.UTF-8','TZ':'UTC','NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','NODE_OPTIONS':'--max-old-space-size=8192','NODE_COMPILE_CACHE':str(stage/'cache/node'),'CI':'1','PRISMA_SCHEMA_ENGINE_BINARY':str(engine),'NPM_CONFIG_CACHE':str(stage/'cache/npm'),'NPM_CONFIG_USERCONFIG':str(stage/'empty.npmrc'),'NPM_CONFIG_GLOBALCONFIG':str(stage/'empty-global.npmrc'),'NPM_CONFIG_PREFIX':str(stage/'npm-prefix'),'NPM_CONFIG_OFFLINE':'true','NPM_CONFIG_AUDIT':'false','NPM_CONFIG_FUND':'false','NPM_CONFIG_UPDATE_NOTIFIER':'false','NPM_CONFIG_LOGS_MAX':'0'}

def consume_attempt(path,packet_sha):write_json(path,{'packetSha256':packet_sha,'consumed':True,'retryAllowed':False})

def record_phase(receipt,name,outcome,verify):
 # Preserve typed command/cleanup facts even if the following input check fails.
 receipt.setdefault('phases',{})[name]=outcome
 if name=='website':receipt['desktop']='skipped'
 verify()
 return outcome

def build_pipeline(invoke,remaining):
 phases={}
 for name in ('website','desktop'):
  budget=remaining()
  if budget<=0:refuse('active_deadline')
  outcome=invoke(name,budget);phases[name]=outcome
  if outcome['exitCode']!=0 or outcome['cleanupConfirmed'] is not True:
   if name=='website':phases['desktop']='skipped'
   return {'accepted':False,'phases':phases,'desktop':phases.get('desktop')}
 return {'accepted':True,'phases':phases,'desktop':phases['desktop']}

class ProcessOwner:
 def __init__(self):self.cancelled=False;self.cleanup_used=0.0
 def signal(self,*_):self.cancelled=True
 def run(self,argv,cwd,env,log_path,budget):
  if self.cancelled:refuse('cancelled')
  deadline=time.monotonic()+budget;process=None;total=0;reason=None;cleanup=False;exit_code=None
  with log_path.open('xb') as log:
   os.chmod(log_path,0o600)
   try:
    # Handler only records cancellation: Popen ownership handoff cannot be interrupted.
    process=subprocess.Popen(argv,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,close_fds=True)
    with selectors.DefaultSelector() as sel:
     sel.register(process.stdout,selectors.EVENT_READ)
     while sel.get_map():
      if self.cancelled:reason='cancelled';break
      left=deadline-time.monotonic()
      if left<=0:reason='deadline';break
      for key,_ in sel.select(min(.1,left)):
       chunk=os.read(key.fd,65536)
       if not chunk:sel.unregister(key.fileobj);continue
       total+=len(chunk)
       if total>LOG_BYTES:reason='log_limit';break
       log.write(chunk)
      if reason:break
     while reason is None and exit_code is None:
      if self.cancelled:reason='cancelled';break
      left=deadline-time.monotonic()
      if left<=0:reason='deadline';break
      try:exit_code=process.wait(timeout=min(.1,left))
      except subprocess.TimeoutExpired:pass
   finally:
    if process is not None:
     start=time.monotonic();end=start+max(0,CLEANUP_SECONDS-self.cleanup_used)
     try:
      try:os.killpg(process.pid,signal.SIGKILL)
      except ProcessLookupError:pass
      left=end-time.monotonic()
      if left>0:process.wait(timeout=left)
      while time.monotonic()<end:
       try:os.killpg(process.pid,0)
       except ProcessLookupError:cleanup=True;break
       time.sleep(min(.02,max(0,end-time.monotonic())))
     except (OSError,subprocess.TimeoutExpired):cleanup=False
     finally:
      self.cleanup_used+=time.monotonic()-start
      if process.stdout is not None:process.stdout.close()
  return {'exitCode':exit_code if reason is None and cleanup else None,'reason':reason,'cleanupConfirmed':cleanup,'logBytesObserved':total,'logSha256':sha(log_path),'logPath':str(log_path)}

def outputs(source):
 result={}
 for name in ('.next','desktop/dist','.prisma/client-source','lib/generated/prisma'):
  root=source/name
  if not root.is_dir():refuse('expected_output_missing')
  # Read-only evidence; never load or launch emitted outputs.
  result[name]=inventory([root])
 return result

def execute(packet_path,expected_packet_sha):
 """Only explicit reviewed packet SHA enables the one marker-protected batch."""
 packet_path=Path(packet_path).resolve(strict=True)
 if sha(packet_path)!=expected_packet_sha:refuse('packet_sha')
 packet=json.loads(packet_path.read_text());tools=verify_packet(packet)
 # Fixed location beside the frozen packet prevents a fresh output directory retry.
 consume_attempt(HERE/'ATTEMPT-CONSUMED.json',expected_packet_sha)
 stage=Path(tempfile.mkdtemp(prefix='axiom-calm-frozen-build-',dir='/private/tmp')).resolve();os.chmod(stage,0o700)
 source=stage/'source';source.mkdir(mode=0o700)
 receipt={'accepted':False,'packetSha256':expected_packet_sha,'snapshotSha256':SNAPSHOT_SHA,'stage':str(stage),'scope':'ordinary website+desktop frontend compilation only','networkDenied':True,'outsideStageWritesDenied':True,'databaseUrlSupplied':False,'nativeRuntimeLaunched':False,'retryAllowed':False}
 write_json(stage/'input-packet.json',packet)
 owner=ProcessOwner();old={}
 try:
  for sig in (signal.SIGINT,signal.SIGTERM,signal.SIGHUP):old[sig]=signal.signal(sig,owner.signal)
  _,manifest=read_inputs();extract_snapshot(SNAPSHOT,manifest['files'],source,183932294)
  if (source/'.npmrc').read_text()!='legacy-peer-deps=false\n':refuse('project_npm_config')
  for name in ('home','cache','tmp','bin','npm-prefix'):(stage/name).mkdir(mode=0o700)
  for name in ('empty.npmrc','empty-global.npmrc'):(stage/name).write_text('')
  (stage/'bin/node').symlink_to(NODE)
  stage_namespace(Path(tools['rootCache']),source/'node_modules',source,True)
  # Desktop gets its original dependency set as readonly aliases, not root substitutions.
  stage_namespace(Path(tools['desktopCache']),source/'desktop/node_modules',source,False)
  env=child_environment(stage,NODE,Path(tools['tools']['schemaEngine']['realpath']))
  profile=sandbox_profile(stage);(stage/'sandbox.sb').write_text(profile)
  verify_packet(packet)
  deadline=time.monotonic()+ACTIVE_SECONDS
  def invoke(name,budget):
   if owner.cancelled:refuse('cancelled')
   result=owner.run([str(SANDBOX),'-p',profile,str(NODE),str(NPM),'run','build'],source if name=='website' else source/'desktop',env,stage/(name+'.log'),budget)
   return record_phase(receipt,name,result,lambda:verify_inventory(packet['cacheInventory']))
  receipt.update(build_pipeline(invoke,lambda:deadline-time.monotonic()))
  if receipt['accepted']:
   receipt['outputs']=outputs(source)
  verify_packet(packet);receipt['finalInputsMatched']=True
  if owner.cancelled:refuse('cancelled')
 except BaseException as error:
  receipt['accepted']=False;receipt['failure']=str(error) if isinstance(error,Refusal) else type(error).__name__
 finally:
  try:verify_packet(packet)
  except BaseException:receipt['accepted']=False;receipt['finalInputsMatched']=False
  for sig,handler in old.items():signal.signal(sig,handler)
  write_json(stage/'RESULT.json',receipt)
  print(json.dumps({'accepted':receipt['accepted'],'stage':str(stage),'receiptSha256':sha(stage/'RESULT.json')}),flush=True)
 return receipt

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--approved-packet',required=True);parser.add_argument('--packet-sha256',required=True)
 args=parser.parse_args()
 try:result=execute(args.approved_packet,args.packet_sha256)
 except BaseException as error:
  print(json.dumps({'accepted':False,'failure':type(error).__name__}));raise SystemExit(1)
 raise SystemExit(0 if result['accepted'] else 1)
