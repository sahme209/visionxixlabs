"""Joined operational compiler: one exact owner-approved PR transition.

Pure recipes/static evidence checks feed the later fixed hosted controller.
Historical compiler profiles/receipts are never modified or reenrolled here.
"""
from pathlib import Path
import re,os,stat,json,importlib.util
TARGET='x86_64-unknown-linux-gnu'
APPROVED_PR=337
APPROVED_BEFORE='b693178ea7485b3a976a100da06ca75b8fa995e6'
OWNER_DECISION='call_60732fcbde694192b8efdaf317b506d1'

def need(ok,reason='operational_compile_unavailable'):
 if not ok:raise ValueError(reason)

def validate_event(event,name,attempt):
 # Exact source-bound approval; neither environment nor event data grants approval.
 need(isinstance(APPROVED_PR,int) and not isinstance(APPROVED_PR,bool) and APPROVED_PR>0 and isinstance(APPROVED_BEFORE,str) and re.fullmatch('[0-9a-f]{40}',APPROVED_BEFORE) and isinstance(OWNER_DECISION,str) and OWNER_DECISION.startswith('call_'),'native_compile_not_approved')
 need(name=='pull_request' and attempt=='1' and isinstance(event,dict) and event.get('action')=='synchronize')
 pr=event.get('pull_request',{});repo=event.get('repository',{})
 need(isinstance(pr,dict) and isinstance(repo,dict),'malformed_compiler_event')
 head=pr.get('head',{});base=pr.get('base',{})
 need(isinstance(head,dict) and isinstance(base,dict) and isinstance(head.get('repo'),dict) and isinstance(base.get('repo'),dict),'malformed_compiler_ref')
 need(repo.get('full_name')=='sahme209/visionxixlabs' and repo.get('private') is False and event.get('number')==APPROVED_PR and pr.get('number')==APPROVED_PR and event.get('before')==APPROVED_BEFORE)
 need(base.get('ref')=='main' and base.get('repo',{}).get('full_name')=='sahme209/visionxixlabs' and head.get('ref')=='codex/governance-operational-package' and head.get('repo',{}).get('full_name')=='sahme209/visionxixlabs')
 sha=head.get('sha');need(isinstance(sha,str) and re.fullmatch('[0-9a-f]{40}',sha) and sha!=APPROVED_BEFORE and event.get('after')==sha)
 return sha

def compile_plan(cc,cargo,source,native,out,sdk):
 for p in (cc,cargo,source,native,out,sdk):need(isinstance(p,Path) and p.is_absolute() and '..' not in p.parts,'fixed_absolute_compile_paths_required')
 c=[str(cc),'-std=c11','-Wall','-Wextra','-I',str(native)]
 def phase(name,argv,output,seconds):return {'name':name,'argv':argv,'output':str(output),'maximumSeconds':seconds,'runtimeQualified':False,'installed':False}
 status=out/'time_operational_status.o';publisher=out/'time_publication.o'
 plan=[phase('status-object',c+['-O0','-fPIC','-pthread','-c',str(native/'time_operational_status.c'),'-o',str(status)],status,30),phase('publisher-object',c+['-O0','-fPIC','-c',str(native/'time_publication.c'),'-o',str(publisher)],publisher,30)]
 daemon=out/'rust'/TARGET/'release/axiom-operational-daemon'
 plan.append(phase('operational-daemon',[str(cargo),'rustc','--locked','--offline','--target',TARGET,'--package','clock-bound','--bin','axiom-operational-daemon','--no-default-features','--features','axiom-operational-time','--release','--','-C','link-arg='+str(status),'-C','link-arg='+str(publisher),'-C','link-arg=-Wl,--no-undefined','-C','link-arg=-lpthread','-C','link-arg=-lrt'],daemon,1500))
 worker=out/'time_worker'
 plan.append(phase('worker',c+['-O2','-fPIE','-pie',*[str(native/n) for n in ('time_worker.c','time_worker_protocol.c','time_publication.c')],'-o',str(worker)],worker,30))
 addon=out/'operational.node'
 plan.append(phase('operational-addon',c+['-O0','-DNAPI_VERSION=8','-DNODE_GYP_MODULE_NAME=axiom_operational','-I',str(sdk),'-fPIC','-shared','-pthread',*[str(native/n) for n in ('time_operational_binding.c','time_parent_binding.c','time_worker_protocol.c','time_publication.c','time_operational_status.c')],'-lrt','-o',str(addon)],addon,30))
 owner=out/'operational-owner-compile-only'
 plan.append(phase('operational-owner',c+['-O0','-fPIE','-pie','-pthread',str(native/'time_operational_owner.c'),str(native/'time_operational_status.c'),'-o',str(owner)],owner,30))
 return plan

