import importlib.util
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / 'governance_linux_compile.py'

class CompilerPlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('linux_compile', MODULE)
        cls.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.m)

    def event(self):
        return {'action':'synchronize','number':331,'before':'12d5c45e7883bc50e9142dfa1e38cc1602b77a43','after':'a'*40,'repository':{'full_name':'sahme209/visionxixlabs','private':False},'pull_request':{'number':331,'base':{'ref':'main','repo':{'full_name':'sahme209/visionxixlabs'}},'head':{'ref':'codex/governance-live-qualification-setup','sha':'a'*40,'repo':{'full_name':'sahme209/visionxixlabs'}}}}

    def test_exact_single_sync_transition_for_existing_pr331_only(self):
        event=self.event();self.assertEqual(self.m.validate_event(event,'pull_request','1'),'a'*40)
        import copy
        changes=[('action','opened'),('action','reopened'),('number',332),('before','b'*40),('after','c'*40)]
        for key,value in changes:
            changed=copy.deepcopy(event);changed[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):self.m.validate_event(changed,'pull_request','1')
        for name,attempt in [('pull_request','2'),('pull_request_target','1'),('workflow_dispatch','1')]:
            with self.subTest(name=name,attempt=attempt),self.assertRaises(ValueError):self.m.validate_event(event,name,attempt)

    def test_exact_base_head_repository_branch_and_pr_numbers_are_required(self):
        import copy
        event=self.event()
        for path,value in [(['repository','private'],True),(['repository','full_name'],'outsider/fork'),(['pull_request','number'],332),(['pull_request','base','ref'],'other'),(['pull_request','base','repo','full_name'],'outsider/fork'),(['pull_request','head','ref'],'other'),(['pull_request','head','repo','full_name'],'outsider/fork'),(['pull_request','head','sha'],'b'*40)]:
            changed=copy.deepcopy(event);cursor=changed
            for part in path[:-1]:cursor=cursor[part]
            cursor[path[-1]]=value
            with self.subTest(path=path),self.assertRaises(ValueError):self.m.validate_event(changed,'pull_request','1')
        del event['before']
        with self.assertRaises(ValueError):self.m.validate_event(event,'pull_request','1')

    def test_installed_toolchain_requires_supported_linux(self):
        self.m.validate_rust_version('rustc 1.90.0 (abc)\nrelease: 1.90.0\nhost: x86_64-unknown-linux-gnu\n')
        for value in ['release: 1.84.0\nhost: x86_64-unknown-linux-gnu','release: 1.90.0\nhost: aarch64-apple-darwin','release: 1.90.0-nightly\nhost: x86_64-unknown-linux-gnu']:
            with self.assertRaises(ValueError): self.m.validate_rust_version(value)

    def test_native_lib_tokens_are_not_shell_text(self):
        self.assertEqual(self.m.native_libraries('note: native-static-libs: -lgcc_s -lutil -lrt -lpthread -lm -ldl -lc\n'), ['-lgcc_s','-lutil','-lrt','-lpthread','-lm','-ldl','-lc'])
        for text in ['note: native-static-libs: -lc;echo owned','note: native-static-libs: /tmp/evil.a','note: native-static-libs: -lssl','note: native-static-libs: -lc\nnote: native-static-libs: -lc']:
            with self.assertRaises(ValueError): self.m.native_libraries(text)

    def test_feature_guard_uses_actual_root(self):
        self.m.verify_feature_tree('clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) daemon\nbon v3.8.1 default\n')
        for line in ['clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) algorithm,daemon','clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) daemon,test-side-by-side','clock-bound v3.0.0-rc.0 (/owned/source/clock-bound) ','other v1 daemon']:
            with self.assertRaises(ValueError): self.m.verify_feature_tree(line)

    def test_clean_environment_rejects_ambient_injection(self):
        env=self.m.clean_environment(Path('/owned'),Path('/tools/rustc'),Path('/tools/rustdoc'))
        self.assertEqual(env['RUSTC'],'/tools/rustc')
        self.assertEqual(env['PATH'],'/usr/bin:/bin')
        self.assertNotIn('GITHUB_TOKEN',env)
        self.assertNotIn('RUSTFLAGS',env)
        self.assertNotIn('LD_PRELOAD',env)
        self.assertEqual(env['CARGO_NET_RETRY'],'0')

    def test_core_commands_are_real_daemon_staticlib(self):
        cmd=self.m.core_command(Path('/tools/cargo'))
        self.assertIn('staticlib',cmd)
        self.assertIn('--offline',cmd)
        self.assertIn('daemon',cmd)
        self.assertEqual(cmd[cmd.index('--package')+1],'clock-bound')
        self.assertEqual(cmd[cmd.index('--')+1:],['-C','link-dead-code=yes','--print','native-static-libs'])
        self.assertNotIn('--all-features',cmd)
        self.assertNotIn('--workspace',cmd)

    def test_complete_native_symbols_required(self):
        symbols='\n'.join('00000000 T '+s for s in ['axiom_time_publish_or_die','axiom_time_capture_v2','axiom_time_capture_current','axiom_time_capture_release','clock_bound::daemon::Daemon::construct_axiom','clock_bound::daemon::time_publication_adapter::NativeTimePublisher::publish_precise_then_delegate'])
        self.m.verify_symbols(symbols)
        with self.assertRaises(ValueError): self.m.verify_symbols(symbols.replace('axiom_time_capture_v2','absent'))
        with self.assertRaises(ValueError): self.m.verify_symbols(symbols.replace(' T axiom_time_publish_or_die',' U axiom_time_publish_or_die'))

    def test_source_inventory_refuses_mutation_or_extra_files(self):
        import tempfile, hashlib
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'Cargo.lock').write_bytes(b'locked')
            inventory=(('Cargo.lock',hashlib.sha256(b'locked').hexdigest(),6),)
            self.m.verify_source(root,inventory)
            (root/'injected').write_bytes(b'code')
            with self.assertRaises(ValueError): self.m.verify_source(root,inventory)
            (root/'injected').unlink();(root/'Cargo.lock').write_bytes(b'changed')
            with self.assertRaises(ValueError): self.m.verify_source(root,inventory)

    def test_final_link_uses_actual_c_object_without_intermediate_archive(self):
        cmd=self.m.link_command(Path('/usr/bin/cc'),Path('/owned/native'),Path('/owned/libclock_bound.a'),['-lc'])
        end=cmd.index('-Wl,--no-whole-archive')
        self.assertIn('/owned/native/time_publication.o',cmd)
        self.assertGreater(cmd.index('/owned/native/time_publication.o'),end)
        self.assertNotIn('/owned/native/libaxiom_time.a',cmd)
        self.assertNotIn('shell',cmd)

    def test_workflow_is_one_approved_public_linux_job(self):
        workflow=(MODULE.parents[1]/'.github/workflows/linux-time-compile.yml').read_text()
        self.assertIn('types: [synchronize]',workflow)
        for required in ['github.event.number == 331','github.event.pull_request.number == 331',"github.event.pull_request.base.ref == 'main'","github.event.before == '12d5c45e7883bc50e9142dfa1e38cc1602b77a43'",'github.event.after == github.event.pull_request.head.sha']:
            self.assertIn(required,workflow)
        self.assertIn('runs-on: ubuntu-24.04',workflow)
        self.assertIn('timeout-minutes: 45',workflow)
        self.assertIn('github.run_attempt == 1',workflow)
        self.assertIn('persist-credentials: false',workflow)
        self.assertIn('contents: read',workflow)
        for forbidden in ['pull_request_target:','workflow_dispatch:','types: [opened]','upload-artifact@','cache@','id-token:','secrets.','sudo ','apt-get ','rustup update','workflow_run:']:
            self.assertNotIn(forbidden,workflow)

    def test_restricted_command_is_fixed_launcher_exec_not_unshare(self):
        self.assertEqual(self.m.restricted_command(Path('/owned/native/network_launcher'),['/tools/cargo','--fixed']),['/owned/native/network_launcher','--','/tools/cargo','--fixed'])
        for argv in [['relative'],[],['/fixed','bad\0argument']]:
            with self.assertRaises(ValueError):self.m.restricted_command(Path('/owned/native/network_launcher'),argv)

    def test_fixture_result_requires_all_exact_real_preflight_categories(self):
        good='local-file:ok\nchild-exec:ok\nnetwork-denials:ok\nselector-denials:ok\n'
        self.m.validate_fixture_result(good)
        for text in [good+'extra\n',good.replace('network-denials:ok','network-denials:skipped'),good.replace('child-exec:ok\n','')]:
            with self.assertRaises(ValueError):self.m.validate_fixture_result(text)

    def test_actual_compiled_filter_description_is_strict_and_matches_named_profile(self):
        import copy,json
        header='#define AXIOM_ALLOWED_SYSCALLS(X)\n X(read)\n X(write)\n\n'
        good={'format':1,'target':'linux-x86_64','arch':3221225534,'defaultErrno':1,'clone3Errno':38,'allowlist':['read','write'],'instructions':[{'code':6,'jt':0,'jf':0,'k':327681}]}
        result=self.m.validate_filter_description(json.dumps(good),header)
        self.assertEqual(result['programSha256'],__import__('hashlib').sha256(json.dumps(good,sort_keys=True,separators=(',',':')).encode()).hexdigest())
        for key,value in [('format',2),('target','other'),('allowlist',['read']),('defaultErrno',0),('clone3Errno',0),('instructions',[])]:
            bad=copy.deepcopy(good);bad[key]=value
            with self.subTest(key=key),self.assertRaises(ValueError):self.m.validate_filter_description(json.dumps(bad),header)
        bad=copy.deepcopy(good);bad['instructions'][0]['jt']=999
        with self.assertRaises(ValueError):self.m.validate_filter_description(json.dumps(bad),header)
        with self.assertRaises(ValueError):self.m.validate_filter_description(json.dumps(good)[:-1]+',"format":1}',header)

    def test_first_tool_or_header_digest_cannot_be_rebound(self):
        import tempfile,hashlib
        with tempfile.TemporaryDirectory() as directory:
            tool=Path(directory)/'installed-tool';tool.write_bytes(b'original');frozen={}
            self.m.add_frozen(frozen,tool);original=dict(frozen);self.m.add_frozen(frozen,tool)
            tool.write_bytes(b'replacement')
            with self.assertRaises(ValueError):self.m.add_frozen(frozen,tool)
            self.assertEqual(frozen,original)
            with self.assertRaises(ValueError):self.m.add_frozen({},tool,hashlib.sha256(b'original').hexdigest())

    def test_frozen_packet_cannot_be_replaced_with_matching_new_inputs(self):
        import tempfile, json, hashlib
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);files={}
            for index in range(8):
                name=f'input-{index}';(root/name).write_bytes(b'old')
                files[name]=hashlib.sha256(b'old').hexdigest()
            packet=json.dumps({'kind':'one-sync-pr331-linux-direct-object-v3','files':files}).encode()
            (root/'packet.json').write_bytes(packet)
            with patch.object(self.m,'PACKET','packet.json'):
                self.m.verify_packet(root,packet)
                (root/'input-0').write_bytes(b'new')
                files['input-0']=hashlib.sha256(b'new').hexdigest()
                (root/'packet.json').write_text(json.dumps({'kind':'one-sync-pr331-linux-direct-object-v3','files':files}))
                with self.assertRaises(ValueError): self.m.verify_packet(root,packet)

if __name__ == '__main__': unittest.main()
