"""One approved compile-only worker checkpoint; Governance outputs NEVER launch."""
import hashlib,json,os,re,signal,sys,time
from pathlib import Path
REPO='sahme209/visionxixlabs'
BRANCH='codex/governance-native-worker'
PR=332
BEFORE='048882304e05c4d77ab766f8f2b39db33e676251'
PACKET='docs/recovery/2026-11-14/native-worker-local/COMPILER-INPUT-PACKET.json'
KIND='one-sync-pr332-native-worker-compile-v1'
SDK=Path('/opt/hostedtoolcache/node/24.22.2/x64/include/node')
SDK_HEADERS=('node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h','node_version.h')
PROOF='docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/BUILD-SYMBOL-FORMAT-PRIMARY-EVIDENCE.json'
BASE='packages/verified-issuer-runtime/linux/'
REQUIRED_INPUTS=frozenset([
 'scripts/governance_native_worker_compile.py','scripts/tests/test_governance_native_worker_compile.py',
 'scripts/tests/test_governance_native_worker_workflow.py','.github/workflows/linux-native-worker-compile.yml',
 'scripts/governance_build_ipc_compile.py','scripts/governance_linux_compile_supervisor.py',
 'scripts/linux-compile/network_launcher.c','scripts/linux-compile/benign_fixture.c','scripts/linux-compile/compiler_profile.h',
 'scripts/tests/test_governance_time_parent_binding.py','scripts/tests/test_governance_time_worker_protocol.py',PROOF,
 *[BASE+n for n in ('time_publication.c','time_publication.h','time_worker.c','time_worker_protocol.c','time_worker_protocol.h','time_parent_binding.c','time_parent_binding.h','native-worker-source.json')],
 'lib/governance/platform/nativeTime/nativeLinuxPorts.ts','lib/governance/platform/nativeTime/__tests__/nativeLinuxPorts.test.ts'])
def need(value,reason='worker_compile_refused'):
 if not value:raise ValueError(reason)
def validate_event(event,name,attempt):
 need(name=='pull_request' and attempt=='1' and isinstance(event,dict) and event.get('action')=='synchronize')
 need(event.get('number')==PR and event.get('before')==BEFORE)
 repo=event.get('repository',{});pr=event.get('pull_request',{});head=pr.get('head',{});base=pr.get('base',{})
 need(repo.get('full_name')==REPO and repo.get('private') is False and pr.get('number')==PR)
 need(base.get('ref')=='main' and base.get('repo',{}).get('full_name')==REPO)
 need(head.get('ref')==BRANCH and head.get('repo',{}).get('full_name')==REPO)
 sha=head.get('sha');need(isinstance(sha,str) and re.fullmatch('[0-9a-f]{40}',sha) and sha!=BEFORE and event.get('after')==sha)
 return sha
def verify_packet(repo,frozen=None):
 raw=(repo/PACKET).read_bytes();need(frozen is None or raw==frozen,'packet_replaced');data=json.loads(raw)
 need(data.get('kind')==KIND and data.get('before')==BEFORE and data.get('pr')==PR,'packet_scope')
 files=data.get('files');need(isinstance(files,dict) and set(files)==REQUIRED_INPUTS,'packet_inputs')
 for name,want in files.items():
  need(isinstance(name,str) and not name.startswith('/') and all(p not in ('','.','..') for p in name.split('/')))
  p=repo/name;need(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(repo.resolve()))
  need(isinstance(want,str) and re.fullmatch('[0-9a-f]{64}',want) and hashlib.sha256(p.read_bytes()).hexdigest()==want,'input_changed')
 return data
def validate_sdk(root):
 need(root.is_dir() and not root.is_symlink(),'sdk_missing');headers={}
 for name in SDK_HEADERS:
  p=root/name;need(p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(root.resolve()) and 0<p.stat().st_size<=2*1024*1024,'sdk_header_missing')
  headers[name]=hashlib.sha256(p.read_bytes()).hexdigest()
 version=(root/'node_version.h').read_text()
 for label,want in [('MAJOR',24),('MINOR',22),('PATCH',2)]:
  need(re.findall(r'^\s*#\s*define\s+NODE_'+label+r'_VERSION\s+(\d+)\s*$',version,re.M)==[str(want)],'sdk_version_changed')
 return {'version':'24.22.2','headers':headers}
def worker_command(cc,repo,out):
 return [str(cc),'-std=c11','-O2','-Wall','-Wextra','-fPIE','-pie',*[str(repo/BASE/n) for n in ('time_worker.c','time_worker_protocol.c','time_publication.c')],'-o',str(out)]
def parent_command(cc,repo,sdk,out):
 return [str(cc),'-std=c11','-O2','-Wall','-Wextra','-DNAPI_VERSION=8','-fPIC','-pthread','-I',str(sdk),'-c',str(repo/BASE/'time_parent_binding.c'),'-o',str(out)]