def validate_addon_imports(text,used):
 need(isinstance(text,str) and 0<len(text.encode())<=256*1024 and '\x00' not in text and text.endswith('\n'),'addon_import_output_unavailable')
 need(isinstance(used,set) and bool(used) and all(re.fullmatch(r'napi_[A-Za-z0-9_]+',n) for n in used),'reviewed_node_api_set_required')
 names=set();host=set()
 for row in text.splitlines():
  m=re.fullmatch(r'\s*([Uw])\s+([A-Za-z_][A-Za-z0-9_]*(?:@GLIBC_[0-9]+(?:\.[0-9]+)*)?)',row);need(m is not None,'unknown_addon_import_row')
  kind,name=m.groups();need(name not in names,'duplicate_addon_import');names.add(name)
  if name.startswith('napi_'):
   need(kind=='U' and name in used,'unknown_node_api_import');host.add(name)
  elif '@GLIBC_' in name:
   need(not name.startswith(('axiom_','napi_','node_api_')),'unresolved_native_contract')
  else:need(kind=='w' and name in {'_ITM_deregisterTMCloneTable','_ITM_registerTMCloneTable','__gmon_start__'},'unknown_addon_import')
 need(host==used,'missing_reviewed_node_api_import')
 return host

def validate_operational_features(text):
 need(isinstance(text,str) and 0<len(text.encode())<=256*1024 and '\x00' not in text,'feature_output_unavailable')
 first=text.splitlines()[0];m=re.fullmatch(r'clock-bound v3\.0\.0-rc\.0 \([^\r\n]+\) ([a-z0-9_,-]+)',first);need(m is not None,'operational_root_features_missing')
 # Target feature is explicit and strict/evaluation/test constructors are excluded.
 features=set(m[1].split(','));need(features=={'axiom-operational-time','daemon','tracing-subscriber'},'unexpected_operational_root_features')


SOURCE_REPORT='docs/recovery/2026-11-15/operational-source-assembly/SOURCE-ASSEMBLY-RESULT.json'
SOURCE_MANIFEST='docs/recovery/2026-11-15/operational-source-assembly/ASSEMBLED-RUST-SOURCE.json'
SOURCE_REPORT_SHA='1a5e3801ad2496696198d275e31df862b839ef4a1147e06405cb63211474d39f'
SOURCE_MANIFEST_SHA='358f10db01c8db3c993b8a9200662acaa6ac6fa374779a539755774f52ee45c6'
NATIVE_NAMES=('time_operational_owner.c','time_operational_status.c','time_operational_status.h','time_operational_binding.c','time_operational_binding.h','time_parent_binding.c','time_parent_binding.h','time_worker.c','time_worker_protocol.c','time_worker_protocol.h','time_publication.c','time_publication.h')

def _sha(data):
 import hashlib
 return hashlib.sha256(data).hexdigest()

def _read_regular(path,maximum=8*1024*1024):
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  before=os.fstat(fd);need(stat.S_ISREG(before.st_mode) and 0<=before.st_size<=maximum,'source_type_or_size')
  chunks=[];total=0
  while True:
   part=os.read(fd,min(65536,maximum-total+1))
   if not part:break
   total+=len(part);need(total<=maximum,'source_grew');chunks.append(part)
  after=os.fstat(fd)
  need(total==before.st_size and all(getattr(before,k)==getattr(after,k) for k in ('st_dev','st_ino','st_size','st_mtime_ns','st_ctime_ns')),'source_changed')
  return b''.join(chunks)
 finally:os.close(fd)

def prepare_sources(repo,destination):
 """Only writes text source into a fresh private directory; never a qualifier."""
 try:
  need(__debug__,'source_preparation_requires_assertions')
  repo=Path(repo).resolve(strict=True);destination=Path(destination)
  need(destination.is_absolute() and '..' not in destination.parts and not os.path.lexists(destination),'fresh_source_destination_required')
  parent=destination.parent.resolve(strict=True);ps=parent.stat()
  need(stat.S_ISDIR(ps.st_mode) and ps.st_uid==os.getuid() and stat.S_IMODE(ps.st_mode)==0o700,'private_source_parent_required')
  report_raw=_read_regular(repo/SOURCE_REPORT);manifest_raw=_read_regular(repo/SOURCE_MANIFEST)
  need(_sha(report_raw)==SOURCE_REPORT_SHA and _sha(manifest_raw)==SOURCE_MANIFEST_SHA,'assembled_source_receipt_changed')
  report=json.loads(report_raw);expected=json.loads(manifest_raw);snapshots={}
  for name,digest in report['sourceInputSha256'].items():
   data=_read_regular(repo/name);need(_sha(data)==digest,'native_or_source_input_changed');snapshots[name]=data
  audit_path=repo/'docs/recovery/2026-11-15/operational-source-assembly/audit.py';audit=_read_regular(audit_path)
  need(_sha(audit)==report['auditSourceSha256'],'assembler_changed')
  # This is the hash-checked local text assembler, not an archive program.
  import types
  assembler=types.ModuleType('fixed_operational_text_assembler');assembler.__file__=str(audit_path)
  exec(compile(audit,str(audit_path),'exec'),assembler.__dict__)
  files,_=assembler.exact(assembler.evaluation_files(repo),snapshots['packages/verified-issuer-runtime/linux/clockbound-operational-time.patch'])
  files['clock-bound/src/daemon/operational_publication.rs']=snapshots['packages/verified-issuer-runtime/linux/operational_publication.rs']
  need(set(files)==set(expected) and len(files)==327,'assembled_source_members_changed')
  for name,data in files.items():need(len(data)==expected[name]['bytes'] and _sha(data)==expected[name]['sha256'],'assembled_source_content_changed')
  os.mkdir(destination,0o700);source=destination/'source';native=destination/'native';source.mkdir(mode=0o700);native.mkdir(mode=0o700)
  def write(name,data,root):
   from governance_linux_compile_inputs import safe_path
   path=root/safe_path(name);path.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
   fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   with os.fdopen(fd,'wb') as out:need(out.write(data)==len(data),'source_write_incomplete')
  for name,data in files.items():write(name,data,source)
  for name in NATIVE_NAMES:write(name,snapshots['packages/verified-issuer-runtime/linux/'+name],native)
  write('runtime_profile.h',snapshots['scripts/linux-native-behavior/runtime_profile.h'],native)
  need(all(_sha(_read_regular(repo/n))==report['sourceInputSha256'][n] for n in snapshots),'source_inputs_changed_during_preparation')
  return {'sourceRoot':str(source),'nativeRoot':str(native),'sourceManifest':expected,'rustModules':sum(n.endswith('.rs') for n in files),'lockSha256':_sha(files['Cargo.lock']),'nativeCompiled':False,'qualified':False}
 except (OSError,KeyError,TypeError,UnicodeError,AssertionError) as error:raise ValueError('operational_source_preparation_unavailable') from None

