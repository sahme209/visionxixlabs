#!/usr/bin/env python3
"""
vxl — VisionXIXLabs command-line interface.

A single-file Python CLI that wraps the v1 API surface and ships a
local webhook receiver with HMAC-SHA256 signature verification. Zero
external dependencies beyond the stdlib + the sibling visionxixlabs.py
SDK.

Install:

    # Drop sdk/python/vxl_cli.py + sdk/python/visionxixlabs.py somewhere
    # on $PATH and chmod +x:
    chmod +x sdk/python/vxl_cli.py
    ln -s "$(pwd)/sdk/python/vxl_cli.py" /usr/local/bin/vxl

Usage:

    export VXL_API_KEY="vxlk_live_…"

    vxl whoami                                # confirm auth + workspace
    vxl gate                                  # release-gate verdict; exit 1 on blocked
    vxl trigger --repo acme/example "Add /healthz route"
    vxl runs list --status running --limit 5
    vxl runs get <runId>
    vxl listen --port 8080 --secret <endpoint-secret>

Every subcommand accepts `--json` to emit machine-readable output for
piping into jq / scripts. Exit codes are stable:

    0   success
    1   command-level failure (gate blocked, run failed, etc.)
    2   bad CLI invocation (missing args, etc.)
    3   API error (4xx / 5xx — message printed to stderr)
    4   network / transport error
    5   webhook signature verification failed (listen subcommand)

Designed to drop into CI:

    if ! vxl gate; then
        echo "Quality gate blocked — refusing to deploy."
        exit 1
    fi
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import http.server
import json
import os
import sys
import time
import uuid
from typing import Any, Dict, NoReturn, Optional

# The sibling SDK file is part of this package; import it relative to
# this script's directory so the CLI works no matter where it's symlinked.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _THIS_DIR)
from visionxixlabs import VisionXIXLabs, VXLApiError, verify_webhook_signature  # noqa: E402

# ============================ exit codes ============================

EXIT_OK = 0
EXIT_COMMAND_FAILED = 1
EXIT_BAD_INVOCATION = 2
EXIT_API_ERROR = 3
EXIT_NETWORK_ERROR = 4
EXIT_SIGNATURE_FAILED = 5

# ============================ helpers ============================

ANSI_GREEN = "\033[32m"
ANSI_RED = "\033[31m"
ANSI_AMBER = "\033[33m"
ANSI_CYAN = "\033[36m"
ANSI_DIM = "\033[2m"
ANSI_BOLD = "\033[1m"
ANSI_RESET = "\033[0m"


def _color_enabled() -> bool:
    """Disable ANSI colors when piping or when NO_COLOR is set."""
    if os.environ.get("NO_COLOR"):
        return False
    return sys.stdout.isatty()


def color(s: str, code: str) -> str:
    if not _color_enabled():
        return s
    return f"{code}{s}{ANSI_RESET}"


def die(msg: str, exit_code: int = EXIT_BAD_INVOCATION) -> NoReturn:
    sys.stderr.write(color(f"vxl: {msg}\n", ANSI_RED))
    sys.exit(exit_code)


def emit_json(obj: Any) -> None:
    """Print canonical JSON to stdout; for piping into jq."""
    print(json.dumps(obj, indent=2, sort_keys=True, default=str))


def resolve_api_key(explicit: Optional[str]) -> str:
    if explicit:
        return explicit
    key = os.environ.get("VXL_API_KEY")
    if not key:
        die(
            "no API key. Set VXL_API_KEY in the environment or pass --api-key.",
        )
    return key


def make_client(api_key: Optional[str], base_url: Optional[str]) -> VisionXIXLabs:
    return VisionXIXLabs(
        api_key=resolve_api_key(api_key),
        base_url=base_url or os.environ.get("VXL_API_BASE", "https://visionxixlabs.com"),
    )


def handle_api_call(fn: Any) -> Dict[str, Any]:
    """Wrap an SDK call so VXLApiError + network errors map to clean exits."""
    try:
        return fn()  # type: ignore[no-any-return]
    except VXLApiError as e:
        sys.stderr.write(color(
            f"vxl: API error {e.status} ({e.code}): {e.message}\n", ANSI_RED,
        ))
        if e.retry_after_seconds:
            sys.stderr.write(color(
                f"     retry-after: {e.retry_after_seconds}s\n", ANSI_DIM,
            ))
        sys.exit(EXIT_API_ERROR)
    except OSError as e:
        sys.stderr.write(color(f"vxl: network error: {e}\n", ANSI_RED))
        sys.exit(EXIT_NETWORK_ERROR)


# ============================ subcommands ============================


def cmd_whoami(args: argparse.Namespace) -> None:
    client = make_client(args.api_key, args.base_url)
    data = handle_api_call(client.whoami)
    if args.json:
        emit_json(data)
        return
    api_key = data.get("apiKey", {})
    org = data.get("organization", {})
    quota = data.get("quota", {})
    print(color("Workspace", ANSI_BOLD))
    print(f"  id:        {color(str(org.get('id', '?')), ANSI_CYAN)}")
    print(f"  plan tier: {org.get('planTier', '?')}")
    print()
    print(color("API key", ANSI_BOLD))
    print(f"  id:        {api_key.get('id', '?')}")
    print(f"  env:       {api_key.get('env', '?')}")
    print(f"  scopes:    {', '.join(api_key.get('scopes', []))}")
    print()
    print(color("Quota", ANSI_BOLD))
    limit = quota.get("monthlyLimit")
    current = quota.get("currentCalls", 0)
    remaining = quota.get("remaining")
    near_limit = bool(quota.get("nearLimit"))
    limit_str = f"{limit:,}" if isinstance(limit, int) else "unlimited"
    remaining_str = f"{remaining:,}" if isinstance(remaining, int) else "∞"
    badge = color("NEAR LIMIT", ANSI_AMBER) if near_limit else color("healthy", ANSI_GREEN)
    print(f"  monthly:   {current:,} / {limit_str}  ·  remaining {remaining_str}  ·  {badge}")


def cmd_gate(args: argparse.Namespace) -> None:
    """Release-gate check. Exits 1 when blocked — designed for CI deploy gating."""
    client = make_client(args.api_key, args.base_url)
    data = handle_api_call(client.release_gate)
    if args.json:
        emit_json(data)
        # Even in --json mode the exit code reflects the verdict.
        if not data.get("hasRun"):
            sys.exit(EXIT_OK)
        gate = data.get("gate") or {}
        sys.exit(EXIT_OK if gate.get("passed") else EXIT_COMMAND_FAILED)
        return

    if not data.get("hasRun"):
        print(color("No eval runs completed yet for this workspace.", ANSI_DIM))
        sys.exit(EXIT_OK)
    gate = data.get("gate") or {}
    passed = bool(gate.get("passed"))
    pass_rate = gate.get("passRate", 0)
    avg_score = gate.get("averageScore", 0)
    summary = gate.get("summary", "")
    badge = color("PASSED", ANSI_GREEN) if passed else color("BLOCKED", ANSI_RED)
    print(f"{badge}  pass rate {pass_rate * 100:.1f}%  ·  avg score {avg_score:.2f}")
    print(color(summary, ANSI_DIM))
    blockers = gate.get("blockers") or []
    if blockers:
        print()
        print(color("Blockers:", ANSI_BOLD))
        for b in blockers:
            print(f"  · {color(b.get('kind', '?'), ANSI_AMBER)}  {b.get('message', '')}")
    sys.exit(EXIT_OK if passed else EXIT_COMMAND_FAILED)


def cmd_trigger(args: argparse.Namespace) -> None:
    if not args.instruction:
        die("missing instruction. Pass it as the last positional arg.")
    if not args.repo:
        die("--repo is required (e.g. owner/name).")
    client = make_client(args.api_key, args.base_url)
    instruction = " ".join(args.instruction).strip()
    idempotency_key = args.idempotency_key or f"vxl_cli_{uuid.uuid4()}"
    data = handle_api_call(lambda: client.start_coding_run(
        instruction=instruction,
        repo_ref=args.repo,
        branch_hint=args.branch,
        metadata={"_via": "vxl_cli", "_idem_source": "cli"},
    ))
    # Note: visionxixlabs.start_coding_run() currently sends no idempotency
    # header; the CLI generates one here for visibility/debug.
    data["_clientIdempotencyKey"] = idempotency_key
    if args.json:
        emit_json(data)
        return
    print(color("✓ Run started", ANSI_GREEN))
    print(f"  runId:           {color(data.get('runId', '?'), ANSI_CYAN)}")
    print(f"  correlationId:   {data.get('correlationId', '?')}")
    print(f"  status:          {data.get('status', '?')}")
    print(f"  pollUrl:         {data.get('pollUrl', '?')}")
    print(f"  idempotencyKey:  {color(idempotency_key, ANSI_DIM)}")


def cmd_runs_list(args: argparse.Namespace) -> None:
    client = make_client(args.api_key, args.base_url)
    data = handle_api_call(lambda: client.list_pipeline_runs(
        limit=args.limit,
        cursor=args.cursor,
        status=args.status,
    ))
    if args.json:
        emit_json(data)
        return
    runs = data.get("runs", [])
    if not runs:
        print(color("(no runs)", ANSI_DIM))
        return
    # 6-col table.
    rows = [("RUN ID", "PIPELINE", "STATUS", "STAGES", "STARTED", "TRIGGERED BY")]
    for r in runs:
        rows.append((
            str(r.get("id", ""))[:18] + "…",
            str(r.get("pipelineId", "")),
            str(r.get("status", "")),
            str(r.get("stageCount", 0)),
            str(r.get("startedAt", ""))[:19],
            str(r.get("triggeredBy", ""))[:24],
        ))
    widths = [max(len(row[i]) for row in rows) for i in range(len(rows[0]))]
    for i, row in enumerate(rows):
        line = "  ".join(cell.ljust(widths[idx]) for idx, cell in enumerate(row))
        if i == 0:
            print(color(line, ANSI_BOLD))
        else:
            status = row[2]
            if status == "succeeded":
                print(color(line, ANSI_GREEN))
            elif status == "failed":
                print(color(line, ANSI_RED))
            elif status == "running":
                print(color(line, ANSI_CYAN))
            else:
                print(line)
    nxt = data.get("nextCursor")
    if nxt:
        print()
        print(color(f"next cursor: {nxt}", ANSI_DIM))


def cmd_runs_get(args: argparse.Namespace) -> None:
    if not args.run_id:
        die("run id is required.")
    client = make_client(args.api_key, args.base_url)
    data = handle_api_call(lambda: client.pipeline_run(args.run_id))
    if args.json:
        emit_json(data)
        return
    run = data.get("run", {})
    print(color(f"Run {run.get('id', '?')}", ANSI_BOLD))
    print(f"  status:      {run.get('status', '?')}")
    print(f"  pipelineId:  {run.get('pipelineId', '?')}")
    print(f"  startedAt:   {run.get('startedAt', '?')}")
    print(f"  completedAt: {run.get('completedAt', '—')}")
    if run.get("errorSummary"):
        print(f"  {color('error:', ANSI_RED)}     {run.get('errorSummary')}")
    print()
    print(color("Stages", ANSI_BOLD))
    for s in run.get("stages", []):
        status = s.get("status", "?")
        ord_str = str(s.get("ordering", 0)).rjust(2, "0")
        status_colored = (
            color(status, ANSI_GREEN) if status == "succeeded" else
            color(status, ANSI_RED)   if status == "failed" else
            color(status, ANSI_CYAN)  if status == "running" else
            status
        )
        print(f"  {ord_str}  {s.get('stageKind', '?'):20}  {status_colored}")
        if s.get("errorMessage"):
            print(color(f"      {s.get('errorMessage')}", ANSI_RED))


# ============================ webhook listener ============================


def cmd_connectors(args: argparse.Namespace) -> None:
    """`vxl connectors` — Phase 410. Print per-connector health.

    Exit codes:
      0  every connector healthy
      1  one or more connectors in any non-healthy status
    """
    client = make_client(args.api_key, args.base_url)
    # The SDK doesn't have a typed connectorsHealth() helper yet on the
    # Python side; call the raw endpoint via the private _get hook.
    data = handle_api_call(lambda: client._get("/api/v1/connectors/health"))  # noqa: SLF001
    if args.json:
        emit_json(data)
    else:
        summary = data.get("summary", {})
        connectors = data.get("connectors", [])
        print(color("Connector health", ANSI_BOLD))
        print(
            "  "
            + color(f"healthy={summary.get('healthy', 0)}", ANSI_GREEN) + "  "
            + color(f"degraded={summary.get('degraded', 0)}", ANSI_AMBER) + "  "
            + color(f"stale={summary.get('stale', 0)}", ANSI_AMBER) + "  "
            + color(f"auth_failed={summary.get('auth_failed', 0)}", ANSI_RED) + "  "
            + color(f"rate_limited={summary.get('rate_limited', 0)}", ANSI_AMBER),
        )
        print()
        for c in connectors:
            status = c.get("status", "?")
            tone = (
                ANSI_GREEN if status == "healthy"
                else ANSI_RED if status == "auth_failed"
                else ANSI_AMBER
            )
            print(f"  {color(status.ljust(13), tone)} {c.get('name', '?')}  {color(c.get('category', '?'), ANSI_DIM)}")
            print(f"    {color(c.get('reason', ''), ANSI_DIM)}")
        print()
    alerts = sum(
        int(data.get("summary", {}).get(k, 0))
        for k in ("degraded", "stale", "auth_failed", "rate_limited")
    )
    sys.exit(EXIT_COMMAND_FAILED if alerts > 0 else EXIT_OK)


def cmd_events_tail(args: argparse.Namespace) -> None:
    """`vxl events tail` — Phase 410. Stream live SSE frames to stdout.

    Subscribes to /api/v1/events/stream using stdlib http.client so we
    don't take a `requests` dependency. Exits cleanly on Ctrl-C; otherwise
    runs forever, reconnecting on connection drop.
    """
    import http.client
    import urllib.parse

    base = (args.base_url or os.environ.get("VXL_API_BASE", "https://visionxixlabs.com"))
    parsed = urllib.parse.urlparse(base)
    if parsed.scheme not in ("http", "https"):
        die(f"bad base URL: {base}")
    host = parsed.hostname or "visionxixlabs.com"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = "/api/v1/events/stream"
    if args.subscribe:
        path += f"?subscribe={urllib.parse.quote(args.subscribe)}"

    api_key = resolve_api_key(args.api_key)

    def stream_once() -> None:
        conn = (
            http.client.HTTPSConnection(host, port, timeout=300)
            if parsed.scheme == "https"
            else http.client.HTTPConnection(host, port, timeout=300)
        )
        try:
            conn.request("GET", path, headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "text/event-stream",
            })
            res = conn.getresponse()
            if res.status != 200:
                sys.stderr.write(color(f"vxl: stream open failed: HTTP {res.status}\n", ANSI_RED))
                sys.exit(EXIT_API_ERROR)

            buffer = ""
            while True:
                chunk = res.read1(4096) if hasattr(res, "read1") else res.read(4096)
                if not chunk:
                    break
                buffer += chunk.decode("utf-8", errors="replace")
                while "\n\n" in buffer:
                    frame, _, buffer = buffer.partition("\n\n")
                    event = "message"
                    data_lines: list = []
                    for line in frame.split("\n"):
                        if line.startswith("event: "):
                            event = line[7:]
                        elif line.startswith("data: "):
                            data_lines.append(line[6:])
                    if not data_lines:
                        continue
                    raw = "\n".join(data_lines)
                    if args.json:
                        print(json.dumps({"event": event, "data": json.loads(raw)}))
                    else:
                        tone = ANSI_GREEN if event == "stream.ready" else (
                            ANSI_CYAN if event == "heartbeat" else ANSI_AMBER
                        )
                        ts = time.strftime("%H:%M:%S")
                        print(f"[{color(ts, ANSI_DIM)}] {color(event.ljust(28), tone)}{raw}")
                    sys.stdout.flush()
        finally:
            conn.close()

    backoff = 1
    while True:
        try:
            stream_once()
            backoff = 1  # clean close — reset backoff
        except KeyboardInterrupt:
            sys.exit(EXIT_OK)
        except OSError as e:
            sys.stderr.write(color(f"vxl: stream dropped ({e}); reconnecting in {backoff}s\n", ANSI_AMBER))
            time.sleep(backoff)
            backoff = min(30, backoff * 2)


def cmd_listen(args: argparse.Namespace) -> None:
    """
    Run a local HTTP server that receives webhook deliveries from the
    platform and verifies each one's HMAC-SHA256 signature.

    Useful in dev to confirm webhooks arrive with valid signatures
    before wiring up your real receiver. Press Ctrl-C to stop.
    """
    if not args.secret:
        die("--secret is required. Pass the secret minted with the endpoint.")

    secret = args.secret
    port = args.port

    class WebhookHandler(http.server.BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args: Any) -> None:  # silence default logging
            return

        def do_POST(self) -> None:  # noqa: N802
            length = int(self.headers.get("Content-Length") or 0)
            raw_body = self.rfile.read(length).decode("utf-8", errors="replace")
            sig_hex = self.headers.get("X-VXL-Signature") or ""
            ts_str = self.headers.get("X-VXL-Timestamp") or "0"
            event_id = self.headers.get("X-VXL-Event-Id") or ""
            event_kind = self.headers.get("X-VXL-Event-Type") or ""
            attempt = self.headers.get("X-VXL-Attempt") or "?"

            try:
                ts_sec = int(ts_str)
            except ValueError:
                ts_sec = 0

            valid = verify_webhook_signature(
                raw_body=raw_body,
                signature_hex=sig_hex,
                timestamp_sec=ts_sec,
                secret=secret,
            )

            ts_local = time.strftime("%H:%M:%S", time.localtime())
            badge = color(" VALID ", ANSI_GREEN) if valid else color(" INVALID ", ANSI_RED)
            print(f"[{ts_local}] {badge}  {event_kind}  attempt={attempt}  event_id={event_id}")

            if args.verbose or not valid:
                try:
                    parsed = json.loads(raw_body) if raw_body else {}
                    if args.json:
                        print(json.dumps(parsed, indent=2, sort_keys=True))
                    else:
                        # Compact: just the event type + data summary
                        data = parsed.get("data", {})
                        if isinstance(data, dict):
                            for k, v in list(data.items())[:6]:
                                print(f"    {color(str(k), ANSI_DIM)}: {v}")
                except Exception:  # noqa: BLE001
                    print(color(f"    (body unparseable, {len(raw_body)} bytes)", ANSI_DIM))

            if valid:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
            else:
                self.send_response(401)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok":false,"error":"bad_signature"}')

    server = http.server.HTTPServer(("0.0.0.0", port), WebhookHandler)
    print(color(
        f"vxl listen  ·  port {port}  ·  verifying signatures with secret prefix {secret[:8]}…",
        ANSI_CYAN,
    ))
    print(color(
        "register this URL on the web admin panel as the endpoint, then trigger any event:",
        ANSI_DIM,
    ))
    print(color(
        f"  http://<your-tunnel-or-public-host>:{port}/",
        ANSI_DIM,
    ))
    print(color("Ctrl-C to stop.", ANSI_DIM))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print()
        print(color("stopped.", ANSI_DIM))
        sys.exit(EXIT_OK)


# ============================ argparse wiring ============================


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="vxl",
        description="VisionXIXLabs command-line interface (Python).",
    )
    parser.add_argument("--api-key", help="Override VXL_API_KEY for this call.")
    parser.add_argument("--base-url", help="Override VXL_API_BASE (default visionxixlabs.com).")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("whoami", help="Confirm auth + show workspace/quota.")

    sub.add_parser("gate", help="Print release-gate verdict. Exits 1 on blocked.")

    p_trig = sub.add_parser("trigger", help="Trigger an ai_coding pipeline run.")
    p_trig.add_argument("--repo", required=True, help="Repository, e.g. owner/name.")
    p_trig.add_argument("--branch", default=None, help="Branch hint (default main).")
    p_trig.add_argument("--idempotency-key", default=None, help="Override the auto-generated UUID.")
    p_trig.add_argument("instruction", nargs="+", help="Free-form instruction text.")

    p_runs = sub.add_parser("runs", help="Pipeline runs surface.")
    p_runs_sub = p_runs.add_subparsers(dest="runs_cmd", required=True)
    p_runs_list = p_runs_sub.add_parser("list", help="List recent pipeline runs.")
    p_runs_list.add_argument("--limit", type=int, default=10)
    p_runs_list.add_argument("--cursor", default=None)
    p_runs_list.add_argument(
        "--status",
        choices=["running", "succeeded", "failed", "awaiting_approval"],
        default=None,
    )
    p_runs_get = p_runs_sub.add_parser("get", help="Show one run + its stages.")
    p_runs_get.add_argument("run_id", help="Run id (vxl runs list to find one).")

    sub.add_parser(
        "connectors",
        help="Phase 410 — per-connector health. Exits 1 if any non-healthy.",
    )

    p_events = sub.add_parser("events", help="Live event stream commands.")
    p_events_sub = p_events.add_subparsers(dest="events_cmd", required=True)
    p_events_tail = p_events_sub.add_parser(
        "tail",
        help="Subscribe to the SSE stream (Phase 409) and print frames to stdout.",
    )
    p_events_tail.add_argument(
        "--subscribe",
        default=None,
        help="Comma-separated StreamEventKind filter, e.g. 'approvals.snapshot,heartbeat'.",
    )

    p_listen = sub.add_parser(
        "listen",
        help="Run a local HTTP server that verifies inbound webhook signatures.",
    )
    p_listen.add_argument("--port", type=int, default=8080)
    p_listen.add_argument("--secret", required=True, help="Endpoint secret (minted with the endpoint).")
    p_listen.add_argument("--verbose", "-v", action="store_true", help="Print body of every delivery.")

    return parser


def dispatch(args: argparse.Namespace) -> None:
    if args.cmd == "whoami":
        return cmd_whoami(args)
    if args.cmd == "gate":
        return cmd_gate(args)
    if args.cmd == "trigger":
        return cmd_trigger(args)
    if args.cmd == "runs":
        if args.runs_cmd == "list":
            return cmd_runs_list(args)
        if args.runs_cmd == "get":
            return cmd_runs_get(args)
    if args.cmd == "connectors":
        return cmd_connectors(args)
    if args.cmd == "events":
        if args.events_cmd == "tail":
            return cmd_events_tail(args)
    if args.cmd == "listen":
        return cmd_listen(args)
    die(f"unknown command: {args.cmd}")


def main(argv: Optional[list] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    dispatch(args)


# Internal helpers for the test suite to import without invoking argparse.
__all__ = [
    "build_parser",
    "dispatch",
    "resolve_api_key",
    "color",
    "_color_enabled",
    "EXIT_OK",
    "EXIT_COMMAND_FAILED",
    "EXIT_API_ERROR",
    "EXIT_NETWORK_ERROR",
    "EXIT_SIGNATURE_FAILED",
    "EXIT_BAD_INVOCATION",
]


# Silence unused-import warning for hmac/hashlib — kept available for
# scripts that import this module's surface area.
_ = hmac, hashlib


if __name__ == "__main__":
    main()
