#!/usr/bin/env python3
"""Bind exact trusted-local native inputs. Never execute engines or authorize identity."""
from __future__ import annotations
import hashlib,importlib.util,json,os,re,shutil,stat,struct,subprocess,tempfile
from pathlib import Path

MAX_FILE=64*1024*1024
MAX_COMMANDS=16*1024*1024
REQUESTED_COMMIT='605197351a3c8bdd595af2d2a9bc3025bca48ea2'
KINDS={'query':('libquery-engine','libquery_engine-darwin-arm64.dylib.node',6,0o600),'schema':('schema-engine','schema-engine',2,0o700)}
class Unavailable(RuntimeError):pass
def fail(reason):raise Unavailable(reason)
def private(path):
 path=Path(path)
 if path.is_symlink()or not path.is_dir()or path.stat().st_uid!=os.getuid()or stat.S_IMODE(path.stat().st_mode)&0o077:fail('private_owned_directory_required')
 return path.resolve()
def state(s):return(s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def native_header(prefix,size,kind):
 if len(prefix)<32:fail('native_header_truncated')
 magic,cpu,subtype,filetype,ncmds,command_bytes,flags,reserved=struct.unpack('<IiiIIIII',prefix[:32])
 if magic!=0xfeedfacf or cpu!=0x100000c or subtype!=0 or filetype!=KINDS[kind][2]or reserved!=0:fail('unsupported_native_header')
 if not 0<ncmds<=4096 or not 8*ncmds<=command_bytes<=MAX_COMMANDS or command_bytes>size-32 or len(prefix)<32+command_bytes:fail('native_commands_bounds')
 offset=32
 for _ in range(ncmds):
  if offset+8>32+command_bytes:fail('native_command_truncated')
  command,length=struct.unpack('<II',prefix[offset:offset+8])
  if length<8 or length%8 or offset+length>32+command_bytes:fail('native_command_size')
  offset+=length
 if offset!=32+command_bytes:fail('native_command_count')
 return {'format':'mach-o-64-little-endian','architecture':'arm64','cpuSubtype':0,'fileType':filetype}
def native_linkage(prefix,size,kind):
 native_header(prefix,size,kind);_,_,_,_,ncmds,_,_,_=struct.unpack('<IiiIIIII',prefix[:32])
 offset=32;install_id=None;dependencies=[]
 for _ in range(ncmds):
  command,length=struct.unpack('<II',prefix[offset:offset+8])
  if command in {0xc,0xd,0x80000018,0x8000001f,0x80000023,0x20}:
   if length<24:fail('native_dylib_command_truncated')
   start=struct.unpack('<I',prefix[offset+8:offset+12])[0]
   if not 24<=start<length:fail('native_dylib_name_offset')
   raw=prefix[offset+start:offset+length];end=raw.find(b'\0')
   if end<1:fail('native_dylib_name_termination')
   try:name=bytes(raw[:end]).decode('ascii')
   except UnicodeError:fail('native_dylib_name_encoding')
   if any(ord(c)<32 for c in name):fail('native_dylib_name_encoding')
   if command==0xd:
    if install_id is not None or kind!='query':fail('native_install_id_invalid')
    install_id=name
   else:dependencies.append(name)
  elif command in {0x8000001c,0x27}:fail('unbound_native_loader_configuration')
  offset+=length
 return {'installId':install_id,'dependencies':dependencies}

def read_native(path,kind,output=None,linkage_output=None):
 path=Path(path);before=path.lstat();fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd)
  if not stat.S_ISREG(opened.st_mode)or opened.st_nlink!=1 or state(before)!=state(opened):fail('native_regular_singlelink_stable_required')
  if not 32<=opened.st_size<=MAX_FILE:fail('native_size_limit')
  digest=hashlib.sha256();count=0;prefix=bytearray()
  while True:
   chunk=os.read(fd,min(1024*1024,opened.st_size-count+1))
   if not chunk:break
   count+=len(chunk)
   if count>opened.st_size:fail('native_grew')
   digest.update(chunk)
   if len(prefix)<MAX_COMMANDS+32:prefix.extend(chunk[:MAX_COMMANDS+32-len(prefix)])
   if output is not None:output.write(chunk)
  if count!=opened.st_size or state(opened)!=state(os.fstat(fd))or state(opened)!=state(path.lstat()):fail('native_changed')
  header=native_header(prefix,count,kind)
  linkage=native_linkage(prefix,count,kind)
  if linkage_output is not None:linkage_output.update(linkage)
  return {'sha256':digest.hexdigest(),'size':count,**header}, {'device':opened.st_dev,'inode':opened.st_ino,'mode':stat.S_IMODE(opened.st_mode),'size':count,'mtimeNs':opened.st_mtime_ns,'ctimeNs':opened.st_ctime_ns}
 finally:os.close(fd)