class _CompilerCancelled(BaseException):pass

class CompileContext:
 """Owns one ordered command stream, not a native/runtime qualification grant.

 Normal cleanup consumes the shared2400s wall budget. Only the last failing
 command may use the additional≤5s cleanup allowance; no following phase runs
 once the shared deadline, cancellation or any uncertainty has occurred.
 """
 def __init__(self,root,tools,verify,supervisor,clock):
  need(isinstance(root,Path) and root.is_absolute() and root.is_dir(),'owned_compile_root_required')
  need(isinstance(tools,set) and bool(tools) and all(isinstance(p,str) and Path(p).is_absolute() for p in tools),'fixed_tool_set_required')
  self.root=root;self.tools=frozenset(tools);self.verify=verify;self.supervisor=supervisor;self.clock=clock
  self.emit=lambda record:None
  self.deadline=clock()+2400.;self.records=[];self.seen=set();self.retired=False;self.cancelled=False;self.handlers={}
  (root/'logs').mkdir(mode=0o700)
 def _term(self,*_):
  self.cancelled=True;self.retired=True;raise _CompilerCancelled()
 def _forward(self,*args):
  import signal
  self.cancelled=True;self.retired=True
  handler=signal.getsignal(signal.SIGTERM)
  if callable(handler):
   handler(signal.SIGTERM,args[1] if len(args)>1 else None)
   return # Supervisor may defer until Popen returns its owned child.
  raise _CompilerCancelled()
 def __enter__(self):
  import signal
  try:
   for sig,handler in [(signal.SIGTERM,self._term),(signal.SIGINT,self._forward),(signal.SIGHUP,self._forward)]:self.handlers[sig]=signal.signal(sig,handler)
  except BaseException:
   self.__exit__(None,None,None);raise
  return self
 def __exit__(self,*_):
  import signal
  for sig,handler in self.handlers.items():signal.signal(sig,handler)
  self.handlers={}
 def run(self,name,argv,maximum,*,cwd=None,env=None,launcher=None):
  import math
  need(not self.retired and not self.cancelled,'compiler_attempt_retired')
  try:
   need(isinstance(name,str) and re.fullmatch('[a-z][a-z0-9-]{0,63}',name) and name not in self.seen,'duplicate_or_invalid_phase')
   need(isinstance(argv,list) and bool(argv) and argv[0] in self.tools and all(isinstance(x,str) and '\x00' not in x for x in argv),'unreviewed_compiler_command')
   need(isinstance(maximum,(int,float)) and not isinstance(maximum,bool) and math.isfinite(maximum) and 0<maximum<=1500,'invalid_phase_budget')
   remaining=self.deadline-self.clock();need(remaining>0,'compiler_deadline')
   command=argv
   if launcher is not None:
    need(str(launcher) in self.tools,'unreviewed_restriction_launcher');command=[str(launcher),'--',*argv]
   self.seen.add(name);self.verify()
   remaining=self.deadline-self.clock();need(remaining>0,'compiler_deadline_before_spawn')
   # Metadata/full Rust symbols need bounded complete output, not a retry after
   # truncation. These are the only16MiB phases; ordinary streams are256KiB.
   limit=16*1024*1024 if name in ('locked-metadata','daemon-symbols') else 256*1024
   stdout=self.root/'logs'/(name+'.stdout');stderr=self.root/'logs'/(name+'.stderr')
   result=self.supervisor(command,cwd=Path(cwd or self.root),env=env or {},stdout_path=stdout,stderr_path=stderr,timeout_seconds=min(maximum,remaining),max_output_bytes=limit,cleanup_seconds=5)
   record={'phase':name,'argv':command,'result':result};self.records.append(record)
   record['diagnostics']={'stdout':diagnostic_evidence(_read_regular(stdout,limit),1024),'stderr':diagnostic_evidence(_read_regular(stderr,limit),16*1024)}
   self.emit(record)
   self.verify()
   need(result.get('status')=='success' and result.get('returncode')==0 and result.get('cleanup_confirmed') is True,'compile_phase_failed')
   need(not self.cancelled and self.clock()<self.deadline,'compiler_deadline_or_cancelled')
   return _read_regular(stdout,limit).decode('utf-8','strict')
  except BaseException:
   self.retired=True;raise

