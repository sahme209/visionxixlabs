"""Owned synthetic packaging fixtures, not native compilation or runtime proof."""
from pathlib import Path
import json,os,sys,tempfile,unittest,io,tarfile,importlib.util
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import native_overlay as n
from governance_local_issuer.manifest import PackageUnavailable,ISOLATED_PROFILE
from governance_local_issuer import materialize as material
class OverlayTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-native-overlay-fixture-',dir='/private/tmp');self.addCleanup(self.temp.cleanup);self.base=Path(self.temp.name);self.base.chmod(0o700);self.stage=self.base/'stage';self.stage.mkdir(mode=0o700);self.build_run=self.base/'build-run';self.build_run.mkdir(mode=0o700);self.control=self.base/'Control.app';(self.control/'Contents/MacOS').mkdir(parents=True)
  self.node=self.base/'runtime/bin/node';self.node.parent.mkdir(parents=True);self.node.write_bytes(b'FIXTURE NOT NODE');self.node.chmod(0o755)
  headers=self.node.parent.parent/'include/node';headers.mkdir(parents=True)
  for name in ('node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'):(headers/name).write_text('HEADER FIXTURE')
  self.patchNode=patch.object(n,'PINNED_NODE',self.node);self.patchNode.start();self.addCleanup(self.patchNode.stop)
  self.patchSign=patch.object(n,'verify_requirement',return_value=None);self.patchSign.start();self.addCleanup(self.patchSign.stop)
  for name in n.SOURCE_INPUTS:
   p=self.stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('SOURCE FIXTURE '+name)
  for name in n.PACKAGE_FILES:
   p=self.stage/n.PACKAGE_PATH/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('RUNTIME FIXTURE '+name)
  for name in n.GENERATED_STAGE:
   p=self.stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'FIXTURE COMPILED OUTPUT');p.chmod(0o755)
  for name in n.CONTROL_TOOLS.values():
   p=self.control/'Contents/MacOS'/name;p.write_bytes(b'FIXTURE CONTROL OUTPUT');p.chmod(0o755)
  package=self.stage/n.PACKAGE_PATH/'package.json';package.write_text(json.dumps({'name':'@axiom/verified-issuer-runtime','files':list(n.NPM_FILES)}))
  self.layout={'packageRoot':str(self.base/'mount'),'controlApp':str(self.control),'imageBacking':str(self.control/'Contents/Resources/issuer-package.dmg'),'spawnClaim':str(self.base/'issuer-startup-claim.json'),'service':n.SERVICE}
  self.requirements={'node':'cdhash H"'+'1'*40+'"','controller':'cdhash H"'+'2'*40+'"','broker':'cdhash H"'+'3'*40+'"'}
 def record(self):return n.record_overlay(self.stage,'a'*40,self.node,self.layout,self.requirements,self.build_run)
 def test_prebuild_snapshot_is_unqualified_and_closes_exact_files(self):
  result=self.record();self.assertFalse(result['executionAuthorized']);self.assertEqual(result['runtimeQualification'],'unavailable');self.assertEqual(n.verify_overlay(self.stage),result);self.assertEqual(set(result['stageArtifacts']),set(n.GENERATED_STAGE));self.assertEqual(set(result['controlArtifacts']),set(n.CONTROL_TOOLS));self.assertNotIn('origin-unit',str(result['runtimePackageFiles']))
 def test_changed_output_or_source_refuses(self):
  self.record();(self.stage/n.GENERATED_STAGE[0]).write_bytes(b'changed')
  with self.assertRaises(PackageUnavailable):n.verify_overlay(self.stage)
 def test_changed_node_or_control_refuses(self):
  self.record();self.node.write_bytes(b'changed')
  with self.assertRaises(PackageUnavailable):n.verify_overlay(self.stage)
 def test_existing_receipt_refuses(self):
  self.record()
  with self.assertRaises(PackageUnavailable):self.record()
 def test_parent_alias_and_expanded_distribution_refuse(self):
  native=self.stage/n.PACKAGE_PATH/'native';native.rename(self.base/'external-native');native.symlink_to(self.base/'external-native')
  with self.assertRaisesRegex(PackageUnavailable,'canonical_artifact'):self.record()
  native.unlink();(self.base/'external-native').rename(native)
  package=self.stage/n.PACKAGE_PATH/'package.json';data=json.loads(package.read_text());data['files'].append('origin-unit/*');package.write_text(json.dumps(data))
  with self.assertRaisesRegex(PackageUnavailable,'allowlist'):self.record()
 def test_compile_order_is_acyclic_and_has_no_run_or_mount(self):
  recipe=n.compile_recipe(self.stage,self.node,self.layout,self.requirements)
  self.assertEqual([x['role'] for x in recipe],['controller','broker','bootstrap','guard']);self.assertTrue(all(x['operation']=='compile_only' for x in recipe));self.assertFalse(any('hdiutil' in str(x) or '--register' in str(x) for x in recipe));self.assertEqual(json.loads(next(x.split('=',1)[1]for x in recipe[1]['argv']if x.startswith('-DAXIOM_ISSUER_CONTROLLER_REQUIREMENT='))),self.requirements['controller']);self.assertEqual(json.loads(next(x.split('=',1)[1]for x in recipe[3]['argv']if x.startswith('-DAXIOM_ISSUER_BROKER_REQUIREMENT='))),self.requirements['broker'])
 def test_source_header_and_control_changes_are_bound(self):
  self.record();source=self.stage/n.SOURCE_INPUTS[0];original=source.read_bytes();source.write_bytes(b'CHANGED SOURCE')
  with self.assertRaises(PackageUnavailable):n.verify_overlay(self.stage)
  source.write_bytes(original);header=self.node.parent.parent/'include/node/node_api.h';original=header.read_bytes();header.write_bytes(b'CHANGED HEADER')
  with self.assertRaises(PackageUnavailable):n.verify_overlay(self.stage)
  header.write_bytes(original);(self.control/'Contents/MacOS'/n.CONTROL_TOOLS['broker']).write_bytes(b'CHANGED BROKER')
  with self.assertRaises(PackageUnavailable):n.verify_overlay(self.stage)
 def test_cannot_record_into_completed_stage_or_started_build_run(self):
  (self.build_run/'attempt.json').write_text('PREEXISTING')
  with self.assertRaisesRegex(PackageUnavailable,'fresh_build_run'):self.record()
  (self.build_run/'attempt.json').unlink();(self.stage/'.next').mkdir()
  with self.assertRaisesRegex(PackageUnavailable,'precede_build'):self.record()
 def test_actual_source_archive_hook_accepts_only_declared_overlay(self):
  overlay=self.record();data=io.BytesIO()
  with tarfile.open(fileobj=data,mode='w')as archive:
   for path in sorted(self.stage.rglob('*')):
    relative=path.relative_to(self.stage).as_posix()
    if relative==n.RECEIPT or relative in n.GENERATED_STAGE:continue
    info=tarfile.TarInfo(relative);info.mode=path.stat().st_mode&0o777
    if path.is_dir():info.type=tarfile.DIRTYPE;archive.addfile(info)
    else:body=path.read_bytes();info.size=len(body);archive.addfile(info,io.BytesIO(body))
  spec=importlib.util.spec_from_file_location('overlay_source_builder',Path(__file__).parents[2]/'build-local-issuer-package-source.py');builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
  with patch.object(builder,'git_bytes',return_value=data.getvalue()):
   result=builder.verify_build_archive(self.stage,self.base/'repo','a'*40);self.assertEqual(result['nativeOverlay'],overlay)
   with self.assertRaises(builder.Unavailable):builder.verify_build_archive(self.stage,self.base/'repo','b'*40)
   archived=io.BytesIO()
   with tarfile.open(fileobj=archived,mode='w')as archive:
    info=tarfile.TarInfo(n.GENERATED_STAGE[0]);body=(self.stage/n.GENERATED_STAGE[0]).read_bytes();info.mode=0o755;info.size=len(body);archive.addfile(info,io.BytesIO(body))
   with patch.object(builder,'git_bytes',return_value=archived.getvalue()),self.assertRaisesRegex(builder.Unavailable,'must_be_generated'):builder.verify_build_archive(self.stage,self.base/'repo','a'*40)
   (self.stage/'undeclared.node').write_bytes(b'NOT DECLARED')
   with self.assertRaises(builder.Unavailable):builder.verify_build_archive(self.stage,self.base/'repo','a'*40)

 def test_diagnostic_native_file_is_not_allowlisted(self):
  self.assertNotIn('origin-unit/broker.c',n.NPM_FILES);self.assertNotIn('native/capability_guard.node',n.NPM_FILES);self.assertNotIn('native/origin-bootstrap',n.NPM_FILES)
