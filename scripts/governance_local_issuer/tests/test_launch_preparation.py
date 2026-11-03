from pathlib import Path
import os
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import launcher

class EnvironmentBoundaryTests(unittest.TestCase):
    def test_compile_cache_loader_control_refuses_before_package_observation(self):
        with patch.dict(os.environ,{'NODE_COMPILE_CACHE':'/caller-selected-cache'},clear=True), patch.object(launcher,'verify_package') as observe:
            result=launcher.preflight_launch('/missing')
            self.assertEqual(result['reasons'],['loader_or_self_report_override'])
            observe.assert_not_called()
            self.assertFalse(result['executionAuthorized'])



from dataclasses import FrozenInstanceError
import json
import tempfile
import subprocess
from governance_local_issuer import launch_preparation as preparation, manifest

class LaunchPreparationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='axiom-handoff-unit-',dir='/private/tmp')
        self.root=Path(self.temp.name).resolve()
        for name,data in {
            '.next/BUILD_ID':b'fixture-build',
            '.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}',
            'node_modules/next/dist/bin/next':b'fixture compiled CLI',
            '__axiom_runtime__/node':b'SYNTHETIC runtime bytes; not an executing Node',
            'node_modules/external/index.js':b'module.exports=1',
            preparation.MAIN_RELATIVE:b'SYNTHETIC canonical main; not an issuer',
            '.next/server/app/route.js.nft.json':b'{"version":1,"files":["../../../node_modules/external"]}',
        }.items():
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        (self.root/preparation.NODE_RELATIVE).chmod(0o755)
        self.save()
    def tearDown(self):self.temp.cleanup()
    def save(self):manifest.write_manifest(self.root,{'sourceRevision':'a'*40,'archiveSha256':'b'*64,'buildReceiptSha256':'c'*64,'materializationReceiptSha256':'d'*64},'v24.21.0')
    def prepare(self,**kw):return preparation.prepare_launch(self.root,inherited_environment={},**kw)
    def test_closed_fixture_prepares_fixed_paths_without_any_process_creation(self):
        with patch.object(subprocess,'Popen') as spawn,patch.object(os,'execve') as execute:
            plan=self.prepare();contract=plan.review_contract()
        spawn.assert_not_called();execute.assert_not_called()
        self.assertEqual(plan.argv,(str(self.root/preparation.NODE_RELATIVE),str(self.root/preparation.MAIN_RELATIVE)))
        self.assertEqual(contract['cwd'],str(self.root));self.assertEqual(contract['qualification'],'preparation_only')
        self.assertFalse(contract['executionAuthorized']);self.assertEqual(contract['executingIssuerIdentity'],'unavailable')
        self.assertNotIn('issuerArtifactDigest',contract)
    def test_spawn_stub_consumes_only_symbolic_readonly_stdin_and_owned_pipe_plan(self):
        calls=[]
        def spawn_stub(contract):
            self.assertEqual(contract['argv'],[str(self.root/preparation.NODE_RELATIVE),str(self.root/preparation.MAIN_RELATIVE)])
            self.assertTrue(contract['close_fds']);self.assertFalse(contract['shell']);self.assertEqual(contract['pass_fds'],[])
            stdin,stdout,stderr=contract['descriptorInstructions']
            self.assertEqual((stdin['operation'],stdin['source']),('open_readonly','/dev/null'))
            self.assertEqual(stdin['flags']&os.O_ACCMODE,os.O_RDONLY)
            self.assertTrue(stdin['flags']&os.O_NOFOLLOW);self.assertTrue(stdin['flags']&os.O_CLOEXEC)
            for instruction,role in [(stdout,'stdout'),(stderr,'stderr')]:
                self.assertEqual(instruction,{'operation':'create_anonymous_pipe','role':role,'source':'launcher_owned_child_write','flags':None})
            calls.append(contract)
        # Closed-package verification below performs only its existing readonly reads.
        plan=self.prepare()
        with patch.object(os,'open') as real_open,patch.object(os,'pipe') as real_pipe,patch.object(subprocess,'Popen') as real_spawn:
            spawn_stub(plan.review_contract())
        real_open.assert_not_called();real_pipe.assert_not_called();real_spawn.assert_not_called();self.assertEqual(len(calls),1)
        # This stub proves a contract, not descriptor inheritance or NoWrite.
    def test_fixed_environment_drops_credentials_and_unknown_values_without_echo(self):
        values={'AWS_SECRET_ACCESS_KEY':'DO-NOT-LEAK','DATABASE_URL':'DO-NOT-LEAK','PATH':'/attacker/bin','HOME':'/attacker/home','UNRECOGNIZED':'DO-NOT-LEAK'}
        plan=preparation.prepare_launch(self.root,inherited_environment=values);values['PATH']='/changed'
        self.assertEqual(dict(plan.environment),dict(preparation.CLEAN_ENVIRONMENT));self.assertNotIn('DO-NOT-LEAK',json.dumps(plan.review_contract()))
    def test_all_loader_and_cache_names_refuse_without_package_observation(self):
        for key in ['NODE_OPTIONS','NODE_PATH','NODE_COMPILE_CACHE','NODE_EXTRA_CA_CERTS','NODE_FUTURE_HOOK','DYLD_INSERT_LIBRARIES','LD_PRELOAD','V8_COVERAGE','TS_NODE_PROJECT','PYTHONPATH','AXIOM_ISSUER_READY']:
            with self.subTest(key=key),patch.object(preparation,'verify_package') as observe:
                with self.assertRaisesRegex(manifest.PackageUnavailable,'loader_or_self_report_override'):
                    preparation.prepare_launch(self.root,inherited_environment={key:'SENSITIVE'})
                observe.assert_not_called()
    def test_caller_argv_cwd_env_stdio_and_inherited_fds_are_not_configuration(self):
        for options in [{'argv':['--require','evil.js']},{'cwd':'/tmp'},{'env':{}},{'stdin':3},{'pass_fds':[4]},{'shell':True},{'unknown':True}]:
            with self.subTest(options=options),patch.object(preparation,'verify_package') as observe:
                with self.assertRaisesRegex(manifest.PackageUnavailable,'caller_launch_options_forbidden'):self.prepare(caller_options=options)
                observe.assert_not_called()
    def test_partial_tampered_or_extra_package_refuses(self):
        target=self.root/'node_modules/external/index.js';original=target.read_bytes();target.write_bytes(b'changed')
        with self.assertRaises(manifest.PackageUnavailable):self.prepare()
        target.write_bytes(original);extra=self.root/'unexpected.js';extra.write_bytes(b'extra')
        with self.assertRaises(manifest.PackageUnavailable):self.prepare()
    def test_root_alias_and_traversal_refuse(self):
        alias=self.root.parent/(self.root.name+'-alias');alias.symlink_to(self.root,target_is_directory=True)
        try:
            for raw in [alias,str(self.root)+'/../'+self.root.name]:
                with self.subTest(raw=str(raw)),self.assertRaisesRegex(manifest.PackageUnavailable,'canonical_package_root_required'):
                    preparation.prepare_launch(raw,inherited_environment={})
        finally:alias.unlink()
    def test_even_a_manifest_bound_main_symlink_is_not_the_fixed_canonical_entrypoint(self):
        main=self.root/preparation.MAIN_RELATIVE;main.unlink();main.symlink_to('../../external/index.js');(self.root/manifest.MANIFEST).unlink();self.save()
        with self.assertRaisesRegex(manifest.PackageUnavailable,'fixed_canonical_entrypoint_required'):self.prepare()
    def test_immutable_plan_and_fresh_review_copy_cannot_reconfigure_handoff(self):
        plan=self.prepare()
        with self.assertRaises(FrozenInstanceError):plan.shell=True
        contract=plan.review_contract();contract['env']['NODE_OPTIONS']='evil';contract['pass_fds'].append(9)
        fresh=plan.review_contract();self.assertNotIn('NODE_OPTIONS',fresh['env']);self.assertEqual(fresh['pass_fds'],[])
    def test_malformed_environment_metadata_refuses_without_disclosing_values(self):
        for inherited in [[],{1:'bad'},{'BAD':'ok','NODE_OPTIONS':1},{'A=B':'SECRET'}]:
            with self.subTest(inherited_type=type(inherited).__name__),self.assertRaisesRegex(manifest.PackageUnavailable,'invalid_environment_metadata'):
                preparation.prepare_launch(self.root,inherited_environment=inherited)
    def test_existing_launch_entry_still_refuses_and_never_consumes_the_prepared_contract(self):
        self.prepare()
        with patch.dict(os.environ,{},clear=True),patch.object(subprocess,'Popen') as spawn,patch.object(os,'execve') as execute:
            with self.assertRaisesRegex(manifest.PackageUnavailable,'verified_preimport_launch_unavailable'):launcher.launch_verified_next(self.root)
        spawn.assert_not_called();execute.assert_not_called()

