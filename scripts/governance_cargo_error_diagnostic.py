"""One approved Cargo-only observation. Import is inert; no native qualification."""
import hashlib,importlib.util,json,os,re,signal,sys,time
from pathlib import Path
BASE='docs/recovery/2026-11-13/real-governance-qualification/design/linux-compiler-validation/'
PACKET=BASE+'CARGO-ERROR-INPUT-PACKET.json'
SAVED=BASE+'RUST-SPAWN-OBSERVED-RESULT.json'
BEFORE='47adbced23b378f4f4789a6bec8d836641785240'
REPOSITORY='sahme209/visionxixlabs'
BRANCH='codex/governance-live-qualification-setup'
TARGET='x86_64-unknown-linux-gnu'
REQUIRED_INPUTS={
 'scripts/governance_cargo_error_diagnostic.py','scripts/tests/test_governance_cargo_error_diagnostic.py',
 'scripts/tests/test_governance_cargo_error_workflow.py','.github/workflows/linux-cargo-error-diagnostic.yml',
 'scripts/governance_rust_spawn_diagnostic.py','scripts/governance_linux_compile.py',
 'scripts/governance_linux_compile_supervisor.py','scripts/linux-compile/network_launcher.c',
 'scripts/linux-compile/compiler_profile.h',SAVED,
}
def need(value,reason='cargo_observation_refused'):
 if not value:raise ValueError(reason)
def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def validate_event(event,name,attempt):
 need(name=='pull_request' and attempt=='1' and isinstance(event,dict))
 need(event.get('action')=='synchronize' and event.get('number')==331 and event.get('before')==BEFORE)
 repo=event.get('repository',{});pr=event.get('pull_request',{});base=pr.get('base',{});head=pr.get('head',{})
 need(repo.get('full_name')==REPOSITORY and repo.get('private') is False and pr.get('number')==331)
 need(base.get('ref')=='main' and base.get('repo',{}).get('full_name')==REPOSITORY)
 need(head.get('ref')==BRANCH and head.get('repo',{}).get('full_name')==REPOSITORY)
 sha=head.get('sha','');need(isinstance(sha,str) and re.fullmatch('[0-9a-f]{40}',sha) and sha!=BEFORE and event.get('after')==sha)
 return sha
def sanitize_stderr(raw,observation,replacements,current=True):
 if not current:return {'stderrReleased':False,'reason':'currentness-unavailable'}
 if observation.get('cleanup_confirmed') is not True or observation.get('status') not in ('success','exit_nonzero'):
  return {'stderrReleased':False,'reason':'incomplete-child'}
 if not isinstance(raw,bytes) or len(raw)>16384 or observation.get('stderr_bytes')!=len(raw):
  return {'stderrReleased':False,'reason':'stderr-limit-or-count'}
 facts={'stderrReleased':False,'stderrBytes':len(raw),'stderrSha256':hashlib.sha256(raw).hexdigest()}
 try:text=raw.decode('utf-8','strict')
 except UnicodeError:return {**facts,'reason':'invalid-utf8'}
 for path,label in sorted(replacements.items(),key=lambda item:len(item[0]),reverse=True):
  need(isinstance(path,str) and path.startswith('/') and len(path)>1 and label in ('<OWNED_ROOT>','<CHECKOUT>','<TOOLCHAIN>'),'redaction-input')
  # Replace the exact known prefix and descendants, not a similarly named path
  # or a substring embedded in a different pathname/error token.
  text=re.sub(r'(?<![A-Za-z0-9_./-])'+re.escape(path)+r'(?![A-Za-z0-9_.-])',lambda _:label,text)
 return {**facts,'stderrReleased':True,'stderrText':text}
def verify_saved_identity(saved,tools,stdlib,program):
 need(set(tools)=={'rustc','cargo','cc','git','true'} and tools==saved.get('toolSha256'),'saved-tool-mismatch')
 need(set(stdlib)=={'std','core'} and stdlib==saved.get('standardLibrarySha256'),'saved-stdlib-mismatch')
 need(program==saved.get('filterProgramSha256'),'saved-filter-mismatch')
