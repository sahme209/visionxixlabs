import os,json,hashlib,subprocess,tempfile,tarfile,signal
from pathlib import Path
repo=Path('/Users/samirahmed/.codex/worktrees/axiom-aws-sdk-upgrade/axiom-ticket-install-completion')
root=Path(tempfile.mkdtemp(prefix='axiom-joined-current-build-',dir='/private/tmp'));source=root/'source';source.mkdir();(root/'home').mkdir();(root/'cache').mkdir()
head='260d76407bcae72a185f21315d71ec088e900229'
paths=subprocess.check_output(['git','ls-tree','-r','--name-only','-z',head],cwd=repo).decode().split('\0');paths=[p for p in paths if p]
assert not any(Path(p).name in ['.env','.env.local','.env.production','.env.production.local'] for p in paths)
hashes={p:hashlib.sha256((repo/p).read_bytes()).hexdigest() for p in paths if (repo/p).is_file()}
subprocess.run(['git','archive','--format=tar','--output='+str(root/'source.tar'),head],cwd=repo,check=True)
with tarfile.open(root/'source.tar') as archive:
 for member in archive.getmembers():
  assert not member.name.startswith('/') and '..' not in Path(member.name).parts and not member.issym() and not member.islnk()
 archive.extractall(source)
assert all(hashlib.sha256((source/p).read_bytes()).hexdigest()==h for p,h in hashes.items())
assert all(p.name=='.env.example' for p in source.glob('.env*'))
(source/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
engine=repo/'node_modules/@prisma/engines/schema-engine-darwin-arm64'
assert hashlib.sha256(engine.read_bytes()).hexdigest()=='6032ea1bdbd6dc3d453c36a22838d1d3b3554053083bf7695c104e9993637ba1'
node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin')
env={'PATH':str(node)+':/usr/bin:/bin','HOME':str(root/'home'),'TMPDIR':str(root),'LANG':'en_US.UTF-8','TZ':'UTC','NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','NODE_OPTIONS':'--max-old-space-size=8192','NODE_COMPILE_CACHE':str(root/'cache'),'CI':'1','PRISMA_SCHEMA_ENGINE_BINARY':str(engine)}
(root/'source-hashes.json').write_text(json.dumps(hashes,indent=2))
run={'head':head,'sourceCount':len(hashes),'networkDenied':True,'databaseUrlSupplied':False,'loadedEnvironmentFilesAbsent':True,'trackedExampleOnly':True,'scope':'ordinary local production compilation only; no native issuer launch/deploy'}
(root/'run.json').write_text(json.dumps(run,indent=2));print(str(root),flush=True)
with (root/'build.log').open('wb') as log:
 p=subprocess.Popen(['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)',str(node/'npm'),'run','build'],cwd=source,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:code=p.wait(timeout=1800)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait();code=124
assert all(hashlib.sha256((repo/p).read_bytes()).hexdigest()==h for p,h in hashes.items())
run.update(exitCode=code,buildLogSha256=hashlib.sha256((root/'build.log').read_bytes()).hexdigest(),sourceUnchanged=True)
(root/'completion.json').write_text(json.dumps(run,indent=2));print(json.dumps({'root':str(root),'exitCode':code}),flush=True)
raise SystemExit(code)
