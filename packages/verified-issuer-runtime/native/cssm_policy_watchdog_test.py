"""Pure mocked controller logic; no subprocess/file preflight/Security invocation."""
import unittest
from unittest.mock import patch
import cssm_policy_watchdog as w

class ControllerTests(unittest.TestCase):
    def test_terminal_precedence(self):
        self.assertEqual(w.observation(10, 0, 0), 'unknown-timeout')
        self.assertEqual(w.observation(1, 2049, 0), 'unknown-output-overflow')
        self.assertEqual(w.observation(1, 2048, 0), 'completed')
        self.assertEqual(w.observation(1, 0, 1), 'completed')
        self.assertEqual(w.observation(1, 0, -9), 'unknown-child-failure')
        self.assertEqual(w.observation(1, 0, None), 'pending')

    def test_unreviewed_packet_blocks_launch(self):
        with patch.object(w, 'binding', return_value={'mode': 0o600, 'sha256': 'unreviewed'}), patch.object(w.subprocess, 'Popen') as launch:
            with self.assertRaises(ValueError):
                w.preflight()
            launch.assert_not_called()

if __name__ == '__main__':
    unittest.main()

class AcyclicPacketTests(unittest.TestCase):
    def test_stable_identity_ignores_atime(self):
        from types import SimpleNamespace
        a = SimpleNamespace(st_dev=1, st_ino=2, st_uid=501, st_gid=20,
                            st_mode=0o100600, st_nlink=1, st_size=3,
                            st_mtime_ns=4, st_ctime_ns=5, st_atime_ns=6)
        b = SimpleNamespace(**{**vars(a), 'st_atime_ns': 99})
        self.assertEqual(w.stable_stat(a), w.stable_stat(b))

    def test_packet_rejects_controller_self_binding(self):
        with self.assertRaisesRegex(ValueError, 'controller-external-binding'):
            w.validate_records([{'path': str(w.Path(w.__file__).resolve())}])

    def test_only_declared_mode_and_ctime_may_transition(self):
        a = {'path': w.HELPER, 'uid': 501, 'mode': 0o600, 'dev': 1,
             'ino': 2, 'size': 3, 'mtime_ns': 4, 'ctime_ns': 5, 'sha256': 'abc'}
        b = {**a, 'mode': 0o700, 'ctime_ns': 9}
        self.assertTrue(w.mode_transition_matches(a, b, 0o700))
        for key in ('ino', 'sha256', 'mtime_ns'):
            self.assertFalse(w.mode_transition_matches(a, {**b, key: 'changed'}, 0o700))
        self.assertFalse(w.mode_transition_matches(a, {**b, 'mode': 0o777}, 0o700))

    def test_cli_does_not_launch_by_default(self):
        with patch.object(w, 'RUN') as run:
            self.assertEqual(w.main([]), 2)
            self.assertEqual(w.main(['--help']), 2)
            run.assert_not_called()

class MockedModeTests(unittest.TestCase):
    def test_exact_owned_helper_transition_and_restoration(self):
        from types import SimpleNamespace
        a = {'path': w.HELPER, 'uid': 501, 'mode': 0o600, 'dev': 1,
             'ino': 2, 'size': 3, 'mtime_ns': 4, 'ctime_ns': 5, 'sha256': 'abc'}
        active = {**a, 'mode': 0o700, 'ctime_ns': 8}
        restored = {**a, 'ctime_ns': 9}
        held = SimpleNamespace(st_dev=1, st_ino=2, st_uid=501, st_mode=0o100600)
        with patch.object(w, 'binding', side_effect=[a, active, restored]), patch.object(w.os, 'open', return_value=123), patch.object(w.os, 'fstat', return_value=held), patch.object(w.os, 'fchmod') as mode, patch.object(w.os, 'close') as close, patch.object(w.subprocess, 'Popen') as launch:
            with w.execution_mode(a) as observed:
                self.assertEqual(observed, active)
            self.assertEqual(mode.call_args_list, [unittest.mock.call(123, 0o700), unittest.mock.call(123, 0o600)])
            close.assert_called_once_with(123)
            launch.assert_not_called()

    def test_mode_restored_when_body_refuses(self):
        from types import SimpleNamespace
        a = {'path': w.HELPER, 'uid': 501, 'mode': 0o600, 'dev': 1,
             'ino': 2, 'size': 3, 'mtime_ns': 4, 'ctime_ns': 5, 'sha256': 'abc'}
        held = SimpleNamespace(st_dev=1, st_ino=2, st_uid=501, st_mode=0o100600)
        with patch.object(w, 'binding', side_effect=[a, {**a, 'mode': 0o700}, a]), patch.object(w.os, 'open', return_value=123), patch.object(w.os, 'fstat', return_value=held), patch.object(w.os, 'fchmod') as mode, patch.object(w.os, 'close'), patch.object(w.subprocess, 'Popen') as launch:
            with self.assertRaisesRegex(ValueError, 'simulated'):
                with w.execution_mode(a):
                    raise ValueError('simulated')
            self.assertEqual(mode.call_args_list, [unittest.mock.call(123, 0o700), unittest.mock.call(123, 0o600)])
            launch.assert_not_called()
