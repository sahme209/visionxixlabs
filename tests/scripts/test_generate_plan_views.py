"""Pure source fixtures only; no source imports, external tools or network."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location('plan_views', Path(__file__).resolve().parents[2] / 'scripts/generate-plan-views.py')
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


def board():
    rows = '| Priority | Requirement | Verified | Next |\n| --- | --- | --- | --- |\n'
    for i, parent in enumerate(sorted(m.PARENTS)):
        label = 'planned' if parent.startswith('C') else 'local-only,simulated'
        rows += f'|{i}|[ ] {parent} Work|<!-- evidence: {label} -->bounded evidence|open gate|\n'
    rows += '\n## Current dependency and decision source register\n\n| Decision | Owner | Selected / state | Alternative | Reason / evidence | Reversibility | Recorded |\n| --- | --- | --- | --- | --- | --- | --- |\n| D1 | owner | selected | alternative | reason | reversible | 2026-11-04 |\n'
    rows += '\n## Current execution unit\n\n[Packet](packet.md). Not accepted.\n'
    return rows


class PlanViewsTests(unittest.TestCase):
    def test_exact_parent_set_and_mixed_classes(self):
        parsed = m.parse_board(board())
        self.assertEqual(set(parsed), m.PARENTS)
        self.assertEqual(parsed['A1'][1], 'local-only,simulated')
        for damaged in [board().replace('[ ] A1 ', '[ ] A99 '), board().replace('[ ] A1 ', '[ ] A2 '), '\n'.join(line for line in board().splitlines() if '[ ] A1 ' not in line), board().replace('local-only,simulated', 'complete'), board().replace('evidence: planned', 'evidence: implemented')]:
            with self.subTest(damaged=damaged[:50]), self.assertRaises(ValueError):
                m.parse_board(damaged)

    def fixture(self, root):
        for relative, content in [(m.MASTER, '### A9. Scope\nOPA and Playwright are proposed.\n'), (m.BOARD, board()), ('package.json', '{"dependencies":{"react":"^19"}}'), ('desktop/package.json', '{"devDependencies":{"vite":"^6"}}'), ('docs/product/packet.md', 'Existing evidence only')]:
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

    def test_determinism_fixed_outputs_drift_and_source_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            self.assertEqual(m.update(root), 4)
            original = m.render(root)
            self.assertEqual(m.render(root), original)
            self.assertEqual(m.update(root, True), 4)
            target = root / m.OUT / 'capabilities.md'
            target.write_text(target.read_text() + 'manual drift')
            with self.assertRaisesRegex(ValueError, 'drift'):
                m.update(root, True)
            m.update(root)
            (root / 'package.json').write_text('{"dependencies":{"react":"^20"}}')
            with self.assertRaisesRegex(ValueError, 'drift'):
                m.update(root, True)
            self.assertIn('Unverified; declaration only', original[m.OUT + '/adoption-inventory.md'])

    def test_link_resolution_missing_traversal_and_external_not_fetched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'exists.md').write_text('evidence')
            generated = {'source.md': '[ok](exists.md#section) [external](https://invalid.example/no-network) [mail](mailto:x@example.test) [bad](missing.md) [escape](../outside.md)'}
            failures = m.local_links(root, ['source.md'], generated)
            self.assertEqual(len(failures), 2)
            self.assertTrue(any('missing:' in f for f in failures))
            self.assertTrue(any('outside repository:' in f for f in failures))

    def test_decision_schema_packet_and_unknown_master_heading_refuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            for old, new in [('Alternative |', 'Options |'), ('[Packet](packet.md)', 'No linked packet')]:
                (root / m.BOARD).write_text(board().replace(old, new))
                with self.assertRaises(ValueError):
                    m.render(root)
            (root / m.BOARD).write_text(board())
            (root / m.MASTER).write_text('### C99. Unknown\n')
            with self.assertRaisesRegex(ValueError, 'unknown master'):
                m.render(root)

    def test_missing_link_prevents_any_output_and_symlink_output_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root)
            (root / 'docs/product/packet.md').unlink()
            with self.assertRaisesRegex(ValueError, 'missing:'):
                m.update(root)
            self.assertFalse((root / m.OUT).exists())
            (root / 'docs/product/packet.md').write_text('evidence')
            (root / m.OUT).mkdir()
            (root / m.OUT / 'adoption-inventory.md').symlink_to(root / 'package.json')
            with self.assertRaisesRegex(ValueError, 'symlink'):
                m.update(root)
            self.assertFalse((root / m.OUT / 'capabilities.md').exists())


if __name__ == '__main__':
    unittest.main()