NODE_API_IMPORTS=frozenset(['napi_add_finalizer', 'napi_call_function', 'napi_check_object_type_tag', 'napi_create_arraybuffer', 'napi_create_async_work', 'napi_create_bigint_uint64', 'napi_create_double', 'napi_create_error', 'napi_create_object', 'napi_create_promise', 'napi_create_reference', 'napi_create_string_utf8', 'napi_create_typedarray', 'napi_define_properties', 'napi_delete_async_work', 'napi_delete_reference', 'napi_get_cb_info', 'napi_get_named_property', 'napi_get_reference_value', 'napi_get_undefined', 'napi_object_freeze', 'napi_queue_async_work', 'napi_reject_deferred', 'napi_remove_wrap', 'napi_resolve_deferred', 'napi_set_named_property', 'napi_throw', 'napi_throw_error', 'napi_type_tag_object', 'napi_unwrap', 'napi_wrap'])

def validate_operational_elf(text,kind):
 need(isinstance(text,str) and 0<len(text.encode())<=65536 and '\x00' not in text,'elf_header_unavailable')
 need(kind in {'daemon','owner','worker','addon'},'unknown_operational_artifact')
 fields={}
 for line in text.splitlines():
  match=re.fullmatch(r'\s*(Class|Data|Type|Machine):\s*(.+)',line)
  if match:
   need(match[1] not in fields,'duplicate_elf_field');fields[match[1]]=match[2]
 need(fields.get('Class')=='ELF64' and fields.get('Data')=="2's complement, little endian" and fields.get('Machine')=='Advanced Micro Devices X86-64','wrong_elf_target')
 expected='DYN (Shared object file)' if kind=='addon' else 'DYN (Position-Independent Executable file)'
 need(fields.get('Type')==expected,'wrong_operational_elf_kind')

def compiler_environment(root,out,rustc,rustdoc):
 # Entire allowlist, never os.environ.copy(). Cargo artifacts stay out of source.
 return {'PATH':'/usr/bin:/bin','HOME':str(root/'home'),'CARGO_HOME':str(root/'cargo-home'),'CARGO_TARGET_DIR':str(out/'rust'),'RUSTC':str(rustc),'RUSTDOC':str(rustdoc),'CARGO_NET_RETRY':'0','CARGO_HTTP_TIMEOUT':'30','CARGO_REGISTRIES_CRATES_IO_PROTOCOL':'sparse','CARGO_TERM_COLOR':'never','CARGO_INCREMENTAL':'0','LANG':'C.UTF-8','LC_ALL':'C.UTF-8','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0'}

def source_topology(root):
 """No following symlinks; retain file and directory identities in owned inputs."""
 root=Path(root);rows={}
 def visit(directory):
  need(stat.S_ISDIR(directory.lstat().st_mode),'source_root_replaced')
  for member in directory.iterdir():
   mode=member.lstat().st_mode;name=member.relative_to(root).as_posix()
   need(len(rows)<100000,'source_topology_limit')
   if stat.S_ISDIR(mode):rows[name]='directory';visit(member)
   else:need(stat.S_ISREG(mode),'source_topology_special_file');rows[name]='file'
 visit(root)
 return rows

def verify_topology(root,expected):
 need(source_topology(root)==expected,'source_topology_changed')

def artifact_identity(path):
 data=_read_regular(path,256*1024*1024)
 return {'sha256':_sha(data),'bytes':len(data)}

def validate_dynamic_libraries(text):
 need(isinstance(text,str) and 0<len(text.encode())<=256*1024 and '\x00' not in text and text.endswith('\n'),'dynamic_output_unavailable')
 need(not re.search(r'\((?:RPATH|RUNPATH|AUDIT|DEPAUDIT|FILTER|AUXILIARY)\)',text),'dynamic_loader_override')
 libraries=re.findall(r'\(NEEDED\).*Shared library: \[([^\]\r\n]+)\]',text)
 need(bool(libraries) and len(set(libraries))==len(libraries) and set(libraries)<={'libc.so.6','libm.so.6','libgcc_s.so.1','libpthread.so.0','librt.so.1','libdl.so.2'},'unreviewed_dynamic_library')
 return libraries

def diagnostic_evidence(raw,maximum):
 need(isinstance(raw,bytes) and isinstance(maximum,int) and 0<maximum<=16*1024,'diagnostic_options')
 # No ambient secrets are supplied to these trusted commands. Keep bounded
 # readable text and exact original stream identity; strip terminal controls.
 prefix=raw[:maximum].decode('utf-8','ignore')
 prefix=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',prefix)
 text=''.join(c if c in '\n\t' or ord(c)>=32 and ord(c)!=127 else '?' for c in prefix)
 return {'bytes':len(raw),'sha256':_sha(raw),'truncated':len(raw)>maximum,'text':text}

