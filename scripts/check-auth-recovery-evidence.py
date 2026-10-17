#!/usr/bin/env python3
"""Offline, fail-closed production authentication recovery evidence gate.

Consumes a sanitized, independently collected JSON attestation. This tool
never accesses a provider, handles credentials, or authorizes a deployment.
"""
import argparse
import json
import pathlib
import re
import sys
from urllib.parse import urlparse

IDENTIFIERS = (
    "deployment_id", "deployment_commit", "vercel_project_id",
    "effective_database_project_id", "effective_database_branch_id",
    "neon_project_id", "neon_branch_id",
)
GATES = (
    "migration_history_verified", "schema_drift_checked",
    "restore_point_verified", "isolated_restore_verified",
    "production_login_verified",
)
# These observations must have separate evidence, not merely a self-asserted true.
EVIDENCE_GATES = ("effective_database_binding_verified",) + GATES


def valid_reference(value):
    if not isinstance(value, str) or not value.strip():
        return False
    parsed = urlparse(value)
    return (parsed.scheme == "https" and bool(parsed.hostname)
            and not parsed.username and not parsed.password
            and not parsed.query and not parsed.fragment)


def check(evidence):
    if not isinstance(evidence, dict):
        return ["Evidence must be a JSON object"]
    problems = []
    for key in IDENTIFIERS:
        value = evidence.get(key)
        if not isinstance(value, str) or not value.strip():
            problems.append(f"{key}: nonempty sanitized identifier required")
    commit = evidence.get("deployment_commit")
    if isinstance(commit, str) and not re.fullmatch(r"[0-9a-f]{40}", commit):
        problems.append("deployment_commit: full lowercase Git commit SHA required")
    for key in EVIDENCE_GATES:
        value = evidence.get(key)
        if type(value) is not bool:
            problems.append(f"{key}: explicit boolean required")
        elif not value:
            problems.append(f"{key}: not verified")
        reference = evidence.get("evidence", {}).get(key) if isinstance(evidence.get("evidence"), dict) else None
        if not valid_reference(reference):
            problems.append(f"{key}: HTTPS evidence URL without credentials/query required")
    if evidence.get("effective_database_project_id") != evidence.get("neon_project_id"):
        problems.append("Effective deployment/Neon project mismatch")
    if evidence.get("effective_database_branch_id") != evidence.get("neon_branch_id"):
        problems.append("Effective deployment/Neon branch mismatch")
    return problems


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("attestation", type=pathlib.Path)
    args = parser.parse_args(argv)
    try:
        data = json.loads(args.attestation.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        print(f"BLOCKED: cannot read valid JSON attestation ({type(exc).__name__})")
        return 2
    problems = check(data)
    if problems:
        print("BLOCKED: production authentication/recovery acceptance is unverified")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print("ATTESTED ONLY: supplied evidence references require independent review; no release authorization")
    return 0


if __name__ == "__main__":
    sys.exit(main())
