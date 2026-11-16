"""Fresh current-source ordinary website build; no historical run authority.

Preparation reads regular source/cache files only. Root reviews INPUTS.json and
this fixed runner before the explicit execute command. No installs, .env,
database/account/SQL, deployment, native app or Governance artifact execution.
"""
from pathlib import Path
import hashlib, importlib.util, json, os, signal, stat, subprocess, sys, tempfile, time, shutil, ctypes, errno
sys.dont_write_bytecode=True

HERE=Path(__file__).resolve().parent
ROOT=Path('/private/tmp/v19-database-runtime-route-trace')
EXPECTED_HEAD='f05c307b4274eee9a343ee51caa02f4f76be8458'
EXPECTED_TREE='65967fbb20d9c590f876a3eee861abdb80738cbe'
MERGED_SOURCE='f05c307b4274eee9a343ee51caa02f4f76be8458'
HELPER=Path('/Users/samirahmed/.codex/worktrees/axiom-governance-recovery-2026-11-14/docs/recovery/2026-11-15/exact-release-render-preparation/executor.py')
PRELOAD=HELPER.parent/'network-deny.cjs'
HELPER_SHA='8e69b92145a98e13f0d3ff2872de8407f814df0101a0bf9b4820a571818832e9'
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
NPM=NODE.parent.parent/'lib/node_modules/npm/bin/npm-cli.js'
SANDBOX=Path('/usr/bin/sandbox-exec')
ENGINE=ROOT/'node_modules/@prisma/engines/schema-engine-darwin-arm64'
# Final explicit new product/test/migration inventory is filled at source freeze.
EXTRA=frozenset({'lib/database/databaseRuntimeTrace.ts','lib/database/__tests__/databaseRuntimeTrace.test.ts','scripts/check-production-product.mjs','lib/ops/__tests__/productionProductSmoke.test.ts'})
SOURCE_HANDOFF_FROZEN=True
LIMITS={'activeSeconds':600,'cleanupSeconds':5,'logBytesPerPhase':32*1024*1024}

def need(ok,reason):
 if not ok:raise RuntimeError(reason)

def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as stream:
  for data in iter(lambda:stream.read(1024*1024),b''):h.update(data)
 return h.hexdigest()

def save(path,data):
 with Path(path).open('x',encoding='utf8') as output:
  os.chmod(path,0o600);json.dump(data,output,indent=2);output.write('\n')

def helper():
 need(sha(HELPER)==HELPER_SHA,'reviewed_helper_changed')
 spec=importlib.util.spec_from_file_location('fresh_ordinary_build_helpers',HELPER)
 unit=importlib.util.module_from_spec(spec);spec.loader.exec_module(unit)
 return unit

def names():
 need(subprocess.check_output(['/usr/bin/git','rev-parse','HEAD'],cwd=ROOT).decode().strip()==EXPECTED_HEAD,'source_head_changed')
 need(subprocess.check_output(['/usr/bin/git','rev-parse','HEAD^{tree}'],cwd=ROOT).decode().strip()==EXPECTED_TREE,'source_tree_changed')
 need(not subprocess.check_output(['/usr/bin/git','diff','--name-only'],cwd=ROOT),'source_worktree_changed')
 values=set(subprocess.check_output(['/usr/bin/git','ls-files','-z'],cwd=ROOT).decode().split('\0'))|EXTRA
 values.discard('')
 # All dotenv and credential extensions are excluded before reading contents.
 return sorted(n for n in values if not any(p.startswith('.env') for p in Path(n).parts)
  and Path(n).suffix.lower() not in ('.pem','.key','.p12','.pfx'))

def source_record(name):
 path=ROOT/name;s=path.lstat()
 need(stat.S_ISREG(s.st_mode),'source_not_regular')
 return {'sha256':sha(path),'bytes':s.st_size,'executable':bool(s.st_mode&0o111)}

