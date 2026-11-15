"""One offline website compilation of explicit current source, never a deployment.
Reuses the already reviewed ordinary-build environment/namespace/process owner;
keeps its historical packet and one-attempt receipts untouched.
"""
from pathlib import Path
import hashlib,importlib.util,json,os,signal,stat,subprocess,tempfile
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
HELPER=ROOT/'docs/recovery/2026-11-15/homepage-pointer-render-validation/executor.py'
EXTRA=('components/marketing/IntegrationCatalogLogo.tsx','components/marketing/IntegrationConnectionsScene.tsx','components/marketing/usePreviewSequence.ts','public/logos/integrations/dagster.svg','public/logos/integrations/NOTICE.md')

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run_owned(owner,argv,cwd,env,log):
 old={}
 try:
  for sig in (signal.SIGINT,signal.SIGTERM,signal.SIGHUP):old[sig]=signal.signal(sig,owner.signal)
  return owner.run(argv,cwd,env,log,600)
 finally:
  for sig,handler in old.items():signal.signal(sig,handler)

def main():
 spec=importlib.util.spec_from_file_location('prior_website_compile',HELPER);helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
 names=subprocess.check_output(['/usr/bin/git','ls-files','-z'],cwd=ROOT).decode().split('\0')
 names=sorted(set(n for n in names if n)|set(EXTRA))
 # Do not read or copy dotenv/credential files, build outputs or user scratch.
 names=[n for n in names if not any(part.startswith('.env') for part in Path(n).parts) and Path(n).suffix.lower() not in ('.pem','.key','.p12','.pfx')]
 manifest={}
 for n in names:
  p=ROOT/n
  if not stat.S_ISREG(p.lstat().st_mode):raise RuntimeError('nonregular_source')
  manifest[n]=sha(p)
 stage=Path(tempfile.mkdtemp(prefix='axiom-framer-website-',dir='/private/tmp')).resolve();source=stage/'source';source.mkdir(mode=0o700)
 for n in names:
  dst=source/n;dst.parent.mkdir(parents=True,exist_ok=True);dst.write_bytes((ROOT/n).read_bytes());os.chmod(dst,0o700 if (ROOT/n).stat().st_mode&0o111 else 0o600)
 for n in ('home','cache','tmp','bin','npm-prefix'):(stage/n).mkdir(mode=0o700)
 for n in ('empty.npmrc','empty-global.npmrc'):(stage/n).write_text('')
 (stage/'bin/node').symlink_to(NODE)
 helper.stage_namespace(ROOT/'node_modules',source/'node_modules',source,True)
 observed=json.loads((HELPER.parent/'OBSERVED-TOOLS.json').read_text());engine=Path(observed['tools']['schemaEngine']['realpath'])
 env=helper.child_environment(stage,NODE,engine)
 profile=helper.sandbox_profile(stage);(stage/'sandbox.sb').write_text(profile)
 receipt={'scope':'website compilation only','stage':str(stage),'sourceFiles':manifest,'helperSha256':sha(HELPER),'nodeSha256':sha(NODE),'engineSha256':sha(engine),'networkDenied':True,'outsideStageWritesDenied':True,'dotenvCopied':False,'credentialsSupplied':False,'nativeExecuted':False,'deployed':False}
 # Mark once in this new unit; no implicit retries and no historical marker update.
 with (HERE/'BUILD-ATTEMPT.json').open('x') as f:json.dump({'stage':str(stage),'attemptConsumed':True},f)
 owner=helper.ProcessOwner()
 try:
  receipt['outcome']=run_owned(owner,['/usr/bin/sandbox-exec','-p',profile,str(NODE),str(helper.NPM),'run','build'],source,env,HERE/'WEBSITE-BUILD.log')
 except BaseException as error:
  receipt['failure']=type(error).__name__
 finally:
  receipt['finalSourcesMatched']=all(sha(ROOT/n)==h for n,h in manifest.items())
  outcome=receipt.get('outcome',{})
  receipt['accepted']=outcome.get('exitCode')==0 and outcome.get('cleanupConfirmed') is True and receipt['finalSourcesMatched'] and not owner.cancelled
  (HERE/'WEBSITE-BUILD-RESULT.json').write_text(json.dumps(receipt,indent=2)+'\n')
 print(json.dumps({k:receipt.get(k) for k in ('stage','accepted','outcome','failure','finalSourcesMatched')}))
 return 0 if receipt['accepted'] else 1
if __name__=='__main__':raise SystemExit(main())