def verify_operational_symbols(text,expected,kind):
 limit=16*1024*1024 if kind=='daemon' else 256*1024
 need(isinstance(text,str) and 0<len(text.encode())<=limit and '\x00' not in text and text.endswith('\n'),'operational_symbol_output_limit')
 rows={name:[] for name in expected}
 for line in text.splitlines():
  match=re.fullmatch(r'([0-9a-fA-F]+)\s+([A-Za-z])\s+(.+)',line.strip())
  if match and match[3] in rows:rows[match[3]].append((match[2],line))
 result=[]
 for name in expected:
  matches=rows[name];need(len(matches)==1 and matches[0][0]=='T','required_symbol_missing_or_ambiguous');result.append(matches[0][1])
 return result

def inspect_artifact(context,phase,tools,env,launcher,freeze):
 name=phase['name'];path=Path(phase['output']);freeze(path)
 kind={'operational-daemon':'daemon','operational-owner':'owner','worker':'worker','operational-addon':'addon'}[name]
 elf=context.run(kind+'-elf',[str(tools['readelf']),'-h',str(path)],10,env=env,launcher=launcher);validate_operational_elf(elf,kind)
 symbols=context.run(kind+'-symbols',[str(tools['nm']),'--extern-only','--defined-only',str(path)],20,env=env,launcher=launcher)
 required={'daemon':('main','axiom_operational_daemon_initialize','axiom_operational_daemon_publish'),'owner':('main','axiom_operational_policy_decode','axiom_operational_accept_derive'),'worker':('main','axiom_time_capture_v2','axiom_worker_capture_encode'),'addon':('napi_register_module_v1','axiom_time_operational_create_private','axiom_time_parent_create_private')}[kind]
 proof={**artifact_identity(path),'elf':elf,'requiredSymbols':verify_operational_symbols(symbols,required,kind),'runtimeExecuted':False}
 if kind=='addon':
  imports=context.run('addon-imports',[str(tools['nm']),'--dynamic','--undefined-only',str(path)],10,env=env,launcher=launcher)
  proof['nodeApiImports']=sorted(validate_addon_imports(imports,set(NODE_API_IMPORTS)))
 dynamic=context.run(kind+'-dynamic',[str(tools['readelf']),'-d','--wide',str(path)],10,env=env,launcher=launcher)
 proof['neededLibraries']=validate_dynamic_libraries(dynamic)
 return proof

def freeze_registry_sources(metadata,lock,cargo_home,freeze,workspace,seal_tree=None):
 """Selected Cargo metadata must point only into the fresh owned registry.
 Cargo's locked fetch verifies registry integrity; independently match each
 selected archive to its exact named lock record and freeze extracted bytes.
 """
 need(isinstance(metadata,dict) and isinstance(metadata.get('packages'),list) and len(metadata['packages'])<=10000,'metadata_packages_unavailable')
 need(isinstance(lock,bytes) and len(lock)<=1024*1024,'locked_source_unavailable')
 sections=lock.decode('utf-8').split('[[package]]\n')[1:];locked={}
 for section in sections:
  def field(name):
   rows=re.findall(r'^'+name+r' = "([^"\r\n]+)"$',section,re.M);need(len(rows)<=1,'ambiguous_lock_field');return rows[0] if rows else None
  source=field('source')
  if source:
   need(source=='registry+https://github.com/rust-lang/crates.io-index','unsupported_registry_source')
   key=(field('name'),field('version'));checksum=field('checksum');need(all(key) and key not in locked and isinstance(checksum,str) and re.fullmatch('[a-f0-9]{64}',checksum),'locked_registry_identity_missing');locked[key]=checksum
 result=[];registry=(cargo_home/'registry/src').resolve(strict=True);cache=cargo_home/'registry/cache'
 for package in metadata['packages']:
  source=package.get('source')
  if source is None:
   manifest=Path(package['manifest_path'])
   need(manifest.is_absolute() and manifest.is_relative_to(workspace) and manifest.name=='Cargo.toml' and not manifest.is_symlink() and manifest.resolve(strict=True).is_relative_to(workspace.resolve(strict=True)),'local_dependency_outside_owned_source')
   freeze(manifest);continue
  need(source=='registry+https://github.com/rust-lang/crates.io-index','foreign_dependency_source')
  key=(package.get('name'),package.get('version'));need(key in locked,'unlocked_dependency')
  manifest=Path(package['manifest_path']);need(manifest.is_absolute() and manifest.is_relative_to(registry) and not manifest.is_symlink(),'registry_manifest_unavailable')
  directory=manifest.parent;need(directory.resolve(strict=True).is_relative_to(registry),'registry_source_outside_owned_root')
  candidates=list(cache.glob('*/'+key[0]+'-'+key[1]+'.crate'));need(len(candidates)==1,'registry_archive_missing_or_ambiguous');freeze(candidates[0],locked[key])
  for member in directory.rglob('*'):
   need(not member.is_symlink(),'registry_symlink')
   if member.is_file():freeze(member)
   else:need(member.is_dir(),'registry_special_file')
  if seal_tree is not None:seal_tree(directory)
  result.append({'name':key[0],'version':key[1],'archiveSha256':locked[key],'license':package.get('license')})
 need(bool(result),'registry_dependency_closure_empty')
 return result

