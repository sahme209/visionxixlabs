"""Actual source archive verifier with synthetic archive/saved artifacts; no Git/compiler."""
from pathlib import Path
import importlib.util,io,sys,tarfile,unittest
from unittest.mock import patch
import test_system_build_inputs as fixture_module
from governance_local_issuer import system_build_inputs as s
class SourceBuilderSystemTests(unittest.TestCase):
 def setUp(self):
  self.fixture=fixture_module.SystemBuildInputsTests();self.fixture.setUp();self.addCleanup(self.fixture.doCleanups)
  spec=importlib.util.spec_from_file_location('system_source_builder_test',Path(__file__).parents[2]/'build-local-issuer-package-source.py');self.b=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.b)
  f=self.fixture;out=io.BytesIO()
  with tarfile.open(fileobj=out,mode='w')as t:
   for p in sorted(f.repo.rglob('*')):t.add(p,arcname=p.relative_to(f.repo).as_posix(),recursive=False)
  self.archive=out.getvalue()
 def verify(self):
  f=self.fixture
  with patch.object(self.b,'git_bytes',return_value=self.archive):return self.b.verify_build_archive(f.stage,f.repo,f.revision)
 def test_real_archive_branch_binds_actual_system_adapter(self):
  expected=self.fixture.record();actual=self.verify()
  self.assertEqual(actual['systemBuildInputs'],expected);self.assertNotIn('nativeOverlay',actual)
 def test_system_profile_never_invokes_legacy_overlay(self):
  self.fixture.record()
  with patch.object(self.b,'native_overlay_inputs',side_effect=AssertionError('legacy helper invoked')):self.verify()
 def test_ordinary_profile_still_uses_legacy_verifier(self):
  with patch.object(self.b,'native_overlay_inputs',return_value=None)as old:
   self.assertNotIn('systemBuildInputs',self.verify());old.assert_called_once()
 def test_dangling_mixed_receipt_refuses_before_helpers(self):
  (self.fixture.stage/s.RECEIPT).symlink_to('missing-system')
  (self.fixture.stage/'_axiom_native_overlay.json').symlink_to('missing-legacy')
  with patch.object(self.b,'native_overlay_inputs',side_effect=AssertionError('called')):
   with self.assertRaises(self.b.Unavailable):self.verify()
 def test_changed_external_role_refuses_actual_source_verifier(self):
  self.fixture.record();(self.fixture.root/'controller').write_bytes(b'OTHER')
  with self.assertRaises(self.b.Unavailable):self.verify()
 def test_unlisted_generated_file_refuses(self):
  self.fixture.record();(self.fixture.stage/'unlisted.json').write_text('{}')
  with self.assertRaises(self.b.Unavailable):self.verify()
if __name__=='__main__':unittest.main()
