"""Synthetic host command responses only; NEVER register or load XPC."""
import contextlib,hashlib,importlib.util,io,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('prepared',Path(__file__).with_name('run_prepared.py'))
runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)

class HostOrchestration(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory(prefix='axiom-origin-host-model-')
        self.addCleanup(self.temporary.cleanup)
        self.root=Path(self.temporary.name);self.root.chmod(0o700)
        self.app=self.root/'app';self.app.mkdir();file=self.app/'fixed';file.write_text('fixture')
        manifest={'root':str(self.root),'app':str(self.app),'controllerRequirementMatchesBrokerConfig':True,'brokerRequirement':'synthetic','files':{'app/fixed':hashlib.sha256(file.read_bytes()).hexdigest()}}
        path=self.root/'manifest.json';path.write_text(json.dumps(manifest))
        self.digest=hashlib.sha256(path.read_bytes()).hexdigest()
        self.calls=[];self.failure=None

    def fake(self,argv,seconds):
        operation=argv[-1] if '--test-reviewed-unit' not in argv else 'probe'
        self.calls.append(operation)
        if argv[0]=='/bin/launchctl':return {'exit':113,'timeout':False,'stdout':'','stderr':'not loaded'}
        if operation=='--status-reviewed-unit':return {'exit':0,'timeout':False,'stdout':'0\n','stderr':''}
        if operation==self.failure:return {'exit':70,'timeout':False,'stdout':'','stderr':'synthetic refusal'}
        return {'exit':0,'timeout':False,'stdout':'component_observed; executingIssuerIdentity=unavailable\n' if operation=='probe' else '', 'stderr':''}

    def run_model(self):
        with patch.object(runner,'ROOT',self.root),patch.object(runner,'MANIFEST_SHA',self.digest),patch.object(runner,'command',self.fake),contextlib.redirect_stdout(io.StringIO()):runner.main()

    def test_success_unregisters_and_keeps_claim(self):
        self.run_model();self.assertTrue((self.root/'host-experiment-claim.json').exists())
        result=json.loads((self.root/'host-experiment-result.json').read_text());self.assertTrue(result['cleanupVerified'])

    def test_failed_register_still_unregisters_without_probe(self):
        self.failure='--register-reviewed-unit'
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
        self.assertTrue((self.root/'host-experiment-claim.json').exists())

if __name__=='__main__':unittest.main()
