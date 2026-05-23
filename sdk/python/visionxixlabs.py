"""
visionxixlabs.py — Phase 399.

Drop-in Python client for the VisionXIXLabs v1 API.
Python 3.9+. Zero external dependencies — uses only the stdlib
(urllib + hmac + hashlib). For higher-throughput integrations,
swap urllib for httpx; the surface stays identical.

Usage:

    from visionxixlabs import VisionXIXLabs, verify_webhook_signature

    client = VisionXIXLabs(api_key=os.environ["VXL_API_KEY"])

    # 1. 3-line integration test:
    me = client.whoami()
    print(f"Signed in as {me['organization']['id']} on {me['organization']['planTier']}")

    # 2. Read the release-gate verdict (CI deploy gate):
    gate = client.release_gate()
    if not gate.get("gate", {}).get("passed"):
        sys.exit(1)

    # 3. Trigger a coding run:
    run = client.start_coding_run(
        instruction="Add a /healthz route",
        repo_ref="acme/example",
        branch_hint="main",
    )

    # 4. Verify a webhook (in your receiver):
    ok = verify_webhook_signature(
        raw_body=request.body,
        signature_hex=request.headers["X-VXL-Signature"],
        timestamp_sec=int(request.headers["X-VXL-Timestamp"]),
        secret=YOUR_ENDPOINT_SECRET,
    )
"""

from __future__ import annotations

import hmac
import hashlib
import json
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional


class VXLApiError(Exception):
    """Raised when the API returns a non-2xx status."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        retry_after_seconds: Optional[int] = None,
    ) -> None:
        super().__init__(f"HTTP {status} · {code} · {message}")
        self.status = status
        self.code = code
        self.message = message
        self.retry_after_seconds = retry_after_seconds


class VisionXIXLabs:
    """Synchronous v1 client. Async users: wrap each call in `asyncio.to_thread`."""

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://visionxixlabs.com",
        timeout_seconds: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    # ------------------------------- endpoints

    def whoami(self) -> Dict[str, Any]:
        """GET /api/v1/whoami — verifies the key + reports workspace + quota."""
        return self._get("/api/v1/whoami")

    def release_gate(self) -> Dict[str, Any]:
        """GET /api/v1/release-gate — current release-gate verdict."""
        return self._get("/api/v1/release-gate")

    def pipeline_run(self, run_id: str) -> Dict[str, Any]:
        """GET /api/v1/pipelines/runs/{id} — poll a run's status."""
        return self._get(f"/api/v1/pipelines/runs/{run_id}")

    def start_coding_run(
        self,
        instruction: str,
        repo_ref: str,
        branch_hint: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """POST /api/v1/pipelines/runs — trigger a coding pipeline run."""
        body: Dict[str, Any] = {
            "pipelineId": "ai_coding",
            "instruction": instruction,
            "repoRef": repo_ref,
        }
        if branch_hint:
            body["branchHint"] = branch_hint
        if metadata:
            body["metadata"] = metadata
        return self._post("/api/v1/pipelines/runs", body)

    # ------------------------------- internals

    def _get(self, path: str) -> Dict[str, Any]:
        return self._execute("GET", path, None)

    def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        return self._execute("POST", path, body)

    def _execute(
        self, method: str, path: str, body: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        data: Optional[bytes] = None
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "VisionXIXLabs-Python/1.0",
        }
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            status = e.code
            code = "http_error"
            message = raw or f"HTTP {status}"
            retry_after = None
            try:
                parsed = json.loads(raw)
                if isinstance(parsed.get("error"), str):
                    code = parsed["error"]
                if isinstance(parsed.get("message"), str):
                    message = parsed["message"]
            except Exception:
                pass
            retry_header = e.headers.get("Retry-After") if e.headers else None
            if retry_header:
                try:
                    retry_after = int(retry_header)
                except ValueError:
                    retry_after = None
            raise VXLApiError(status, code, message, retry_after) from None


# ============================ webhook verification ============================

def verify_webhook_signature(
    raw_body: str,
    signature_hex: str,
    timestamp_sec: int,
    secret: str,
    tolerance_seconds: int = 300,
    now: Optional[float] = None,
) -> bool:
    """
    Verify the HMAC-SHA256 signature on an inbound webhook delivery.

    Returns True only when both the signature matches AND the timestamp
    is within the tolerance window. Uses `hmac.compare_digest` for
    constant-time comparison.
    """
    current = now if now is not None else time.time()
    skew = abs(int(current) - timestamp_sec)
    if skew > tolerance_seconds:
        return False

    payload = f"{timestamp_sec}.{raw_body}".encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_hex.lower())
