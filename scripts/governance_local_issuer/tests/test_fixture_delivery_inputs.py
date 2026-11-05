"""Actual fixed delivery validators/copies; synthetic compile/engine observations only."""
from pathlib import Path
import json,hashlib,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]));sys.path.insert(0,str(Path(__file__).parent))
from governance_local_issuer import fixture_delivery_inputs as f,system_build_inputs as system,system_preparation as prep
import test_system_build_inputs as system_fixtures
class FixtureDeliveryFixture:
 def __init__(self):
  self.helper_data=f.preimport_banner()+b'\n// SYNTHETIC COMPILED HELPER; NEVER EXECUTED\n'+json.dumps(prep.PACKAGE_ROOT+'/node_modules/@prisma/client').encode()
  original=prep.prepare_system
  def configured(repo,stage,config,**kw):
   config['fixturePrincipal']={'uid':504,'gid':504};config['fixtureTools']={'nodeSha256':config['node']['sha256'],'producerSha256':hashlib.sha256(self.helper_data).hexdigest()};return original(repo,stage,config,**kw)
  self.system=system_fixtures.SystemBuildInputsTests()
  with patch.object(prep,'prepare_system',side_effect=configured):self.system.setUp()
  self.root=self.system.root;self.stage=self.system.stage;self.revision=self.system.revision;self.observation=self.system.record()
  real=Path(__file__).resolve().parents[3];self.put(self.stage/'scripts/emit-synthetic-fixture-producer.cjs',(real/'scripts/emit-synthetic-fixture-producer.cjs').read_bytes(),0o644)

  for name in f.SOURCE_PATHS:self.put(self.stage/name,(real/name).read_bytes(),0o644)
  schema=(real/'prisma/schema.prisma').read_bytes();self.schema=self.put(self.root/'fixture-schema-source.prisma',schema);self.engine=self.put(self.root/'fake-engine',b'SYNTHETIC ENGINE NEVER RUN');self.seed=self.put(self.root/'fixture-seed.sql',(real/'lib/governance/qualification/fixture-seed.sql').read_bytes());self.sql=self.put(self.root/'fixture-schema.sql',b'CREATE TABLE "Synthetic" (id text);')
  self.put(self.stage/'node_modules/@prisma/engines/schema-engine-darwin-arm64',self.engine.read_bytes())
  self.engine_sha=system.binding(self.engine)['sha256'];self.schema_sha=system.binding(self.schema)['sha256'];self.patches=[patch.object(f,'ENGINE_SHA',self.engine_sha,create=True),patch.object(f,'SCHEMA_SHA',self.schema_sha,create=True)]
  for p in self.patches:p.start()
  import re
  binding={'format':'axiom.synthetic-fixture-schema/1','schemaSha256':self.schema_sha,'engineSha256':self.engine_sha,'diffInputSha256':hashlib.sha256(schema.replace(b'url      = env("DATABASE_URL")',b'url      = "postgresql://qualification.invalid/qualification"')).hexdigest(),'sqlSha256':system.binding(self.sql)['sha256'],'seedSha256':system.binding(self.seed)['sha256'],'models':sorted(re.findall(r'^model ([A-Za-z0-9_]+) \{',schema.decode(),re.M)),'completeSchema':True,'qualification':False}
  self.binding=self.js(self.root/'fixture-schema.binding.json',binding)
  self.packet=self.js(self.root/'fixture-input-packet.json',{'format':'axiom.fixture-delivery-inputs/1','profile':'compiled-private-fixture/1','generation':prep.GENERATION,'sourceRevision':self.revision,'stage':str(self.stage),'schemaSource':system.binding(self.schema),'engine':system.binding(self.engine),'resources':{'schema':system.binding(self.sql),'binding':system.binding(self.binding),'seed':system.binding(self.seed)},'toolNode':self.observation['runtimeNode']})
 def put(self,p,data,mode=0o600):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(mode);return p
 def js(self,p,data):return self.put(p,(json.dumps(data,sort_keys=True)+'\n').encode())
 def record(self):return f.record_fixture_delivery_inputs(self.stage,self.packet)
 def emit(self):
  for name in f.PRISMA_ANCHORS:self.put(self.stage/name,(self.schema.read_bytes()if name.endswith('schema.prisma')else b'SYNTHETIC PRISMA DEPENDENCY; NEVER LOADED'))
  return self.put(self.stage/'.next/server/__axiom_private_fixture__/fixture-producer.cjs',self.helper_data)
 def materialize(self):
  from governance_local_issuer import materialize as m
  record=self.record();self.emit()
  for name,data in {'.next/BUILD_ID':b'SYNTHETIC','.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}','.next/server/__axiom_private__/release-merge-bootstrap.cjs':b'SYNTHETIC RELEASE BOOTSTRAP','package.json':b'{"name":"synthetic"}','next.config.ts':b'SYNTHETIC CONFIG','node_modules/next/dist/bin/next':b'SYNTHETIC NEXT CLI'}.items():self.put(self.stage/name,data)
  link=self.stage/'node_modules/@axiom/verified-issuer-runtime';link.parent.mkdir(parents=True,exist_ok=True);link.symlink_to('../../packages/verified-issuer-runtime')
  parent=self.root/'output';parent.mkdir(mode=0o700)
  details={'stage':str(self.stage),'source':self.revision,'archiveSha256':'b'*64,'nodeVersion':'v24.21.0','systemBuildInputs':self.observation,'fixtureDeliveryInputs':record}
  with patch.object(m,'collect_native_prerequisites',return_value={'unresolved':[],'syntheticObserver':True}):result=m._materialize(details,'c'*64,self.system.build,parent/'package',profile=m.ISOLATED_PROFILE,isolated_evidence={'syntheticCompiler':True},system_mode_map=m.SYSTEM_MODE_MAP)
  return result
 def close(self):
  for p in reversed(self.patches):p.stop()
  self.system.doCleanups()
