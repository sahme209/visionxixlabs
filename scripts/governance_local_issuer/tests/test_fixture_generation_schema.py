"""Canonical formatting evidence is file evidence, never runtime authority."""
from pathlib import Path
import sys,unittest,json
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]));sys.path.insert(0,str(Path(__file__).parent))
from governance_local_issuer import fixture_delivery_inputs as f
from test_fixture_delivery_inputs import FixtureDeliveryFixture
class FixtureGenerationSchemaTests(unittest.TestCase):
 def test_formatted_generated_schema_can_differ_from_archived_raw_source(self):
  x=FixtureDeliveryFixture();self.addCleanup(x.close);x.record();x.emit()
  generated=x.stage/'node_modules/.prisma/client/schema.prisma'
  self.assertNotEqual(generated.read_bytes(),x.schema.read_bytes())
  f.verify_fixture_delivery_inputs(x.stage,after_build=True)
 def test_bound_generation_engine_does_not_require_uninstalled_npm_sidecar(self):
  x=FixtureDeliveryFixture();self.addCleanup(x.close)
  (x.stage/'node_modules/@prisma/engines/schema-engine-darwin-arm64').unlink()
  x.record()
 def test_selected_materializer_preserves_raw_generated_bytes(self):
  x=FixtureDeliveryFixture();self.addCleanup(x.close);result=x.materialize()
  final=f.verify_fixture_materialization(result['fixtureDeliveryReceipt'])
  mat=json.loads(Path(final['mainMaterialization']['path']).read_text())
  package=Path(mat['fixturePackageRoot'])
  self.assertEqual((package/'node_modules/.prisma/client/schema.prisma').read_bytes(),x.generated_schema)
  self.assertNotEqual(x.generated_schema,x.schema.read_bytes())
 def test_source_query_canonical_and_authority_substitutions_refuse(self):
  for fault in ('raw','canonical','source','query','authority','revision','missing','owned_engine'):
   with self.subTest(fault=fault):
    x=FixtureDeliveryFixture()
    try:
     if fault=='owned_engine':x.plan['engines']['inputs']['schema']={'sha256':'0'*64,'size':x.engine.stat().st_size}
     elif fault=='raw':x.put(x.stage/'node_modules/.prisma/client/schema.prisma',b'CHANGED GENERATED RAW')
     elif fault=='canonical':x.put(x.generation_run/'tmp/emitted-schema.prisma',b'CHANGED CANONICAL')
     elif fault=='query':x.put(x.stage/'node_modules/.prisma/client/libquery_engine-darwin-arm64.dylib.node',b'UNBOUND QUERY')
     elif fault=='missing':
      packet=json.loads(x.packet.read_text());del packet['generationInputs'];x.js(x.packet,packet)
     else:
      path=x.generation_run/('attempt.json'if fault=='revision'else'result.json');r=json.loads(path.read_text())
      if fault=='source':r['schemaComparison']['rawArchiveSha256']='0'*64
      elif fault=='authority':r['executionAuthorized']=True
      else:r['sourceRevision']='b'*40
      x.js(path,r)
     with self.assertRaises((ValueError,x.generation.Unavailable)):x.record()
    finally:x.close()
 def test_builder_reuses_same_generation_observer(self):
  import importlib.util,types
  x=FixtureDeliveryFixture();self.addCleanup(x.close)
  path=Path(__file__).parents[2]/'build-local-issuer-package-source.py';spec=importlib.util.spec_from_file_location('fdi_generation_builder_test',path);b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
  x.plan['sources']={};x.plan['engines']['inputs']['schema']=x.generation.stable_file_hash(x.engine)
  attempt=json.loads((x.generation_run/'attempt.json').read_text());attempt['preparation']=x.plan;x.js(x.generation_run/'attempt.json',attempt)
  expected=x.generation.verify_generation_observation(x.stage,x.generation_run,x.plan,x.system.build,x.revision)
  with patch.object(b,'source_inputs',return_value=({}, {}, {'sourceRevision':x.revision})),patch.object(b,'verify_build_archive',return_value={}),patch.object(b,'lock_plan',return_value={}),patch.object(b,'validate_local_links'),patch.object(b,'observe_build_sources',return_value={}),patch.object(b,'framework_type_profile',return_value={}),patch.object(b,'_engine_tool',return_value=x.generation):
   got=b.prepare_build_inputs(x.stage,x.system.repo,x.revision,x.cache,x.bound_inputs,x.generation_run,x.system.build)
  self.assertEqual(got['generationEvidence'],expected)
if __name__=='__main__':unittest.main()