def compile_joined(context,repo,assembly,tools,sdk,env,launcher,freeze,seal_tree=None):
 from governance_build_ipc_compile import header_dependencies
 source=Path(assembly['sourceRoot']);native=Path(assembly['nativeRoot']);out=context.root/'outputs'
 out.mkdir(mode=0o700);env=dict(env);env['CARGO_TARGET_DIR']=str(out/'rust')
 plan=compile_plan(Path(tools['cc']),Path(tools['cargo']),source,native,out,sdk)
 lock=_read_regular(source/'Cargo.lock',1024*1024)
 # One explicit acquisition; all subsequent Cargo/native commands are restricted.
 context.run('locked-fetch',[str(tools['cargo']),'fetch','--locked','--target',TARGET],480,cwd=source,env=env)
 need(_read_regular(source/'Cargo.lock',1024*1024)==lock,'cargo_lock_changed')
 raw=context.run('locked-metadata',[str(tools['cargo']),'metadata','--locked','--offline','--format-version','1','--filter-platform',TARGET,'--no-default-features','--features','clock-bound/axiom-operational-time'],60,cwd=source,env=env,launcher=launcher)
 packages=freeze_registry_sources(json.loads(raw),lock,Path(env['CARGO_HOME']),freeze,source,seal_tree)
 features=context.run('operational-features',[str(tools['cargo']),'tree','--locked','--offline','--target',TARGET,'--package','clock-bound','--no-default-features','--features','axiom-operational-time','--edges','normal,build','--prefix','none','--format','{p} {f}'],30,cwd=source,env=env,launcher=launcher);validate_operational_features(features)
 outputs={}
 for phase in plan:
  if phase['argv'][0]==str(tools['cc']):
   argv=phase['argv'];sources=[n for n in argv if n.endswith('.c')];options=argv[1:next(i for i,n in enumerate(argv) if n.endswith('.c'))]
   # Remove output-kind flags; retain every preprocessing selector/include.
   options=[v for v in options if v not in ('-c','-shared','-pie')]
   for index,path in enumerate(sources):
    deps=context.run(phase['name']+'-headers-'+str(index),[str(tools['cc']),*options,'-M',path],15,env=env,launcher=launcher)
    for header,digest in header_dependencies(deps).items():freeze(header,digest)
  context.run(phase['name'],phase['argv'],phase['maximumSeconds'],cwd=source,env=env,launcher=launcher)
  path=Path(phase['output']);freeze(path)
  if phase['name'] not in ('status-object','publisher-object'):outputs[phase['name']]=inspect_artifact(context,phase,tools,env,launcher,freeze)
 return {'outputs':outputs,'packages':packages,'nativeRuntimeExecuted':False,'targetCompatibilityQualified':False,'governanceEnabled':False}

PACKET='docs/recovery/2026-11-15/operational-joined-compiler/INPUT-PACKET.json'
TOOL_PROOF='docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-SYMBOL-FORMAT-PRIMARY-EVIDENCE.json'
SDK_PROOF='docs/recovery/2026-11-14/native-worker-local/COMPILER-OBSERVED-RESULT.json'
SDK=Path('/opt/hostedtoolcache/node/24.22.2/x64/include/node')

def packet_inputs(repo):
 report=json.loads(_read_regular(repo/SOURCE_REPORT))
 historical=json.loads(_read_regular(repo/'packages/verified-issuer-runtime/linux/vendor/EXPECTED-PATCHED-SHA256.json'))
 return set(report['sourceInputSha256'])|set(historical['inputSha256'])|{SOURCE_REPORT,SOURCE_MANIFEST,TOOL_PROOF,SDK_PROOF,
  'docs/recovery/2026-11-15/operational-source-assembly/audit.py',
  'scripts/governance_operational_compile.py','scripts/tests/test_governance_operational_compile.py',
  'scripts/governance_linux_compile_supervisor.py','scripts/governance_build_ipc_compile.py','scripts/governance_native_worker_compile.py',
  'scripts/governance_rust_spawn_diagnostic.py','scripts/linux-compile/network_launcher.c','scripts/linux-compile/compiler_profile.h','scripts/linux-compile/benign_fixture.c',
  '.github/workflows/linux-operational-compile.yml',
  'lib/governance/platform/nativeTime/__tests__/operationalCompilePreparation.test.ts',
  'docs/recovery/2026-11-15/operational-joined-compiler/PLAN.md',
  'docs/recovery/2026-11-15/operational-joined-compiler/NODE-API-SOURCE-IMPORTS.json'}

