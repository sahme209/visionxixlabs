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
    def test_unenrolled_controller_refuses_before_platform_or_account_access(self):
        with patch.object(candidate, "BUNDLER_RECIPE_REVIEWED", False):
            with self.assertRaisesRegex(RuntimeError, "acceptance_not_enrolled"):
                candidate.authority()

    def test_child_environment_drops_credentials_and_injection_options(self):
        env = candidate.child_environment({"Path": "owned-path", "SystemRoot": r"C:\Windows", "GITHUB_TOKEN": "synthetic-do-not-retain", "AWS_SECRET_ACCESS_KEY": "synthetic-do-not-retain", "NODE_OPTIONS": "--require synthetic", "RUSTFLAGS": "synthetic", "TAURI_SIGNING_PRIVATE_KEY": "synthetic-do-not-retain"})
        self.assertEqual(env, {"PATH": "owned-path", "SYSTEMROOT": r"C:\Windows", "CI": "1", "NO_COLOR": "1"})
        with self.assertRaisesRegex(RuntimeError, "extra_environment_refused"):
            candidate.child_environment({}, {"GITHUB_TOKEN": "synthetic"})

    def test_only_fixed_synthetic_vault_fields_can_be_added(self):
        extra = {"AXIOM_WINDOWS_ACCEPTANCE_KEY": "owned-roundtrip-1-2", "AXIOM_WINDOWS_ACCEPTANCE_STAGE": "cleanup"}
        env = candidate.child_environment({}, extra)
        self.assertEqual(env, {"CI": "1", "NO_COLOR": "1", **extra})

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
