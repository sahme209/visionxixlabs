#!/usr/bin/env bash
# axiom-release-gate.sh — drop-in CI helper. Wraps the Python CLI's
# `vxl gate` and `vxl connectors` checks with concise exit semantics so
# any shell-based CI (Jenkins, CircleCI, GitLab, etc.) can block on the
# platform's quality gate without taking a Python dep beyond what's
# already in /usr/bin.
#
# Usage:
#   VXL_API_KEY=vxlk_live_… ./scripts/axiom-release-gate.sh
#
# Exit codes:
#   0 — gate passed, every connector healthy
#   1 — gate blocked OR a connector is non-healthy
#   2 — bad invocation (missing API key, etc)
#   3 — API error (4xx / 5xx)
#   4 — network error

set -euo pipefail

if [[ -z "${VXL_API_KEY:-}" ]]; then
  echo "axiom-release-gate: VXL_API_KEY is unset." >&2
  exit 2
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
CLI="${SCRIPT_DIR}/../sdk/python/vxl_cli.py"

if [[ ! -x "${CLI}" ]]; then
  chmod +x "${CLI}"
fi

echo "→ axiom-release-gate · release-gate check"
"${CLI}" gate
GATE_EXIT=$?

echo "→ axiom-release-gate · connector health check"
set +e
"${CLI}" connectors
CONN_EXIT=$?
set -e

if [[ "${GATE_EXIT}" -ne 0 ]]; then
  echo "axiom-release-gate: release gate BLOCKED — refusing to ship." >&2
  exit 1
fi

if [[ "${CONN_EXIT}" -ne 0 ]]; then
  echo "axiom-release-gate: one or more connectors are non-healthy — refusing to ship." >&2
  exit 1
fi

echo "✓ axiom-release-gate: gate passed, every connector healthy."
exit 0
