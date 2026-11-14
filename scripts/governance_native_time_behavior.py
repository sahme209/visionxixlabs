"""ONE reviewed role-free native behavior job; no protected time authority."""
import hashlib,json,os,re,signal,sys,time,struct
from pathlib import Path
REPO='sahme209/visionxixlabs'
BRANCH='codex/governance-native-time-behavior'
PACKET='docs/recovery/2026-11-14/native-time-behavior/INPUT-PACKET.json'
KIND='one-opened-native-time-behavior-v1'
SDK=Path('/opt/hostedtoolcache/node/24.22.2/x64/include/node')
NODE=Path('/opt/hostedtoolcache/node/24.22.2/x64/bin/node')
BASE='packages/verified-issuer-runtime/linux/'
PROOF='docs/recovery/2026-11-14/native-worker-local/COMPILER-OBSERVED-RESULT.json'
REQUIRED_INPUTS=frozenset([
 'scripts/governance_native_time_behavior.py','scripts/tests/test_governance_native_time_behavior.py',
 '.github/workflows/linux-native-time-behavior.yml','scripts/governance_native_worker_compile.py',
 'scripts/governance_build_ipc_compile.py','scripts/governance_linux_compile_supervisor.py',
 'scripts/linux-compile/network_launcher.c','scripts/linux-compile/compiler_profile.h','scripts/linux-compile/benign_fixture.c',
 'scripts/linux-native-behavior/runtime_launcher.c','scripts/linux-native-behavior/runtime_profile.h',
 'scripts/tests/test_native_behavior_runtime_profile.py','scripts/tests/test_native_behavior_runtime_launcher.py',
 'scripts/tests/test_governance_native_time_behavior_fixture.py','scripts/tests/test_governance_time_parent_binding.py','scripts/tests/test_governance_time_worker_protocol.py',
 'scripts/linux-compile/native_time_behavior.mjs',PROOF,
 *[BASE+x for x in ('time_worker.c','time_worker_protocol.c','time_worker_protocol.h','time_parent_binding.c','time_parent_binding.h','time_publication.c','time_publication.h','time_behavior_fixture.c','time_behavior_stall.c')]])
def need(ok,reason='native_behavior_refused'):
 if not ok:raise ValueError(reason)
def validate_event(event,name,attempt):
 need(name=='pull_request' and attempt=='1' and isinstance(event,dict) and event.get('action')=='opened','event_refused')
 p=event.get('pull_request',{});r=event.get('repository',{});h=p.get('head',{});b=p.get('base',{})
 number=event.get('number');need(type(number) is int and number>0 and p.get('number')==number,'pr_mismatch')
 need(r.get('full_name')==REPO and r.get('private') is False and h.get('repo',{}).get('full_name')==REPO and b.get('repo',{}).get('full_name')==REPO,'repository_refused')
 need(b.get('ref')=='main' and h.get('ref')==BRANCH,'branch_refused')
 sha=h.get('sha');need(isinstance(sha,str) and re.fullmatch('[0-9a-f]{40}',sha),'head_refused')
 need('after' not in event or event['after']==sha,'after_mismatch');return sha

def verify_packet(repo,frozen=None):
 raw=(repo/PACKET).read_bytes();need(frozen is None or raw==frozen,'packet_replaced');data=json.loads(raw)
 need(data.get('kind')==KIND and data.get('event')=='opened' and data.get('branch')==BRANCH,'packet_scope')
 files=data.get('files');need(isinstance(files,dict) and set(files)==REQUIRED_INPUTS,'packet_inputs')
 for name,digest in files.items():
  need(isinstance(name,str) and not name.startswith('/') and all(p not in ('','.','..') for p in name.split('/')),'input_path')
  p=repo/name;need(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(repo.resolve()),'input_shape')
  need(isinstance(digest,str) and re.fullmatch('[0-9a-f]{64}',digest) and hashlib.sha256(p.read_bytes()).hexdigest()==digest,'input_changed')
 return data

