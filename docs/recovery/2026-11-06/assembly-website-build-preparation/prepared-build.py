"""PREPARED ONLY. Frozen packet plus separate root execution decision required.
Ordinary website compiler: no npm, Prisma generation, emitter, native or System command.
"""
from pathlib import Path
import hashlib, importlib.util, io, json, os, re, stat, subprocess, sys, tarfile, time
sys.dont_write_bytecode = True
REPO = Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
HERE = Path(__file__).resolve().parent
NODE = Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
DEPS = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-system-build-4/stage')
PARENT = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds')

def digest(path):
    if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode): raise RuntimeError('regular nonsymlink required')
    return hashlib.sha256(path.read_bytes()).hexdigest()

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module

def main():
    prepare_only=sys.argv[1:]==['--prepare-only']
    execute_prepared=sys.argv[1:]==['--execute-prepared']
    if not (prepare_only or execute_prepared): raise RuntimeError('choose --prepare-only or separately authorized --execute-prepared')
    packet = json.loads((HERE/'build-packet.json').read_bytes())
    rev = packet['sourceRevision']
    if not isinstance(rev,str) or not re.fullmatch('[a-f0-9]{40}', rev): raise RuntimeError('reviewed exact revision required; no HEAD fallback')
    if not prepare_only and packet['executionAuthorized'] is not True: raise RuntimeError('separate exact execution decision required')
    for item in packet['preparedInputs']: 
        if digest(Path(item['path'])) != item['sha256']: raise RuntimeError('prepared source changed')
    if digest(NODE) != packet['nodeSha256']: raise RuntimeError('pinned Node changed')
    if not re.fullmatch(r'axiom-evidence-assembly-build-[a-f0-9]{8}',packet['ownedName']):raise RuntimeError('fixed owned name required')
    owned = PARENT / packet['ownedName']
    if prepare_only:
        if owned.exists() or owned.is_symlink(): raise RuntimeError('fresh run required; no overwrite or retry')
        owned.mkdir(mode=0o700); stage=owned/'stage';stage.mkdir(mode=0o700)
        for n in ['tmp','home']:(owned/n).mkdir(mode=0o700)
        logs={n:owned/n for n in ['contract.log','next-build.log']}
        print('OWNED',owned,flush=True)
        git_env={'PATH':'/usr/bin:/bin','GIT_NO_LAZY_FETCH':'1','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null'}
        git_prefix=['/usr/bin/sandbox-exec','-p','(version 1)(allow default)(deny network*)','/usr/bin/git','-C',str(REPO)]
        raw=subprocess.check_output([*git_prefix,'archive','--format=tar',rev],env=git_env,timeout=60)
        if hashlib.sha256(raw).hexdigest()!=packet['archiveSha256']: raise RuntimeError('frozen archive changed')
        expected={}
        seen=set()
        with tarfile.open(fileobj=io.BytesIO(raw),mode='r:') as archive:
            for member in archive:
                if member.name.casefold() in seen:raise RuntimeError('duplicate archive member')
                seen.add(member.name.casefold())
                path=stage/member.name
                if member.name.startswith('/') or '..' in Path(member.name).parts or member.issym() or member.islnk() or not (member.isfile() or member.isdir()): raise RuntimeError('nonordinary archive entry')
                if Path(member.name).parts[0] in {'node_modules','.next','.git'}:raise RuntimeError('reserved archive root')
                if member.isdir():path.mkdir(parents=True,exist_ok=True);continue
                body=archive.extractfile(member).read();path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body);path.chmod(member.mode & 0o777);expected[member.name]=hashlib.sha256(body).hexdigest()
        for n in ['.env','.env.local','.env.production','.env.production.local']:
            if (stage/n).exists():raise RuntimeError('ambient env file prohibited')
        for n in ['package.json','package-lock.json','prisma/schema.prisma']:
            if (stage/n).read_bytes()!=(DEPS/n).read_bytes():raise RuntimeError('matching dependency/schema source required')
        print('ARCHIVE_BOUND',rev,flush=True)
        subprocess.run(['/bin/cp','-cR',str(DEPS/'node_modules'),str(stage/'node_modules')],check=True,timeout=120)
        for directory,dirs,files in os.walk(stage/'node_modules',followlinks=False):
            for name in dirs+files:
                p=Path(directory)/name
                if p.is_symlink() and not p.resolve().is_relative_to(stage.resolve()):raise RuntimeError('dependency link escape')
        generation=json.loads((DEPS.parent/'generation-run/result.json').read_bytes())
        if not generation['generatedOutputsVerified'] or generation['schemaComparison']['rawArchiveSha256']!=digest(stage/'prisma/schema.prisma'):raise RuntimeError('existing generated-client evidence mismatch')
        for name,record in generation['outputs'].items():
            p=stage/'node_modules/.prisma/client'/name;q=DEPS/'node_modules/.prisma/client'/name
            if digest(p)!=record['sha256'] or digest(q)!=record['sha256'] or p.stat().st_ino==q.stat().st_ino:raise RuntimeError('generated-client copy changed or aliased')
        for item in packet['dependencyInputs']:
            p=stage/item['relativePath'];q=DEPS/item['relativePath']
            if digest(p)!=item['sha256'] or digest(q)!=item['sha256'] or p.stat().st_ino==q.stat().st_ino:raise RuntimeError('critical dependency copy changed or aliased')
        engine=load('assembly_existing_child',REPO/'scripts/local_prisma_engine_inputs.py')
        builder=load('assembly_existing_output',REPO/'scripts/build-local-issuer-package-source.py')
        profile=engine._generation_profile(stage,owned/'tmp',list(logs.values()),[REPO,DEPS],read_protected=[REPO,DEPS])
        (owned/'compiler.sb').write_text(profile)
        (owned/'source-manifest.json').write_text(json.dumps(expected,sort_keys=True)+'\n')
        (owned/'prepared.json').write_text(json.dumps({'sourceRevision':rev,'archiveSha256':packet['archiveSha256'],'dependencyInputs':packet['dependencyInputs'],'nodeSha256':packet['nodeSha256'],'preparedInputs':packet['preparedInputs'],'profileSha256':digest(owned/'compiler.sb'),'sourceManifestSha256':digest(owned/'source-manifest.json'),'generationEvidence':str(DEPS.parent/'generation-run/result.json'),'status':'prepared-not-compiled','publicOnly':True},indent=2)+'\n')
        print('PREPARED_NOT_COMPILED',owned,flush=True)
        return
    stage=owned/'stage';logs={n:owned/n for n in ['contract.log','next-build.log']}
    receipt=json.loads((owned/'prepared.json').read_bytes())
    for key in ['sourceRevision','archiveSha256','dependencyInputs','nodeSha256','preparedInputs']:
        if receipt[key]!=packet[key]:raise RuntimeError('prepared packet bindings changed')
    if digest(owned/'compiler.sb')!=receipt['profileSha256'] or digest(owned/'source-manifest.json')!=receipt['sourceManifestSha256']:raise RuntimeError('prepared source/profile changed')
    if (stage/'.next').exists() or any(p.exists() for p in logs.values()) or (owned/'result.json').exists():raise RuntimeError('fresh one-shot compile required; no retry')
    expected=json.loads((owned/'source-manifest.json').read_bytes());profile=(owned/'compiler.sb').read_text()
    for item in packet['dependencyInputs']:
        if digest(stage/item['relativePath'])!=item['sha256']:raise RuntimeError('critical copied dependency changed')
    engine=load('assembly_existing_child',REPO/'scripts/local_prisma_engine_inputs.py')
    builder=load('assembly_existing_output',REPO/'scripts/build-local-issuer-package-source.py')
    env={'PATH':str(NODE.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(owned/'home'),'TMPDIR':str(owned/'tmp'),'XDG_CACHE_HOME':str(owned/'tmp'),'LANG':'C','TZ':'UTC','NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','NODE_DISABLE_COMPILE_CACHE':'1','CHECKPOINT_DISABLE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','AWS_EC2_METADATA_DISABLED':'true','DATABASE_URL':'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic','AUTH_SECRET':'synthetic-local-web-build-not-real-credential','NEXTAUTH_SECRET':'synthetic-local-web-build-not-real-credential'}
    start=time.monotonic();result={'sourceRevision':rev,'scope':'ordinary website compile only; no emitter/System/native qualification','buildOutputsVerified':False,'executionAuthorized':False}
    def verify_source(after_build=False):
        for n,h in expected.items():
            if after_build and n=='next-env.d.ts':continue # only known framework-owned declaration may be regenerated; verified separately below
            if digest(stage/n)!=h:raise RuntimeError('archived source drift: '+n)
    try:
        for arguments,log in [(['scripts/check-vercel-build.mjs'],logs['contract.log']),(['node_modules/next/dist/bin/next','build','--webpack'],logs['next-build.log'])]:
            verify_source();left=600-(time.monotonic()-start)
            if left<=0:raise RuntimeError('compiler bundle deadline')
            print('PHASE',arguments[0],flush=True)
            with log.open('xb') as output:
                code,error=engine._run_generation_child(['/usr/bin/sandbox-exec','-p',profile,str(NODE),*arguments],stage,env,output,left,file_size_limit=512*1024*1024,creation_mask=0o022)
            if error or code!=0:raise RuntimeError('ordinary compiler failed: '+str(error or code))
        verify_source(after_build=True);framework=builder.verify_framework_declaration(stage)
        # Explicit public-output adaptation: original verifier additionally REQUIRES a private emitted bootstrap.
        # Do not emit/copy one to make an ordinary website preview appear System-qualified.
        verifier=load('assembly_public_outputs',HERE/'public-output-verification.py')
        result.update(buildOutputsVerified=True,outputs=verifier.verify_public_outputs(stage),frameworkDeclaration=framework,status='ordinary_public_web_outputs_observed')
    except Exception as exc:
        result.update(status='failed',reason=str(exc));raise
    finally:
        result['elapsedSeconds']=round(time.monotonic()-start,3);(owned/'result.json').write_text(json.dumps(result,indent=2)+'\n');print('RESULT',json.dumps({k:result.get(k)for k in ['status','buildOutputsVerified','elapsedSeconds','reason']}),flush=True)
if __name__=='__main__':main()
