"""Owned ordinary file tests only. Never imports a controller or native image."""
import importlib.util
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('preparation', Path(__file__).with_name('prepare-cssm-persistent-qualification.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PreparationFiles(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='axiom-preparation-pure-')
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()

    def test_new_lab_private_and_existing_destination_never_adopted(self):
        destination = self.root / 'owned-parent' / 'fresh'
        previous_umask = os.umask(0o177)
        self.addCleanup(os.umask, previous_umask)
        with patch.object(p, 'LAB', destination):
            self.assertEqual(p.create_fresh_lab(), destination)
            self.assertEqual(stat.S_IMODE(destination.stat().st_mode), 0o700)
            nested = destination / 'source'
            p.private_directory(nested)
            self.assertEqual(stat.S_IMODE(nested.stat().st_mode), 0o700)
            marker = destination / 'preserve'
            marker.write_bytes(b'previous-attempt')
            self.assertEqual(stat.S_IMODE(marker.stat().st_mode), 0o600)
            with self.assertRaises(FileExistsError):
                p.create_fresh_lab()
            self.assertEqual(marker.read_bytes(), b'previous-attempt')

    def test_symlink_ancestor_refuses_without_creating_destination(self):
        target = self.root / 'target'
        target.mkdir()
        alias = self.root / 'alias'
        alias.symlink_to(target, target_is_directory=True)
        with patch.object(p, 'LAB', alias / 'fresh'):
            with self.assertRaisesRegex(ValueError, 'ancestor'):
                p.create_fresh_lab()
        self.assertFalse((target / 'fresh').exists())

    def test_binding_captures_current_identity_and_refuses_alias_or_hardlink(self):
        source = self.root / 'source'
        source.write_bytes(b'abc')
        source.chmod(0o600)
        actual = p.bind_owned_file(source)
        self.assertEqual(actual['sha256'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
        self.assertEqual(actual['uid'], os.getuid())
        self.assertEqual(actual['mode'], 0o600)
        self.assertEqual(actual['size'], 3)
        self.assertEqual(actual['ino'], source.stat().st_ino)
        alias = self.root / 'alias'
        alias.symlink_to(source)
        with self.assertRaises(ValueError):
            p.bind_owned_file(alias)
        hardlink = self.root / 'hardlink'
        os.link(source, hardlink)
        with self.assertRaises(ValueError):
            p.bind_owned_file(source)


if __name__ == '__main__':
    unittest.main()
