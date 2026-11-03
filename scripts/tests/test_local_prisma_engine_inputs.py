"""Owned synthetic Mach-O parser/copy fixtures; no native engine execution."""
import hashlib,importlib.util,json,os,struct,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('engines',Path(__file__).parents[1]/'local_prisma_engine_inputs.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def native(kind):
 command=struct.pack('<II',0x1b,24)+b'FIXTURE-UUID-000'
 return struct.pack('<IiiIIIII',0xfeedfacf,0x100000c,0,6 if kind=='query' else 2,1,len(command),0,0)+command+b'NONEXECUTABLE-FIXTURE'
class EngineInputs(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-engine-input-unit-',dir='/private/tmp');self.root=Path(self.temp.name);self.root.chmod(0o700)
  self.source=self.root/'source';self.source.mkdir();self.owned=self.root/'owned';self.owned.mkdir(mode=0o700)
  for kind,name in [('query','libquery-engine'),('schema','schema-engine')]: (self.source/name).write_bytes(native(kind))
 def tearDown(self):self.temp.cleanup()
 def bind(self):return m.bind_local_engines(self.source,self.owned)
 def test_exact_owned_bytes_receipt_and_no_authenticity_or_execution(self):
  original={p.name:p.read_bytes()for p in self.source.iterdir()};result=self.bind()
  self.assertEqual(result['format'],'axiom.local-engine-inputs/2');self.assertEqual(result['provenance'],'trusted_local_host_input');self.assertEqual(result['upstreamAuthenticity'],'unavailable');self.assertEqual(result['engineCommitAuthenticity'],'unavailable');self.assertFalse(result['executionAuthorized'])
  for kind,item in result['inputs'].items():
   target=self.owned/'engine-inputs'/item['file'];self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(),item['sha256']);self.assertEqual(item['architecture'],'arm64');self.assertEqual(target.stat().st_mode&0o777,0o700 if kind=='schema' else 0o600)
  self.assertEqual(original,{p.name:p.read_bytes()for p in self.source.iterdir()})
  self.assertEqual(m.verify_bound_engines(self.owned/'engine-inputs'),result)
 def test_wrong_arch_type_truncation_load_commands_and_fat_refuse(self):
  for body in [b'bad',b'\xca\xfe\xba\xbe'+b'0'*80, native('query')[:32],native('schema'),struct.pack('<IiiIIIII',0xfeedfacf,0x1000007,0,6,0,0,0,0)]:
   with self.subTest(body=body[:8]):
    (self.source/'libquery-engine').write_bytes(body)
    with self.assertRaises(m.Unavailable):self.bind()
    self.assertFalse((self.owned/'engine-inputs').exists())
 def test_symlink_hardlink_and_existing_destination_refuse(self):
  path=self.source/'libquery-engine';target=self.root/'outside';target.write_bytes(native('query'));path.unlink();path.symlink_to(target)
  with self.assertRaises((m.Unavailable,OSError)):self.bind()
  path.unlink();os.link(target,path)
  with self.assertRaises(m.Unavailable):self.bind()
  path.unlink();path.write_bytes(native('query'));self.bind()
  with self.assertRaises((m.Unavailable,OSError)):self.bind()
 def test_owned_tamper_and_malformed_receipt_refuse(self):
  self.bind();directory=self.owned/'engine-inputs';(directory/'libquery_engine-darwin-arm64.dylib.node').write_bytes(native('query')+b'changed')
  with self.assertRaises(m.Unavailable):m.verify_bound_engines(directory)
  (directory/'receipt.json').write_text('{}')
  with self.assertRaises(m.Unavailable):m.verify_bound_engines(directory)
 def test_old_generic_basename_receipt_version_is_historical_not_reused(self):
  result=self.bind();directory=self.owned/'engine-inputs';result['format']='axiom.local-engine-inputs/1'
  (directory/'receipt.json').write_text(json.dumps(result))
  with self.assertRaises(m.Unavailable):m.verify_bound_engines(directory)

 def test_mutating_source_during_read_refuses_and_removes_partial_copy(self):
  real=os.read;changed=False
  def read(fd,count):
   nonlocal changed
   data=real(fd,count)
   if not changed:
    changed=True
    with (self.source/'libquery-engine').open('ab')as out:out.write(b'growth')
   return data
  with patch.object(m.os,'read',side_effect=read):
   with self.assertRaises(m.Unavailable):self.bind()
  self.assertFalse((self.owned/'engine-inputs').exists())
 def test_native_install_id_is_not_a_dependency_and_external_load_remains_visible(self):
  def command(kind,name):
   text=name.encode()+b'\0';size=(24+len(text)+7)//8*8
   return struct.pack('<IIIIII',kind,size,24,0,0,0)+text+b'\0'*(size-24-len(text))
  commands=command(0xd,'/build/runner/libquery_engine.dylib')+command(0xc,'/usr/lib/libSystem.B.dylib')+command(0xc,'/outside/unsafe.dylib')
  data=struct.pack('<IiiIIIII',0xfeedfacf,0x100000c,0,6,3,len(commands),0,0)+commands
  result=m.native_linkage(data,len(data),'query')
  self.assertEqual(result['installId'],'/build/runner/libquery_engine.dylib')
  self.assertEqual(result['dependencies'],['/usr/lib/libSystem.B.dylib','/outside/unsafe.dylib'])

 def test_generation_plan_requires_exact_sources_and_never_executes(self):
  self.bind();stage=self.root/'stage';stage.mkdir(mode=0o700);(stage/'prisma').mkdir();(stage/'prisma/schema.prisma').write_text('FIXTURE')
  with patch.object(m,'verify_generation_sources',return_value={'status':'fixture_source_bytes_only'}),patch.object(m,'verify_native_dependencies',return_value={'kind':'fixture_not_real_native_closure'}),patch.object(m,'verify_archived_inputs',return_value={'schemaSha256':hashlib.sha256(b'FIXTURE').hexdigest(),'sourceRevision':'a'*40,'lockSha256':'b'*64}):
   result=m.prepare_generation(stage,self.owned/'engine-inputs',self.root/'repo','a'*40,self.root/'cache',Path('/fixed/node'))
  self.assertFalse(result['generationStarted']);self.assertFalse(result['executionAuthorized'])
  self.assertEqual(result['arguments'],['node_modules/prisma/build/index.js','generate','--schema',str(stage/'prisma/schema.prisma')])
  self.assertEqual(result['engineEnvironment']['PRISMA_SCHEMA_ENGINE_BINARY'],str(self.owned/'engine-inputs/schema-engine'))
  self.assertEqual(result['engineEnvironment']['PRISMA_QUERY_ENGINE_LIBRARY'],str(self.owned/'engine-inputs/libquery_engine-darwin-arm64.dylib.node'))
if __name__=='__main__':unittest.main()
