"""Workflow source guards only. No YAML execution, workflow or child is run."""
from pathlib import Path
import re
import unittest

WORKFLOW=Path(__file__).resolve().parents[2]/'.github/workflows/linux-rust-spawn-diagnostic.yml'

class WorkflowTests(unittest.TestCase):
    def text(self):return WORKFLOW.read_text()
    def test_single_sync_event_without_other_trigger(self):
        text=self.text();self.assertIn('types: [synchronize]',text)
        for forbidden in ['push:','workflow_dispatch:','pull_request_target:','workflow_run:','schedule:','reopened','types: [opened]']:
            self.assertNotIn(forbidden,text)
    def test_both_pr_numbers_exact_prior_head_and_new_head_are_required(self):
        text=self.text()
        for condition in ['github.event.number == 331','github.event.pull_request.number == 331',"github.event.before == '010444b751e6ded03a01a99e772bf925280d3dcf'",'github.event.after == github.event.pull_request.head.sha','github.run_attempt == 1']:
            self.assertIn(condition,text)
    def test_exact_public_repository_base_and_head_are_required(self):
        text=self.text()
        for condition in ["github.repository == 'sahme209/visionxixlabs'",'github.event.repository.private == false',"github.event.pull_request.base.ref == 'main'",'github.event.pull_request.base.repo.full_name == github.repository','github.event.pull_request.head.repo.full_name == github.repository',"github.event.pull_request.head.ref == 'codex/governance-live-qualification-setup'"]:
            self.assertIn(condition,text)
    def test_one_standard_five_minute_readonly_job(self):
        text=self.text();self.assertIn('runs-on: ubuntu-24.04',text);self.assertIn('timeout-minutes: 5',text);self.assertIn('contents: read',text)
        jobs=text.split('jobs:\n',1)[1];self.assertEqual(len(re.findall(r'^  [a-zA-Z][\w-]*:$',jobs,re.M)),1)
        for forbidden in ['matrix:','id-token:','write','secrets.','environment:']:
            self.assertNotIn(forbidden,text)
    def test_checkout_is_actual_head_without_persisted_credentials(self):
        text=self.text();self.assertIn('uses: actions/checkout@v7',text);self.assertIn('ref: ${{ github.event.pull_request.head.sha }}',text);self.assertIn('persist-credentials: false',text)
    def test_only_reviewed_driver_is_invoked(self):
        text=self.text();self.assertIn('AXIOM_PR_HEAD_SHA: ${{ github.event.pull_request.head.sha }}',text)
        self.assertEqual(re.findall(r'^        run: (.*)$',text,re.M),['python3 scripts/governance_rust_spawn_diagnostic.py --approved-ci-once'])
    def test_no_install_network_cache_artifact_or_compiler_workflow(self):
        text=self.text()
        for forbidden in ['apt-get','sudo ','cargo ','rustc ','curl ','wget ','npm ','pip ','upload-artifact@','cache@','linux-time-compile.yml','governance_linux_compile.py','rustup update','rustup install']:
            self.assertNotIn(forbidden,text)
    def test_paths_are_narrow_and_include_only_diagnostic_sources(self):
        text=self.text();paths=re.findall(r"^      - '([^']+)'$",text,re.M)
        self.assertEqual(paths,['scripts/governance_rust_spawn_diagnostic.py','scripts/linux-compile/rust_spawn_fixture.rs','scripts/tests/test_governance_rust_spawn_workflow.py','scripts/tests/test_governance_rust_spawn_diagnostic.py','.github/workflows/linux-rust-spawn-diagnostic.yml'])

if __name__=='__main__':unittest.main()
