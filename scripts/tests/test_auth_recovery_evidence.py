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
            "migration_history_verified": True,
            "schema_drift_checked": True,
            "restore_point_verified": True,
            "isolated_restore_verified": True,
            "production_login_verified": True,
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


if __name__ == "__main__":
    unittest.main()