class MaterializationOverlayTests(unittest.TestCase):
 setUp=OverlayTests.setUp
 def prepare(self,diagnostic_trace=False):
  overlay=n.record_overlay(self.stage,'a'*40,self.node,self.layout,self.requirements,self.build_run)
  for name,body in {'.next/BUILD_ID':b'fixture','.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}','package.json':b'{"name":"fixture"}','next.config.ts':b'FIXTURE','node_modules/next/dist/bin/next':b'FIXTURE'}.items():
   p=self.stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body)
  runtime=self.stage/n.PACKAGE_PATH
  for name in ('origin-unit/diagnostic.cjs','native/capability_guard.c','native/test_only.c'):
   p=runtime/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('EXCLUDED SOURCE FIXTURE')
  link=self.stage/'node_modules/@axiom/verified-issuer-runtime';link.parent.mkdir(parents=True);link.symlink_to('../../packages/verified-issuer-runtime')
  trace=self.stage/'.next/server/route.js.nft.json';trace.parent.mkdir(parents=True)
  target=runtime/('origin-unit/diagnostic.cjs' if diagnostic_trace else 'index.cjs')
  trace.write_text(json.dumps({'version':1,'files':[os.path.relpath(target,trace.parent)]}))
  output=self.base/'output';output.mkdir(mode=0o700)
  details={'source':'a'*40,'archiveSha256':'b'*64,'verifiedRegularFiles':1,'exit':0,'nodeVersion':'v24.21.0','stage':str(self.stage),'nativeOverlay':overlay}
  return details,output/'package'
 def test_exact_allowlist_and_bootstrap_relocation_keep_unqualified(self):
  details,destination=self.prepare()
  with patch.object(material,'collect_native_prerequisites',return_value={'unresolved':[]}):result=material._materialize(details,'c'*64,self.node,destination,profile=ISOLATED_PROFILE)
  root=destination/'node_modules/@axiom/verified-issuer-runtime'
  self.assertEqual(set(p.relative_to(root.resolve()).as_posix()for p in root.resolve().rglob('*')if p.is_file()),set(n.PACKAGE_FILES))
  self.assertEqual((destination/'__axiom_runtime__/origin-bootstrap').read_bytes(),b'FIXTURE COMPILED OUTPUT')
  self.assertFalse(result['executionAuthorized']);self.assertEqual(result['executingIssuerIdentity'],'unavailable')
 def test_traced_diagnostic_refuses_instead_of_silent_omission(self):
  details,destination=self.prepare(True)
  with patch.object(material,'collect_native_prerequisites',return_value={'unresolved':[]}),self.assertRaisesRegex(PackageUnavailable,'outside_explicit_distribution'):material._materialize(details,'c'*64,self.node,destination,profile=ISOLATED_PROFILE)
 def test_node_changed_after_overlay_precheck_cannot_be_copied_as_new_authority(self):
  details,destination=self.prepare();original=n.verify_overlay;changed=False
  def mutate_after_precheck(*args,**kwargs):
   nonlocal changed
   result=original(*args,**kwargs)
   if not changed:
    changed=True;self.node.write_bytes(b'CHANGED NODE AFTER PRECHECK')
   return result
  with patch.object(n,'verify_overlay',side_effect=mutate_after_precheck),patch.object(material,'collect_native_prerequisites',return_value={'unresolved':[]}),self.assertRaises(PackageUnavailable):material._materialize(details,'c'*64,self.node,destination,profile=ISOLATED_PROFILE)
  self.assertTrue(changed);self.assertFalse(destination.exists());self.assertFalse((destination.parent/'materialization.json').exists())
 def test_source_changed_after_copy_refuses_before_receipt_or_manifest(self):
  details,destination=self.prepare()
  def mutate_after_copy(root):
   (self.stage/n.SOURCE_INPUTS[0]).write_bytes(b'CHANGED SOURCE AFTER COPY')
   return {'unresolved':[]}
  with patch.object(material,'collect_native_prerequisites',side_effect=mutate_after_copy),self.assertRaises(PackageUnavailable):material._materialize(details,'c'*64,self.node,destination,profile=ISOLATED_PROFILE)
  self.assertFalse(destination.exists());self.assertFalse((destination.parent/'materialization.json').exists())
 def test_postbuild_native_mutation_refuses_without_stage_repair(self):
  details,destination=self.prepare();(self.stage/n.GENERATED_STAGE[0]).write_bytes(b'CHANGED')
  with self.assertRaises(PackageUnavailable):material._materialize(details,'c'*64,self.node,destination,profile=ISOLATED_PROFILE)

if __name__=='__main__':unittest.main()
