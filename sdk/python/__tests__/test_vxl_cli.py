"""
Unit tests for the vxl Python CLI.

Run with:  python3 -m pytest sdk/python/__tests__/test_vxl_cli.py -v
Or with the stdlib unittest runner:  python3 -m unittest sdk.python.__tests__.test_vxl_cli

Tests cover the pure helpers (arg parsing, color, key resolution,
exit-code constants) + the webhook listener's signature handling via
the shared verify_webhook_signature function. Network-touching CLI
subcommands aren't exercised here — they're covered by integration
testing against a live workspace.
"""

from __future__ import annotations

import os
import sys
import time
import unittest
from io import StringIO
from typing import Any, Dict
from unittest.mock import patch

# Make the sibling modules importable.
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, ".."))

import vxl_cli  # noqa: E402
from visionxixlabs import verify_webhook_signature, VXLApiError  # noqa: E402


# ============================ exit-code stability ============================


class ExitCodeStabilityTests(unittest.TestCase):
    """The CLI's exit codes are part of its public contract (CI scripts
    branch on them); these tests pin them so they never silently drift."""

    def test_ok_is_zero(self) -> None:
        self.assertEqual(vxl_cli.EXIT_OK, 0)

    def test_command_failed_is_one(self) -> None:
        self.assertEqual(vxl_cli.EXIT_COMMAND_FAILED, 1)

    def test_bad_invocation_is_two(self) -> None:
        self.assertEqual(vxl_cli.EXIT_BAD_INVOCATION, 2)

    def test_api_error_is_three(self) -> None:
        self.assertEqual(vxl_cli.EXIT_API_ERROR, 3)

    def test_network_error_is_four(self) -> None:
        self.assertEqual(vxl_cli.EXIT_NETWORK_ERROR, 4)

    def test_signature_failed_is_five(self) -> None:
        self.assertEqual(vxl_cli.EXIT_SIGNATURE_FAILED, 5)


# ============================ argparse wiring ============================


class ParserTests(unittest.TestCase):
    def test_parser_requires_subcommand(self) -> None:
        parser = vxl_cli.build_parser()
        with self.assertRaises(SystemExit):
            parser.parse_args([])

    def test_whoami_parses(self) -> None:
        parser = vxl_cli.build_parser()
        args = parser.parse_args(["whoami"])
        self.assertEqual(args.cmd, "whoami")

    def test_gate_parses(self) -> None:
        parser = vxl_cli.build_parser()
        args = parser.parse_args(["gate"])
        self.assertEqual(args.cmd, "gate")

    def test_trigger_requires_repo(self) -> None:
        parser = vxl_cli.build_parser()
        with self.assertRaises(SystemExit):
            parser.parse_args(["trigger", "do a thing"])

    def test_trigger_parses_full(self) -> None:
        parser = vxl_cli.build_parser()
        args = parser.parse_args([
            "trigger",
            "--repo", "acme/example",
            "--branch", "develop",
            "Add",
            "a",
            "/healthz",
            "route",
        ])
        self.assertEqual(args.cmd, "trigger")
        self.assertEqual(args.repo, "acme/example")
        self.assertEqual(args.branch, "develop")
        self.assertEqual(args.instruction, ["Add", "a", "/healthz", "route"])

    def test_runs_list_filter_status(self) -> None:
        parser = vxl_cli.build_parser()
        args = parser.parse_args(["runs", "list", "--status", "running"])
        self.assertEqual(args.runs_cmd, "list")
        self.assertEqual(args.status, "running")

    def test_runs_list_rejects_bad_status(self) -> None:
        parser = vxl_cli.build_parser()
        with self.assertRaises(SystemExit):
            parser.parse_args(["runs", "list", "--status", "garbage"])

    def test_runs_get_requires_id(self) -> None:
        parser = vxl_cli.build_parser()
        with self.assertRaises(SystemExit):
            parser.parse_args(["runs", "get"])

    def test_listen_requires_secret(self) -> None:
        parser = vxl_cli.build_parser()
        with self.assertRaises(SystemExit):
            parser.parse_args(["listen", "--port", "9000"])

    def test_global_json_flag_recognized(self) -> None:
        parser = vxl_cli.build_parser()
        args = parser.parse_args(["--json", "whoami"])
        self.assertTrue(args.json)

    def test_api_key_override(self) -> None:
        parser = vxl_cli.build_parser()
        args = parser.parse_args(["--api-key", "vxlk_test_FAKE_KEY_FAKE", "whoami"])
        self.assertEqual(args.api_key, "vxlk_test_FAKE_KEY_FAKE")


# ============================ API key resolution ============================