class RecordedMetadataTests(unittest.TestCase):
    def valid(self):return {'format':'axiom.recorded-handoff/1','stdin':{'kind':'vnode','path':'/dev/null','access':'read_only','close_on_exec':True},'stdout':{'kind':'anonymous_pipe','owner':'launcher','endpoint':'child_write','close_on_exec':True},'stderr':{'kind':'anonymous_pipe','owner':'launcher','endpoint':'child_write','close_on_exec':True},'close_fds':True,'pass_fds':[],'shell':False,'extra_descriptors':[]}
    def test_recorded_shape_never_becomes_native_or_process_qualification(self):
        observation=preparation.decode_recorded_handoff(self.valid());self.assertEqual(observation.qualification,'recorded_handoff_shape_only');self.assertFalse(observation.execution_authorized);self.assertEqual(observation.executing_issuer_identity,'unavailable')
    def test_writable_stdio_named_fifo_inherited_fds_unknowns_and_fake_booleans_refuse(self):
        changes=[lambda r:r['stdin'].update(access='read_write'),lambda r:r['stdout'].update(kind='vnode'),lambda r:r['stderr'].update(kind='named_fifo'),lambda r:r['stdout'].update(owner='caller'),lambda r:r['pass_fds'].append(4),lambda r:r['extra_descriptors'].append({'fd':9}),lambda r:r.update(extra='grant'),lambda r:r['stdin'].update(close_on_exec=1),lambda r:r.update(close_fds=1)]
        for change in changes:
            raw=self.valid();change(raw)
            with self.subTest(raw_keys=sorted(raw)),self.assertRaisesRegex(manifest.PackageUnavailable,'recorded_handoff_unavailable'):preparation.decode_recorded_handoff(raw)

if __name__=='__main__':unittest.main()
