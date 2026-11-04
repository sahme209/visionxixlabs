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
