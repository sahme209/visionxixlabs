"""Real Windows Script Host synthetic-link preflight, no installed/real shortcuts."""
import sys
sys.dont_write_bytecode=True
import hashlib,json,os,time
from pathlib import Path
import windows_installed_acceptance as qa
COMPLETION_SENTINEL = 'V19_SHORTCUT_FIXTURE_COMPLETE'
CSCRIPT_FLAGS = ('//NoLogo',)  # //B suppresses the runtime refusal diagnostics.

def vbs_string(value):return '"'+value.replace('"','""')+'"'
def fixture_script(source,phase,data,second_move_failure=False,removing=False):
    # Only MSI's Session property boundary is adapted; migration logic is exact.
    qa.need(source.count('Session.Property(')==3,'script_session_boundary_changed')
    prefix='Option Explicit\nFunction V19FixtureProperty(name)\nIf name = "REMOVE" Then\nV19FixtureProperty = '+vbs_string('ALL' if removing else '')+'\nElse\nV19FixtureProperty = '+vbs_string(data)+'\nEnd If\nEnd Function\n'
    body=source.replace('Option Explicit\n','',1).replace('__PHASE__',phase).replace('Session.Property(','V19FixtureProperty(')
    if second_move_failure:
        needle='        fso.MoveFile links(i), backups(i)'
        qa.need(body.count(needle)==1,'fixture_move_boundary_changed')
        body=body.replace(needle,'        If i = 1 Then Fail "Synthetic second move failure"\n'+needle)
    return prefix+body+'\nWScript.Echo "'+COMPLETION_SENTINEL+'"\n'

def phase_evidence(record,expected_reason=None):
    stdout=record['diagnostics']['stdout']['text'];stderr=record['diagnostics']['stderr']['text']
    complete=COMPLETION_SENTINEL in [line.strip() for line in stdout.splitlines()]
    qa.need(record['exitCode'] in (0,1),'unexpected_script_host_status')
    if expected_reason:
        qa.need('V19 shortcut migration: '+expected_reason in stdout+'\n'+stderr,'expected_refusal_description_missing')
        qa.need(not complete,'refused_script_reached_completion')
        record['fixedExpectedRefusalDescription']=expected_reason
        record['completionSentinelObserved']=False
    else:
        qa.need(record['exitCode']==0 and complete and not stderr,'script_completion_not_proven')
        record['completionSentinelObserved']=True


