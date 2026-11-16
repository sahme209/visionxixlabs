"""Pure preparation checks. No Windows API, native child, package or vault use."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "windows_installed_acceptance.py"
spec = importlib.util.spec_from_file_location("windows_acceptance_preparation", SOURCE)
candidate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(candidate)


class WindowsAcceptancePreparation(unittest.TestCase):
    def test_shared_application_directory_only_empty_physical_child_is_removed(self):
        with tempfile.TemporaryDirectory() as folder,tempfile.TemporaryDirectory() as outside:
            base=Path(folder);application=base/'application';other=base/'unrelated';other.mkdir()
            application.mkdir();candidate.remove_empty_application_directory(base)
            self.assertFalse(application.exists());self.assertTrue(other.exists())
            application.mkdir();foreign=application/'foreign.txt';foreign.write_bytes(b'preserve')
            with self.assertRaisesRegex(RuntimeError,'application_directory_residuals'):candidate.remove_empty_application_directory(base)
            self.assertEqual(foreign.read_bytes(),b'preserve');foreign.unlink();application.rmdir()
            application.symlink_to(Path(outside),target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError,'application_directory_link_refused'):candidate.remove_empty_application_directory(base)
            self.assertTrue(Path(outside).exists());self.assertTrue(application.is_symlink())

    def test_all_upgrade_recipes_share_fixed_application_path(self):
        import windows_upgrade_acceptance as upgrade
        base=Path('/owned/fixed-run');expected=str(base/'application')
        for case in upgrade.AUTOMATED_CASES:
            plan=upgrade.upgrade_commands(case,{'msiexec.exe':'fixed'},base,'old','new')
            self.assertEqual(plan['installDirectory'],expected)
            self.assertIn(('INSTALLDIR=' if case=='msi-major-upgrade' else '/D=')+expected,plan['oldInstall'])
            self.assertIn(('INSTALLDIR=' if case=='msi-major-upgrade' else '/D=')+expected,plan['candidateUpgrade'])

    def test_unenrolled_controller_refuses_before_platform_or_account_access(self):
        with patch.object(candidate, "BUNDLER_RECIPE_REVIEWED", False):
            with self.assertRaisesRegex(RuntimeError, "acceptance_not_enrolled"):
                candidate.authority()

    def test_entry_setup_and_future_helper_imports_never_write_source_bytecode(self):
        import json,os,shutil,subprocess,sys
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);scripts=root/'scripts';scripts.mkdir()
            shutil.copyfile(SOURCE,scripts/SOURCE.name)
            shutil.copyfile(SOURCE.parent/'windows_upgrade_acceptance.py',scripts/'windows_upgrade_acceptance.py')
            shutil.copyfile(SOURCE.parent/'windows_legacy_acquire.py',scripts/'windows_legacy_acquire.py')
            code="import json,pathlib,runpy,sys; sys.dont_write_bytecode=False; root=pathlib.Path(sys.argv[1]); sys.path.insert(0,str(root/'scripts')); runpy.run_path(str(root/'scripts/windows_installed_acceptance.py'),run_name='fixture_controller'); import windows_upgrade_acceptance; print(json.dumps({'guard':sys.dont_write_bytecode,'bytecode':[str(p.relative_to(root)) for p in root.rglob('*.pyc')]}))"
            env={key:os.environ[key] for key in ['PATH','SYSTEMROOT','WINDIR','TEMP','TMP'] if key in os.environ}
            result=subprocess.run([sys.executable,'-c',code,str(root)],env=env,capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            proof=json.loads(result.stdout);self.assertTrue(proof['guard']);self.assertEqual(proof['bytecode'],[])
            # Removing only the entry guard reproduces the observed source-tree
            # mutation: this is not an inventory ignore or fabricated pyc fixture.
            entry=scripts/SOURCE.name;entry.write_text(entry.read_text().replace('sys.dont_write_bytecode = True','sys.dont_write_bytecode = False'))
            result=subprocess.run([sys.executable,'-c',code,str(root)],env=env,capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            proof=json.loads(result.stdout);self.assertFalse(proof['guard']);self.assertTrue(any('windows_upgrade_acceptance' in name for name in proof['bytecode']))
            shutil.rmtree(scripts/'__pycache__')
            downloader="import json,pathlib,runpy,sys; root=pathlib.Path(sys.argv[1]); sys.path.insert(0,str(root/'scripts')); runpy.run_path(str(root/'scripts/windows_legacy_acquire.py'),run_name='fixture_downloader'); print(json.dumps({'startupGuard':sys.flags.dont_write_bytecode,'bytecode':[str(p.relative_to(root)) for p in root.rglob('*.pyc')]}))"
            child_env=candidate.child_environment(env)
            result=subprocess.run([sys.executable,'-c',downloader,str(root)],env=child_env,capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            proof=json.loads(result.stdout);self.assertEqual(proof['startupGuard'],1);self.assertEqual(proof['bytecode'],[])


    def test_child_environment_drops_credentials_and_injection_options(self):
        env = candidate.child_environment({"Path": "owned-path", "SystemRoot": r"C:\Windows", "GITHUB_TOKEN": "synthetic-do-not-retain", "AWS_SECRET_ACCESS_KEY": "synthetic-do-not-retain", "NODE_OPTIONS": "--require synthetic", "PYTHONPATH": "synthetic-injection", "PYTHONPYCACHEPREFIX": "synthetic-outside-path", "PYTHONDONTWRITEBYTECODE": "0", "RUSTFLAGS": "synthetic", "TAURI_SIGNING_PRIVATE_KEY": "synthetic-do-not-retain"})
        self.assertEqual(env, {"PATH": "owned-path", "SYSTEMROOT": r"C:\Windows", "CI": "1", "NO_COLOR": "1", "PYTHONDONTWRITEBYTECODE": "1"})
        with self.assertRaisesRegex(RuntimeError, "extra_environment_refused"):
            candidate.child_environment({}, {"GITHUB_TOKEN": "synthetic"})

    def test_required_powershell_environment_is_forwarded_only_as_validated_nonsecret_fields(self):
        import re
        script_root=SOURCE.parent
        uses=set()
        for path in script_root.glob('windows*.ps1'):uses.update(re.findall(r'\$env:([A-Za-z_][A-Za-z0-9_]*)',path.read_text()))
        uses.update(re.findall(r'\$env:([A-Za-z_][A-Za-z0-9_]*)',SOURCE.read_text()))
        env=candidate.child_environment({'SYSTEMROOT':r'C:\Windows','RUNNER_TEMP':r'D:\a\_temp','GITHUB_TOKEN':'synthetic-not-forwarded'})
        self.assertEqual(uses,{'RUNNER_TEMP','SYSTEMROOT'});self.assertTrue(uses<=set(env));self.assertEqual(env['RUNNER_TEMP'],r'd:\a\_temp')
        self.assertNotIn('GITHUB_TOKEN',env)
        for value in ['',r'D:relative',r'\\server\share',r'D:\a\_temp\..\outside']:
            with self.assertRaises(RuntimeError):candidate.child_environment({'RUNNER_TEMP':value})

    def test_runner_temp_requires_actual_directory_without_link_or_resolved_escape(self):
        class FakePath:
            directory=True;linked=False;resolved=r'D:\a\_temp'
            def __init__(self,value):self.value=value
            def __str__(self):return self.value
            def is_dir(self):return self.directory
            def is_symlink(self):return self.linked
            def resolve(self,strict=False):return FakePath(self.resolved)
        with patch.object(candidate,'Path',FakePath):
            self.assertEqual(str(candidate.validated_runner_temp(r'D:\a\_temp')),r'd:\a\_temp')
            for field,value in [('directory',False),('linked',True),('resolved',r'E:\foreign')]:
                with patch.object(FakePath,field,value),self.assertRaises(RuntimeError):candidate.validated_runner_temp(r'D:\a\_temp')

    def test_read_only_snapshot_preflight_uses_fresh_owned_empty_folder_before_expensive_phases(self):
        import sys
        sys.path.insert(0,str(SOURCE.parent))
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);calls=[]
            def snapshot(runner,tools,base,directories,codes,label):
                calls.append((base,directories,codes,label));self.assertTrue(directories[0].is_dir());self.assertEqual(list(directories[0].iterdir()),[])
                return {'products':[],'shortcuts':[],'protocolCommands':[],'ownedPayloads':[]}
            with patch.object(candidate,'upgrade_snapshot',side_effect=snapshot):
                proof=candidate.snapshot_helper_preflight(object(),{},root)
            self.assertTrue(proof['readOnly']);self.assertEqual(calls[0][2],[]);self.assertEqual(calls[0][3],'helper-snapshot-preflight')
        source=SOURCE.read_text();main=source[source.index('def main():'):source.index('def upgrade_snapshot(')]
        self.assertLess(main.index('snapshot_helper_preflight('),main.index('"desktop-dependencies"'))
        self.assertLess(main.index('snapshot_helper_preflight('),main.index('"vault-build"'))
        self.assertIn("'all-installs-pristine'",main)

    def test_only_fixed_synthetic_vault_fields_can_be_added(self):
        extra = {"AXIOM_WINDOWS_ACCEPTANCE_KEY": "owned-roundtrip-1-2", "AXIOM_WINDOWS_ACCEPTANCE_STAGE": "cleanup"}
        env = candidate.child_environment({}, extra)
        self.assertEqual(env, {"CI": "1", "NO_COLOR": "1", "PYTHONDONTWRITEBYTECODE": "1", **extra})

    def test_installer_inventory_requires_exactly_one_of_each_kind(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root / "msi").mkdir(); (root / "nsis").mkdir()
            with self.assertRaisesRegex(RuntimeError, "installer_count_invalid"):
                candidate.installers(root)
            for name in ["msi/owned.msi", "nsis/owned.exe"]: (root / name).write_bytes(b"synthetic")
            self.assertEqual(set(candidate.installers(root)), {"msi", "nsis"})
            (root / "msi/extra.msi").write_bytes(b"synthetic")
            with self.assertRaisesRegex(RuntimeError, "installer_count_invalid"):
                candidate.installers(root)

    def test_candidate_paths_cannot_escape_the_owned_output(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); owned = root / "owned"; owned.mkdir()
            outside = root / "outside.exe"; outside.write_bytes(b"synthetic")
            with self.assertRaisesRegex(RuntimeError, "artifact_outside_owned_root"):
                candidate.owned_file(outside, owned)
            (owned / "link.exe").symlink_to(outside)
            with self.assertRaisesRegex(RuntimeError, "artifact_not_regular"):
                candidate.owned_file(owned / "link.exe", owned)

    def test_pe_metadata_checks_structure_without_running_a_payload(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "synthetic.exe"
            data = bytearray(136); data[:2] = b"MZ"; data[0x3c:0x40] = (128).to_bytes(4, "little"); data[128:132] = b"PE\0\0"; data[132:134] = (0x8664).to_bytes(2, "little")
            file.write_bytes(data); self.assertEqual(candidate.pe_machine(file), 0x8664)
            data[0x3c:0x40] = (2000000).to_bytes(4, "little"); file.write_bytes(data)
            with self.assertRaisesRegex(RuntimeError, "installed_pe_offset_invalid"):
                candidate.pe_machine(file)
            file.write_bytes(b"not-an-executable")
            with self.assertRaisesRegex(RuntimeError, "installed_pe_header_invalid"):
                candidate.pe_machine(file)

    def test_nsis_x86_stub_and_amd64_application_roles_are_separate_not_filename_inferred(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'arbitrary-name.exe'
            for machine,kind,wrong in [(0x14c,'NsisInstaller','Application'),(0x8664,'Application','NsisInstaller')]:
                data=bytearray(136);data[:2]=b'MZ';data[0x3c:0x40]=(128).to_bytes(4,'little');data[128:132]=b'PE\0\0';data[132:134]=machine.to_bytes(2,'little');path.write_bytes(data)
                self.assertIn(candidate.require_pe_role(path,kind),['I386','AMD64'])
                with self.assertRaisesRegex(RuntimeError,'artifact_pe_role_mismatch'):candidate.require_pe_role(path,wrong)
            data[132:134]=(0xaa64).to_bytes(2,'little');path.write_bytes(data)
            for kind in ['NsisInstaller','Application','unknown']:
                with self.assertRaisesRegex(RuntimeError,'artifact_pe_role_mismatch'):candidate.require_pe_role(path,kind)
        source=(SOURCE.parents[1]/'scripts/windows_installer_metadata.ps1').read_text()
        self.assertIn("[ValidateSet('MsiInstaller','NsisInstaller','Application')]",source)
        self.assertIn("if($ArtifactKind -eq 'NsisInstaller')",source)
        self.assertIn("if($machine -ne 0x14c)",source);self.assertIn("if($machine -ne 0x8664)",source)

    def vault_message(self, executable):
        return {'reason':'compiler-artifact','package_id':'path+file:///D:/repo/desktop/src-tauri#axiom-desktop@0.1.23','manifest_path':r'D:\repo\desktop\src-tauri\Cargo.toml','target':{'name':'windows_keyring_acceptance','kind':['test'],'crate_types':['bin'],'src_path':r'D:\repo\desktop\src-tauri\tests\windows_keyring_acceptance.rs','test':True},'profile':{'test':True},'executable':executable,'filenames':[executable]}

    def test_vault_selection_accepts_actual_json_for_old_and_cargo_1100_layouts(self):
        target=r'D:\owned\vault-target'
        for executable in [target+r'\debug\deps\windows_keyring_acceptance-0123456789abcdef.exe',target+r'\debug\build\axiom-desktop\0123456789abcdef\out\windows_keyring_acceptance.exe']:
            row=self.vault_message(executable)
            selected=candidate.select_vault_artifact([row],target,r'D:\repo\desktop\src-tauri\Cargo.toml',r'D:\repo\desktop\src-tauri\tests\windows_keyring_acceptance.rs','0.1.23')
            self.assertEqual(selected,executable)

    def test_windows_ownership_handles_case_drive_and_verbatim_aliases_without_escape(self):
        self.assertTrue(candidate.windows_path_within(r'\\?\D:\OWNED\vault-target\debug\test.exe',r'd:\owned\vault-target'))
        for path in [r'E:\owned\vault-target\test.exe',r'D:\owned\vault-target-other\test.exe',r'D:\owned\vault-target\..\foreign.exe',r'\\server\share\test.exe',r'\\.\GLOBALROOT\test.exe',r'D:relative.exe',r'D:\owned\vault-target\test.exe:stream']:
            with self.subTest(path=path):self.assertFalse(candidate.windows_path_within(path,r'D:\owned\vault-target'))

    def test_vault_json_provenance_rejects_wrong_crate_source_profile_filename_and_outside(self):
        import copy
        target=r'D:\owned\vault-target';row=self.vault_message(target+r'\debug\build\axiom-desktop\hash\out\windows_keyring_acceptance.exe')
        for change in ['package','manifest','source','kind','profile','filenames','outside','basename','duplicate']:
            bad=copy.deepcopy(row)
            if change=='package':bad['package_id']='path+file:///D:/repo/desktop/src-tauri#another-crate@0.1.23'
            elif change=='manifest':bad['manifest_path']=r'D:\other\Cargo.toml'
            elif change=='source':bad['target']['src_path']=r'D:\other\windows_keyring_acceptance.rs'
            elif change=='kind':bad['target']['kind']=['bin']
            elif change=='profile':bad['profile']['test']=False
            elif change=='filenames':bad['filenames']=[target+r'\other.exe']
            elif change=='outside':bad['executable']=r'D:\foreign\windows_keyring_acceptance.exe';bad['filenames']=[bad['executable']]
            elif change=='basename':bad['executable']=target+r'\other.exe';bad['filenames']=[bad['executable']]
            rows=[bad,bad] if change=='duplicate' else [bad]
            with self.subTest(change=change),self.assertRaises(RuntimeError):candidate.select_vault_artifact(rows,target,r'D:\repo\desktop\src-tauri\Cargo.toml',r'D:\repo\desktop\src-tauri\tests\windows_keyring_acceptance.rs','0.1.23')

    def test_vault_file_requires_owned_real_amd64_pe_and_refuses_resolved_escape(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);owned=root/'vault-target';owned.mkdir();inside=owned/'windows_keyring_acceptance.exe';outside=root/'outside.exe'
            data=bytearray(136);data[:2]=b'MZ';data[0x3c:0x40]=(128).to_bytes(4,'little');data[128:132]=b'PE\0\0';data[132:134]=(0x8664).to_bytes(2,'little')
            inside.write_bytes(data);outside.write_bytes(data)
            self.assertEqual(candidate.owned_vault_file(inside,owned),inside.resolve())
            with self.assertRaisesRegex(RuntimeError,'artifact_outside_owned_root'):candidate.owned_vault_file(outside,owned)
            (owned/'linked').symlink_to(root,target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError,'artifact_outside_owned_root'):candidate.owned_vault_file(owned/'linked/outside.exe',owned)
            data[132:134]=(0x14c).to_bytes(2,'little');inside.write_bytes(data)
            with self.assertRaisesRegex(RuntimeError,'artifact_pe_role_mismatch'):candidate.owned_vault_file(inside,owned)

    def test_vault_diagnostics_bound_selected_paths_without_arbitrary_output(self):
        row=self.vault_message(r'\\?\D:\owned\vault-target\debug\windows_keyring_acceptance.exe')
        row['arbitrary']='synthetic-private-do-not-emit'
        proof=candidate.vault_artifact_diagnostics([row],r'D:\owned\vault-target')
        import json
        self.assertNotIn('synthetic-private-do-not-emit',json.dumps(proof));self.assertEqual(proof['candidateCount'],1)
        self.assertTrue(proof['candidates'][0]['insideOwnedRoot']);self.assertLess(len(json.dumps(proof)),16384)

    def test_msi_absence_requires_explicit_unknown_product(self):
        self.assertTrue(candidate.msi_absent(-1))
        for state in [-7,-6,-5,-4,-3,-2,0,1,2,3,4,5]:
            with self.assertRaisesRegex(RuntimeError,'msi_product_not_absent'):
                candidate.msi_absent(state)

    def test_protocol_targets_exact_executable_not_a_path_substring(self):
        exe=r'C:\owned\installed-msi\axiom-desktop.exe'
        self.assertTrue(candidate.protocol_args_match([exe,'%1'],exe))
        for args in [[exe+'-other','%1'],[r'C:\other.exe',exe],[exe],['axiom-desktop.exe','%1'],[exe,'%1','--extra']]:
            self.assertFalse(candidate.protocol_args_match(args,exe))

    def test_absolute_deadline_includes_prelaunch_work_and_one_cleanup_budget(self):
        end=candidate.phase_deadline(100.,90.,30.)
        self.assertEqual(end,100.)
        self.assertEqual(candidate.remaining_milliseconds(end,99.),1000)
        with self.assertRaisesRegex(RuntimeError,'command_deadline_exceeded'):
            candidate.remaining_milliseconds(end,100.)
        self.assertEqual(candidate.phase_deadline(100.,10.,30.),40.)

    def test_source_inventory_uses_owned_bounded_process(self):
        calls=[]
        class Runner:
            def run(self,label,args,cwd,limit):calls.append((label,args,limit));return 'README.md\0'
        with patch.object(candidate,'ROOT',SOURCE.parents[1]),patch.object(candidate,'digest',return_value='synthetic'):
            rows=candidate.source_snapshot(Runner(),{'git.exe':'fixed-git.exe'})
        self.assertEqual(set(rows),{'README.md'});self.assertEqual(calls[0][1][0],'fixed-git.exe');self.assertEqual(calls[0][2],15)

    def test_existing_vault_target_cannot_arm_controller_cleanup(self):
        calls=[]
        class RefusingRunner:
            def run(self,label,*args,**kwargs):calls.append(label);raise RuntimeError('synthetic target already exists')
        with self.assertRaises(RuntimeError):candidate.admit_vault(RefusingRunner(),['fixed.exe','--ignored','--exact'],{},Path('owned'))
        self.assertEqual(calls,['vault-preflight'])

    def test_preexisting_msi_product_is_never_uninstalled_by_refusal(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);installer=base/'owned.msi';installer.write_bytes(b'synthetic')
            class Runner:
                deadline=100.;output=base
                def run(self,*args,**kwargs):raise AssertionError('unowned install/uninstall must not execute')
            with patch.object(candidate,'protocol_state',return_value=[]),patch.object(candidate,'product_state',return_value=5),patch.object(candidate,'require_webview_runtime',return_value={'synthetic':True}):
                with self.assertRaisesRegex(RuntimeError,'msi_product_not_absent'):
                    candidate.install_one(Runner(),{'msiexec.exe':'fixed.exe'},base,'msi',installer,{'sha256':candidate.digest(installer),'ProductCode':'synthetic'},'0.1.23','unused',{'installations':[]})

    def test_emitted_and_saved_receipt_cannot_accept_truncated_proof(self):
        import json
        self.assertTrue(json.loads(candidate.primary_receipt({'accepted':True,'proof':'fixed'}))['accepted'])
        result=json.loads(candidate.primary_receipt({'accepted':True,'proof':'x'*(1024*1024)}))
        self.assertFalse(result['accepted']);self.assertEqual(result['failureCode'],'receipt_output_limit')

    def test_webview_reads_only_fixed_template_paths_value_and_registry_views(self):
        calls=[]
        class Registry:
            HKEY_LOCAL_MACHINE='HKLM';HKEY_CURRENT_USER='HKCU';KEY_READ=1;KEY_WOW64_32KEY=2;KEY_WOW64_64KEY=4;REG_SZ=1
            def OpenKey(self,hive,path,reserved,access):
                calls.append((hive,path,reserved,access))
                class Key:
                    def __enter__(self):return (hive,path,access)
                    def __exit__(self,*args):pass
                return Key()
            def QueryValueEx(self,key,name):
                self_name=name
                if self_name!='pv':raise AssertionError('unexpected value')
                return ('130.0.2849.80',self.REG_SZ)
        reg=Registry();proof=candidate.require_webview_runtime(reg)
        native=r'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
        wow=r'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
        self.assertEqual(calls,[('HKLM',wow,0,5),('HKLM',native,0,5),('HKCU',native,0,5)])
        self.assertTrue(proof['msiSeesInstalledRuntime']);self.assertTrue(proof['nsisSeesInstalledRuntime'])

    def test_only_reviewed_v19_nsis_template_hash_is_admitted(self):
        import json
        root=SOURCE.parents[1];config=json.loads((root/'desktop/src-tauri/tauri.conf.json').read_text())
        candidate.validate_webview_configuration(config,root)
        with tempfile.TemporaryDirectory() as folder:
            fake=Path(folder);path=fake/'desktop/src-tauri/windows/installer.nsi';path.parent.mkdir(parents=True);path.write_text('unreviewed altered template')
            with self.assertRaisesRegex(RuntimeError,'unreviewed_webview_configuration'):candidate.validate_webview_configuration(config,fake)
        with self.assertRaisesRegex(RuntimeError,'unreviewed_webview_configuration'):candidate.validate_webview_configuration(config)

    def test_webview_missing_unknown_bad_type_and_one_installer_only_refuse(self):
        class Registry:
            HKEY_LOCAL_MACHINE='HKLM';HKEY_CURRENT_USER='HKCU';KEY_READ=1;KEY_WOW64_32KEY=2;KEY_WOW64_64KEY=4;REG_SZ=1
            def __init__(self,mode):self.mode=mode
            def OpenKey(self,hive,path,reserved,access):
                if self.mode=='missing' or self.mode=='msi-only' and (hive!='HKLM' or 'WOW6432Node' in path) or self.mode=='user-only' and hive!='HKCU':raise FileNotFoundError()
                if self.mode=='unknown':raise PermissionError()
                class Key:
                    def __enter__(self):return None
                    def __exit__(self,*args):pass
                return Key()
            def QueryValueEx(self,key,name):return ('0.0.0.0' if self.mode=='zero' else '130.0.2849.80',99 if self.mode=='bad-type' else 1)
        for mode in ['missing','unknown','zero','bad-type','msi-only']:
            with self.subTest(mode=mode),self.assertRaises(RuntimeError):candidate.require_webview_runtime(Registry(mode))
        fallback=candidate.require_webview_runtime(Registry('user-only'))
        self.assertEqual(fallback['versions'],{'user64':'130.0.2849.80'})
        self.assertTrue(fallback['msiSeesInstalledRuntime'] and fallback['nsisSeesInstalledRuntime'])

    def test_webview_config_rejects_runtime_updates_custom_templates_and_modes(self):
        candidate.validate_webview_configuration({'bundle':{}})
        for windows in [{'minimumWebview2Version':'999.0.0.0'},{'webviewInstallMode':{'type':'embedBootstrapper'}},{'nsis':{'template':'custom.nsi'}},{'wix':{'template':'custom.wxs'}}]:
            with self.assertRaisesRegex(RuntimeError,'unreviewed_webview_configuration'):candidate.validate_webview_configuration({'bundle':{'windows':windows}})

    def test_missing_runtime_refuses_before_any_installer_or_cleanup(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);installer=base/'owned.exe';installer.write_bytes(b'synthetic')
            class Runner:
                deadline=100.;output=base
                def run(self,*args,**kwargs):raise AssertionError('no installer/uninstaller permitted')
            with patch.object(candidate,'protocol_state',return_value=[]),patch.object(candidate,'require_webview_runtime',side_effect=RuntimeError('webview_runtime_missing')):
                with self.assertRaisesRegex(RuntimeError,'webview_runtime_missing'):
                    candidate.install_one(Runner(),{},base,'nsis',installer,{'sha256':candidate.digest(installer)},'0.1.23','unused',{'installations':[]})

    def test_original_public_owner_pr_source_custody_is_not_external_approval_proof(self):
        import copy
        repo={'id':1130181785,'full_name':candidate.REPOSITORY,'private':False}
        env={'GITHUB_EVENT_NAME':'pull_request','GITHUB_RUN_ATTEMPT':'1','GITHUB_REPOSITORY':candidate.REPOSITORY,'GITHUB_ACTOR':'sahme209','GITHUB_REF':'refs/pull/339/merge','AXIOM_QA_SOURCE_SHA':'a'*40,'GITHUB_SHA':'b'*40}
        event={'number':339,'action':'synchronize','repository':repo,'pull_request':{'number':339,'user':{'login':'sahme209'},'head':{'sha':'a'*40,'ref':'codex/watched-review-corrections','repo':repo},'base':{'ref':'main','repo':repo}}}
        proof=candidate.source_binding(env,event)
        self.assertEqual(proof['sha'],'a'*40);self.assertFalse(proof['externalHumanApprovalProof'])
        for key,value in [('GITHUB_RUN_ATTEMPT','2'),('GITHUB_ACTOR','foreign'),('AXIOM_QA_SOURCE_SHA','b'*40),('GITHUB_REF','refs/pull/340/merge'),('GITHUB_EVENT_NAME','workflow_dispatch')]:
            with self.assertRaises(RuntimeError):candidate.source_binding({**env,key:value},event)
        for change in ['fork','private','base','owner','branch','number']:
            bad=copy.deepcopy(event)
            if change=='fork':bad['pull_request']['head']['repo']['id']=1
            elif change=='private':bad['repository']['private']=True
            elif change=='base':bad['pull_request']['base']['ref']='other'
            elif change=='owner':bad['pull_request']['user']['login']='other'
            elif change=='branch':bad['pull_request']['head']['ref']='other'
            else:bad['number']=340
            with self.assertRaises(RuntimeError):candidate.source_binding(env,bad)

    def test_manifest_excludes_only_itself_and_refuses_escaping_source(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'source.txt').write_text('source')
            rows=candidate.source_members(['source.txt',candidate.REVIEWED_MANIFEST],root)
            self.assertEqual(set(rows),{'source.txt'})
            self.assertEqual(rows['source.txt']['sha256'],candidate.digest(root/'source.txt'))
            for name in ['../source.txt','/source.txt','a/../source.txt',r'a\source.txt']:
                with self.assertRaises(RuntimeError):candidate.source_members([name],root)

    def test_runtime_manifest_custody_digest_and_required_members_are_not_optional(self):
        import json
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);path=root/candidate.REVIEWED_MANIFEST;path.parent.mkdir(parents=True)
            required=['scripts/windows_installed_acceptance.py','scripts/windows_installer_metadata.ps1','.github/workflows/desktop-ci.yml','scripts/windows_upgrade_acceptance.py','scripts/windows_upgrade_snapshot.ps1','scripts/windows_shortcut_collision.ps1','scripts/windows_legacy_acquire.py','desktop/src-tauri/windows/installer.nsi','desktop/package-lock.json','desktop/src-tauri/Cargo.lock','desktop/src-tauri/tauri.conf.json','desktop/src-tauri/tests/windows_keyring_acceptance.rs']
            value={'schema':'axiom.windows-reviewed-files/1','files':{name:{'bytes':1,'sha256':'a'*64} for name in required}}
            path.write_text(json.dumps(value));binding={'manifestSha256':candidate.digest(path)}
            self.assertEqual(candidate.reviewed_manifest(binding,root),value['files'])
            path.write_text(json.dumps({**value,'files':{}}))
            with self.assertRaisesRegex(RuntimeError,'reviewed_manifest_changed'):candidate.reviewed_manifest(binding,root)
            binding={'manifestSha256':candidate.digest(path)}
            with self.assertRaisesRegex(RuntimeError,'reviewed_manifest_incomplete'):candidate.reviewed_manifest(binding,root)

    def test_supported_managed_versions_are_observed_not_preknown_hashes(self):
        for name,text in {'node.exe':'v24.21.0','cargo.exe':'cargo 1.91.0 (abc 2026-01-01)','rustc.exe':'rustc 1.91.0 (abc 2026-01-01)','pwsh.exe':'7.4.1','git.exe':'git version 2.49.0.windows.1','python.exe':'3.12.1','npm':'11.5.0'}.items():
            self.assertTrue(candidate.supported_version(name,text))
        for name,text in [('node.exe','v24.20.0'),('node.exe','v25.0.0'),('rustc.exe','rustc 1.87.0'),('pwsh.exe','8.0.0'),('npm','10.0.0'),('git.exe','git version 2.39.0')]:
            with self.assertRaisesRegex(RuntimeError,'unsupported_managed_tool_version'):candidate.supported_version(name,text)

    def test_locked_tauri_checks_both_packages_and_integrity(self):
        import json
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'desktop').mkdir()
            packages={}
            for name in ['@tauri-apps/cli','@tauri-apps/cli-win32-x64-msvc']:
                packages['node_modules/'+name]={'version':'2.12.4','integrity':'sha512-synthetic','resolved':'https://registry.npmjs.org/'+name+'/-/synthetic.tgz'}
            path=root/'desktop/package-lock.json';path.write_text(json.dumps({'packages':packages}))
            self.assertEqual(len(candidate.locked_tauri(root)),2)
            packages['node_modules/@tauri-apps/cli-win32-x64-msvc']['version']='2.12.5';path.write_text(json.dumps({'packages':packages}))
            with self.assertRaisesRegex(RuntimeError,'tauri_lock_changed'):candidate.locked_tauri(root)

    def test_vendor_inventory_needs_both_real_fixed_tool_families(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            with self.assertRaises(RuntimeError):candidate.vendor_cache_snapshot(root)
            for name in ['WixTools314/candle.exe','WixTools314/light.exe','NSIS/makensis.exe']:
                path=root/name;path.parent.mkdir(exist_ok=True);path.write_bytes(b'synthetic')
            self.assertEqual(len(candidate.vendor_cache_snapshot(root)),3)
            (root/'NSIS/makensis.exe').unlink()
            with self.assertRaises(RuntimeError):candidate.vendor_cache_snapshot(root)

    def test_raw_lf_checkout_policy_is_local_to_qa_checkout_step(self):
        workflow=(SOURCE.parents[1]/'.github/workflows/desktop-ci.yml').read_text()
        job=workflow.split('  windows-installed-candidate:',1)[1]
        checkout=job.split('      - uses: actions/setup-node',1)[0]
        self.assertIn("GIT_CONFIG_COUNT: '1'",checkout)
        self.assertIn('GIT_CONFIG_KEY_0: core.autocrlf',checkout)
        self.assertIn("GIT_CONFIG_VALUE_0: 'false'",checkout)
        self.assertIn('persist-credentials: false',checkout)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}',checkout)
        self.assertNotIn('git config --global',job)
        self.assertNotIn('GIT_CONFIG_',job.split('      - uses: actions/setup-node',1)[1])

    def test_workflow_is_scoped_to_native_qualified_owner_pr_and_no_external_binding_enters_shell(self):
        workflow=(SOURCE.parents[1]/'.github/workflows/desktop-ci.yml').read_text()
        self.assertNotIn('if: ${{ false &&',workflow)
        self.assertIn('needs: windows-native',workflow)
        self.assertIn("github.event_name == 'pull_request'",workflow)
        self.assertIn('github.event.pull_request.number == 339',workflow)
        self.assertIn('AXIOM_QA_SOURCE_SHA: ${{ github.event.pull_request.head.sha }}',workflow)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}',workflow)
        self.assertIn('run: python scripts/windows_installed_acceptance.py',workflow)
        self.assertNotIn('EXPECTED_TOOL_SHA256',SOURCE.read_text())
        self.assertEqual(candidate.EXPECTED_ACTOR,'sahme209');self.assertEqual(candidate.EXPECTED_REF,'refs/heads/codex/watched-review-corrections')
        self.assertTrue(candidate.BUNDLER_RECIPE_REVIEWED)


if __name__ == "__main__":
    unittest.main()
