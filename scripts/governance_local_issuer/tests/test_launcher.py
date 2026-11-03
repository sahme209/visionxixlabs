from pathlib import Path
import os
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import launcher,manifest

class LaunchTests(unittest.TestCase):
    def test_environment_digest_readiness_and_loader_flags_never_initialize_identity(self):
        for key in ["AXIOM_ISSUER_ARTIFACT_DIGEST","AXIOM_ISSUER_READY","NODE_OPTIONS","NODE_PATH","DYLD_INSERT_LIBRARIES"]:
            with patch.dict(os.environ,{key:"self-reported"},clear=True):
                result=launcher.preflight_launch("/missing")
                self.assertFalse(result["executionAuthorized"])
                self.assertEqual(result["executingIssuerIdentity"],"unavailable")
                self.assertNotIn("issuerArtifactDigest",result)
                self.assertEqual(result["reasons"],["loader_or_self_report_override"])
    def test_no_code_import_or_process_launch_from_a_descriptor(self):
        with patch.object(os,"execve") as execute:
            with self.assertRaises(manifest.PackageUnavailable):
                launcher.launch_verified_next("/missing")
            execute.assert_not_called()
    def test_chmod_is_not_an_immutable_filesystem(self):
        with tempfile.TemporaryDirectory(prefix="axiom-mode-unit-") as tmp:
            root=Path(tmp);p=root/manifest.MANIFEST;p.write_bytes(b"fixture");p.chmod(0o444)
            self.assertFalse(launcher.readonly_filesystem(root)["kernelReadonly"])
            p.chmod(0o600)

if __name__=="__main__":unittest.main()