def main():
    qa.need(os.name=='nt','windows_script_preflight_only')
    folder=Path(sys.argv[1]);parent=folder.parent
    qa.need(parent.is_dir() and not parent.is_symlink() and parent.name.startswith('axiom-installed-') and qa.windows_path_within(str(parent),str(qa.validated_runner_temp(os.environ.get('RUNNER_TEMP')))),'script_fixture_owner_invalid')
    qa.need(folder.name=='msi-shortcut-script' and not folder.exists() and not folder.is_symlink(),'script_fixture_preexisting')
    folder.mkdir();output=folder/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+50)
    host=(Path(os.environ['SYSTEMROOT'])/'System32/cscript.exe').resolve(strict=True);qa.need(host.is_file(),'windows_script_host_unavailable')
    source=(qa.ROOT/'desktop/src-tauri/windows/msi-shortcut-migration.vbs').read_text()
    stage='case_setup';current_case='bootstrap'
    result={'accepted':False,'syntheticLinksOnly':True,'realInstalledLinksUsed':False,'sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'hostSha256':qa.digest(host),'cases':[],'processes':runner.records}
    def case(label,foreign_old=False,foreign_current=False,partial=False,rollback=False,backup=False,directory=False,reparse=False,foreign_args=False,uninstall_foreign=False):
        nonlocal stage,current_case
        current_case=label;stage='case_setup'
        owned=folder/label;owned.mkdir();app=owned/'application';app.mkdir();desktop=owned/'desktop';
        if not reparse:desktop.mkdir()
        else:
            alternate=owned/'junction-target';alternate.mkdir()
            command=(Path(os.environ['SYSTEMROOT'])/'System32/cmd.exe').resolve(strict=True)
            runner.run(label+'-junction',[command,'/d','/c','mklink','/J',desktop,alternate],owned,5)
        menu=owned/'programs'/'Axiom Agent';menu.mkdir(parents=True);current_menu=owned/'programs'/'V19';current_menu.mkdir()
        expected=app/'axiom-desktop.exe';expected.write_bytes(b'synthetic non-executable target; never launched')
        foreign=app/'foreign.exe';foreign.write_bytes(b'synthetic foreign non-executable target; never launched')
        links=[desktop/'Axiom Agent.lnk',menu/'Axiom Agent.lnk',desktop/'V19.lnk',current_menu/'V19.lnk'];backups=[Path(str(expected)+'.v19-legacy-desktop.lnk'),Path(str(expected)+'.v19-legacy-menu.lnk')]
        data='|'.join(map(str,[expected,*links]))
        def setup_link(name,target,tag,arguments=""):
            nonlocal stage
            stage='link_setup'
            script=owned/(tag+'.vbs');script.write_text('Dim s,l\nSet s=CreateObject("WScript.Shell")\nSet l=s.CreateShortcut('+vbs_string(str(name))+')\nl.TargetPath='+vbs_string(str(target))+'\nl.Arguments='+vbs_string(arguments)+'\nl.Save\n',encoding='utf-16')
            runner.run(label+'-'+tag,[host,*CSCRIPT_FLAGS,script],owned,5)
        if directory:links[0].mkdir()
        else:setup_link(links[0],foreign if foreign_old else expected,'desktop-link', 'synthetic argument' if foreign_args else '')
        setup_link(links[1],expected,'menu-link')
        if foreign_current:setup_link(links[2],foreign,'foreign-current')
        if backup:backups[0].write_bytes(b'preexisting foreign backup; preserve')
        original={str(p):p.read_bytes() for p in links+backups if p.is_file()}
        def phase(name,allowed=(0,)):
            nonlocal stage
            stage=name
            script=owned/(name+'.vbs');script.write_text(fixture_script(source,name,data,second_move_failure=partial and name=='migrate',removing=uninstall_foreign),encoding='utf-16')
            expected_reason = None
            if allowed == (1,):
                if partial and name == 'migrate':expected_reason='Synthetic second move failure'
                elif foreign_old or foreign_current:expected_reason='Foreign shortcut preserved'
                elif backup:expected_reason='Shortcut backup already exists'
                elif directory:expected_reason='Shortcut destination is a directory'
                elif reparse:expected_reason='Shortcut parent is a reparse point'
                elif foreign_args:expected_reason='Shortcut arguments preserved'
                qa.need(expected_reason is not None,'expected_refusal_case_unknown')
            # Observe the actual host status AND exact known refusal description.
            # An unrelated syntax/runtime error cannot satisfy a negative case.
            runner.run(label+'-'+name,[host,*CSCRIPT_FLAGS,script],owned,5,allow=(0,1) if expected_reason else allowed)
            record=runner.records[-1]
            phase_evidence(record,expected_reason)
            return record['exitCode']
        if foreign_old or foreign_current or backup or directory or reparse or foreign_args:
            phase('preflight',(1,))
            qa.need(all(Path(p).read_bytes()==value for p,value in original.items()),'foreign_shortcut_changed')
            qa.need(not backups[1].exists() and (backup or not backups[0].exists()),'foreign_refusal_created_backup')
            if directory:qa.need(links[0].is_dir(),'foreign_directory_changed')
            if reparse:qa.need(bool(os.lstat(desktop).st_file_attributes & 1024),'foreign_reparse_point_changed')
        else:
            phase('preflight')
            phase('migrate',(1,) if partial else (0,))
            qa.need(backups[0].read_bytes()==original[str(links[0])],'legacy_backup_not_byte_exact')
            if partial or rollback:
                phase('rollback');qa.need(links[0].read_bytes()==original[str(links[0])],'rollback_desktop_changed')
                qa.need(links[1].read_bytes()==original[str(links[1])],'rollback_menu_changed')
                qa.need(not any(p.exists() for p in backups),'rollback_backup_residual')
            else:
                qa.need(backups[1].read_bytes()==original[str(links[1])],'legacy_menu_backup_changed');phase('commit')
                qa.need(not any(p.exists() for p in links[:2]+backups),'legacy_commit_residual')
        result['cases'].append(label)
    try:
        case('commit');case('rollback',rollback=True);case('foreign-old',foreign_old=True);case('foreign-current',foreign_current=True);case('foreign-backup',backup=True);case('partial-rollback',partial=True);case('directory',directory=True);case('reparse-parent',reparse=True);case('foreign-arguments',foreign_args=True);case('uninstall-foreign-current',foreign_current=True,uninstall_foreign=True)
        result['accepted']=len(result['cases'])==10 and all(row['ownedJobEmpty'] for row in runner.records)
    except Exception:result['failure']={'stage':stage,'case':current_case,'code':'fixed_windows_shortcut_script_preflight_failed'}
    # Only synthetic fixture files remain within this owned output folder. They
    # are not installed/system links, registry entries, credentials or executables.
    print(json.dumps(result,sort_keys=True),flush=True)
    return 0 if result['accepted'] else 1
if __name__=='__main__':
    try:exit_code=main()
    except Exception:
        print(json.dumps({'accepted':False,'failure':{'stage':'bootstrap','case':'bootstrap','code':'fixed_windows_shortcut_script_preflight_failed'}}),flush=True);exit_code=1
    raise SystemExit(exit_code)
