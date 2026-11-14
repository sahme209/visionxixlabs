"""Pure source guards: do not execute YAML, native programs, CI or network."""
from pathlib import Path
import re
import unittest

WORKFLOW=Path(__file__).resolve().parents[2]/'.github/workflows/linux-native-worker-compile.yml'

class NativeWorkerWorkflowTests(unittest.TestCase):
    def text(self):
        self.assertTrue(WORKFLOW.exists(),'approved native worker compile workflow is missing')
        return WORKFLOW.read_text()
    def test_only_single_synchronize_event(self):
        text=self.text();self.assertIn('types: [synchronize]',text)
        for forbidden in ['push:','workflow_dispatch:','pull_request_target:','workflow_run:','schedule:','reopened','types: [opened]']:
            self.assertNotIn(forbidden,text)
    def test_exact_consumed_transition_pr_and_attempt(self):
        text=self.text()
        for condition in ['github.event.number == 332','github.event.pull_request.number == 332',"github.event.before == '048882304e05c4d77ab766f8f2b39db33e676251'",'github.event.after == github.event.pull_request.head.sha','github.run_attempt == 1']:
            self.assertIn(condition,text)
    def test_same_public_repository_main_and_branch(self):
        text=self.text()
        for condition in ["github.repository == 'sahme209/visionxixlabs'",'github.event.repository.private == false',"github.event.pull_request.base.ref == 'main'",'github.event.pull_request.base.repo.full_name == github.repository','github.event.pull_request.head.repo.full_name == github.repository',"github.event.pull_request.head.ref == 'codex/governance-native-worker'"]:
            self.assertIn(condition,text)
    def test_one_standard_readonly_fifteen_minute_job(self):
        text=self.text()
        for required in ['runs-on: ubuntu-24.04','timeout-minutes: 15','contents: read']:
            self.assertIn(required,text)
        jobs=text.split('jobs:\n',1)[1];self.assertEqual(len(re.findall(r'^  [a-zA-Z][\w-]*:$',jobs,re.M)),1)
        for forbidden in ['matrix:','id-token:','secrets.','environment:','contents: write']:
            self.assertNotIn(forbidden,text)
    def test_exact_checkout_has_no_persisted_credentials(self):
        text=self.text()
        for required in ['uses: actions/checkout@v7','ref: ${{ github.event.pull_request.head.sha }}','persist-credentials: false']:
            self.assertIn(required,text)
    def test_only_fixed_combined_controller_runs(self):
        text=self.text();self.assertIn('AXIOM_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}',text)
        self.assertEqual(re.findall(r'^        run: (.*)$',text,re.M),['python3 scripts/governance_native_worker_compile.py --approved-ci-once'])
    def test_no_direct_install_fetch_retry_or_other_workflow(self):
        text=self.text()
        for forbidden in ['apt-get','sudo ','cargo ','rustc ','curl ','wget ','npm ','pip ','upload-artifact@','cache@','uses: ./','rustup update','rustup install','setup-','node ','download-artifact@','governance_linux_compile.py --','governance_cargo_error_diagnostic.py --']:
            self.assertNotIn(forbidden,text)
    def test_narrow_changed_paths(self):
        text=self.text();paths=re.findall(r"^      - '([^']+)'$",text,re.M)
        self.assertEqual(paths,['scripts/governance_native_worker_compile.py','scripts/tests/test_governance_native_worker_workflow.py','.github/workflows/linux-native-worker-compile.yml'])

if __name__=='__main__':unittest.main()
