"""Temporary branch bounded exact-source host preflight; no installer/app/build."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,os,shutil,time,uuid
from pathlib import Path
import windows_installed_acceptance as qa
from windows_msi_byte_diagnostic import authority,diagnostic_tools

def main():
    authority();tools,_=diagnostic_tools()
    base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-msi-script-'+uuid.uuid4().hex);base.mkdir(exist_ok=False);output=base/'evidence';output.mkdir()
    runner=qa.OwnedWindowsProcess(output,time.monotonic()+75)
    packet=qa.ROOT/'scripts/windows-msi-shortcut-quick-inputs.json';inputs=json.loads(packet.read_text());stage='source_guard'
    result={'accepted':False,'syntheticLinksOnly':True,'msiSessionOrTransactionVerified':False,'nativeInstallerVerified':False,'published':False,'processes':runner.records,'packetSha256':qa.digest(packet)}
    def verify():
        return all(qa.digest(qa.ROOT/name)==value for name,value in inputs.items())
    folder=base/'msi-shortcut-script'
    try:
        qa.need(verify(),'quick_reviewed_source_changed');stage='checkout_identity'
        qa.need(runner.run('source-head',[tools['git.exe'],'rev-parse','HEAD'],qa.ROOT,5)==os.environ['GITHUB_SHA'],'checkout_changed')
        stage='script_fixture'
        raw=runner.run('owned-script-fixture',[tools['python.exe'],qa.ROOT/'scripts/windows_msi_shortcut_preflight.py',folder],qa.ROOT,60,allow=(0,1))
        result['client']=json.loads(raw);qa.need(result['client'].get('accepted') is True,'script_fixture_failed')
        qa.need(verify(),'quick_source_changed_after_fixture');result['sourceInputsMatched']=True;result['accepted']=True
    except Exception:result['failure']={'stage':stage,'code':'fixed_owned_shortcut_preflight_failure'}
    finally:
        stage='fixture_cleanup';clean=False
        try:result['sourceInputsMatched']=verify() and qa.digest(packet)==result['packetSha256']
        except Exception:result['sourceInputsMatched']=False
        try:
            # The only reparse fixture is this exact created directory junction.
            junction=folder/'reparse-parent'/'desktop'
            if junction.exists():
                qa.need(qa.windows_path_within(str(junction),str(folder)),'fixture_junction_scope_changed')
                qa.need(junction.resolve(strict=True)==(folder/'reparse-parent'/'junction-target').resolve(strict=True),'fixture_junction_target_changed')
                os.rmdir(junction)  # Removes junction itself; never follows it.
            if folder.exists():
                qa.need(not folder.is_symlink() and folder.resolve(strict=True)==base.resolve(strict=True)/'msi-shortcut-script','fixture_cleanup_scope_changed')
                qa.need(all(not p.is_symlink() and not getattr(p,'is_junction',lambda:False)() for p in folder.rglob('*')),'unexpected_fixture_link')
                shutil.rmtree(folder)
            clean=not folder.exists()
        except Exception:result['cleanupFailure']='owned_synthetic_fixture_cleanup_unconfirmed'
        result['ownedFixtureRemoved']=clean
        result['ownedProcessesEmpty']=all(row['ownedJobEmpty'] for row in runner.records)
        result['accepted']=result['accepted'] and clean and result['ownedProcessesEmpty'] and result['sourceInputsMatched']
        (output/'RESULT.json').write_text(qa.primary_receipt(result)+'\n')
        print('V19_MSI_SHORTCUT_PREFLIGHT_RESULT:'+qa.primary_receipt(result),flush=True)
    return 0 if result['accepted'] else 1
if __name__=='__main__':raise SystemExit(main())