def verify_packet(repo,raw):
 packet=json.loads(raw);need(packet.get('format')=='axiom.operational-compiler-preparation/1','wrong_compiler_packet')
 need(packet.get('approval')=={'pr':APPROVED_PR,'before':APPROVED_BEFORE,'ownerDecision':OWNER_DECISION},'approval_packet_changed')
 files=packet.get('files');need(isinstance(files,dict) and set(files)==packet_inputs(repo),'compiler_packet_members_changed')
 for name,digest in files.items():need(_sha(_read_regular(repo/name))==digest,'compiler_packet_source_changed')
 return packet

def primary_receipt(receipt):
 encoded=json.dumps(receipt,sort_keys=True,ensure_ascii=True)
 if len(encoded.encode())>1024*1024:return json.dumps({'accepted':False,'errorCategory':'compiler_receipt_limit','nativeRuntimeExecuted':False,'governanceEnabled':False},sort_keys=True)
 return encoded

def main():
 import sys,time
 receipt={'accepted':False,'scope':'trusted compiler/build scripts only; Governance outputs never launch','nativeRuntimeExecuted':False,'governanceEnabled':False,'targetCompatibilityQualified':False};root=None;context=None;verify=None;frozen={};trees={};started=time.monotonic()
 try:
  need(sys.argv[1:]==['--approved-ci-once'],'fixed_compiler_invocation_required')
  # Refuse before even reading hosted context while the preparation is closed.
  need(APPROVED_PR is not None and APPROVED_BEFORE is not None and OWNER_DECISION is not None,'native_compile_not_approved')
  repo=Path(__file__).resolve().parents[1];raw=_read_regular(repo/PACKET);verify_packet(repo,raw)
  event_path=Path(os.environ['GITHUB_EVENT_PATH']);event=json.loads(_read_regular(event_path,2*1024*1024));head=validate_event(event,os.environ.get('GITHUB_EVENT_NAME'),os.environ.get('GITHUB_RUN_ATTEMPT'))
  need(os.environ.get('AXIOM_PR_HEAD_SHA')==head and os.environ.get('RUNNER_OS')=='Linux' and os.environ.get('RUNNER_ARCH')=='X64','wrong_compiler_host_or_head')
  temporary=Path(os.environ['RUNNER_TEMP']).resolve(strict=True);need(temporary.is_dir(),'runner_temp_unavailable')
  candidate=temporary/'axiom-operational-compiler-once';candidate.mkdir(mode=0o700)
  root=candidate # Own this namespace only after exclusive creation succeeds.
  for name in ('home','cargo-home'):(root/name).mkdir(mode=0o700)
  from governance_linux_compile_supervisor import supervise
  from governance_build_ipc_compile import header_dependencies,validate_filter_description,validate_fixture_result
  from governance_native_worker_compile import validate_sdk
  from governance_rust_spawn_diagnostic import prepare_crate,assert_no_cargo_config
  proof=json.loads(_read_regular(repo/TOOL_PROOF));sdk_proof=json.loads(_read_regular(repo/SDK_PROOF))
  need(proof.get('accepted') is True and proof.get('evidenceComplete') is True and sdk_proof.get('accepted') is True,'prior_compiler_evidence_unavailable')
  frozen={}
  def freeze(path,expected=None):
   path=Path(path);data=_read_regular(path,256*1024*1024);digest=_sha(data)
   need(expected is None or digest==expected,'compiler_input_identity_changed')
   need(str(path) not in frozen or frozen[str(path)]==digest,'compiler_input_rebound');frozen[str(path)]=digest
  for name,record in proof['tools'].items():
   need(name in {'cargo','cc','git','nm','readelf','rustc','rustdoc','true'},'unknown_compiler_tool')
   path=Path(record['path']);need(path.is_absolute() and path.resolve(strict=True)==path,'compiler_tool_path_changed');freeze(path,record['sha256'])
  need(set(proof['tools'])=={'cargo','cc','git','nm','readelf','rustc','rustdoc','true'},'incomplete_compiler_tools')
  tools={name:Path(record['path']) for name,record in proof['tools'].items()}
  need(validate_sdk(SDK)==sdk_proof['sdk'],'node_sdk_changed')
  for name,digest in sdk_proof['sdk']['headers'].items():freeze(SDK/name,digest)
  sysroot=tools['rustc'].parent.parent
  for name,pattern in [('std','libstd-*.rlib'),('core','libcore-*.rlib')]:
   paths=list((sysroot/'lib/rustlib'/TARGET/'lib').glob(pattern));need(len(paths)==1,'compiler_stdlib_missing');freeze(paths[0],proof['standardLibrarySha256'][name])
  def seal_tree(path):
   path=Path(path);key=str(path);snapshot=source_topology(path)
   need(key not in trees or trees[key]==snapshot,'source_topology_rebound');trees[key]=snapshot
  def verify():
   verify_packet(repo,raw)
   for name,snapshot in trees.items():verify_topology(Path(name),snapshot)
   for name,digest in frozen.items():need(_sha(_read_regular(Path(name),256*1024*1024))==digest,'frozen_compiler_input_changed')
  context=CompileContext(root,{str(p) for p in tools.values()},verify,supervise,time.monotonic);context.deadline=started+2400
  context.emit=lambda record:print(json.dumps({'evidenceKind':'operational-compiler-phase/1','record':record},sort_keys=True,ensure_ascii=True),flush=True)
  receipt.update({'head':head,'packetSha256':_sha(raw),'records':context.records})
  with context:
   env=compiler_environment(root,root/'outputs',tools['rustc'],tools['rustdoc'])
   observed=context.run('source-head',[str(tools['git']),'rev-parse','HEAD'],10,cwd=repo,env=env);need(observed.strip()==head,'checkout_head_changed')
   assembly=prepare_sources(repo,root/'inputs');source=Path(assembly['sourceRoot']);native=Path(assembly['nativeRoot'])
   for path in source.rglob('*'):
    need(not path.is_symlink(),'source_symlink')
    if path.is_file():freeze(path)
   for path in native.iterdir():freeze(path)
   seal_tree(source)
   for parent in [source,*source.parents]:need(not (parent/'.cargo/config').exists() and not (parent/'.cargo/config.toml').exists(),'inherited_cargo_config')
   for name in ('network_launcher.c','compiler_profile.h','benign_fixture.c'):
    original=repo/'scripts/linux-compile'/name;target=native/name;data=_read_regular(original);target.write_bytes(data);target.chmod(0o600);freeze(target,_sha(data))
   seal_tree(native)
   for name in ('network_launcher','benign_fixture'):
    target=root/name
    deps=context.run(name.replace('_','-')+'-headers',[str(tools['cc']),'-std=c11','-I',str(native),'-M',str(native/(name+'.c'))],15,cwd=repo,env=env)
    for path,digest in header_dependencies(deps).items():freeze(path,digest)
    context.run(name.replace('_','-')+'-compile',[str(tools['cc']),'-std=c11','-Wall','-Wextra','-Werror','-I',str(native),str(native/(name+'.c')),'-o',str(target)],30,cwd=repo,env=env);freeze(target)
   launcher=root/'network_launcher';context.tools=frozenset([*context.tools,str(launcher),str(root/'benign_fixture')])
   description=context.run('filter-description',[str(launcher),'--describe'],10,env=env)
   profile=validate_filter_description(description,_read_regular(native/'compiler_profile.h').decode());need(profile['programSha256']==proof['filterProgramSha256'],'compiler_filter_changed')
   checked=context.run('restriction-preflight',[str(root/'benign_fixture'),str(root/'fixture-owned-file'),str(tools['true'])],10,env=env,launcher=launcher);validate_fixture_result(checked)
   crate=root/'tiny-crate'
   for path,digest in prepare_crate(crate).items():freeze(path,digest)
   seal_tree(crate);assert_no_cargo_config(crate,root/'cargo-home')
   tiny_env=dict(env);tiny_env['CARGO_TARGET_DIR']=str(root/'tiny-target')
   context.run('tiny-offline-cargo',[str(tools['cargo']),'rustc','--offline','--locked','--target',TARGET,'--lib','--no-default-features'],30,cwd=crate,env=tiny_env,launcher=launcher)
   tiny_output=root/'tiny-target'/TARGET/'debug/libaxiom_spawn_probe.rlib';freeze(tiny_output);receipt['tinyCrateArtifact']=artifact_identity(tiny_output)
   receipt.update(compile_joined(context,repo,assembly,tools,SDK,env,launcher,freeze,seal_tree));verify();need(time.monotonic()<context.deadline,'compiler_batch_deadline');receipt['accepted']=True
 except BaseException as error:
  receipt['accepted']=False;receipt['errorCategory']=str(error) if isinstance(error,ValueError) else type(error).__name__
 finally:
  if context is not None:
   receipt['records']=context.records
   receipt['retired']=context.retired or context.cancelled
  if verify is not None:
   try:verify();receipt['finalFrozenInputsMatched']=True
   except BaseException:receipt['accepted']=False;receipt['finalFrozenInputsMatched']=False;receipt['errorCategory']='final_frozen_input_changed'
  manifest=json.dumps(frozen,sort_keys=True,separators=(',',':'),ensure_ascii=True)
  if len(manifest.encode())>8*1024*1024:
   receipt['accepted']=False;receipt['errorCategory']='compiler_frozen_manifest_limit'
  elif frozen:
   receipt['frozenInputManifestSha256']=_sha(manifest.encode());receipt['frozenInputCount']=len(frozen)
   rows=sorted(frozen.items());parts=[rows[i:i+128] for i in range(0,len(rows),128)]
   for index,entries in enumerate(parts):print(json.dumps({'evidenceKind':'operational-compiler-frozen-inputs/1','index':index,'total':len(parts),'entries':entries}),flush=True)
  # Exactly the same bounded primary bytes are retained locally and emitted.
  rendered=primary_receipt(receipt);receipt=json.loads(rendered)
  if root is not None:
   fd=os.open(root/'RESULT.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   with os.fdopen(fd,'w') as out:out.write(rendered+'\n')
  print(rendered,flush=True)
 return 0 if receipt['accepted'] else 1

if __name__=='__main__':raise SystemExit(main())
