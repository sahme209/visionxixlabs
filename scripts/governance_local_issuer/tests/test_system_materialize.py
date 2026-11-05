"""Actual System adapter/copy/trace/manifest with synthetic compiler evidence.
No compiler, Node, native observer/host process or signing operation runs."""
from pathlib import Path
import copy,hashlib,json,os,sys,unittest
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import materialize as m,system_build_inputs as s
from governance_local_issuer.manifest import PackageUnavailable
import test_system_build_inputs as adapter_fixtures
MODE='axiom.system-runtime-output-modes/1'
class SystemMaterialize(unittest.TestCase):
 def setUp(self):
  self.f=adapter_fixtures.SystemBuildInputsTests();self.f.setUp();self.addCleanup(self.f.doCleanups)
  self.system=self.f.record();self.stage=self.f.stage;self.run=self.f.run;self.root=self.f.root
  for n in ('cache','bound','generation','output'):(self.root/n).mkdir(mode=0o700)
  files={'.next/BUILD_ID':b'synthetic-build','.next/server/__axiom_private__/release-merge-bootstrap.cjs':b'SYNTHETIC EMITTED PRIVATE INITIALIZER', '.next/required-server-files.json':b'{"files":[".next/server/__axiom_private__/release-merge-bootstrap.cjs"]}','package.json':b'{"name":"synthetic-compiled-app"}','next.config.ts':b'SYNTHETIC CONFIG NEVER RUN','node_modules/next/dist/bin/next':b'SYNTHETIC NEXT NEVER RUN','node_modules/dependency/index.js':b'SUPPORT'}
  for name,data in files.items():
   p=self.stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
  link=self.stage/'node_modules/@axiom/verified-issuer-runtime';link.parent.mkdir();link.symlink_to('../../packages/verified-issuer-runtime')
  trace=self.stage/'.next/server/route.js.nft.json';trace.write_text(json.dumps({'version':1,'files':['../../node_modules/dependency/index.js','../../packages/verified-issuer-runtime/native/origin_guard.node']}))
  self.trace=trace;self.outputs={'routes':1,'traces':1};self.inputs={'sourceRevision':self.f.revision,'sourceArchive':{'archiveSha256':'b'*64,'verifiedRegularFiles':7,'systemBuildInputs':self.system}}
  attempt={'format':'axiom.local-next-build-attempt/1','status':'reserved_before_launch','inputs':self.inputs,'node':{'sha256':hashlib.sha256(self.f.build.read_bytes()).hexdigest(),'size':self.f.build.stat().st_size}}
  result={'format':'axiom.local-next-build-result/1','exit':0,'buildStarted':True,'contractCheckStarted':True,'executionAuthorized':False,'executingIssuerIdentity':'unavailable','buildCompatibilityVerified':False,'descendantQuiescence':'unavailable'}
  (self.run/'attempt.json').write_text(json.dumps(attempt));(self.run/'result.json').write_text(json.dumps(result));(self.run/'node-version.log').write_text('v24.21.0\n')
  observed={'format':'axiom.local-completed-build-observation/1','sourceRevision':self.f.revision,'status':'build_outputs_observed_unqualified','compilerExit':0,'compilerRerun':False,'generationRerun':False,'originalResult':result,'originalResultSha256':hashlib.sha256((self.run/'result.json').read_bytes()).hexdigest(),'observerSourceSha256':'c'*64,'inputs':self.inputs,'outputs':self.outputs,'buildOutputsVerified':True,'buildCompatibilityVerified':False,'completeExecutableClosure':'unavailable','descendantQuiescence':'unavailable','executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False}
  self.observation=self.root/'completed-observation.json';self.observation.write_text(json.dumps(observed))
  self.builder=SimpleNamespace(prepare_build_inputs=lambda *a,**k:self.inputs,verify_build_outputs=lambda *a:self.outputs,verify_framework_declaration=lambda *a:{'synthetic':True})
  self.observer_roots=[]
 def observer(self,root):
  self.observer_roots.append(Path(root));return {'unresolved':[],'runtimeQualification':'unavailable','systemInstallNames':['/usr/lib/libSystem.B.dylib'],'machOFiles':[],'syntheticObserver':True}
 def build(self,mode=MODE):
  with patch.object(m,'_source_builder',return_value=self.builder),patch.object(m,'collect_native_prerequisites',side_effect=self.observer),patch('governance_local_issuer.native_overlay.verify_overlay',side_effect=AssertionError('legacy overlay invoked')):
   kwargs={}if mode is None else {'system_mode_map':mode}
   return m.materialize_isolated(self.observation,self.run,self.stage,self.f.repo,self.root/'cache',self.root/'bound',self.root/'generation',self.f.build,self.root/'output/package',**kwargs)
 def test_default_missing_mode_mapping_refuses_before_copy(self):
  with self.assertRaisesRegex(PackageUnavailable,'system_explicit_mode_map_required'):self.build(None)
  self.assertFalse((self.root/'output/package').exists())
 def test_actual_adapter_connected_copy_provenance_and_canonical_manifest(self):
  original={k:Path(v['path']).read_bytes()for k,v in self.system['roleArtifacts'].items()}
  result=self.build();out=self.root/'output/package'
  self.assertEqual((out/'__axiom_runtime__/node').read_bytes(),original['node']);self.assertNotEqual((out/'__axiom_runtime__/node').read_bytes(),self.f.build.read_bytes())
  for target,role in [('__axiom_runtime__/origin-bootstrap','bootstrap'),('node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node','guard')]:self.assertEqual((out/target).read_bytes(),original[role])
  self.assertFalse((out/'node_modules/@axiom/verified-issuer-runtime').is_symlink());self.assertFalse((out/'packages/verified-issuer-runtime').exists())
  self.assertEqual((out/'.next/server/__axiom_private__/release-merge-bootstrap.cjs').read_bytes(),b'SYNTHETIC EMITTED PRIVATE INITIALIZER')
  self.assertEqual((out/'__axiom_runtime__/node').stat().st_mode&0o777,0o755);self.assertEqual((out/'__axiom_runtime__/origin-bootstrap').stat().st_mode&0o777,0o755);self.assertEqual((out/'node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node').stat().st_mode&0o777,0o644)
  for role,b in self.system['roleArtifacts'].items():self.assertEqual(Path(b['path']).read_bytes(),original[role]);self.assertEqual(Path(b['path']).stat().st_mode&0o777,0o600)
  audit=json.loads((self.root/'output/materialization.json').read_text());self.assertEqual(audit['systemBuildInputs'],self.system);self.assertEqual(audit['systemOutputModeMap']['name'],MODE);self.assertEqual(audit['buildToolNode']['sha256'],self.system['buildNode']['sha256']);self.assertEqual(set(audit['systemCompanions']['files']),{'owner','broker','controller','maintenance'})
  for role,value in audit['systemCompanions']['files'].items():self.assertEqual(Path(value['materializedPath']).read_bytes(),original[role]);self.assertFalse(Path(value['materializedPath']).is_relative_to(out))
  self.assertEqual(len(self.observer_roots),2);self.assertEqual(result['qualification'],'package_file_set_verified');self.assertFalse(result['executionAuthorized']);self.assertEqual(result['runtimeLaunchability'],'unavailable')
  manifest=json.loads((out/'_axiom_local_issuer_manifest.json').read_text());self.assertEqual(manifest['runtime']['entrypoint'],'__axiom_runtime__/node')
  trace=json.loads((out/'.next/server/route.js.nft.json').read_text());self.assertIn('../../node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node',trace['files'])
 def test_wrong_mode_map_refuses(self):
  with self.assertRaisesRegex(PackageUnavailable,'system_explicit_mode_map_required'):self.build('arbitrary-map')
 def test_external_role_mutation_refuses(self):
  (self.root/'broker').write_bytes(b'changed-role')
  with self.assertRaises(PackageUnavailable):self.build()
 def test_generated_guard_mutation_refuses(self):
  (self.stage/s.GENERATED_STAGE[0]).write_bytes(b'changed-guard')
  with self.assertRaises(PackageUnavailable):self.build()
 def test_source_and_recorded_dependency_must_stay_current(self):
  (self.f.repo/'packages/verified-issuer-runtime/index.cjs').write_bytes(b'changed-source')
  with self.assertRaises(PackageUnavailable):self.build()
 def test_trace_cannot_pull_unreviewed_native_source(self):
  native=self.stage/'packages/verified-issuer-runtime/native/unreviewed.c';native.write_bytes(b'UNREVIEWED NATIVE SOURCE')
  self.trace.write_text(json.dumps({'version':1,'files':['../../packages/verified-issuer-runtime/native/unreviewed.c']}))
  with self.assertRaisesRegex(PackageUnavailable,'native_runtime_input_outside_explicit_distribution'):self.build()
 def test_companion_closure_uncertainty_refuses(self):
  def uncertain(root):
   self.observer_roots.append(Path(root));return {'unresolved':[{'file':'owner','reason':'unbound dylib'}]if'companion'in Path(root).name else[]}
  self.observer=uncertain
  with self.assertRaisesRegex(PackageUnavailable,'native_dependency_resolution_unavailable'):self.build()
 def test_both_profiles_refuse(self):
  (self.stage/'_axiom_native_overlay.json').write_text('{}')
  with self.assertRaises(PackageUnavailable):self.build()
 def test_unbound_companion_file_before_manifest_refuses(self):
  original=self.observer
  def mutate(root):
   value=original(root)
   if Path(root).name=='system-companions':(Path(root)/'unbound.native').write_bytes(b'UNBOUND MACHO INPUT')
   return value
  self.observer=mutate
  with self.assertRaisesRegex(PackageUnavailable,'system_companion_inventory_changed'):self.build()
 def test_companion_mode_promotion_before_manifest_refuses(self):
  original=self.observer
  def mutate(root):
   value=original(root)
   if Path(root).name=='system-companions':(Path(root)/'Axiom Synthetic Custodian.app/Contents/Helpers/AxiomSyntheticLaunchOwner').chmod(0o755)
   return value
  self.observer=mutate
  with self.assertRaisesRegex(PackageUnavailable,'system_companion_inventory_changed'):self.build()
 def test_companion_equal_bytes_replacement_before_manifest_refuses(self):
  original=self.observer
  def mutate(root):
   value=original(root)
   if Path(root).name=='system-companions':
    p=Path(root)/'Axiom Synthetic Custodian.app/Contents/Helpers/AxiomSyntheticLaunchOwner';data=p.read_bytes();p.unlink();p.write_bytes(data);p.chmod(0o600)
   return value
  self.observer=mutate
  with self.assertRaisesRegex(PackageUnavailable,'system_companion_inventory_changed'):self.build()
 def test_dependency_changes_after_copy_refuse(self):
  original=self.observer
  def mutate(root):
   value=original(root)
   if Path(root).name=='package':(self.stage/'node_modules/dependency/index.js').write_bytes(b'CHANGED SUPPORT')
   return value
  self.observer=mutate
  with self.assertRaisesRegex(PackageUnavailable,'materialization_source_changed_after_copy'):self.build()
 def test_companion_mutation_during_manifest_cannot_reach_success(self):
  write=m.write_manifest
  def mutate(*args,**kwargs):
   value=write(*args,**kwargs)
   p=self.root/'output/system-companions/Axiom Synthetic Custodian.app/Contents/Helpers/AxiomSyntheticLaunchOwner';p.chmod(0o755)
   return value
  with patch.object(m,'write_manifest',side_effect=mutate),self.assertRaisesRegex(PackageUnavailable,'system_companion_inventory_changed'):self.build()
 def test_copied_completed_receipts_cannot_change_planned_build_run(self):
  other=self.root/'different-build-run';other.mkdir(mode=0o700)
  for name in ('attempt.json','result.json','node-version.log'):(other/name).write_bytes((self.run/name).read_bytes())
  with patch.object(m,'_source_builder',return_value=self.builder),patch.object(m,'collect_native_prerequisites',side_effect=self.observer),self.assertRaisesRegex(PackageUnavailable,'system_completed_build_run_mismatch'):
   m.materialize_isolated(self.observation,other,self.stage,self.f.repo,self.root/'cache',self.root/'bound',self.root/'generation',self.f.build,self.root/'output/package',system_mode_map=MODE)
if __name__=='__main__':unittest.main()
