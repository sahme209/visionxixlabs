"""Offline checks for the production auth recovery evidence gate."""
import importlib.util
from pathlib import Path
import unittest

PATH = Path(__file__).resolve().parents[1] / "check-auth-recovery-evidence.py"
spec = importlib.util.spec_from_file_location("auth_recovery_evidence", PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class EvidenceGateTests(unittest.TestCase):
    def setUp(self):
        self.valid = {
            "deployment_id": "dpl_example",
            "deployment_commit": "a" * 40,
            "vercel_project_id": "prj_example",
            "effective_database_project_id": "project_example",
            "effective_database_branch_id": "branch_example",
            "neon_project_id": "project_example",
            "neon_branch_id": "branch_example",
            "effective_database_name": "neondb",
            "neon_database_name": "neondb",
            "preflight_database_project_id": "project_example",
            "preflight_database_branch_id": "branch_example",
            "preflight_database_name": "neondb",
            "effective_database_binding_verified": True,
            "migration_history_verified": True,
            "schema_drift_checked": True,
            "restore_point_verified": True,
            "isolated_restore_verified": True,
            "production_login_verified": True,
            "email_password_verified": True,
            "google_oauth_verified": True,
            "github_oauth_verified": True,
            "founder_workspace_access_verified": True,
            "evidence": {
                gate: f"https://example.org/evidence/{gate}"
                for gate in module.EVIDENCE_GATES
            },
        }

    def test_all_attested(self):
        self.assertEqual(module.check(self.valid), [])

    def test_missing_runtime_binding_fails_closed(self):
        data = dict(self.valid)
        data.pop("effective_database_branch_id")
        self.assertTrue(module.check(data))

    def test_project_mismatch_fails(self):
        data = dict(self.valid, neon_project_id="different")
        self.assertIn("Effective deployment/Neon project mismatch", module.check(data))

    def test_branch_mismatch_fails(self):
        data = dict(self.valid, neon_branch_id="different")
        self.assertIn("Effective deployment/Neon branch mismatch", module.check(data))

    def test_restore_not_proven_fails(self):
        data = dict(self.valid, isolated_restore_verified=False)
        self.assertIn("isolated_restore_verified: not verified", module.check(data))

    def test_string_boolean_not_accepted(self):
        data = dict(self.valid, production_login_verified="true")
        self.assertIn("production_login_verified: explicit boolean required", module.check(data))

    def test_non_object_fails(self):
        self.assertTrue(module.check([]))

    def test_missing_evidence_reference_fails(self):
        data = dict(self.valid, evidence={})
        self.assertIn("production_login_verified: HTTPS evidence URL without credentials/query required", module.check(data))

    def test_evidence_with_credentials_fails(self):
        data = dict(self.valid)
        data["evidence"] = dict(data["evidence"], production_login_verified="https://user:password@example.org/login")
        self.assertTrue(module.check(data))

    def test_evidence_with_query_fails(self):
        data = dict(self.valid)
        data["evidence"] = dict(data["evidence"], production_login_verified="https://example.org/login?token=secret")
        self.assertTrue(module.check(data))

    def test_missing_binding_verification_fails(self):
        data = dict(self.valid)
        data.pop("effective_database_binding_verified")
        self.assertIn("effective_database_binding_verified: explicit boolean required", module.check(data))

    def test_invalid_commit_fails(self):
        data = dict(self.valid, deployment_commit="short")
        self.assertIn("deployment_commit: full lowercase Git commit SHA required", module.check(data))

    def test_each_production_login_method_requires_its_own_evidence(self):
        for gate in ("email_password_verified", "google_oauth_verified", "github_oauth_verified", "founder_workspace_access_verified"):
            with self.subTest(gate=gate):
                self.assertTrue(module.check(dict(self.valid, **{gate: False})))

    def test_database_name_and_protected_preflight_target_must_match(self):
        for key in ("neon_database_name", "preflight_database_project_id", "preflight_database_branch_id", "preflight_database_name"):
            with self.subTest(key=key):
                self.assertTrue(module.check(dict(self.valid, **{key: "different"})))

    def test_missing_preflight_target_fails(self):
        data = dict(self.valid)
        data.pop("preflight_database_name")
        self.assertTrue(module.check(data))

    def test_malformed_and_noncanonical_references_fail_without_exception(self):
        for value in ("https://@example.org/evidence", "https://:@example.org/evidence", "https://example.org\\other/evidence", "https://%zz/evidence", "https://[invalid", "https://example.org:invalid/evidence", "https://example.org:0/evidence", " https://example.org/evidence", "https://example.org/\nsecret", "https://example.org/" + "a" * 2048):
            with self.subTest(value=value[:35]):
                try:
                    result = module.valid_reference(value)
                except ValueError:
                    self.fail("Malformed reference must be rejected without propagating parser details")
                self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
