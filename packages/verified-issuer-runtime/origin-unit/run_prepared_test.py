"""Synthetic host command responses only; NEVER register or load XPC."""
import contextlib,hashlib,importlib.util,io,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('prepared',Path(__file__).with_name('run_prepared.py'))
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class HostOrchestration(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='axiom-origin-host-model-');self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name);self.root.chmod(0o700);self.app=self.root/'Axiom Origin Unit.app';self.app.mkdir()
        file=self.app/'fixed';file.write_text('fixture')
        manifest={'root':str(self.root),'app':str(self.app),'controllerRequirementMatchesBrokerConfig':True,'brokerRequirement':'synthetic','files':{'Axiom Origin Unit.app/fixed':hashlib.sha256(file.read_bytes()).hexdigest()}}
        path=self.root/'manifest.json';path.write_text(json.dumps(manifest));self.digest=hashlib.sha256(path.read_bytes()).hexdigest()
        self.calls=[];self.failure=None;self.initialStatus=0;self.registered=False;self.afterRegister=1;self.loaded=False;self.bundleMismatch=False;self.lostAck=False

    def fake(self,argv,seconds):
        operation=argv[-1] if '--test-reviewed-unit' not in argv else 'probe';self.calls.append(operation)
        if argv[0]=='/bin/launchctl':return {'exit':0 if self.loaded else 113,'timeout':False,'stdout':'','stderr':''}
        if operation=='--register-reviewed-unit' and self.lostAck:return {'exit':None,'timeout':True,'stdout':'','stderr':'synthetic lost acknowledgement'}
        if operation.startswith('--'):
            data={'exactCallingBundle':not self.bundleMismatch,'bundleURL':str(self.app),'executableURL':str(self.app/'Contents/MacOS/AxiomOriginRegistrationHost'),'bundleIdentifier':'com.visionxixlabs.axiom.origin-unit.app','status':1 if self.registered else self.initialStatus}
            if operation=='--register-reviewed-unit':
                data.update(registrationSucceeded=operation!=self.failure,postStatus=self.afterRegister)
                if operation!=self.failure:self.registered=True
            if operation=='--unregister-reviewed-unit':
                data.update(unregistrationSucceeded=operation!=self.failure)
                if operation!=self.failure:self.registered=False;self.initialStatus=0
            return {'exit':70 if operation==self.failure else 0,'timeout':False,'stdout':json.dumps(data),'stderr':''}
        return {'exit':70 if operation==self.failure else 0,'timeout':False,'stdout':'component_observed; executingIssuerIdentity=unavailable\n' if operation=='probe' else '', 'stderr':''}

    def run_model(self):
        with patch.object(runner,'ROOT',self.root),patch.object(runner,'MANIFEST_SHA',self.digest),patch.object(runner,'command',self.fake),contextlib.redirect_stdout(io.StringIO()):runner.main()

    def test_success_unregisters_and_keeps_claim(self):
        self.run_model();self.assertTrue((self.root/'host-experiment-claim.json').exists());self.assertTrue(json.loads((self.root/'host-experiment-result.json').read_text())['cleanupVerified'])
    def test_notfound_is_diagnostic_register_must_succeed(self):
        self.initialStatus=3;self.run_model();self.assertIn('--register-reviewed-unit',self.calls)
    def test_failed_register_never_unregisters_or_probes(self):
        self.failure='--register-reviewed-unit'
        with self.assertRaises(AssertionError):self.run_model()
        self.assertNotIn('--unregister-reviewed-unit',self.calls);self.assertNotIn('probe',self.calls)
    def test_lost_register_ack_never_unregisters_or_probes(self):
        self.lostAck=True
        with self.assertRaises(AssertionError):self.run_model()
        self.assertNotIn('--unregister-reviewed-unit',self.calls);self.assertNotIn('probe',self.calls)
    def test_owned_requiresapproval_cleans_up_without_probe(self):
        self.afterRegister=2
        with self.assertRaises(AssertionError):self.run_model()
        self.assertIn('--unregister-reviewed-unit',self.calls);self.assertNotIn('probe',self.calls)
    def test_owned_unknown_status_cleans_up_without_probe(self):
        self.afterRegister=3
        with self.assertRaises(AssertionError):self.run_model()
        self.assertIn('--unregister-reviewed-unit',self.calls);self.assertNotIn('probe',self.calls)
    def test_failed_probe_still_unregisters(self):
        self.failure='probe'
        with self.assertRaises(AssertionError):self.run_model()
        self.assertIn('--unregister-reviewed-unit',self.calls)
    def test_consumed_claim_refuses_registration(self):
        (self.root/'host-experiment-claim.json').write_text('consumed')
        with self.assertRaises(FileExistsError):self.run_model()
        self.assertNotIn('--register-reviewed-unit',self.calls)
    def test_cleanup_unknown_is_not_success(self):
        self.failure='--unregister-reviewed-unit'
        with self.assertRaisesRegex(AssertionError,'cleanup_unknown'):self.run_model()
    def test_pending_status_never_registers_and_saves_preclaim_failure(self):
        self.initialStatus=2
        with self.assertRaises(AssertionError):self.run_model()
        self.assertNotIn('--register-reviewed-unit',self.calls);self.assertFalse((self.root/'host-experiment-claim.json').exists());self.assertEqual(json.loads((self.root/'host-experiment-result.json').read_text())['phase'],'refused_or_unknown_no_retry')
    def test_enabled_preexisting_status_never_registers(self):
        self.initialStatus=1
        with self.assertRaises(AssertionError):self.run_model()
        self.assertNotIn('--register-reviewed-unit',self.calls);self.assertNotIn('--unregister-reviewed-unit',self.calls)
    def test_loaded_service_never_registers(self):
        self.loaded=True
        with self.assertRaises(AssertionError):self.run_model()
        self.assertNotIn('--register-reviewed-unit',self.calls)
    def test_wrong_bundle_never_registers(self):
        self.bundleMismatch=True
        with self.assertRaises(AssertionError):self.run_model()
        self.assertNotIn('--register-reviewed-unit',self.calls)
    def test_previous_result_never_overwritten_or_replayed(self):
        path=self.root/'host-experiment-result.json';path.write_text('preserved_unknown')
        with self.assertRaises(FileExistsError):self.run_model()
        self.assertEqual(path.read_text(),'preserved_unknown');self.assertEqual(self.calls,[])
    def test_manifest_failure_saved_without_claim(self):
        (self.root/'manifest.json').write_text('changed')
        with self.assertRaises(AssertionError):self.run_model()
        self.assertTrue((self.root/'host-experiment-result.json').exists());self.assertFalse((self.root/'host-experiment-claim.json').exists());self.assertEqual(self.calls,[])

if __name__=='__main__':unittest.main()
