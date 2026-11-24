import contextlib
import io
from pathlib import Path
import runpy
import unittest
from unittest.mock import patch


RUNNER = Path(__file__).resolve().parents[1] / "run-platform-governance-postgres.py"


class PlatformGovernancePostgresCliTest(unittest.TestCase):
    def test_help_does_not_create_a_fixture(self):
        output = io.StringIO()
        with patch("sys.argv", [str(RUNNER), "--help"]), patch("tempfile.mkdtemp") as create_fixture:
            with contextlib.redirect_stdout(output), self.assertRaises(SystemExit) as exit_result:
                runpy.run_path(str(RUNNER), run_name="__main__")
        self.assertEqual(exit_result.exception.code, 0)
        self.assertIn("Owned socket-only PostgreSQL", output.getvalue())
        create_fixture.assert_not_called()

    def test_unknown_argument_does_not_create_a_fixture(self):
        errors = io.StringIO()
        with patch("sys.argv", [str(RUNNER), "--unknown"]), patch("tempfile.mkdtemp") as create_fixture:
            with contextlib.redirect_stderr(errors), self.assertRaises(SystemExit) as exit_result:
                runpy.run_path(str(RUNNER), run_name="__main__")
        self.assertEqual(exit_result.exception.code, 2)
        self.assertIn("unrecognized arguments: --unknown", errors.getvalue())
        create_fixture.assert_not_called()


if __name__ == "__main__":
    unittest.main()