def verify_symbols(text,expected):
 need(isinstance(text,str) and len(text.encode())<=256*1024,'symbol_output_limit');rows=[]
 for name in expected:
  matches=[]
  for line in text.splitlines():
   m=re.fullmatch(r'([0-9a-fA-F]+)\s+([A-Za-z])\s+(.+)',line.strip())
   if m and m.group(3)==name:matches.append((m.group(2),line))
  need(len(matches)==1 and matches[0][0] in ('T','t'),'required_symbol_missing_or_ambiguous');rows.append(matches[0][1])
 return rows
def validate_elf(text,kind):
 need(isinstance(text,str) and len(text.encode())<=16384 and 'ELF64' in text and 'Advanced Micro Devices X86-64' in text,'elf_target')
 types=re.findall(r'^\s*Type:\s+(\w+)',text,re.M);entries=re.findall(r'^\s*Entry point address:\s+(0x[0-9a-fA-F]+)',text,re.M)
 need(len(types)==1 and len(entries)==1,'elf_shape');entry=int(entries[0],16)
 need((kind=='worker' and types[0] in ('EXEC','DYN') and entry!=0) or (kind=='parent' and types[0]=='REL' and entry==0),'elf_kind')
 return True

def phase_budget(deadline,now,maximum):
 remaining=deadline-now;need(remaining>5,'total_deadline');return min(maximum,remaining-5)
def compiler_diagnostic(raw,repo,root,sdk):
 need(isinstance(raw,bytes) and len(raw)<=256*1024,'diagnostic_limit')
 data={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'truncated':len(raw)>16384}
 try:raw.decode('utf-8','strict')
 except UnicodeDecodeError:return {**data,'encoding':'invalid-utf8','text':None}
 prefix=raw[:16384]
 while prefix:
  try:text=prefix.decode('utf-8','strict');break
  except UnicodeDecodeError:prefix=prefix[:-1]
 else:text=''
 for value,label in [(str(repo),'<source>'),(str(root),'<work>'),(str(sdk),'<sdk>')]:text=text.replace(value,label)
 text=re.sub(r'(?<![A-Za-z0-9_>])(?:/[A-Za-z0-9_.+@-]+)+','<path>',text)
 return {**data,'encoding':'utf8','text':text}

