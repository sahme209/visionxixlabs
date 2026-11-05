"""Actual delivery source/copy/main/manifest joins on owned inert files only.

Main compiler observation is synthetic. No image/native observer, process,
Prisma engine, SQL, Node target or signature is invoked by this fixture.
"""
from pathlib import Path
import copy, json, sys, unittest
sys.path.insert(0, str(Path(__file__).parents[2]))
sys.path.insert(0, str(Path(__file__).parent))
from governance_local_issuer import fixture_delivery_inputs as f, manifest, system_build_inputs as s
from test_fixture_delivery_inputs import FixtureDeliveryFixture


class FixtureProfileJoinTests(unittest.TestCase):
 def setUp(self):
  self.x=FixtureDeliveryFixture(); self.addCleanup(self.x.close)
  self.x.record(); self.x.emit()
  self.copies=f.prepare_fixture_materialization(self.x.stage,self.x.root)
  self.package=self.x.root/'inert-package';self.package.mkdir(mode=0o700)
  for name in manifest.REQUIRED:
   self.x.put(self.package/name,b'INERT FILE; NEVER EXECUTED',0o755 if name=='__axiom_runtime__/node'else 0o600)
  self.x.js(self.package/'.next/required-server-files.json',{'files':['.next/BUILD_ID']})
  for name in (f.HELPER,*f.PRISMA_ANCHORS):self.x.put(self.package/name,(self.x.stage/name).read_bytes())
  self.main=self.x.root/'materialization.json'
  self.audit={'format':'axiom.local-issuer-materialization/3','source':self.x.revision,
              'fixtureDeliveryInputs':self.copies,'fixturePackageRoot':str(self.package),
              'executionAuthorized':False,'installationReady':False,'activationAllowed':False}
  self.write_main_and_manifest()

 def write_main_and_manifest(self):
  self.x.js(self.main,self.audit)
  path=self.package/manifest.MANIFEST
  if path.exists():path.unlink()  # Deliberate coherent counterfeit in OWNED fixture.
  self.digest=manifest.write_manifest(self.package,{'sourceRevision':self.x.revision,
    'archiveSha256':'b'*64,'buildReceiptSha256':'c'*64,
    'materializationReceiptSha256':s.binding(self.main)['sha256']},'v24.21.0')

 def test_actual_final_validator_joins_external_receipt_without_digest_cycle(self):
  r=f.finish_fixture_materialization(self.main,self.package)
  self.assertEqual(r,f.verify_fixture_materialization(self.main.parent/'fixture-delivery.json'))
  self.assertEqual(r['mainMaterialization'],s.binding(self.main))
  self.assertEqual(r['packageDigest'],self.digest)
  self.assertNotIn('packageDigest',json.loads(self.main.read_text()))
  self.assertNotIn('fixture-delivery.json',[x['path']for x in json.loads((self.package/manifest.MANIFEST).read_text())['files']])
  self.assertFalse(r['executionAuthorized']);self.assertFalse(r['installationReady'])

 def test_coherent_alternate_recipe_source_cannot_be_adopted(self):
  alternative=self.x.put(self.x.root/'unselected.sql',b'SELECT 999;')
  changed=copy.deepcopy(self.audit)
  item=changed['fixtureDeliveryInputs']['resources']['schema'];bound=s.binding(alternative)
  self.x.put(Path(item['materializedPath']),alternative.read_bytes())
  item.update(source=bound,sha256=bound['sha256'],size=bound['size'])
  self.audit=changed;self.write_main_and_manifest()
  with self.assertRaises(ValueError):f.finish_fixture_materialization(self.main,self.package)

 def test_emitted_helper_must_match_native_preparation_pin(self):
  helper=self.x.stage/f.HELPER
  helper.write_bytes(helper.read_bytes()+b'\n// CHANGED OUTPUT; SAME BANNER AND MAP\n')
  with self.assertRaisesRegex(ValueError,'fixture_helper_preimport_mapping_required'):
   f.verify_fixture_delivery_inputs(self.x.stage,after_build=True)


if __name__=='__main__':unittest.main()