def prepare():
 need(SOURCE_HANDOFF_FROZEN,'source_handoff_not_frozen')
 unit=helper();files={}
 for name in names():unit.source_name(name);files[name]=source_record(name)
 need((ROOT/'.npmrc').read_text()=='legacy-peer-deps=false\n','project_npm_config')
 tools={str(p):sha(p) for p in (NODE,NPM,SANDBOX,ENGINE,PRELOAD,Path('/bin/sh'),Path('/usr/bin/env'))}
 caches=unit.inventory([ROOT/'node_modules',NPM.parent.parent])
 packet={'scope':'Combined diagnostic and critical-journey source offline website build; not a deployed artifact', 'sourceHead':EXPECTED_HEAD,'baseTree':EXPECTED_TREE,'baseMergedSource':MERGED_SOURCE,'sourceIndexSha256':hashlib.sha256(subprocess.check_output(['/usr/bin/git','ls-files','--stage','-z'],cwd=ROOT)).hexdigest(),'sourceFiles':files,
  'runnerSha256':sha(Path(__file__)),'helperSha256':HELPER_SHA,'tools':tools,'cacheInventory':caches,
  'explicitNewFiles':sorted(EXTRA),'limits':LIMITS,'commands':[['npm','run','build']],
  'databaseUrlSupplied':False,'dotenvCopied':False,'nativeAppOrGovernanceRuntime':False,'deployment':False}
 save(HERE/'INPUTS.json',packet)
 print(json.dumps({'prepared':True,'sourceFiles':len(files),'packetSha256':sha(HERE/'INPUTS.json'),'runnerSha256':packet['runnerSha256']}))

def verify(packet,unit):
 need(packet['sourceIndexSha256']==hashlib.sha256(subprocess.check_output(['/usr/bin/git','ls-files','--stage','-z'],cwd=ROOT)).hexdigest(),'source_index_changed')
 need(packet['limits']==LIMITS and packet['explicitNewFiles']==sorted(EXTRA),'fixed_build_contract')
 need(packet['commands']==[['npm','run','build']],'fixed_build_commands')
 need(packet['runnerSha256']==sha(Path(__file__)) and packet['helperSha256']==sha(HELPER)==HELPER_SHA,'build_helper_changed')
 need(set(names())==set(packet['sourceFiles']),'source_members_changed')
 for name,want in packet['sourceFiles'].items():need(source_record(name)==want,'source_content_changed')
 for name,want in packet['tools'].items():need(sha(Path(name))==want,'tool_content_changed')
 unit.verify_inventory(packet['cacheInventory'])

def clone_regular_file(src,dst):
 # APFS clone-on-write files have independent inodes. Never alias mutable cache.
 src,dst=Path(src),Path(dst)
 need(src.is_file() and not src.is_symlink() and not dst.exists(),'clone_regular_file_contract')
 libc=ctypes.CDLL('/usr/lib/libSystem.B.dylib',use_errno=True)
 clone=libc.clonefile;clone.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_int];clone.restype=ctypes.c_int
 if clone(os.fsencode(src),os.fsencode(dst),0)!=0:
  code=ctypes.get_errno()
  if code not in (errno.ENOTSUP,errno.EXDEV,errno.EINVAL):raise OSError(code,'owned_clone_failed')
  shutil.copy2(src,dst)
 need(src.stat().st_ino!=dst.stat().st_ino or src.stat().st_dev!=dst.stat().st_dev,'dependency_hardlink_refused')
 shutil.copystat(src,dst)
 return str(dst)