def native_observation(text):
 need(isinstance(text,str) and len(text.encode())<=4096,'result_limit');data=json.loads(text)
 need(type(data) is dict,'result_shape')
 if data.get('accepted') is True:
  need(set(data)=={'format','cases','accepted','timeAuthority'} and data['format']=='axiom-native-time-behavior-v1' and data['cases']==['joined','replacement','cancellation','foreign'] and data['timeAuthority'] is False,'result_refused')
 else:
  need(set(data)=={'format','accepted','error','phase','reason','timeAuthority'} and data.get('format')=='axiom-native-time-behavior-v1' and data.get('accepted') is False and data.get('error')=='fixture_failed' and data.get('timeAuthority') is False,'failure_shape')
  need(data['phase'] in ('joined','replacement','cancellation','foreign','cleanup') and data['reason'] in ('version','module','hold','start','capture','evidence','release','replace','refusal','ready','cancel','cleanup'),'failure_category')
 return data

def validate_result(text):
 data=native_observation(text);need(data['accepted'] is True,'native_cases_failed');return data

def check_compiler_warnings(raw):
 need(isinstance(raw,bytes) and len(raw)<=256*1024,'compiler_diagnostic_limit')
 text=raw.decode('utf-8','strict').lower()
 for pattern in [r'implicit.*declaration',r'incompatible.*pointer',r'integer.*pointer',r'pointer.*integer',r'return[- ]type',r'(unknown type name|undeclared|missing).*napi',r'undefined reference']:
  need(not re.search(pattern,text),'critical_compiler_diagnostic')

def identity_header(values):
 need(set(values)=={'root','worker','stall'},'identity_shape');lines=['/* GENERATED fixed fixture identity, NOT authority. */']
 for label,fields in [('root',('DEV','INO')),('worker',('DEV','INO','SIZE')),('stall',('DEV','INO','SIZE'))]:
  row=values[label];need(isinstance(row,tuple) and len(row)==len(fields),'identity_shape')
  for field,value in zip(fields,row):
   need(type(value) is int and 0<=value<=18446744073709551615,'identity_range')
   lines.append('#define '+label.upper()+'_'+field+' '+str(value)+'ULL')
 return '\n'.join(lines)+'\n'

def validate_module_imports(text,headers):
 need(isinstance(text,str) and len(text.encode())<=256*1024,'module_import_limit')
 for line in text.splitlines():
  match=re.fullmatch(r'\s*([Uwv])\s+(\S+)\s*',line)
  need(match is not None,'module_import_shape');name=match.group(2).split('@',1)[0]
  need(not name.startswith('axiom_'),'private_native_import_unresolved')
  if name.startswith('napi_'):need(re.search(r'\b'+re.escape(name)+r'\s*\(',headers) is not None,'napi_import_undeclared')
 return True

def validate_runtime_description(text,header):
 need(isinstance(text,str) and len(text.encode())<=256*1024,'runtime_description_limit');data=json.loads(text)
 expected={'format','scope','target','arch','defaultAction','defaultErrno','clone3Flags','deniedSyscalls','instructions'}
 need(type(data) is dict and set(data)==expected,'runtime_description_shape')
 need(data['format']==1 and data['scope']=='trusted-fixed-native-behavior-only' and data['target']=='linux-x86_64' and data['arch']==0xc000003e and data['defaultAction']=='allow-trusted-source' and data['defaultErrno']==1 and data['clone3Flags']=='source-trusted-not-inspected','runtime_description_scope')
 match=re.search(r'#define AXIOM_RUNTIME_DENIED_SYSCALLS\(X\)(.*?)(?:\n\s*\n)',header,re.S)
 need(match is not None,'runtime_denials_missing');names=re.findall(r'X\(([a-zA-Z0-9_]+)\)',match.group(1))
 need(names and len(names)==len(set(names)) and data['deniedSyscalls']==names,'runtime_denials_changed')
 instructions=data['instructions'];need(type(instructions) is list and 1<=len(instructions)<=4096,'runtime_instruction_limit');wire=bytearray()
 for instruction in instructions:
  need(type(instruction) is dict and set(instruction)=={'code','jt','jf','k'},'runtime_instruction_shape')
  values=[instruction[k] for k in ('code','jt','jf','k')]
  need(all(type(value) is int and 0<=value<=maximum for value,maximum in zip(values,(65535,255,255,4294967295))),'runtime_instruction_range')
  wire.extend(struct.pack('<HBBI',*values))
 return {**data,'programSha256':hashlib.sha256(wire).hexdigest()}

