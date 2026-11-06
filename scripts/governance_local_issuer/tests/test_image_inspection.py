"""Pure/mock image inspection; no child, mount, statvfs or device operation."""
from pathlib import Path
import json,plistlib,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import image_inspection as i,container_assembly as a
class ImageInspectionTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(dir='/private/tmp');self.addCleanup(self.t.cleanup);self.root=Path(self.t.name);self.root.chmod(0o700)
  self.image=self.root/'image/issuer-package.dmg';self.image.parent.mkdir(mode=0o700);self.image.write_bytes(b'FIXTURE IMAGE');self.image.chmod(0o600)
  self.stack=__import__('contextlib').ExitStack();self.addCleanup(self.stack.close);self.stack.enter_context(patch.object(i,'RUN_ROOT',self.root))
  self.identity={'stDev':7,'stIno':11,'readOnly':True};self.mount=self.root/'mount';self.package={'sourcePackage':'/private/tmp/FIXTURE-PACKAGE','sourceRevision':'a'*40,'packageDigest':'b'*64,'manifestSha256':'c'*64}
  self.attach=plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk9s1','mount-point':str(self.mount)}]})
  self.calls=[]
  def run(argv,seconds):
   self.calls.append(argv)
   return {'argv':argv,'state':'completed','exit':0,'stdout':self.attach if 'attach'in argv else b'','stderr':b'','cleanup':'reaped_original_child'}
  self.runner=self.stack.enter_context(patch.object(i,'_run',side_effect=run));self.identity_mock=self.stack.enter_context(patch.object(i,'_mount_identity',return_value=self.identity))
  self.namespace=self.stack.enter_context(patch.object(i,'_namespace_restored',return_value=True))
  self.content=self.stack.enter_context(patch.object(i,'_content',return_value={'qualification':'package_file_set_verified','packageDigest':'b'*64,'manifestSha256':'c'*64,'sourceRevision':'a'*40}))
 def inspect(self):return i.inspect_image(a.binding(self.image),self.package)
 def test_positive_exit_zero_single_readonly_mount_verified_and_detached_once(self):
  proof=self.inspect();self.assertEqual([x[1]for x in self.calls],['attach','detach']);self.assertEqual(self.calls[-1],['/usr/bin/hdiutil','detach','/dev/disk9s1'])
  p=json.loads(proof.read_text());self.assertEqual(p['state'],'content_verified_detached');self.assertFalse(p['possibleMountedImage']);self.assertFalse(p['executionAuthorized'])
  self.assertEqual(i.verify_recorded_inspection(a.binding(proof),a.binding(self.image),self.package)['state'],'content_verified_detached')
 def test_device_grammar_rejects_options_arbitrary_paths_and_oversized(self):
  for value in ('-force','/tmp/disk1','/dev/rdisk1','/dev/diskx','/dev/disk1\n','/dev/disk'+'1'*140):
   with self.subTest(value=value),self.assertRaises(ValueError):i._device(value)
 def test_ambiguous_or_nonzero_attach_never_speculatively_detaches(self):
  self.attach=plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk9s1','mount-point':str(self.mount)},{'dev-entry':'/dev/disk9s2','mount-point':'/other'}]})
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_reported_mount_without_changed_namespace_is_not_owned(self):
  def same(mount):
   s=mount.lstat();return {'stDev':s.st_dev,'stIno':s.st_ino,'readOnly':True}
  self.identity_mock.side_effect=same
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_nonzero_attach_never_detaches(self):
  self.runner.side_effect=lambda argv,seconds:{'argv':argv,'state':'completed','exit':1,'stdout':self.attach,'stderr':b'FAILED','cleanup':'reaped_original_child'}
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image)
 def test_known_owned_nonreadonly_mount_is_detached_but_never_accepted(self):
  self.identity['readOnly']=False
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertFalse(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_digest_mismatch_detaches_owned_mount_but_never_succeeds(self):
  self.content.return_value={'qualification':'package_file_set_verified','packageDigest':'0'*64,'manifestSha256':'c'*64,'sourceRevision':'a'*40}
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertFalse(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_ownership_loss_never_detaches_replacement(self):
  self.identity_mock.side_effect=[self.identity,{'stDev':8,'stIno':22,'readOnly':True}]
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)
 def test_detach_timeout_retains_possible_mount_and_no_retry(self):
  original=self.runner.side_effect
  def run(argv,seconds):
   if 'detach'in argv:self.calls.append(argv);return {'argv':argv,'state':'timeout','exit':None,'stdout':b'','stderr':b'','cleanup':'unknown'}
   return original(argv,seconds)
  self.runner.side_effect=run
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_detach_exit_zero_without_namespace_restoration_is_unknown(self):
  self.namespace.return_value=False
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual([x[1]for x in self.calls],['attach','detach'])
 def test_image_mutation_after_successful_detach_never_returns_success_proof(self):
  original=self.runner.side_effect
  def run(argv,seconds):
   r=original(argv,seconds)
   if 'detach'in argv:self.image.write_bytes(b'CHANGED AFTER DETACH')
   return r
  self.runner.side_effect=run
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertFalse(cm.exception.possible_mounted_image)
 def test_attach_timeout_never_speculatively_detaches(self):
  self.runner.side_effect=lambda argv,seconds:{'argv':argv,'state':'timeout','exit':None,'stdout':b'','stderr':b'','cleanup':'unknown'}
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(self.runner.call_count,1)
 def test_same_run_is_never_replayed(self):
  self.inspect()
  with self.assertRaises(FileExistsError):self.inspect()
  self.assertEqual(len(self.calls),2)
 def test_image_mutation_before_detach_preserves_unknown_without_speculation(self):
  def content(*args):self.image.write_bytes(b'CHANGED');return {'qualification':'package_file_set_verified',**{k:self.package[k]for k in ('packageDigest','manifestSha256','sourceRevision')}}
  self.content.side_effect=content
  with self.assertRaises(i.InspectionStopped)as cm:self.inspect()
  self.assertTrue(cm.exception.possible_mounted_image);self.assertEqual(len(self.calls),1)

class BoundedImageRunnerTests(unittest.TestCase):
 def exercise(self,timeout=False,overflow=False,image=None):
  from types import SimpleNamespace
  from unittest.mock import Mock
  import selectors,signal,subprocess
  class Pipe:
   def __init__(self,n):self.n=n
   def fileno(self):return self.n
   def close(self):pass
  class Selector:
   def __init__(self):self.entries={}
   def register(self,p,event,name):self.entries[p]=SimpleNamespace(fileobj=p,data=name)
   def get_map(self):return self.entries
   def select(self,t):return [(v,1)for v in list(self.entries.values())]
   def unregister(self,p):self.entries.pop(p)
   def close(self):pass
  child=SimpleNamespace(pid=424242,returncode=None,stdout=Pipe(101),stderr=Pipe(102));child.kill=Mock()
  def wait(timeout):child.returncode=0;return 0
  child.wait=Mock(side_effect=subprocess.TimeoutExpired('SYNTHETIC',1)if timeout else wait)
  with patch.object(i.subprocess,'Popen',return_value=child)as launch,patch.object(i.selectors,'DefaultSelector',return_value=Selector()),patch.object(i.os,'set_blocking'),patch.object(i.os,'read',return_value=b'12345678X'if overflow else b''),patch.object(i.os,'killpg')as no_signal,patch.object(i.time,'monotonic',return_value=0),patch.object(i.signal,'getsignal',return_value=signal.SIG_DFL),patch.object(i,'CAP',8):
   result=i._run(i._attach_argv(image if image is not None else i.RUN_ROOT/'image/issuer-package.dmg'),90);no_signal.assert_not_called();launch.assert_called_once()
  return result,child
 def test_output_cap_kills_only_unreaped_mock_child_and_retains_no_overflow(self):
  r,p=self.exercise(overflow=True);self.assertEqual(r['stdout'],b'12345678');self.assertEqual(r['state'],'output_bound');p.kill.assert_called_once()
 def test_wait_reaped_child_is_never_killed(self):
  r,p=self.exercise();self.assertEqual(r['cleanup'],'reaped_original_child');p.kill.assert_not_called()
 def test_wait_timeout_preserves_unknown_without_replay(self):
  r,p=self.exercise(timeout=True);self.assertEqual(r['state'],'timeout');self.assertEqual(r['cleanup'],'unknown');p.kill.assert_called_once();self.assertEqual(p.wait.call_count,2)


class NamespaceReadbackTests(unittest.TestCase):
 def test_absent_or_exact_writable_original_namespace_only(self):
  from types import SimpleNamespace
  import stat
  path=Path('/private/tmp/SYNTHETIC-NO-QUERY')
  with patch.object(Path,'lstat',side_effect=FileNotFoundError):self.assertTrue(i._namespace_restored(path,{'stDev':7,'stIno':11}))
  record=SimpleNamespace(st_mode=stat.S_IFDIR|0o700,st_uid=i.os.getuid(),st_dev=7,st_ino=11)
  with patch.object(Path,'lstat',return_value=record),patch.object(i.os,'statvfs',return_value=SimpleNamespace(f_flag=0))as query:
   self.assertTrue(i._namespace_restored(path,{'stDev':7,'stIno':11}));query.assert_called_once()
  with patch.object(Path,'lstat',return_value=record),patch.object(i.os,'statvfs')as query:
   self.assertFalse(i._namespace_restored(path,{'stDev':8,'stIno':11}));query.assert_not_called()
  with patch.object(Path,'lstat',return_value=record),patch.object(i.os,'statvfs',return_value=SimpleNamespace(f_flag=i.os.ST_RDONLY)):
   self.assertFalse(i._namespace_restored(path,{'stDev':7,'stIno':11}))

class FixedImageNamespaceTests(unittest.TestCase):
 # Reuse only ordinary-file/mock setup, without inheriting/repeating its cases.
 def setUp(self):
  self.actual_run=i._run;ImageInspectionTests.setUp(self);self.fresh=self.root/'fresh';self.fresh.mkdir(mode=0o700);self.fresh_image=self.fresh/'image/issuer-package.dmg';self.fresh_image.parent.mkdir(mode=0o700);self.fresh_image.write_bytes(self.image.read_bytes());self.fresh_image.chmod(0o600)
  self.stack.enter_context(patch.object(i,'FRESH_RUN_ROOT',self.fresh,create=True))
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
  with patch.object(i,'FRESH_RUN_ROOT',alias),self.assertRaises(ValueError):i._attach_argv(alias/'image/issuer-package.dmg')
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
   result,child=BoundedImageRunnerTests().exercise(image=self.fresh_image)
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
  with patch.object(i,'FRESH_RUN_ROOT',freshroot):
   self.assertEqual(a._inputs(f.packet)['image'],a.binding(f.image))
   completion=json.loads(f.imageproof.read_text());package={k:completion[k]for k in ('sourcePackage','sourceRevision','packageDigest','manifestSha256')};identity={'stDev':17,'stIno':19,'readOnly':True}
   def run(argv,seconds):return {'argv':argv,'state':'completed','exit':0,'stdout':plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk11s1','mount-point':str(freshroot/'mount')}]})if 'attach'in argv else b'','stderr':b'','cleanup':'reaped_original_child'}
   with patch.object(i,'_run',side_effect=run),patch.object(i,'_mount_identity',return_value=identity),patch.object(i,'_namespace_restored',return_value=True),patch.object(i,'_content',return_value={'qualification':'package_file_set_verified',**{k:package[k]for k in ('sourceRevision','packageDigest','manifestSha256')}}):proof=i.inspect_image(a.binding(image),package)
   operation=json.loads(f.imageoperation.read_text());operation.update(argv=a._image_argv(f.package,image),image=a.binding(image));f.js(f.imageoperation,operation);completion.update(image=a.binding(image),operationRecord=a.binding(f.imageoperation),mountedObservation=a.binding(proof));f.js(f.imageproof,completion);f.packet_change('imageCompletion',a.binding(f.imageproof));actual=a._inputs(f.packet)
   self.assertEqual(actual['image'],a.binding(image));self.assertFalse(actual['packet'].get('executionAuthorized',False))

if __name__=='__main__':unittest.main()