def execute(expected_sha):
 started=time.monotonic();deadline=started+LIMITS['activeSeconds']
 packet_path=HERE/'INPUTS.json';need(sha(packet_path)==expected_sha,'packet_sha_changed')
 packet=json.loads(packet_path.read_text());unit=helper();verify(packet,unit)
 # New marker is exclusive and belongs only to this new ordinary batch.
 save(HERE/'ATTEMPT.json',{'packetSha256':expected_sha,'consumed':True,'retryAllowed':False})
 stage=Path(tempfile.mkdtemp(prefix='v19-combined-diagnostic-',dir='/private/tmp')).resolve()
 os.chmod(stage,0o700);source=stage/'source';source.mkdir(mode=0o700)
 owner=unit.ProcessOwner();saved_handlers={};receipt={'accepted':False,'stage':str(stage),'packetSha256':expected_sha,
  'scope':packet['scope'],'networkDenied':True,'outsideStageWritesDenied':True,'dotenvCopied':False,
  'databaseUrlSupplied':False,'nativeAppOrGovernanceRuntime':False,'deployment':False,'phases':{}}
 try:
  for sig in (signal.SIGINT,signal.SIGTERM,signal.SIGHUP):saved_handlers[sig]=signal.signal(sig,owner.signal)
  for name,want in packet['sourceFiles'].items():
   need(not owner.cancelled,'cancelled');need(time.monotonic()<deadline,'active_deadline')
   data=(ROOT/name).read_bytes();need(hashlib.sha256(data).hexdigest()==want['sha256'],'copied_source_changed')
   target=source/name;target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
   with target.open('xb') as output:output.write(data)
   os.chmod(target,0o700 if want['executable'] else 0o600)
  for name in ('home','cache','tmp','bin','npm-prefix'):(stage/name).mkdir(mode=0o700)
  for name in ('empty.npmrc','empty-global.npmrc'):(stage/name).write_text('')
  (stage/'bin/node').symlink_to(NODE)
  # Physical regular dependency files; preserve/rebase only owned internal links.
  def copy_dependency(src,dst):
   need(not owner.cancelled,'cancelled')
   need(time.monotonic()<deadline,'dependency_copy_deadline')
   return clone_regular_file(src,dst)
  shutil.copytree(ROOT/'node_modules',source/'node_modules',symlinks=True,copy_function=copy_dependency)
  links=[]
  for current,dirs,files in os.walk(source/'node_modules',followlinks=False):
   for name in dirs+files:
    link=Path(current)/name
    if link.is_symlink():links.append(link)
  for link in links:
   original_link=ROOT/'node_modules'/link.relative_to(source/'node_modules')
   target=original_link.resolve(strict=True)
   need(target.is_relative_to(ROOT),'dependency_link_outside_reviewed_root')
   expected=source/target.relative_to(ROOT)
   link.unlink();link.symlink_to(expected,target_is_directory=target.is_dir())
  for link in links:need(link.resolve(strict=True).is_relative_to(source),'staged_link_not_owned')
  need(time.monotonic()<deadline,'copy_deadline')
  shutil.copyfile(PRELOAD,stage/'network-deny.cjs')
  env=unit.child_environment(stage,NODE,ENGINE)
  env['NODE_OPTIONS'] += ' --require='+str(stage/'network-deny.cjs')
  profile=unit.sandbox_profile(stage)
  print(json.dumps({'phase':'build-starting','stage':str(stage),'source':str(source),'sourceTree':EXPECTED_TREE}),flush=True)
  (stage/'sandbox.sb').write_text(profile)
  for phase,cwd in [('website',source)]:
   need(not owner.cancelled,'cancelled')
   budget=deadline-time.monotonic();need(budget>0,'active_deadline')
   outcome=owner.run([str(SANDBOX),'-p',profile,str(NODE),str(NPM),'run','build'],cwd,env,stage/(phase+'.log'),budget)
   receipt['phases'][phase]=outcome
   verify(packet,unit)
   need(outcome['exitCode']==0 and outcome['cleanupConfirmed'] is True,'build_phase_failed')
  need(time.monotonic()<deadline and not owner.cancelled,'deadline_or_cancelled')
  receipt['outputs']={name:unit.inventory([source/name]) for name in ('.next','.prisma/client-source','lib/generated/prisma')}
  receipt['previewNamespace']=unit.namespace_inventory(source/'node_modules')
  receipt['previewRootEntries']=sorted(item.name for item in source.iterdir())
  need(time.monotonic()<deadline and not owner.cancelled,'deadline_or_cancelled')
  receipt['accepted']=True;receipt['finalInputsMatched']=True
 except BaseException as error:
  receipt['failure']=str(error) if isinstance(error,RuntimeError) else type(error).__name__
 finally:
  if not receipt['accepted']:receipt['finalInputsMatched']=False
  for sig,handler in saved_handlers.items():signal.signal(sig,handler)
  save(stage/'RESULT.json',receipt)
  save(HERE/'RESULT.json',{'accepted':receipt['accepted'],'stage':str(stage),'receiptSha256':sha(stage/'RESULT.json'),
   'packetSha256':expected_sha,'phases':receipt['phases'],'failure':receipt.get('failure'),'finalInputsMatched':receipt.get('finalInputsMatched')})
  print(json.dumps({'accepted':receipt['accepted'],'stage':str(stage),'failure':receipt.get('failure'),'receiptSha256':sha(stage/'RESULT.json')}))
 return 0 if receipt['accepted'] else 1

if __name__=='__main__':
 if sys.argv[1:]==['prepare']:prepare()
 elif len(sys.argv)==3 and sys.argv[1]=='execute':raise SystemExit(execute(sys.argv[2]))
 else:raise SystemExit('fixed_prepare_or_execute_required')
