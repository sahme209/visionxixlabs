import importlib.util,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('namespace',Path(__file__).with_name('namespace_correction.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class NamespaceTests(unittest.TestCase):
 def test_existing_cache_vite_temp_is_not_a_writable_alias(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();cache=root/'cache';cache.mkdir();(cache/'.bin').mkdir();(cache/'.vite-temp').mkdir();saved=cache/'.vite-temp/old.mjs';saved.write_bytes(b'prior cache evidence')
   (cache/'vite').mkdir();(cache/'vite/bin').mkdir();(cache/'vite/bin/vite.js').write_text('fixture');(cache/'.bin/vite').symlink_to('../vite/bin/vite.js')
   source=root/'stage/source';(source/'packages/verified-issuer-runtime').mkdir(parents=True);namespace=source/'desktop/node_modules';namespace.parent.mkdir()
   m.stage_namespace(cache,namespace,source)
   self.assertFalse((namespace/'.vite-temp').is_symlink())
   self.assertTrue((namespace/'.vite-temp').is_dir())
   self.assertEqual((namespace/'.vite-temp').stat().st_mode&0o777,0o700)
   (namespace/'.vite-temp/config.mjs').write_text('owned-stage-only')
   self.assertEqual(saved.read_bytes(),b'prior cache evidence');self.assertFalse((cache/'.vite-temp/config.mjs').exists())
   self.assertEqual((namespace/'vite').resolve(),cache/'vite');self.assertEqual((namespace/'.bin/vite').resolve(),cache/'vite/bin/vite.js')
 def test_repair_removes_only_matching_stage_link(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();cache=root/'cache';cache.mkdir();saved=cache/'old';saved.write_text('unchanged');namespace=root/'namespace';namespace.mkdir(mode=0o700);(namespace/'.vite-temp').symlink_to(cache)
   m.repair_owned_vite_temp(namespace,cache)
   self.assertFalse((namespace/'.vite-temp').is_symlink());self.assertEqual((namespace/'.vite-temp').stat().st_mode&0o777,0o700);self.assertEqual(saved.read_text(),'unchanged')
 def test_wrong_link_and_real_existing_directory_refuse_without_mutation(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();cache=root/'cache';cache.mkdir();namespace=root/'namespace';namespace.mkdir(mode=0o700);temp=namespace/'.vite-temp';temp.symlink_to(cache)
   with self.assertRaises(m.Refusal):m.repair_owned_vite_temp(namespace,root/'other')
   self.assertTrue(temp.is_symlink());temp.unlink();temp.mkdir()
   with self.assertRaises(m.Refusal):m.repair_owned_vite_temp(namespace,cache)
   self.assertTrue(temp.is_dir())
if __name__=='__main__':unittest.main()