def strict_json(body):
 def unique(pairs):
  result={}
  for k,v in pairs:
   if k in result:fail('duplicate_receipt_key')
   result[k]=v
  return result
 try:return json.loads(body,object_pairs_hook=unique)
 except(ValueError,UnicodeError,TypeError):fail('invalid_receipt_json')
def bind_local_engines(source,owned):
 source=Path(source).resolve();owned=private(owned);destination=owned/'engine-inputs'
 if destination.exists()or destination.is_symlink():fail('new_engine_destination_required')
 destination.mkdir(mode=0o700)
 try:
  inputs={}
  for kind,(original,name,_,mode)in KINDS.items():
   path=destination/name;fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
   with os.fdopen(fd,'wb')as out:
    identity,observation=read_native(source/original,kind,out);out.flush();os.fsync(out.fileno());os.fchmod(out.fileno(),mode)
   copied,_=read_native(path,kind)
   if copied!=identity:fail('owned_engine_copy_mismatch')
   inputs[kind]={'file':name,'mode':mode,**identity,'sourceObservation':observation}
  receipt={'format':'axiom.local-engine-inputs/2','provenance':'trusted_local_host_input','platform':'darwin-arm64',
           'requestedEngineCommit':REQUESTED_COMMIT,'upstreamAuthenticity':'unavailable','engineCommitAuthenticity':'unavailable',
           'inputs':inputs,'generationStarted':False,'buildStarted':False,'executingIssuerIdentity':'unavailable','executionAuthorized':False}
  fd=os.open(destination/'receipt.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'w')as out:json.dump(receipt,out,sort_keys=True,separators=(',',':'));out.write('\n');out.flush();os.fsync(out.fileno())
  return verify_bound_engines(destination)
 except BaseException:shutil.rmtree(destination);raise

def verify_bound_engines(directory):
 directory=private(directory);path=directory/'receipt.json';before=path.lstat()
 if not stat.S_ISREG(before.st_mode)or before.st_nlink!=1 or before.st_size>16384:fail('invalid_receipt_file')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd)
  if state(before)!=state(opened):fail('receipt_changed')
  body=os.read(fd,16385)
  if len(body)>16384 or state(opened)!=state(os.fstat(fd))or state(opened)!=state(path.lstat()):fail('receipt_changed')
 finally:os.close(fd)
 value=strict_json(body)
 fixed={'format':'axiom.local-engine-inputs/2','provenance':'trusted_local_host_input','platform':'darwin-arm64','requestedEngineCommit':REQUESTED_COMMIT,
        'upstreamAuthenticity':'unavailable','engineCommitAuthenticity':'unavailable','generationStarted':False,'buildStarted':False,'executingIssuerIdentity':'unavailable','executionAuthorized':False}
 if not isinstance(value,dict)or set(value)!=set(fixed)|{'inputs'}or any(value.get(k)!=v or type(value.get(k))is not type(v)for k,v in fixed.items()):fail('invalid_engine_receipt')
 if not isinstance(value['inputs'],dict)or set(value['inputs'])!=set(KINDS):fail('invalid_receipt_inputs')
 if set(p.name for p in directory.iterdir())!={'receipt.json',*[v[1]for v in KINDS.values()]}:fail('unexpected_engine_directory_entry')
 for kind,(_,name,_,mode)in KINDS.items():
  item=value['inputs'][kind]
  if not isinstance(item,dict)or set(item)!={'file','mode','sha256','size','format','architecture','cpuSubtype','fileType','sourceObservation'}or item.get('file')!=name or item.get('mode')!=mode:fail('invalid_engine_input')
  observed=item['sourceObservation']
  if not isinstance(observed,dict)or set(observed)!={'device','inode','mode','size','mtimeNs','ctimeNs'}or any(type(n)is not int or n<0 for n in observed.values()):fail('invalid_source_observation')
  actual,_=read_native(directory/name,kind)
  if any(type(item.get(k))is not type(v)or item[k]!=v for k,v in actual.items())or stat.S_IMODE((directory/name).stat().st_mode)!=mode or observed['size']!=actual['size']:fail('bound_engine_changed')
 return value

