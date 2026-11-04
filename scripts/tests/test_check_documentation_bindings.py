"""Pure fixture preflight and mocked process-boundary tests; never executes Node."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

SPEC = importlib.util.spec_from_file_location('binding_runner', Path(__file__).parents[1] / 'check-documentation-bindings.py')
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class BindingChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='binding-runner-fixture-', dir=os.environ.get('TMPDIR', '/private/tmp'))
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        directory = self.root / runner.DIRECTORY
        directory.mkdir(parents=True)
        self.test = directory / 'example-bindings.test.cjs'
        self.test.write_text('throw Error("preflight must not import test code");\n')
        self.record = {'path': self.test.relative_to(self.root).as_posix(), 'sha256': hashlib.sha256(self.test.read_bytes()).hexdigest()}
        self.data = {'format': 'axiom.control-binding-checks/1', 'customerEligible': False, 'publicationApproved': False, 'tests': [self.record]}
        self.write()

    def write(self):
        (self.root / runner.REGISTRY).write_text(json.dumps(self.data))

    def test_preflight_reads_hashes_without_import_or_execution(self):
        with patch.object(runner.subprocess, 'Popen') as process:
            self.assertEqual(runner.preflight(self.root), [self.record['path']])
            process.assert_not_called()
        self.test.write_text('changed')
        with self.assertRaisesRegex(RuntimeError, 'hash mismatch'):
            runner.preflight(self.root)

    def test_closed_registry_rejects_schema_duplicate_records_and_duplicate_json_keys(self):
        for change in [lambda d: d.update(extra=True), lambda d: d.update(customerEligible=True), lambda d: d.update(tests=[]), lambda d: d['tests'].append(dict(self.record))]:
            self.data = {'format': 'axiom.control-binding-checks/1', 'customerEligible': False, 'publicationApproved': False, 'tests': [dict(self.record)]}
            change(self.data); self.write()
            with self.assertRaises(RuntimeError):
                runner.preflight(self.root)
        (self.root / runner.REGISTRY).write_text('{"format":1,"format":2}')
        with self.assertRaisesRegex(RuntimeError, 'duplicate JSON key'):
            runner.preflight(self.root)

    def test_traversal_absolute_unknown_and_noncanonical_paths_refuse(self):
        for name in ['../outside.test.cjs', '/etc/passwd', './' + self.record['path'], self.record['path'].replace('/knowledge/', '//knowledge/'), '.', 'docs/product/knowledge/other.test.cjs']:
            self.data['tests'] = [{'path': name, 'sha256': self.record['sha256']}]; self.write()
            with self.assertRaises((RuntimeError, OSError)):
                runner.preflight(self.root)

    def test_symlinked_test_and_parent_refuse(self):
        self.test.unlink(); self.test.symlink_to(self.root / runner.REGISTRY)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            runner.preflight(self.root)
        self.test.unlink(); self.test.write_text('x')
        directory = self.root / runner.DIRECTORY
        moved = directory.with_name('saved-knowledge'); directory.rename(moved); directory.symlink_to(moved, target_is_directory=True)
        with self.assertRaisesRegex(RuntimeError, 'symlink'):
            runner.preflight(self.root)

    def test_new_unregistered_and_missing_matching_tests_refuse(self):
        extra = self.test.with_name('new-bindings.test.cjs'); extra.write_text('x')
        with self.assertRaisesRegex(RuntimeError, 'unregistered or missing'):
            runner.preflight(self.root)
        extra.unlink(); self.test.unlink()
        with self.assertRaises(OSError):
            runner.preflight(self.root)

    def test_unsupported_platform_refuses_without_launch(self):
        with patch.object(runner.platform, 'system', return_value='Linux'), patch.object(runner, 'run_child') as launch:
            with self.assertRaisesRegex(RuntimeError, 'restriction platform'):
                runner.execute(self.root, [self.record['path']])
            launch.assert_not_called()

    def test_fixed_child_command_scrubs_environment_and_retains_failure(self):
        owned = self.root / 'owned'; owned.mkdir()
        with patch.object(runner.platform, 'system', return_value='Darwin'), patch.object(runner.tempfile, 'mkdtemp', return_value=str(owned)), patch.object(runner, 'run_child', return_value=7) as child, patch.dict(os.environ, {'AWS_SECRET_ACCESS_KEY': 'synthetic'}):
            self.assertEqual(runner.execute(self.root, [self.record['path']]), 7)
        command, cwd, env, log = child.call_args.args
        self.assertEqual(command, [str(runner.SANDBOX), '-p', '(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath ' + json.dumps(str(owned)) + '))', str(runner.NODE), '--test', self.record['path']])
        self.assertEqual(cwd, self.root); self.assertNotIn('AWS_SECRET_ACCESS_KEY', env)
        self.assertEqual(env['HOME'], str(owned / 'home')); self.assertEqual(env['TMPDIR'], str(owned / 'tmp'))
        self.assertEqual(env['XDG_CACHE_HOME'], str(owned / 'cache')); self.assertEqual(env['NODE_DISABLE_COMPILE_CACHE'], '1')

    def test_timeout_and_output_cap_kill_only_owned_process_group(self):
        for output, times, reason in [(b'', [0, 61], 'timeout'), (b'x' * runner.OUTPUT_CAP, [0], 'output cap')]:
            with (self.root / 'output.log').open('w+b') as log:
                log.write(output); log.flush()
                process = Mock(pid=987654); events = []
                process.wait.side_effect = lambda **kwargs: events.append('wait')
                with patch.object(runner.subprocess, 'Popen', return_value=process) as spawn, patch.object(runner.time, 'monotonic', side_effect=times), patch.object(runner.os, 'killpg') as kill:
                    kill.side_effect = lambda *args: events.append('kill')
                    with self.assertRaisesRegex(RuntimeError, reason):
                        runner.run_child(['synthetic-command'], self.root, {}, log)
                    kill.assert_called_once_with(process.pid, signal.SIGKILL)
                    process.wait.assert_called_with(timeout=5)
                    self.assertEqual(events, ['kill', 'wait'])
                    self.assertTrue(spawn.call_args.kwargs['start_new_session'])
                    self.assertIs(spawn.call_args.kwargs['preexec_fn'], runner.child_bounds)

    def test_normal_reaped_exit_retains_status_without_signalling_a_reused_group(self):
        with (self.root / 'normal.log').open('w+b') as log:
            process = Mock(pid=987654); process.wait.return_value = 3
            with patch.object(runner.subprocess, 'Popen', return_value=process), patch.object(runner.os, 'killpg') as kill:
                self.assertEqual(runner.run_child(['synthetic-command'], self.root, {}, log), 3)
                kill.assert_not_called(); process.wait.assert_called_once_with(timeout=0.05)

    def test_only_list_cli_option_is_accepted_and_never_launches(self):
        with patch.object(runner.sys, 'argv', ['runner', '--list']), patch.object(runner, 'ROOT', self.root), patch.object(runner, 'execute') as execute:
            self.assertEqual(runner.main(), 0); execute.assert_not_called()
        with patch.object(runner.sys, 'argv', ['runner', '--node', 'unexpected']), patch.object(runner, 'execute') as execute:
            with self.assertRaises(SystemExit):
                runner.main()
            execute.assert_not_called()


if __name__ == '__main__':
    unittest.main()
