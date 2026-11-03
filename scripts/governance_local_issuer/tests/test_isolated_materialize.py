"""Isolated evidence/copy fixtures, not a compiled/runtime identity qualification."""
from pathlib import Path
import hashlib,json,os,sys,tempfile,unittest
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
import governance_local_issuer.materialize as m
from governance_local_issuer.manifest import PackageUnavailable
class IsolatedMaterialize(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-isolated-materialize-unit-',dir='/private/tmp');self.root=Path(self.temp.name);self.root.chmod(0o700)
  for name in ['stage','build-run','generation-run','bound','cache','repo','output']:(self.root/name).mkdir(mode=0o700)
  self.stage=self.root/'stage';deps=self.stage/'node_modules';deps.mkdir()
  for name,body in {'.next/BUILD_ID':b'fixture','.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}','package.json':b'{"name":"fixture"}','next.config.ts':b'FIXTURE NEVER EXECUTED','node_modules/next/dist/bin/next':b'FIXTURE NEVER EXECUTED','node_modules/dependency/index.js':b'FIXTURE DEPENDENCY'}.items():
   path=self.stage/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body)
  trace=self.stage/'.next/server/route.js.nft.json';trace.parent.mkdir(parents=True);trace.write_text(json.dumps({'version':1,'files':['../../node_modules/dependency/index.js']}))
  package=self.stage/'packages/verified-issuer-runtime';package.mkdir(parents=True);(package/'index.cjs').write_text('FIXTURE UNAVAILABLE');(package/'support.cjs').write_text('SUPPORT')
  link=deps/'@axiom/verified-issuer-runtime';link.parent.mkdir();link.symlink_to('../../packages/verified-issuer-runtime')
  self.node=self.root/'fixture-node';self.node.write_bytes(b'FIXTURE NOT REAL NODE');self.node.chmod(0o755)
  self.inputs={'sourceRevision':'a'*40,'sourceArchive':{'archiveSha256':'b'*64,'verifiedRegularFiles':4},'executingIssuerIdentity':'unavailable','executionAuthorized':False}
  self.outputs={'requiredMetadata':{},'routeCount':1,'traceCount':1,'traceEntryCount':1,'completeExecutableClosure':'unavailable','loadedCodeIdentity':'unavailable'}
  self.attempt={'format':'axiom.local-next-build-attempt/1','status':'reserved_before_launch','inputs':self.inputs,'node':{'sha256':hashlib.sha256(self.node.read_bytes()).hexdigest(),'size':self.node.stat().st_size},'processBounds':'original_process_group_only','descendantQuiescence':'unavailable','executionAuthorized':False}
  self.failed={'format':'axiom.local-next-build-result/1','exit':0,'buildStarted':True,'contractCheckStarted':True,'status':'unavailable','reason':'next_trace_entry_limit','executionAuthorized':False,'executingIssuerIdentity':'unavailable','buildCompatibilityVerified':False,'descendantQuiescence':'unavailable'}
  self.run=self.root/'build-run';(self.run/'attempt.json').write_text(json.dumps(self.attempt));(self.run/'result.json').write_text(json.dumps(self.failed));(self.run/'node-version.log').write_bytes(b'v24.21.0\n')
  self.observation={'format':'axiom.local-completed-build-observation/1','sourceRevision':'a'*40,'status':'build_outputs_observed_unqualified','compilerExit':0,'compilerRerun':False,'generationRerun':False,'originalResult':self.failed,'originalResultSha256':hashlib.sha256((self.run/'result.json').read_bytes()).hexdigest(),'observerSourceSha256':'c'*64,'inputs':self.inputs,'outputs':self.outputs,'buildOutputsVerified':True,'buildCompatibilityVerified':False,'completeExecutableClosure':'unavailable','descendantQuiescence':'unavailable','executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False}
  self.observation_path=self.root/'completed.json';self.save()
  self.builder=SimpleNamespace(prepare_build_inputs=lambda *a,**kw:self.inputs,verify_build_outputs=lambda *a:self.outputs,verify_framework_declaration=lambda *a:{'profile':'fixture_derived_type_only'})
 def tearDown(self):self.temp.cleanup()
 def save(self):self.observation_path.write_text(json.dumps(self.observation))
 def details(self):
  with patch.object(m,'_source_builder',return_value=self.builder):return m.isolated_build_details(self.observation_path,self.run,self.stage,self.root/'repo',self.root/'cache',self.root/'bound',self.root/'generation-run',self.node)
 def test_original_failure_preserved_and_source_outputs_independently_rechecked(self):
  before=(self.run/'result.json').read_bytes();details,evidence=self.details()
  self.assertEqual(details['source'],'a'*40);self.assertEqual(details['stage'],str(self.stage));self.assertEqual(evidence['originalBuildResultSha256'],hashlib.sha256(before).hexdigest());self.assertEqual((self.run/'result.json').read_bytes(),before)
  self.builder.prepare_build_inputs=lambda *a,**kw:{**self.inputs,'sourceRevision':'d'*40}
  with self.assertRaises(PackageUnavailable):self.details()
 def test_forged_boolean_cannot_hide_changed_outputs_or_failed_compile(self):
  self.builder.verify_build_outputs=lambda *a:{**self.outputs,'routeCount':2}
  with self.assertRaises(PackageUnavailable):self.details()
  self.builder.verify_build_outputs=lambda *a:self.outputs;self.failed['exit']=1;(self.run/'result.json').write_text(json.dumps(self.failed));self.observation['originalResult']=self.failed;self.observation['originalResultSha256']=hashlib.sha256((self.run/'result.json').read_bytes()).hexdigest();self.save()
  with self.assertRaises(PackageUnavailable):self.details()
 def test_isolated_real_dependencies_archive_link_complete_and_no_identity(self):
  before=(self.run/'result.json').read_bytes()
  with patch.object(m,'_source_builder',return_value=self.builder),patch.object(m,'collect_native_prerequisites',return_value={'unresolved':[],'runtimeQualification':'unavailable'}):
   result=m.materialize_isolated(self.observation_path,self.run,self.stage,self.root/'repo',self.root/'cache',self.root/'bound',self.root/'generation-run',self.node,self.root/'output/package')
  self.assertFalse(result['executionAuthorized']);self.assertEqual(result['executingIssuerIdentity'],'unavailable');self.assertEqual((self.run/'result.json').read_bytes(),before)
  self.assertEqual((self.root/'output/package/node_modules/@axiom/verified-issuer-runtime/support.cjs').read_text(),'SUPPORT')
  manifest=json.loads((self.root/'output/package/_axiom_local_issuer_manifest.json').read_text());self.assertEqual(manifest['profile'],'next-start-darwin-arm64/2')
  audit=json.loads((self.root/'output/materialization.json').read_text());self.assertEqual(audit['format'],'axiom.local-issuer-materialization/2');self.assertIn('isolatedBuildEvidence',audit)
 def test_new_profile_refuses_workspace_dependency_symlink_before_copy(self):
  deps=self.stage/'node_modules';deps.rename(self.root/'external');deps.symlink_to(self.root/'external')
  with self.assertRaises(PackageUnavailable):self.details()
if __name__=='__main__':unittest.main()
