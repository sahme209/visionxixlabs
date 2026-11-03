"""PENDING NEW EXACT-RUN APPROVAL: one component registration/probe/cleanup.
Never imported by the application. Does not create an issuer identity.
"""
from pathlib import Path
import hashlib,json,os,signal,stat,subprocess

ROOT=Path('/private/tmp/axiom-origin-unit-prepared-2d_6kwi8')
MANIFEST_SHA='25129462668fe5ef677af7283b09fda4d6d7c9d2defc443e7c8653c3906ca368'
SERVICE='com.visionxixlabs.axiom.origin-unit'

def command(argv,seconds):
    try:child=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
    except OSError as error:return {'exit':None,'timeout':False,'stdout':'','stderr':'spawn_error','errorType':type(error).__name__}
    try:
        stdout,stderr=child.communicate(timeout=seconds)
    except subprocess.TimeoutExpired:
        try:os.killpg(child.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        try:stdout,stderr=child.communicate(timeout=3)
        except subprocess.TimeoutExpired:return {'exit':None,'timeout':True,'stdout':'','stderr':'reap_unknown','pid':child.pid}
        return {'exit':child.returncode,'timeout':True,'stdout':stdout.decode(errors='replace')[:8192],'stderr':stderr.decode(errors='replace')[:8192]}
    return {'exit':child.returncode,'timeout':False,'stdout':stdout.decode(errors='replace')[:8192],'stderr':stderr.decode(errors='replace')[:8192]}

def host_result(result,app):
    if result['timeout']:raise AssertionError('host_response_unknown')
    data=json.loads(result['stdout'])
    assert isinstance(data,dict) and data.get('exactCallingBundle') is True
    assert data.get('bundleURL')==str(app) and data.get('executableURL')==str(app/'Contents/MacOS/AxiomOriginRegistrationHost') and data.get('bundleIdentifier')=='com.visionxixlabs.axiom.origin-unit.app'
    return data

def main():
    root_stat=ROOT.lstat()
    assert stat.S_ISDIR(root_stat.st_mode) and root_stat.st_uid==os.getuid() and stat.S_IMODE(root_stat.st_mode)==0o700
    # An exclusive result journal prevents a second invocation even after preclaim refusal.
    # A crash leaves the started journal intact/unknown; never overwrite or adopt it.
    fd=os.open(ROOT/'host-experiment-result.json',os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
    results={'manifest':MANIFEST_SHA,'scope':'component protocol only; NO issuer identity','phase':'started','ownedRegistration':False}
    def persist():
        data=(json.dumps(results,indent=2)+'\n').encode();os.lseek(fd,0,os.SEEK_SET);os.ftruncate(fd,0)
        offset=0
        while offset<len(data):
            written=os.write(fd,data[offset:])
            if written<=0:raise OSError('receipt_write_incomplete')
            offset+=written
        os.fsync(fd)
    owned=False;app=None;host=None
    try:
        persist()
        manifest_file=ROOT/'manifest.json';assert hashlib.sha256(manifest_file.read_bytes()).hexdigest()==MANIFEST_SHA
        manifest=json.loads(manifest_file.read_text());assert manifest['root']==str(ROOT) and manifest['controllerRequirementMatchesBrokerConfig'] is True
        for name,digest in manifest['files'].items():
            relative=Path(name);assert not relative.is_absolute() and '..' not in relative.parts
            file=ROOT/relative;assert not file.is_symlink() and file.is_file() and hashlib.sha256(file.read_bytes()).hexdigest()==digest
        app=Path(manifest['app']);assert app==ROOT/'Axiom Origin Unit.app'
        mac=app/'Contents/MacOS';host=mac/'AxiomOriginRegistrationHost';controller=mac/'AxiomOriginController'
        results['signature']=command(['/usr/bin/codesign','--verify','--deep','--strict',str(app)],10)
        assert results['signature']['exit']==0 and not results['signature']['timeout']
        results['preStatus']=command([str(host),'--status-reviewed-unit'],5)
        status=host_result(results['preStatus'],app)
        assert results['preStatus']['exit']==0 and type(status.get('status')) is int and status['status'] in (0,3),'preexisting_pending_or_unknown_status'
        # NotFound3 is diagnostic only. The supported register operation itself must succeed.
        domain=f'gui/{os.getuid()}/{SERVICE}'
        results['preLoaded']=command(['/bin/launchctl','print',domain],5)
        assert results['preLoaded']['exit']==113 and not results['preLoaded']['timeout'],'loaded_or_unresolved_service'
        claim=ROOT/'host-experiment-claim.json'
        with claim.open('x') as file:
            os.chmod(claim,0o600);json.dump({'status':'consumed_no_retry','manifest':MANIFEST_SHA,'pid':os.getpid()},file);file.flush();os.fsync(file.fileno())
        results['phase']='registration_intent';persist()
        results['register']=command([str(host),'--register-reviewed-unit'],10)
        registration=host_result(results['register'],app)
        assert results['register']['exit']==0 and registration.get('registrationSucceeded') is True,'registration_not_confirmed_no_cleanup'
        owned=True;results['ownedRegistration']=True;results['phase']='registration_confirmed';persist()
        assert type(registration.get('postStatus')) is int and registration['postStatus']==1,'owned_registration_not_enabled_no_probe'
        results['probe']=command([str(controller),'--test-reviewed-unit',manifest['brokerRequirement']],25)
        assert results['probe']['exit']==0 and not results['probe']['timeout'] and 'component_observed; executingIssuerIdentity=unavailable' in results['probe']['stdout'],'component_probe_failed'
        results['phase']='component_observed_no_identity'
    except BaseException as error:
        results['failureType']=type(error).__name__;results['phaseAtFailure']=results['phase'];results['phase']='refused_or_unknown_no_retry'
        raise
    finally:
        try:
            # NO/timeout/lostack never authorizes removal of possibly preexisting state.
            if owned:
                results['unregister']=command([str(host),'--unregister-reviewed-unit'],10)
                results['postStatus']=command([str(host),'--status-reviewed-unit'],5)
                results['postLoaded']=command(['/bin/launchctl','print',f'gui/{os.getuid()}/{SERVICE}'],5)
                try:
                    unregistered=host_result(results['unregister'],app);post=host_result(results['postStatus'],app)
                    results['cleanupVerified']=(results['unregister']['exit']==0 and unregistered.get('unregistrationSucceeded') is True and results['postStatus']['exit']==0 and type(post.get('status')) is int and post['status']==0 and results['postLoaded']['exit']==113 and not results['postLoaded']['timeout'])
                except (ValueError,TypeError,KeyError,AssertionError):results['cleanupVerified']=False
            else:results['cleanupAttempted']=False
            persist();print(json.dumps(results,indent=2))
        finally:os.close(fd)
    assert results.get('cleanupVerified') is True,'cleanup_unknown_no_retry'

if __name__=='__main__':main()