def builder():
 spec=importlib.util.spec_from_file_location('local_source_builder',Path(__file__).with_name('build-local-issuer-package-source.py'))
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def verify_archived_inputs(stage,repo,revision):
 b=builder();_,_,source=b.source_inputs(repo,revision)
 for name,key in [('package.json','packageSha256'),('package-lock.json','lockSha256')]:
  path=stage/name
  if path.is_symlink()or hashlib.sha256(path.read_bytes()).hexdigest()!=source[key]:fail('archived_package_inputs_changed')
 schema=stage/'prisma/schema.prisma'
 if schema.is_symlink()or schema.resolve()!=schema:fail('canonical_archived_schema_required')
 expected=b.git_bytes(repo,['show',revision+':prisma/schema.prisma'])
 if len(expected)>16*1024*1024 or schema.read_bytes()!=expected:fail('archived_schema_changed')
 return {**source,'schemaSha256':hashlib.sha256(expected).hexdigest()}
def verify_generation_sources(stage,cache):
 b=builder();return b.observe_generation_sources(stage,b.json_data((stage/'package-lock.json').read_bytes()),cache)
def verify_native_dependencies(directory):
 names=set()
 for kind,(_,name,_,_)in KINDS.items():
  linkage={};read_native(directory/name,kind,linkage_output=linkage)
  if not linkage['dependencies']:fail('native_dependencies_missing')
  for dependency in linkage['dependencies']:
   if not dependency.startswith(('/usr/lib/','/System/Library/'))or '..'in dependency.split('/'):fail('unbound_native_dependency')
   names.add(dependency)
 return {'kind':'trusted_macos_static_system_libraries_not_attestation','installNames':sorted(names),
         'dynamicRuntimeClosure':'not_qualified_by_static_load_commands'}
def prepare_generation(stage,directory,repo,revision,cache,node):
 stage=private(stage);directory=private(directory)
 source=verify_archived_inputs(stage,repo,revision);sources=verify_generation_sources(stage,cache)
 engines=verify_bound_engines(directory);dependencies=verify_native_dependencies(directory)
 # Final byte recheck follows all source/native inspection awaits; no execution.
 verify_bound_engines(directory)
 return {'format':'axiom.local-prisma-generation-preparation/1','status':'prepared_not_executed',**source,
         'node':str(node),'arguments':['node_modules/prisma/build/index.js','generate','--schema',str(stage/'prisma/schema.prisma')],
         'engineEnvironment':{'PRISMA_QUERY_ENGINE_LIBRARY':str(directory/KINDS['query'][1]),'PRISMA_SCHEMA_ENGINE_BINARY':str(directory/KINDS['schema'][1])},
         'sources':sources,'engines':engines,'nativeDependencies':dependencies,'network':'must_be_kernel_denied',
         'generationStarted':False,'buildStarted':False,'executingIssuerIdentity':'unavailable','executionAuthorized':False}

# This executor is callable only deliberately; importing this module never runs it.
# It accepts source coordinates, NOT a prepared JSON receipt or caller truth flag.
def stable_file_hash(path,limit=256*1024*1024):
 path=Path(path);before=path.lstat();fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd)
  if not stat.S_ISREG(opened.st_mode)or opened.st_nlink!=1 or state(before)!=state(opened)or not 0<opened.st_size<=limit:fail('regular_stable_output_required')
  count=0;digest=hashlib.sha256()
  while True:
   chunk=os.read(fd,min(1024*1024,opened.st_size-count+1))
   if not chunk:break
   count+=len(chunk)
   if count>opened.st_size:fail('output_grew')
   digest.update(chunk)
  if count!=opened.st_size or state(opened)!=state(os.fstat(fd))or state(opened)!=state(path.lstat()):fail('output_changed')
  return {'sha256':digest.hexdigest(),'size':count}
 finally:os.close(fd)