class FixtureDeliveryInputsTests(unittest.TestCase):
 def setUp(self):self.x=FixtureDeliveryFixture();self.addCleanup(self.x.close)
 def test_bound_source_record_and_real_quarantine_copies(self):
  x=self.x;r=x.record();self.assertEqual(r,f.verify_fixture_delivery_inputs(x.stage));x.emit();self.assertEqual(r,f.verify_fixture_delivery_inputs(x.stage,after_build=True));copies=f.prepare_fixture_materialization(x.stage,x.root);self.assertEqual(set(copies['resources']),{'producer','schema','binding','seed'});self.assertEqual(copies['toolNode']['source'],x.observation['runtimeNode']);self.assertTrue(all(Path(v['materializedPath']).stat().st_mode&0o777==0o600 for v in [*copies['resources'].values(),copies['toolNode']]))
 def test_actual_selected_materializer_and_acyclic_final_verifier(self):
  x=self.x;result=x.materialize();final=Path(result['fixtureDeliveryReceipt']);r=f.verify_fixture_materialization(final);main=json.loads(Path(r['mainMaterialization']['path']).read_text());self.assertEqual(main['format'],'axiom.local-issuer-materialization/3');self.assertNotIn('packageDigest',main['fixtureDeliveryInputs']);self.assertEqual(r['packageDigest'],result['packageDigest']);self.assertEqual(r['dependencyRoot'],prep.PACKAGE_ROOT)
 def test_coherent_counterfeit_seed_is_not_approved_source(self):
  x=self.x;x.seed.write_bytes(b'SELECT 999;');binding=json.loads(x.binding.read_text());binding['seedSha256']=system.binding(x.seed)['sha256'];x.js(x.binding,binding);packet=json.loads(x.packet.read_text());packet['resources']['seed']=system.binding(x.seed);packet['resources']['binding']=system.binding(x.binding);x.js(x.packet,packet);self.assertRaises(ValueError,x.record)
 def test_actual_source_builder_selected_archive_and_output_branch(self):
  import io,tarfile,importlib.util
  x=self.x;record=x.record();location=Path(__file__).parents[2]/'build-local-issuer-package-source.py';spec=importlib.util.spec_from_file_location('fixture_selected_builder',location);builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
  archive=io.BytesIO()
  with tarfile.open(fileobj=archive,mode='w')as tar:
   for path in sorted(x.stage.rglob('*')):
    relative=path.relative_to(x.stage).as_posix()
    if relative.split('/')[0]=='node_modules'or relative in {f.RECEIPT,system.RECEIPT,*system.GENERATED_STAGE}:continue
    info=tarfile.TarInfo(relative);info.mode=path.stat().st_mode&0o777
    if path.is_dir():info.type=tarfile.DIRTYPE;tar.addfile(info)
    else:data=path.read_bytes();info.size=len(data);tar.addfile(info,io.BytesIO(data))
  with patch.object(builder,'git_bytes',return_value=archive.getvalue()),patch.object(builder,'native_overlay_inputs',side_effect=AssertionError('legacy overlay called')):observed=builder.verify_build_archive(x.stage,x.system.repo,x.revision)
  self.assertEqual(observed['fixtureDeliveryInputs'],record)
  x.emit()
  outputs={'.next/BUILD_ID':b'SYNTHETIC','.next/required-server-files.json':b'{"files":[".next/server/app/page.js"]}','.next/server/app-paths-manifest.json':b'{"page":"app/page.js"}','.next/server/app/page.js':b'SYNTHETIC PAGE','.next/server/app/page.js.nft.json':b'{"version":1,"files":["../../../node_modules/@prisma/client/default.js"]}','.next/server/__axiom_private__/release-merge-bootstrap.cjs':b'SYNTHETIC BOOTSTRAP'}
  for name,data in outputs.items():x.put(x.stage/name,data)
  result=builder.verify_build_outputs(x.stage);self.assertIn(f.HELPER,result['requiredMetadata'])
 def test_changed_recipe_and_runtime_node_refuse(self):
  x=self.x;x.record();x.seed.write_bytes(b'changed');self.assertRaises(ValueError,f.verify_fixture_delivery_inputs,x.stage)
 def test_missing_or_late_preimport_banner_refuses(self):
  x=self.x;x.record();x.put(x.stage/'.next/server/__axiom_private_fixture__/fixture-producer.cjs',b'require("@prisma/client");\n'+f.preimport_banner());self.assertRaises(ValueError,lambda:f.verify_fixture_delivery_inputs(x.stage,after_build=True))
if __name__=='__main__':unittest.main()
