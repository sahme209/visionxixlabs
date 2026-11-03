"""PENDING SEPARATE APPROVAL: one component registration/probe/unregistration.

Never imported by the application. Does not create an issuer identity.
"""
from pathlib import Path
import hashlib,json,os,signal,stat,subprocess,time

ROOT=Path('/private/tmp/axiom-origin-unit-prepared-ze5igxef')
MANIFEST_SHA='6d0380e929d43d564ad5008c2ebea8f383fc6ad06f18a65c91f291420ffc8a94'
SERVICE='com.visionxixlabs.axiom.origin-unit'

def command(argv,seconds):
    child=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    try:
        stdout,stderr=child.communicate(timeout=seconds)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid,signal.SIGKILL)
        stdout,stderr=child.communicate(timeout=3)
        return {'exit':child.returncode,'timeout':True,'stdout':stdout.decode(errors='replace')[:8192],'stderr':stderr.decode(errors='replace')[:8192]}
    return {'exit':child.returncode,'timeout':False,'stdout':stdout.decode(errors='replace')[:8192],'stderr':stderr.decode(errors='replace')[:8192]}

def main():
    root_stat=ROOT.lstat()
    assert stat.S_ISDIR(root_stat.st_mode) and root_stat.st_uid==os.getuid() and stat.S_IMODE(root_stat.st_mode)==0o700
    manifest_file=ROOT/'manifest.json'
    assert hashlib.sha256(manifest_file.read_bytes()).hexdigest()==MANIFEST_SHA
    manifest=json.loads(manifest_file.read_text())
    assert manifest['root']==str(ROOT) and manifest['controllerRequirementMatchesBrokerConfig'] is True
    for name,digest in manifest['files'].items():
        relative=Path(name)
        assert not relative.is_absolute() and '..' not in relative.parts
        file=ROOT/relative
        assert not file.is_symlink() and file.is_file() and hashlib.sha256(file.read_bytes()).hexdigest()==digest
    app=Path(manifest['app']); mac=app/'Contents/MacOS'
    host=mac/'AxiomOriginRegistrationHost'; controller=mac/'AxiomOriginController'
    signature=command(['/usr/bin/codesign','--verify','--deep','--strict',str(app)],10)
    assert signature['exit']==0 and not signature['timeout'],signature
    status=command([str(host),'--status-reviewed-unit'],5)
    assert status['exit']==0 and not status['timeout'] and status['stdout'].strip()=='0',status
    domain=f'gui/{os.getuid()}/{SERVICE}'
    loaded=command(['/bin/launchctl','print',domain],5)
    assert loaded['exit']!=0 and not loaded['timeout'],loaded
    # Claim before any registration: interrupted or unknown attempts are never replayed.
    claim=ROOT/'host-experiment-claim.json'
    with claim.open('x') as file:
        os.chmod(claim,0o600)
        json.dump({'status':'consumed_no_retry','manifest':MANIFEST_SHA,'pid':os.getpid()},file)
        file.flush();os.fsync(file.fileno())
    results={'manifest':MANIFEST_SHA,'scope':'component protocol only; NO issuer identity','preStatus':status,'preLoaded':loaded,'signature':signature}
    attempted=False
    try:
        attempted=True
        results['register']=command([str(host),'--register-reviewed-unit'],10)
        assert results['register']['exit']==0 and not results['register']['timeout'],results['register']
        results['probe']=command([str(controller),'--test-reviewed-unit',manifest['brokerRequirement']],25)
        assert results['probe']['exit']==0 and not results['probe']['timeout'] and 'component_observed; executingIssuerIdentity=unavailable' in results['probe']['stdout'],results['probe']
    finally:
        if attempted:
            # Cleanup is required even when registration returns an uncertain failure.
            results['unregister']=command([str(host),'--unregister-reviewed-unit'],10)
            results['postStatus']=command([str(host),'--status-reviewed-unit'],5)
            results['postLoaded']=command(['/bin/launchctl','print',domain],5)
            results['cleanupVerified']=(results['unregister']['exit']==0 and not results['unregister']['timeout'] and results['postStatus']['exit']==0 and not results['postStatus']['timeout'] and results['postStatus']['stdout'].strip()=='0' and results['postLoaded']['exit']!=0 and not results['postLoaded']['timeout'])
        (ROOT/'host-experiment-result.json').write_text(json.dumps(results,indent=2)+'\n')
        print(json.dumps(results,indent=2))
    assert results.get('cleanupVerified') is True,'cleanup_unknown_no_retry'

if __name__=='__main__':
    main()