def load_pinned(path,name):
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def main():
 need(sys.argv[1:]==['--approved-ci-once'])
 repo=Path(__file__).resolve().parents[1];packet_path=repo/PACKET;packet_bytes=packet_path.read_bytes();need(len(packet_bytes)<=65536)
 packet=json.loads(packet_bytes);need(set(packet)=={'kind','files'} and packet['kind']=='one-pr331-cargo-error-v1')
 need(isinstance(packet['files'],dict) and set(packet['files'])==REQUIRED_INPUTS)
 files={}
 for name,want in packet['files'].items():
  path=repo/name;need(path.resolve().is_relative_to(repo) and path.is_file() and not path.is_symlink() and isinstance(want,str) and re.fullmatch('[0-9a-f]{64}',want))
  need(digest(path)==want,'packet-input-changed');files[path]=want
 # All three helpers are exact packet-bound OWN source, imported only after pins.
 base=load_pinned(repo/'scripts/governance_rust_spawn_diagnostic.py','cargo_error_base')
 helpers=load_pinned(repo/'scripts/governance_linux_compile.py','cargo_error_helpers')
 supervisor=load_pinned(repo/'scripts/governance_linux_compile_supervisor.py','cargo_error_supervisor')
 saved=json.loads((repo/SAVED).read_text());need(saved.get('head')==BEFORE and saved.get('diagnosticCompleted') is True,'saved-receipt-mismatch')
 event_path=Path(os.environ['GITHUB_EVENT_PATH']);need(event_path.stat().st_size<=2*1024*1024)
 head=validate_event(json.loads(event_path.read_text()),os.environ.get('GITHUB_EVENT_NAME'),os.environ.get('GITHUB_RUN_ATTEMPT'))
 need(os.environ.get('AXIOM_PR_HEAD_SHA')==head and os.environ.get('RUNNER_OS')=='Linux' and os.environ.get('RUNNER_ARCH')=='X64')
 root=Path(os.environ['RUNNER_TEMP'])/'axiom-cargo-error-once';need(root.is_absolute());root.mkdir(mode=0o700)
 for name in ('home','cargo-home','target','native','logs'):(root/name).mkdir(mode=0o700)
 deadline=time.monotonic()+240;records=[];phase='initialization'
 result={'diagnosticCompleted':False,'compilerAccepted':False,'governanceEnabled':False,'governanceRuntimeLaunched':False,'head':head,'packetSha256':hashlib.sha256(packet_bytes).hexdigest(),'records':records}
 tools={name:(Path('/usr/bin')/name).resolve(strict=True) for name in ('cc','git','true')}
 for name,path in tools.items():base.freeze(files,path);need(files[path]==saved['toolSha256'].get(name),'saved-tool-mismatch')
 need(Path('/usr/bin/true').is_file() and digest('/usr/bin/true')==files[tools['true']],'fixed-true-mismatch')
 rustup=(Path.home()/'.cargo/bin/rustup').resolve(strict=True);base.freeze(files,rustup)
 env={'PATH':'/usr/bin:/bin','HOME':str(root/'home'),'RUSTUP_HOME':str(Path.home()/'.rustup'),'RUSTUP_AUTO_INSTALL':'0','LANG':'C.UTF-8'}
 launcher=root/'native/network_launcher'
 def recheck():
  need(packet_path.read_bytes()==packet_bytes,'packet-changed');base.verify_frozen(files)
 def run(label,argv,timeout,filtered=False,cwd=repo,allow_failure=False):
  nonlocal phase
  phase=label;recheck();remaining=deadline-time.monotonic();need(remaining>5,'total-deadline')
  command=[str(launcher),'--',*argv] if filtered else argv
  out=root/'logs'/(label+'.stdout');err=root/'logs'/(label+'.stderr')
  observed=supervisor.supervise(command,cwd=cwd,env=env,stdout_path=out,stderr_path=err,timeout_seconds=min(timeout,remaining-5),max_output_bytes=16384 if label=='cargo-once' else 65536,cleanup_seconds=5)
  records.append({'phase':label,'result':observed});recheck()
  if not allow_failure:need(observed['cleanup_confirmed'] and observed['status']=='success','phase-incomplete')
  # Private bytes only; metadata callers decode strictly and never echo them.
  return observed,out.read_bytes(),err.read_bytes()
 def stopped(_signum,_frame):raise SystemExit('cargo_observation_cancelled')
 previous=signal.signal(signal.SIGTERM,stopped)
 try:
  paths={}
  for name in ('rustc','cargo'):
   _,raw,_=run('locate-'+name,[str(rustup),'which','--toolchain','stable',name],10)
   path=Path(raw.decode('utf-8','strict').strip());need(path.is_absolute() and path.name==name and path.resolve().is_relative_to((Path.home()/'.rustup/toolchains').resolve()))
   paths[name]=path.resolve(strict=True);base.freeze(files,paths[name]);need(files[paths[name]]==saved['toolSha256'].get(name),'saved-tool-mismatch')
  env=base.clean_environment(root,paths['rustc'])
  _,raw,_=run('source-head',[str(tools['git']),'rev-parse','HEAD'],10);need(raw.decode().strip()==head,'wrong-checkout')
  _,raw,_=run('rust-version',[str(paths['rustc']),'--version','--verbose'],10);version=raw.decode('utf-8','strict');helpers.validate_rust_version(version)
  _,raw,_=run('cargo-version',[str(paths['cargo']),'--version'],10);cargo_match=re.fullmatch(r'cargo ([0-9]+\.[0-9]+\.[0-9]+) \(([a-f0-9]+) ([0-9-]+)\)\n',raw.decode('utf-8','strict'));need(cargo_match is not None,'cargo-version-invalid')
  commits=re.findall(r'^commit-hash: ([a-f0-9]{40})$',version,re.M);need(len(commits)==1,'rust-version-invalid')
  result['toolchain']={'rustcRelease':re.findall(r'^release: ([0-9.]+)$',version,re.M)[0],'rustcCommit':commits[0],'cargoRelease':cargo_match[1],'cargoCommit':cargo_match[2],'target':TARGET}
  need(result['toolchain']==saved.get('toolchain'),'saved-version-mismatch')
  _,raw,_=run('rust-sysroot',[str(paths['rustc']),'--print','sysroot'],10)
  sysroot=Path(raw.decode('utf-8','strict').strip());need(sysroot.is_absolute() and sysroot.resolve().is_relative_to((Path.home()/'.rustup/toolchains').resolve()))
  stdlib={}
  for name,pattern in (('std','libstd-*.rlib'),('core','libcore-*.rlib')):
   found=list((sysroot/'lib/rustlib'/TARGET/'lib').glob(pattern));need(len(found)==1,'stdlib-identity-missing');base.freeze(files,found[0]);stdlib[name]=files[found[0]]
  need(stdlib==saved.get('standardLibrarySha256'),'saved-stdlib-mismatch')
  native=root/'native'
  for name in ('network_launcher.c','compiler_profile.h'):
   path=native/name
   with path.open('xb') as target:target.write((repo/'scripts/linux-compile'/name).read_bytes())
   path.chmod(0o600);base.freeze(files,path)
  depfile=native/'launcher.d'
  run('launcher-headers',[str(tools['cc']),'-std=c11','-I',str(native),'-M','-MF',str(depfile),str(native/'network_launcher.c')],20)
  for path,want in helpers.header_dependencies(depfile.read_text()).items():need(digest(path)==want);base.freeze(files,path)
  run('launcher-compile',[str(tools['cc']),'-std=c11','-Wall','-Wextra','-Werror','-I',str(native),str(native/'network_launcher.c'),'-o',str(launcher)],30);base.freeze(files,launcher)
  _,raw,_=run('filter-description',[str(launcher),'--describe'],5)
  program=helpers.validate_filter_description(raw.decode('utf-8','strict'),(native/'compiler_profile.h').read_text())['programSha256']
  tool_hashes={name:files[path] for name,path in {**tools,**paths}.items()}
  verify_saved_identity(saved,tool_hashes,stdlib,program)
  result.update(toolSha256=tool_hashes,standardLibrarySha256=stdlib,filterProgramSha256=program)
  crate=root/'crate';files.update(base.prepare_crate(crate));base.assert_no_cargo_config(crate,root/'cargo-home')
  observed,_stdout,raw_stderr=run('cargo-once',[str(paths['cargo']),'rustc','--offline','--locked','--target',TARGET,'--lib','--no-default-features'],15,filtered=True,cwd=crate,allow_failure=True)
  base.assert_no_cargo_config(crate,root/'cargo-home');recheck()
  observation=sanitize_stderr(raw_stderr,observed,{str(root):'<OWNED_ROOT>',str(repo):'<CHECKOUT>',str(sysroot):'<TOOLCHAIN>'})
  result['stderrObservation']=observation
  need(observation['stderrReleased'],'stderr-unavailable')
  result['cargoCategory']=base.classify_cargo(observed,raw_stderr.decode('utf-8','strict'))
  outputs=list((root/'target'/TARGET/'debug/deps').glob('libaxiom_spawn_probe-*.rlib'))
  if observed['status']=='success':need(len(outputs)==1,'tiny-output-missing')
  result['tinyOutputSha256']=[digest(path) for path in outputs if path.is_file() and not path.is_symlink()]
  recheck();result['diagnosticCompleted']=True
 except BaseException:
  result['diagnosticCompleted']=False;result['failurePhase']=phase;result['terminalCategory']='observation-stopped'
  # No raw unexpected exceptions, partial diagnostics or previously attached text.
  result['stderrObservation']={'stderrReleased':False,'reason':'observation-stopped'}
 finally:
  signal.signal(signal.SIGTERM,previous)
  try:recheck()
  except BaseException:
   result['diagnosticCompleted']=False;result['terminalCategory']='final-currentness-unavailable';result['stderrObservation']={'stderrReleased':False,'reason':'currentness-unavailable'}
  print(json.dumps(result,sort_keys=True,ensure_ascii=True),flush=True)
 need(result['diagnosticCompleted'],'diagnostic-incomplete')
if __name__=='__main__':
 try:main()
 except BaseException:
  print('{"diagnosticCompleted":false,"terminalCategory":"stopped"}',flush=True);sys.exit(1)