def main():
 need(sys.argv[1:]==['--approved-ci-once']);repo=Path(__file__).resolve().parents[1]
 frozen=(repo/PACKET).read_bytes();verify_packet(repo,frozen)
 from governance_build_ipc_compile import header_dependencies,add_frozen,verify_frozen_files,validate_fixture_result,validate_filter_description,restricted_command
 from governance_linux_compile_supervisor import supervise
 event=Path(os.environ['GITHUB_EVENT_PATH']);need(event.stat().st_size<=2*1024*1024)
 head=validate_event(json.loads(event.read_text()),os.environ.get('GITHUB_EVENT_NAME'),os.environ.get('GITHUB_RUN_ATTEMPT'))
 need(os.environ.get('AXIOM_PR_HEAD_SHA')==head and os.environ.get('RUNNER_OS')=='Linux' and os.environ.get('RUNNER_ARCH')=='X64')
 root=Path(os.environ['RUNNER_TEMP'])/'axiom-native-worker-compile-once';root.mkdir(mode=0o700)
 for name in ('home','logs','outputs'):(root/name).mkdir(mode=0o700)
 deadline=time.monotonic()+600;phase='initialize';records=[];files={}
 result={'accepted':False,'head':head,'packetSha256':hashlib.sha256(frozen).hexdigest(),'records':records,'runtimeLaunched':False,'governanceEnabled':False}
 env={'PATH':'/usr/bin:/bin','HOME':str(root/'home'),'LANG':'C.UTF-8','LC_ALL':'C.UTF-8','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null','GIT_TERMINAL_PROMPT':'0'}
 old_handlers={}
 def interrupted(signum,_frame):raise RuntimeError('interrupted')
 def forwarded(signum,_frame):signal.raise_signal(signal.SIGTERM)
 def run(label,argv,restricted=False,maximum=60):
  nonlocal phase
  phase=label;verify_packet(repo,frozen);verify_frozen_files(files)
  command=restricted_command(root/'outputs/network_launcher',argv) if restricted else argv
  stdout=root/'logs'/(label+'.stdout');stderr=root/'logs'/(label+'.stderr')
  item=supervise(command,cwd=repo,env=env,stdout_path=stdout,stderr_path=stderr,timeout_seconds=phase_budget(deadline,time.monotonic(),maximum),max_output_bytes=256*1024,cleanup_seconds=5)
  records.append({'phase':label,'command':command,'result':item});verify_packet(repo,frozen);verify_frozen_files(files)
  print(json.dumps({'phase':label,'status':item['status'],'cleanupConfirmed':item['cleanup_confirmed']}),flush=True)
  if item['status']!='success' and ('compile' in label or 'headers' in label):result['diagnostic']={'phase':label,**compiler_diagnostic(stderr.read_bytes(),repo,root,SDK)}
  need(item['status']=='success' and item['cleanup_confirmed'],'command_failed')
  return stdout.read_text(),stderr.read_text()
 def headers(label,argv):
  text,_=run(label,argv,restricted=label not in ('launcher-headers','fixture-headers'))
  for p,h in header_dependencies(text).items():add_frozen(files,p,h)
 try:
  old_handlers[signal.SIGTERM]=signal.signal(signal.SIGTERM,interrupted)
  for sig in (signal.SIGINT,signal.SIGHUP):old_handlers[sig]=signal.signal(sig,forwarded)
  phase='tool-preflight';proof=json.loads((repo/PROOF).read_text());need(proof.get('accepted') is True and proof.get('evidenceComplete') is True,'prior_proof_unaccepted')
  tools={n:(Path('/usr/bin')/n).resolve(strict=True) for n in ('cc','nm','readelf','git','true')}
  for n,p in tools.items():
   expected=proof['tools'][n];need(str(p)==expected['path'],'tool_path_changed');add_frozen(files,p,expected['sha256'])
  result['tools']={n:{'path':str(p),'sha256':files[p]} for n,p in tools.items()}
  actual,_=run('source-head',[str(tools['git']),'rev-parse','HEAD']);need(actual.strip()==head,'head_changed')
  phase='sdk-preflight';result['sdk']=validate_sdk(SDK)
  for name,digest in result['sdk']['headers'].items():add_frozen(files,SDK/name,digest)
  cc=str(tools['cc']);launcher=repo/'scripts/linux-compile/network_launcher.c';fixture=repo/'scripts/linux-compile/benign_fixture.c'
  for label,source in [('launcher',launcher),('fixture',fixture)]:
   headers(label+'-headers',[cc,'-std=c11','-O2','-M',str(source)])
   run(label+'-compile',[cc,'-std=c11','-O2',str(source),'-o',str(root/'outputs'/('network_'+label))])
   add_frozen(files,root/'outputs'/('network_'+label))
  description,_=run('filter-description',[str(root/'outputs/network_launcher'),'--describe'])
  profile=validate_filter_description(description,(repo/'scripts/linux-compile/compiler_profile.h').read_text());need(profile['programSha256']==proof['filterProgramSha256'],'filter_changed');result['filterProgramSha256']=profile['programSha256']
  checked,_=run('isolation-preflight',[str(root/'outputs/network_fixture'),str(root/'outputs/fixture-owned-file'),str(tools['true'])],restricted=True);validate_fixture_result(checked)
  out=root/'outputs';worker=worker_command(cc,repo,out/'time_worker');parent=parent_command(cc,repo,SDK,out/'time_parent_binding.o')
  # Dependency discovery uses exactly each compilation's preprocessing options.
  for i,source in enumerate(worker[7:-2]):headers('worker-headers-'+str(i),worker[:7]+['-M',source])
  headers('parent-headers',parent[:parent.index('-c')]+['-M',parent[parent.index('-c')+1]])
  for label,command,path,kind,expected in [('worker',worker,out/'time_worker','worker',('main','axiom_time_capture_v2','axiom_time_capture_current','axiom_time_capture_release','axiom_time_publish_or_die','axiom_worker_context_decode','axiom_worker_capture_encode')),('parent',parent,out/'time_parent_binding.o','parent',('axiom_time_parent_create_private',))]:
   run(label+'-compile',command,restricted=True,maximum=120);add_frozen(files,path)
   artifact={'bytes':path.stat().st_size,'sha256':files[path]};result.setdefault('outputs',{})[label]=artifact
   elf,_=run(label+'-elf',[str(tools['readelf']),'-h',str(path)],restricted=True);artifact['elf']=elf
   symbols,_=run(label+'-symbols',[str(tools['nm']),'--defined-only',str(path)],restricted=True);artifact['symbolTable']=symbols
   validate_elf(elf,kind);artifact['requiredSymbols']=verify_symbols(symbols,expected)
  verify_packet(repo,frozen);verify_frozen_files(files);need(time.monotonic()<deadline,'total_deadline');result['accepted']=True
 except BaseException as exc:
  result['accepted']=False
  result['failurePhase']=phase;result['errorCategory']=str(exc) if isinstance(exc,ValueError) else type(exc).__name__
 finally:
  for sig,handler in old_handlers.items():signal.signal(sig,handler)
  try:verify_packet(repo,frozen);verify_frozen_files(files);result['finalFrozenInputsMatched']=True
  except BaseException:
   result['accepted']=False;result['finalFrozenInputsMatched']=False;result['errorCategory']='final_frozen_input_changed';result.pop('diagnostic',None);result['diagnosticInvalidated']=True
  result['frozenInputs']={str(p):h for p,h in files.items()}
  # Primary proof never depends on an unbounded metadata record fitting the log.
  primary={k:v for k,v in result.items() if k!='records'};primary['evidenceKind']='native-worker-compile-v1'
  encoded=json.dumps(primary,sort_keys=True,ensure_ascii=True)
  if len(encoded.encode())>1024*1024:result['accepted']=False;encoded=json.dumps({'evidenceKind':'native-worker-compile-v1','accepted':False,'reason':'evidence_limit','head':head,'packetSha256':result['packetSha256']})
  print(encoded,flush=True)
  print(json.dumps({'accepted':result['accepted'],'records':records},sort_keys=True),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':sys.exit(main())