def _sandbox_string(value):
 text=str(value)
 if not text.isascii()or any(ord(c)<32 for c in text)or any(c in text for c in '"\\'):fail('unsupported_sandbox_path')
 return '"'+text+'"'
def _generation_profile(stage,tmp,logs,protected,read_protected=()):
 rules=['(version 1)','(allow default)','(deny network*)','(deny file-write*)',
        '(allow file-write* (subpath '+_sandbox_string(stage)+') (subpath '+_sandbox_string(tmp)+') '+ ' '.join('(literal '+_sandbox_string(log)+')'for log in logs)+')']
 for directory in protected:rules.append('(deny file-write* (subpath '+_sandbox_string(directory)+'))')
 for directory in read_protected:rules.append('(deny file-read* (subpath '+_sandbox_string(directory)+'))')
 return ''.join(rules)
def _run_generation_child(command,stage,environment,log,timeout,file_size_limit=128*1024*1024,creation_mask=None):
 # Group signals are permitted only while the exact direct child is unreaped.
 # After reaping, numeric group IDs are not ownership proofs; never probe them.
 # No complete descendant/quiescence or untrusted-code containment claim.
 import signal,time,resource
 if signal.getsignal(signal.SIGCHLD)!=signal.SIG_DFL:fail('generation_exclusive_child_reaper_required')
 def limits():
  resource.setrlimit(resource.RLIMIT_FSIZE,(file_size_limit,file_size_limit))
  if creation_mask is not None:os.umask(creation_mask)
 nullfd=None;process=None;launch_failure=None;null_cleanup_unknown=False
 try:
  nullfd=os.open('/dev/null',os.O_RDONLY|os.O_CLOEXEC|os.O_NOFOLLOW)
  process=subprocess.Popen(command,cwd=stage,env=environment,stdin=nullfd,stdout=log,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
 except (OSError,subprocess.SubprocessError)as error:
  import errno
  code=errno.errorcode.get(getattr(error,'errno',None),'UNKNOWN');code=code if code in ('EPERM','EACCES','ENOENT','EMFILE','ENFILE','ENOMEM','EAGAIN','EIO','ENOEXEC')else'UNKNOWN'
  launch_failure=Unavailable('generation_launch_unavailable');launch_failure.launchDiagnostic={'phase':'null_input'if nullfd is None else'spawn','class':'OSError'if isinstance(error,OSError)else'SubprocessError','errno':code}
 finally:
  if nullfd is not None:
   try:os.close(nullfd)
   except OSError:null_cleanup_unknown=True
 if launch_failure is not None:
  if null_cleanup_unknown:launch_failure.parentInputCleanup='unknown'
  raise launch_failure from None
 reason='generation_parent_stdin_cleanup_unknown'if null_cleanup_unknown else None;deadline=time.monotonic()+timeout;kill_attempted=False
 def kill_owned_once():
  nonlocal kill_attempted
  if process.returncode is not None or kill_attempted:return
  kill_attempted=True
  try:os.killpg(process.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 try:
  while reason is None and process.poll()is None:
   if time.monotonic()>=deadline:reason='generation_parent_wall_timeout';break
   if os.fstat(log.fileno()).st_size>64*1024*1024:reason='generation_output_limit';break
   time.sleep(min(0.025,max(0,deadline-time.monotonic())))
  if reason:
   kill_owned_once()
   try:process.wait(timeout=5)
   except subprocess.TimeoutExpired:return process.returncode,'generation_original_child_cleanup_unknown'
  else:
   process.wait(timeout=5)
   # Normal exit is only a compiler-exit observation. Original-group survival
   # and descendant quiescence remain unavailable after this child is reaped.
  if os.fstat(log.fileno()).st_size>64*1024*1024:reason='generation_output_limit'
  return process.returncode,reason
 except BaseException:
  if process.returncode is None:
   kill_owned_once()
   try:process.wait(timeout=5)
   except subprocess.TimeoutExpired:raise RuntimeError('generation_original_child_cleanup_unknown')from None
  raise

def _schema_bytes(path,limit=16*1024*1024):
 path=Path(path);before=path.lstat();fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd)
  if not stat.S_ISREG(opened.st_mode)or opened.st_nlink!=1 or state(before)!=state(opened)or not 0<opened.st_size<=limit:fail('schema_observation_unavailable')
  parts=[];count=0
  while True:
   chunk=os.read(fd,min(1024*1024,opened.st_size-count+1))
   if not chunk:break
   count+=len(chunk)
   if count>opened.st_size:fail('schema_changed_during_read')
   parts.append(chunk)
  if count!=opened.st_size or state(opened)!=state(os.fstat(fd))or state(opened)!=state(path.lstat()):fail('schema_changed_during_read')
  return b''.join(parts)
 finally:os.close(fd)
def _schema_scratch(source,target):
 body=_schema_bytes(source);fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as out:out.write(body);out.flush();os.fsync(out.fileno())
 if _schema_bytes(target)!=body:fail('scratch_schema_copy_mismatch')
 return hashlib.sha256(body).hexdigest()

def verify_generated_outputs(stage,plan):
 root=stage/'node_modules/.prisma/client'
 if root.is_symlink()or root.resolve()!=root or not root.is_dir():fail('generated_client_missing_or_aliased')
 observations={}
 for name in ['index.js','default.js','index.d.ts','schema.prisma','libquery_engine-darwin-arm64.dylib.node']:
  path=root/name
  if path.resolve()!=path:fail('generated_output_alias')
  observations[name]=stable_file_hash(path,64*1024*1024)
 expected=plan['engines']['inputs']['query'];query=observations['libquery_engine-darwin-arm64.dylib.node']
 if query!={'sha256':expected['sha256'],'size':expected['size']}:fail('generated_query_engine_mismatch')
 return observations

def verify_generation_observation(stage,run,preparation,node,revision):
 """Recheck existing generation evidence only; never format or execute a tool."""
 stage=private(stage);run=private(run)
 def read(path,cap):
  data=_schema_bytes(path,cap)
  if len(data)>cap:fail('generation_evidence_limit')
  return data
 def document(raw):
  def pairs(items):
   out={}
   for key,value in items:
    if key in out:fail('duplicate_generation_evidence_key')
    out[key]=value
   return out
  try:return json.loads(raw,object_pairs_hook=pairs)
  except(ValueError,TypeError,RecursionError):fail('generation_evidence_json_invalid')
 attempt_raw=read(run/'attempt.json',4*1024*1024);result_raw=read(run/'result.json',4*1024*1024)
 attempt=document(attempt_raw);result=document(result_raw)
 if not isinstance(attempt,dict)or attempt.get('format')!='axiom.local-generation-attempt/1'or attempt.get('sourceRevision')!=revision or attempt.get('preparation')!=preparation or attempt.get('node')!=stable_file_hash(node):fail('generation_input_provenance_mismatch')
 if not isinstance(result,dict)or result.get('format')!='axiom.local-generation-result/1'or result.get('status')!='generated_outputs_observed_unqualified'or result.get('generatedOutputsVerified')is not True or result.get('generationCompatibilityVerified')is not False or result.get('executionAuthorized')is not False or result.get('executingIssuerIdentity')!='unavailable'or result.get('descendantQuiescence')!='unavailable':fail('generation_observation_not_unqualified')
 current=verify_generated_outputs(stage,preparation)
 if current!=result.get('outputs'):fail('current_generated_inputs_changed')
 comparison=result.get('schemaComparison')
 if not isinstance(comparison,dict)or comparison.get('kind')!='canonical_formatted_scratch_bytes'or comparison.get('semanticAttestation')!='unavailable'or comparison.get('rawArchiveSha256')!=preparation['schemaSha256']or comparison.get('rawGeneratedSha256')!=current['schema.prisma']['sha256']:fail('generation_schema_provenance_mismatch')
 archive=read(run/'tmp/archive-schema.prisma',16*1024*1024);emitted=read(run/'tmp/emitted-schema.prisma',16*1024*1024)
 if archive!=emitted or hashlib.sha256(archive).hexdigest()!=comparison.get('canonicalArchiveSha256')or hashlib.sha256(emitted).hexdigest()!=comparison.get('canonicalGeneratedSha256'):fail('generation_canonical_observation_changed')
 return {'attemptSha256':hashlib.sha256(attempt_raw).hexdigest(),'resultSha256':hashlib.sha256(result_raw).hexdigest(),'currentRequiredOutputs':current,'schemaComparison':comparison}

def execute_generation(stage,directory,repo,revision,cache,node,owned_run,timeout=120):
 import math,platform,time
 if type(timeout)not in (int,float)or not math.isfinite(timeout)or not 0<timeout<=120:fail('generation_deadline_invalid')
 deadline=time.monotonic()+timeout
 if platform.system()!='Darwin'or platform.machine()!='arm64':fail('unsupported_generation_host')
 stage=private(stage);directory=private(directory);owned_run=private(owned_run);repo=Path(repo).resolve();cache=Path(cache).resolve();node=Path(node)
 pinned=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
 if node!=pinned or node.is_symlink()or node.resolve()!=node:fail('pinned_node_required')
 protected=[repo,cache,Path.home()/'.cache/prisma',directory]
 for target in [*protected,owned_run]:
  target=target.resolve()
  if target==stage or stage in target.parents or target in stage.parents:fail('generation_stage_boundary_overlap')
 if any(owned_run==p.resolve()or p.resolve()in owned_run.parents for p in protected):fail('generation_output_boundary_overlap')
 node_identity=stable_file_hash(node)
 plan=prepare_generation(stage,directory,repo,revision,cache,node)
 # Fail before launch on any existing output; never truncate prior evidence.
 names=['attempt.json','result.json','generation.log','node-version.log','format-archive.log','format-emitted.log','tmp']
 if any((owned_run/name).exists()or(owned_run/name).is_symlink()for name in names):fail('fresh_generation_outputs_required')
 handles={}
 try:
  for name in names[:-1]:
   fd=os.open(owned_run/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   handles[name]=os.fdopen(fd,'wb')
  tmp=owned_run/'tmp';tmp.mkdir(mode=0o700)
  attempt={'format':'axiom.local-generation-attempt/1','sourceRevision':revision,'node':node_identity,'preparation':plan,
           'status':'reserved_before_launch','processBounds':'original_process_group_only','postReapGroupStatus':'unqualified_not_signalled','descendantQuiescence':'unavailable','upstreamAuthenticity':'unavailable','executingIssuerIdentity':'unavailable','executionAuthorized':False}
  handles['attempt.json'].write((json.dumps(attempt,sort_keys=True)+'\n').encode());handles['attempt.json'].flush();os.fsync(handles['attempt.json'].fileno())
  environment={'PATH':str(node.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','TZ':'UTC','TMPDIR':str(tmp),'XDG_CACHE_HOME':str(tmp),
               'CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','NEXT_TELEMETRY_DISABLED':'1',
               'PRISMA_QUERY_ENGINE_LIBRARY':str(directory/KINDS['query'][1]),'PRISMA_SCHEMA_ENGINE_BINARY':str(directory/KINDS['schema'][1])}
  profile=_generation_profile(stage,tmp,[owned_run/name for name in ['generation.log','node-version.log','format-archive.log','format-emitted.log']],protected)
  prefix=['/usr/bin/sandbox-exec','-p',profile,str(node)]
  result={'format':'axiom.local-generation-result/1','status':'unavailable','archiveFormatStarted':False,'emittedFormatStarted':False,'generationStarted':False,'generatedOutputsVerified':False,'generationCompatibilityVerified':False,
          'processBounds':'original_process_group_only','postReapGroupStatus':'unqualified_not_signalled','descendantQuiescence':'unavailable','runtimeQualification':'unavailable',
          'upstreamAuthenticity':'unavailable','engineCommitAuthenticity':'unavailable','runtimeClosure':'unavailable',
          'executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False,'buildStarted':False}
  def remaining(cap=None):
   left=deadline-time.monotonic()
   if left<=0:fail('generation_parent_wall_timeout')
   return min(left,cap)if cap is not None else left
  try:
   code,error=_run_generation_child([*prefix,'--version'],stage,environment,handles['node-version.log'],remaining(5))
   handles['node-version.log'].flush()
   if error or code!=0 or (owned_run/'node-version.log').read_bytes()!=b'v24.21.0\n':fail(error or 'pinned_node_version_unavailable')
   # Recompute source/schema/SRI/native binding after the last child await.
   recomputed=prepare_generation(stage,directory,repo,revision,cache,node)
   if recomputed!=plan:fail('preparation_changed_before_generation')
   if stable_file_hash(node)!=node_identity:fail('node_changed_before_generation')
   archive_scratch=tmp/'archive-schema.prisma';emitted_scratch=tmp/'emitted-schema.prisma'
   archive_raw=_schema_scratch(stage/'prisma/schema.prisma',archive_scratch)
   if archive_raw!=plan['schemaSha256']:fail('archive_changed_before_format')
   result['archiveFormatStarted']=True
   code,error=_run_generation_child([*prefix,'node_modules/prisma/build/index.js','format','--schema',str(archive_scratch)],stage,environment,handles['format-archive.log'],remaining())
   if error or code!=0:fail(error or 'offline_archive_format_failed')
   archive_canonical=_schema_bytes(archive_scratch)
   if prepare_generation(stage,directory,repo,revision,cache,node)!=plan:fail('preparation_changed_after_archive_format')
   if stable_file_hash(node)!=node_identity:fail('node_changed_before_generation')
   result['generationStarted']=True
   code,error=_run_generation_child([*prefix,'node_modules/prisma/build/index.js','generate','--schema',str(stage/'prisma/schema.prisma')],stage,environment,handles['generation.log'],remaining())
   result['exit']=code
   if error or code!=0:fail(error or 'offline_generation_failed')
   outputs=verify_generated_outputs(stage,plan)
   emitted_path=stage/'node_modules/.prisma/client/schema.prisma'
   generated_raw=_schema_scratch(emitted_path,emitted_scratch)
   if generated_raw!=outputs['schema.prisma']['sha256']:fail('generated_schema_changed_during_observation')
   result['emittedFormatStarted']=True
   code,error=_run_generation_child([*prefix,'node_modules/prisma/build/index.js','format','--schema',str(emitted_scratch)],stage,environment,handles['format-emitted.log'],remaining())
   if error or code!=0:fail(error or 'offline_emitted_format_failed')
   generated_canonical=_schema_bytes(emitted_scratch)
   if _schema_bytes(archive_scratch)!=archive_canonical:fail('canonical_archive_scratch_changed')
   if archive_canonical!=generated_canonical:fail('generated_schema_canonical_mismatch')
   if hashlib.sha256(_schema_bytes(emitted_path)).hexdigest()!=generated_raw:fail('generated_schema_changed_after_format')
   result['schemaComparison']={'kind':'canonical_formatted_scratch_bytes','rawArchiveSha256':archive_raw,'rawGeneratedSha256':generated_raw,
                               'canonicalArchiveSha256':hashlib.sha256(archive_canonical).hexdigest(),'canonicalGeneratedSha256':hashlib.sha256(generated_canonical).hexdigest(),
                               'semanticAttestation':'unavailable'}
   verify_generation_sources(stage,cache);verify_bound_engines(directory)
   after=verify_archived_inputs(stage,repo,revision)
   if any(plan.get(key)!=value for key,value in after.items()):fail('archive_changed_after_generation')
   if stable_file_hash(node)!=node_identity:fail('node_changed_after_generation')
   result.update(status='generated_outputs_observed_unqualified',generatedOutputsVerified=True,outputs=outputs)
  except(RuntimeError,OSError,ValueError)as exc:
   # The dynamically imported builder has a distinct Unavailable subclass.
   # Keep foreign helper failures durable without exporting their messages.
   result['reason']=str(exc)if type(exc)is Unavailable else 'generation_verification_unavailable'
  handles['result.json'].write((json.dumps(result,sort_keys=True)+'\n').encode());handles['result.json'].flush();os.fsync(handles['result.json'].fileno())
  if not result['generatedOutputsVerified']:fail(result['reason'])
  return result
 finally:
  for handle in handles.values():handle.close()
