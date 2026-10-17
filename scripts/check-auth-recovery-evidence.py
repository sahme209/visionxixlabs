#!/usr/bin/env python3
"""Fail-closed, offline production authentication recovery evidence gate.

Consumes a sanitized JSON attestation prepared from independent read-only
Vercel/Neon observations. Never connects to a provider or prints credentials.
An attestation is not proof of an actual restore or login.
"""
import argparse
import json
import pathlib
import sys

REQUIRED = (
    "deployment_id", "deployment_commit", "vercel_project_id",
    "effective_database_project_id", "effective_database_branch_id",
    "neon_project_id", "neon_branch_id", "migration_history_verified",
    "schema_drift_checked", "restore_point_verified",
    "isolated_restore_verified", "production_login_verified",
)
BOOLEAN = REQUIRED[-5:]


def check(evidence):
    if not isinstance(evidence, dict):
        return ["Evidence must be a JSON object"]
    problems = []
    for key in REQUIRED:
        value = evidence.get(key)
        if key in BOOLEAN:
            if type(value) is not bool:
                problems.append(f"{key}: explicit boolean required")
            elif not value:
                problems.append(f"{key}: not verified")
        elif not isinstance(value, str) or not value.strip():
            problems.append(f"{key}: nonempty sanitized identifier required")
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
    print("ATTESTED: all declared gates are true; independently verify source evidence before release")
    return 0


if __name__ == "__main__":
    sys.exit(main())
