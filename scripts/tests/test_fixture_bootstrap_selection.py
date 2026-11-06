"""Pure source-builder command selection, no build/emission invocation."""
from pathlib import Path
import importlib.util,unittest
p=Path(__file__).parents[1]/'build-local-issuer-package-source.py'
s=importlib.util.spec_from_file_location('fixture_bootstrap_selection_builder',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class FixedEmitterSelectionTests(unittest.TestCase):
 def test_default_preserves_original_and_selected_uses_only_fixed_fixture(self):
  self.assertEqual(m.private_bootstrap_emitter(False),'scripts/emit-private-release-bootstrap.cjs')
  self.assertEqual(m.private_bootstrap_emitter(True),'scripts/emit-private-fixture-release-bootstrap.cjs')