def main():
 need(sys.argv[1:]==['--approved-ci-once'],'cli_refused');repo=Path(__file__).resolve().parents[1]
 frozen=(repo/PACKET).read_bytes();verify_packet(repo,frozen)
 # Imported project source is closed/hash-verified BEFORE Python executes it.
 from governance_native_worker_compile import validate_sdk,worker_command,verify_symbols,validate_elf,compiler_diagnostic
 from governance_build_ipc_compile import header_dependencies,add_frozen,verify_frozen_files,phase_budget,validate_fixture_result,validate_filter_description,restricted_command
 from governance_linux_compile_supervisor import supervise
 ep=Path(os.environ['GITHUB_EVENT_PATH']);need(ep.stat().st_size<=2*1024*1024,'event_limit');event=json.loads(ep.read_text())
 head=validate_event(event,os.environ.get('GITHUB_EVENT_NAME'),os.environ.get('GITHUB_RUN_ATTEMPT'))
 need(os.environ.get('AXIOM_PR_HEAD_SHA')==head and os.environ.get('RUNNER_OS')=='Linux' and os.environ.get('RUNNER_ARCH')=='X64','runner_head_refused')
 root=Path(os.environ['RUNNER_TEMP'])/'axiom-native-time-behavior-once';root.mkdir(mode=0o700)
 for name in ('logs','home'): (root/name).mkdir(mode=0o700)
 deadline=time.monotonic()+300;files={};records=[];phase='initialize';old={}
 result={'accepted':False,'head':head,'pr':event['number'],'packetSha256':hashlib.sha256(frozen).hexdigest(),'timeAuthority':False,'governanceEnabled':False,'records':records}
 env={'PATH':'/usr/bin:/bin','HOME':str(root/'home'),'LANG':'C.UTF-8','LC_ALL':'C.UTF-8','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0'}
 def interrupted(signum,_frame):raise RuntimeError('interrupted')
 def forwarded(signum,_frame):signal.raise_signal(signal.SIGTERM)
 def run(label,argv,restriction=None,maximum=60,cwd=None):
  nonlocal phase
  phase=label;verify_packet(repo,frozen);verify_frozen_files(files)
  command=restricted_command(root/'compiler_launcher',argv) if restriction=='compiler' else argv
  stdout=root/'logs'/(label+'.stdout');stderr=root/'logs'/(label+'.stderr')
  status=supervise(command,cwd=cwd or repo,env=env,stdout_path=stdout,stderr_path=stderr,timeout_seconds=phase_budget(deadline,time.monotonic(),maximum),max_output_bytes=256*1024,cleanup_seconds=5)
  records.append({'phase':label,'status':status});verify_packet(repo,frozen);verify_frozen_files(files)
  out=stdout.read_bytes();err=stderr.read_bytes()
  if label=='native-four-cases':
   try:result['nativeObservation']=native_observation(out.decode('utf-8','strict'))
   except (ValueError,UnicodeDecodeError):result['nativeObservation']={'accepted':False,'reason':'invalid_fixture_observation'}
  if 'compile' in label or 'headers' in label:
   diagnostic=compiler_diagnostic(err,repo,root,SDK);result.setdefault('compilerDiagnostics',{})[label]=diagnostic
   check_compiler_warnings(err)
  if status['status']!='success':result['failureDiagnostic']={'phase':label,**compiler_diagnostic(err,repo,root,SDK)}
  need(status['status']=='success' and status['cleanup_confirmed'],'child_failed_or_cleanup_unknown')
  print(json.dumps({'phase':label,'status':'success','cleanupConfirmed':True}),flush=True)
  return out.decode('utf-8','strict'),err.decode('utf-8','strict')
 def compile_one(label,sources,out,flags=(),restricted=True):
  # Per-TU exact preprocessing options; never use -M with multiple outputs.
  prefix=[str(tools['cc']),'-std=c11','-O2','-Wall','-Wextra',*flags]
  for index,source in enumerate(sources):
   deps,_=run(label+'-headers-'+str(index),prefix+['-M',str(source)],'compiler' if restricted else None)
   for p,digest in header_dependencies(deps).items():add_frozen(files,p,digest)
  run(label+'-compile',prefix+[str(s) for s in sources]+['-o',str(out)],'compiler' if restricted else None)
  add_frozen(files,out)
 def artifact(label,path,kind,symbols):
  header,_=run(label+'-elf',[str(tools['readelf']),'-h',str(path)],'compiler')
  if kind=='module':
   need('ELF64' in header and 'Advanced Micro Devices X86-64' in header and re.findall(r'^\s*Type:\s+(\w+)',header,re.M)==['DYN'] and re.findall(r'^\s*Entry point address:\s+(0x[0-9a-fA-F]+)',header,re.M)==['0x0'],'module_elf')
  else:validate_elf(header,'worker')
  text,_=run(label+'-symbols',[str(tools['nm']),'--defined-only',str(path)],'compiler');chosen=verify_symbols(text,symbols)
  result.setdefault('outputs',{})[label]={'bytes':path.stat().st_size,'sha256':files[path],'elf':header,'requiredSymbols':chosen}
 try:
  old[signal.SIGTERM]=signal.signal(signal.SIGTERM,interrupted)
  for sig in (signal.SIGINT,signal.SIGHUP):old[sig]=signal.signal(sig,forwarded)
  proof=json.loads((repo/PROOF).read_text());need(proof.get('accepted') is True and proof.get('finalFrozenInputsMatched') is True,'prior_compile_refused')
  tools={name:(Path('/usr/bin')/name).resolve(strict=True) for name in ('cc','git','nm','readelf','true')}
  for name,path in tools.items():need(str(path)==proof['tools'][name]['path'],'tool_path_changed');add_frozen(files,path,proof['tools'][name]['sha256'])
  result['tools']={name:{'path':str(path),'sha256':files[path]} for name,path in tools.items()}
  actual,_=run('source-head',[str(tools['git']),'rev-parse','HEAD']);need(actual.strip()==head,'source_head_changed')
  result['sdk']=validate_sdk(SDK)
  for name,digest in result['sdk']['headers'].items():add_frozen(files,SDK/name,digest)
  need(NODE.is_file() and not NODE.is_symlink(),'node_missing');add_frozen(files,NODE)
  result['node']={'path':str(NODE),'sha256':files[NODE]}
  b=repo/BASE
  compile_one('compiler-launcher',[repo/'scripts/linux-compile/network_launcher.c'],root/'compiler_launcher',restricted=False)
  compile_one('compiler-fixture',[repo/'scripts/linux-compile/benign_fixture.c'],root/'compiler_fixture',restricted=False)
  desc,_=run('compiler-profile-description',[str(root/'compiler_launcher'),'--describe'])
  description=validate_filter_description(desc,(repo/'scripts/linux-compile/compiler_profile.h').read_text());need(description['programSha256']==proof['filterProgramSha256'],'compiler_profile_changed')
  checked,_=run('compiler-isolation-fixture',[str(root/'compiler_fixture'),str(root/'compiler-owned-file'),str(tools['true'])],'compiler',maximum=15);validate_fixture_result(checked)
  compile_one('worker',[b/'time_worker.c',b/'time_worker_protocol.c',b/'time_publication.c'],root/'time_worker',('-fPIE','-pie'))
  artifact('worker',root/'time_worker','worker',('main','axiom_time_capture_v2','axiom_worker_context_decode','axiom_worker_capture_encode'))
  compile_one('stall',[b/'time_behavior_stall.c'],root/'time_behavior_stall',('-fPIE','-pie'))
  artifact('stall',root/'time_behavior_stall','worker',('main',))
  st=root.stat();w=(root/'time_worker').stat();fault=(root/'time_behavior_stall').stat()
  header=root/'fixture_identity.h';header.write_text(identity_header({'root':(st.st_dev,st.st_ino),'worker':(w.st_dev,w.st_ino,w.st_size),'stall':(fault.st_dev,fault.st_ino,fault.st_size)}));header.chmod(0o400);add_frozen(files,header)
  compile_one('fixture-module',[b/'time_behavior_fixture.c',b/'time_parent_binding.c',b/'time_worker_protocol.c',b/'time_publication.c'],root/'fixture.node',('-DAXIOM_TIME_BEHAVIOR_TEST','-DNODE_GYP_MODULE_NAME=fixture','-DNAPI_VERSION=8','-fPIC','-shared','-pthread','-I',str(SDK),'-I',str(root)))
  artifact('fixture-module',root/'fixture.node','module',('napi_register_module_v1','axiom_time_parent_create_private'))
  undefined,_=run('module-unresolved-symbols',[str(tools['nm']),'-u',str(root/'fixture.node')],'compiler')
  validate_module_imports(undefined,'\n'.join((SDK/name).read_text() for name in result['sdk']['headers']))
  result['moduleUnresolvedSymbols']=undefined
  harness=root/'native_time_behavior.mjs';harness.write_bytes((repo/'scripts/linux-compile/native_time_behavior.mjs').read_bytes());harness.chmod(0o400);add_frozen(files,harness)
  macro='-DAXIOM_NATIVE_BEHAVIOR_HARNESS='+json.dumps(str(harness))
  compile_one('runtime-launcher',[repo/'scripts/linux-native-behavior/runtime_launcher.c'],root/'runtime_launcher',(macro,))
  # Exact generated restriction recorded, not inferred from compiler acceptance.
  runtime_desc,_=run('runtime-profile-description',[str(root/'runtime_launcher'),'--describe'])
  result['runtimeProfile']=validate_runtime_description(runtime_desc,(repo/'scripts/linux-native-behavior/runtime_profile.h').read_text())
  for name in ('success','replacement','foreign','cancel'):
   directory=root/name;directory.mkdir(mode=0o750);record=b'AXIOM_TIME_V2\nclockbound-precise-origin-v1\nfixture-v2\n1\n0\n1\n0\n0\nunknown\n0\n0\nEND\n';p=directory/'current';p.write_bytes(record);p.chmod(0o440)
  nxt=root/'replacement/next';nxt.write_bytes(record.replace(b'\n1\n0\n1\n',b'\n2\n0\n1\n',1));nxt.chmod(0o440)
  # Fixture mutation files are deliberately not immutable inputs. Trusted code
  # verifies exact readiness/replacement identities within the four cases.
  text,_=run('native-four-cases',[str(root/'runtime_launcher'),'--'],maximum=10,cwd=root)
  result['observedCases']=validate_result(text)
  verify_packet(repo,frozen);verify_frozen_files(files);need(time.monotonic()<deadline,'total_deadline');result['accepted']=True
 except BaseException as exc:
  result['accepted']=False;result['failurePhase']=phase;result['errorCategory']=str(exc) if isinstance(exc,ValueError) else type(exc).__name__
 finally:
  for sig,handler in old.items():signal.signal(sig,handler)
  try:verify_packet(repo,frozen);verify_frozen_files(files);result['finalFrozenInputsMatched']=True
  except BaseException:result['accepted']=False;result['finalFrozenInputsMatched']=False;result.pop('failureDiagnostic',None);result.pop('compilerDiagnostics',None)
  result['frozenInputs']={str(p):digest for p,digest in files.items()};primary={k:v for k,v in result.items() if k!='records'};primary['evidenceKind']='role-free-native-time-behavior-v1'
  wire=json.dumps(primary,sort_keys=True,ensure_ascii=True)
  if len(wire.encode())>1024*1024:result['accepted']=False;wire=json.dumps({'accepted':False,'evidenceKind':primary['evidenceKind'],'reason':'evidence_limit','head':head})
  print(wire,flush=True);print(json.dumps({'accepted':result['accepted'],'records':records},sort_keys=True),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':sys.exit(main())