class ResolveApiKeyTests(unittest.TestCase):
    def test_explicit_arg_wins(self) -> None:
        # Explicit arg should override even when env var is also set.
        with patch.dict(os.environ, {"VXL_API_KEY": "env_key"}):
            self.assertEqual(vxl_cli.resolve_api_key("explicit_key"), "explicit_key")

    def test_falls_back_to_env(self) -> None:
        with patch.dict(os.environ, {"VXL_API_KEY": "env_key"}):
            self.assertEqual(vxl_cli.resolve_api_key(None), "env_key")

    def test_missing_dies_cleanly(self) -> None:
        # Clear the env var if set, then resolve should sys.exit.
        env = {k: v for k, v in os.environ.items() if k != "VXL_API_KEY"}
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaises(SystemExit) as ctx:
                vxl_cli.resolve_api_key(None)
            self.assertEqual(ctx.exception.code, vxl_cli.EXIT_BAD_INVOCATION)


# ============================ color helper ============================


class ColorTests(unittest.TestCase):
    def test_color_no_op_when_disabled(self) -> None:
        # Force NO_COLOR + non-tty to keep tests deterministic.
        with patch.dict(os.environ, {"NO_COLOR": "1"}):
            self.assertEqual(vxl_cli.color("hello", "\033[32m"), "hello")

    def test_color_wraps_when_enabled(self) -> None:
        env = {k: v for k, v in os.environ.items() if k != "NO_COLOR"}
        with patch.dict(os.environ, env, clear=True):
            with patch("sys.stdout.isatty", return_value=True):
                wrapped = vxl_cli.color("hello", "\033[32m")
                self.assertIn("hello", wrapped)
                self.assertIn("\033[", wrapped)
                self.assertTrue(wrapped.endswith("\033[0m"))


# ============================ webhook signature verification ============================


class WebhookSignatureTests(unittest.TestCase):
    """The listen subcommand depends on verify_webhook_signature from the
    SDK. These tests pin its contract so a future SDK refactor can't
    silently break the CLI's signature check."""

    SECRET = "test_secret_abcdef0123456789"

    def _sign(self, body: str, ts: int) -> str:
        import hmac
        import hashlib
        payload = f"{ts}.{body}".encode("utf-8")
        return hmac.new(self.SECRET.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    def test_valid_signature_passes(self) -> None:
        now = int(time.time())
        body = '{"hello":"world"}'
        sig = self._sign(body, now)
        self.assertTrue(verify_webhook_signature(
            raw_body=body, signature_hex=sig, timestamp_sec=now, secret=self.SECRET,
        ))

    def test_tampered_body_fails(self) -> None:
        now = int(time.time())
        sig = self._sign('{"hello":"world"}', now)
        self.assertFalse(verify_webhook_signature(
            raw_body='{"hello":"WORLD"}',  # uppercase — changed
            signature_hex=sig, timestamp_sec=now, secret=self.SECRET,
        ))

    def test_wrong_secret_fails(self) -> None:
        now = int(time.time())
        body = '{"hello":"world"}'
        sig = self._sign(body, now)
        self.assertFalse(verify_webhook_signature(
            raw_body=body, signature_hex=sig, timestamp_sec=now,
            secret="different_secret",
        ))

    def test_stale_timestamp_fails(self) -> None:
        old = int(time.time()) - 3600  # 1 hour ago, well outside default 5-min tolerance
        body = '{"hello":"world"}'
        sig = self._sign(body, old)
        self.assertFalse(verify_webhook_signature(
            raw_body=body, signature_hex=sig, timestamp_sec=old, secret=self.SECRET,
        ))

    def test_uppercase_signature_still_validates(self) -> None:
        """The SDK lowercases the candidate before constant-time compare,
        so callers passing an uppercase hex still work."""
        now = int(time.time())
        body = '{"hello":"world"}'
        sig = self._sign(body, now)
        self.assertTrue(verify_webhook_signature(
            raw_body=body, signature_hex=sig.upper(),
            timestamp_sec=now, secret=self.SECRET,
        ))


# ============================ handle_api_call exit behavior ============================


class HandleApiCallTests(unittest.TestCase):
    def test_returns_value_on_success(self) -> None:
        out = vxl_cli.handle_api_call(lambda: {"ok": True})
        self.assertEqual(out, {"ok": True})

    def test_api_error_exits_with_3(self) -> None:
        def boom() -> Dict[str, Any]:
            raise VXLApiError(429, "quota_exhausted", "Monthly v1 API quota exhausted.", 100)

        with patch("sys.stderr", new_callable=StringIO):
            with self.assertRaises(SystemExit) as ctx:
                vxl_cli.handle_api_call(boom)
        self.assertEqual(ctx.exception.code, vxl_cli.EXIT_API_ERROR)

    def test_network_error_exits_with_4(self) -> None:
        def boom() -> Dict[str, Any]:
            raise OSError("connection refused")

        with patch("sys.stderr", new_callable=StringIO):
            with self.assertRaises(SystemExit) as ctx:
                vxl_cli.handle_api_call(boom)
        self.assertEqual(ctx.exception.code, vxl_cli.EXIT_NETWORK_ERROR)


if __name__ == "__main__":
    unittest.main()
