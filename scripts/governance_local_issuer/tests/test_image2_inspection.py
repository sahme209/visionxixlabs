"""Fixed image2 addition only: pure/mock; never child/mount/host operations."""
from pathlib import Path
import json,plistlib,sys,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.tests import test_image_inspection as fixtures
from governance_local_issuer import image_inspection as i,container_assembly as a
class FixedImage2NamespaceTests(unittest.TestCase):
 # Reuse only ordinary-file/mock setup, without inheriting/repeating its cases.
 def setUp(self):
  self.actual_run=i._run;fixtures.ImageInspectionTests.setUp(self);self.fresh=self.root/'fresh';self.fresh.mkdir(mode=0o700);self.fresh_image=self.fresh/'image/issuer-package.dmg';self.fresh_image.parent.mkdir(mode=0o700);self.fresh_image.write_bytes(self.image.read_bytes());self.fresh_image.chmod(0o600)
  self.stack.enter_context(patch.object(i,'IMAGE2_ROOT',self.fresh,create=True))
 def inspect(self):return i.inspect_image(a.binding(self.image),self.package)
 def fresh_proof(self):
  self.attach=plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk10s1','mount-point':str(self.fresh/'mount')}]});return i.inspect_image(a.binding(self.fresh_image),self.package)
 def test_fresh_fixed_attach_uses_its_matching_mount(self):
  self.assertEqual(i._attach_argv(self.fresh_image),['/usr/bin/hdiutil','attach','-readonly','-nobrowse','-noautoopen','-plist','-mountpoint',str(self.fresh/'mount'),str(self.fresh_image)])
 def test_fresh_complete_saved_proof_and_legacy_proof_both_verify(self):
  old=self.inspect();fresh=self.fresh_proof()
  self.assertEqual(i.verify_recorded_inspection(a.binding(old),a.binding(self.image),self.package)['state'],'content_verified_detached')
  self.assertEqual(i.verify_recorded_inspection(a.binding(fresh),a.binding(self.fresh_image),self.package)['state'],'content_verified_detached')
  self.assertEqual(self.calls[-1],['/usr/bin/hdiutil','detach','/dev/disk10s1'])
 def test_unknown_lexical_alias_and_symlink_namespace_refuse_before_command(self):
  alias=self.root/'fresh-alias';alias.symlink_to(self.fresh,target_is_directory=True)
  for path in (self.root/'other/image/issuer-package.dmg',str(self.fresh)+'/image/../image/issuer-package.dmg',str(self.fresh)+'/image//issuer-package.dmg',alias/'image/issuer-package.dmg'):
   with self.subTest(path=str(path)),self.assertRaises(ValueError):i._attach_argv(path)
  self.assertEqual(self.calls,[])
 def test_supported_root_that_is_itself_symlink_refuses(self):
  alias=self.root/'selected-alias';alias.symlink_to(self.fresh,target_is_directory=True)
  with patch.object(i,'IMAGE2_ROOT',alias),self.assertRaises(ValueError):i._attach_argv(alias/'image/issuer-package.dmg')
 def test_cross_root_image_mount_command_logs_and_device_refuse(self):
  old=self.inspect();fresh=self.fresh_proof();original=json.loads(old.read_text());new=json.loads(fresh.read_text())
  def check(value):
   candidate=self.root/'candidate.json';candidate.write_text(json.dumps(value));candidate.chmod(0o600)
   with self.assertRaises(ValueError):i.verify_recorded_inspection(a.binding(candidate),a.binding(self.image),self.package)
  for field in ('imageBefore','mountPath','attachRecord','detachRecord','device'):
   with self.subTest(field=field):value=json.loads(json.dumps(original));value[field]=new[field];check(value)
  # Even identical empty stderr must belong to the same fixed producer run.
  command_path=Path(original['attachRecord']['path']);command=json.loads(command_path.read_text());other=json.loads(Path(new['attachRecord']['path']).read_text());command['stderr']=other['stderr'];command_path.write_text(json.dumps(command));value=json.loads(json.dumps(original));value['attachRecord']=a.binding(command_path);check(value)
 def test_exact_fresh_image_symlink_is_not_an_allowed_alias(self):
  self.fresh_image.unlink();self.fresh_image.symlink_to(self.image)
  with self.assertRaises(ValueError):i.inspect_image({'path':str(self.fresh_image)},self.package)
  self.assertEqual(self.calls,[])
 def test_fresh_attach_reporting_legacy_mount_stays_unknown_without_detach(self):
  with self.assertRaises(i.InspectionStopped)as cm:i.inspect_image(a.binding(self.fresh_image),self.package)
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_fresh_known_nonreadonly_mount_detaches_owned_device_but_refuses(self):
  self.identity['readOnly']=False
  with self.assertRaises(i.InspectionStopped)as cm:self.fresh_proof()
  self.assertFalse(cm.exception.possible_mounted_image);self.assertEqual(self.calls[-1],['/usr/bin/hdiutil','detach','/dev/disk10s1'])
 def test_real_bounded_runner_accepts_only_matching_fixed_fresh_attach(self):
  with patch.object(i,'_run',self.actual_run):
   result,child=fixtures.BoundedImageRunnerTests().exercise(image=self.fresh_image)
  self.assertEqual(result['cleanup'],'reaped_original_child');child.kill.assert_not_called()
  argv=i._attach_argv(self.fresh_image);argv[-2]=str(self.root/'mount')
  with patch.object(i.subprocess,'Popen')as no_launch,self.assertRaises(ValueError):self.actual_run(argv,90)
  no_launch.assert_not_called()
 def test_actual_container_reader_accepts_new_namespace_proof(self):
  from governance_local_issuer.tests import test_container_assembly as fixtures
  f=fixtures.ContainerAssemblyTests();f.setUp();self.addCleanup(f.doCleanups)
  # Its exact synthetic package/main/companion/image evidence is joined through
  # the real container reader; only OS attach/statvfs/content are mocked here.
  freshroot=f.root/'new-image-run';freshroot.mkdir(mode=0o700);image=freshroot/'image/issuer-package.dmg';image.parent.mkdir(mode=0o700);image.write_bytes(f.image.read_bytes());image.chmod(0o600)
  with patch.object(i,'IMAGE2_ROOT',freshroot):
   self.assertEqual(a._inputs(f.packet)['image'],a.binding(f.image))
   completion=json.loads(f.imageproof.read_text());package={k:completion[k]for k in ('sourcePackage','sourceRevision','packageDigest','manifestSha256')};identity={'stDev':17,'stIno':19,'readOnly':True}
   def run(argv,seconds):return {'argv':argv,'state':'completed','exit':0,'stdout':plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk11s1','mount-point':str(freshroot/'mount')}]})if 'attach'in argv else b'','stderr':b'','cleanup':'reaped_original_child'}
   with patch.object(i,'_run',side_effect=run),patch.object(i,'_mount_identity',return_value=identity),patch.object(i,'_namespace_restored',return_value=True),patch.object(i,'_content',return_value={'qualification':'package_file_set_verified',**{k:package[k]for k in ('sourceRevision','packageDigest','manifestSha256')}}):proof=i.inspect_image(a.binding(image),package)
   operation=json.loads(f.imageoperation.read_text());operation.update(argv=a._image_argv(f.package,image),image=a.binding(image));f.js(f.imageoperation,operation);completion.update(image=a.binding(image),operationRecord=a.binding(f.imageoperation),mountedObservation=a.binding(proof));f.js(f.imageproof,completion);f.packet_change('imageCompletion',a.binding(f.imageproof));actual=a._inputs(f.packet)
   self.assertEqual(actual['image'],a.binding(image));self.assertFalse(actual['packet'].get('executionAuthorized',False))


if __name__=='__main__':unittest.main()
