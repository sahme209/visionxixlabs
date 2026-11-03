import hashlib,json,os,tempfile,unittest,sys,subprocess
from pathlib import Path
from unittest.mock import patch
from governance_local_issuer import protected_fixture_run as unit
from governance_local_issuer.manifest import PackageUnavailable
class MockedHostLifecycleTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(prefix='axiom-resource-host-test-',dir='/private/tmp');self.root=Path(self.t.name);self.root.chmod(0o700);self.mounted=False;self.calls=[];self.fail=None
  manifest={}
  for key,name in [('resourceAttackPrepared','resource-attack'),('restrictionLauncherPrepared','resource-launcher')]:
   p=self.root/name;p.write_bytes(b'not executable; mocked process only');p.chmod(0o600);manifest[key]={'binary':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
  self.manifest=self.root/'final-artifact.json';self.manifest.write_text(json.dumps(manifest));self.digest=hashlib.sha256(self.manifest.read_bytes()).hexdigest()
  self.plan={'futureImageCreate':['create'],'futureAttach':['attach'],'futureDetach':['detach']}
 def tearDown(self):self.t.cleanup()
 def run_mock(self,argv,timeout):
  self.assertTrue((self.root/'experiment-claim.json').exists());self.calls.append(argv[0]);success=True
  if argv[0]=='create':(self.root/'package.dmg').write_bytes(b'owned image stand-in')
  if argv[0]=='attach':self.mounted=True
  if argv[0]=='detach':self.mounted=False
  if self.fail==argv[0]:success=False
  return {'argv':argv,'exit':0 if success else 1,'stdout':'mocked','stderr':'','timeout':False,'overflow':False}
 def invoke(self):
  with patch.object(unit,'ROOT',self.root),patch.object(unit,'prepare_resource_fixture',return_value=self.plan),patch.object(unit,'_verify_mounted'),patch.object(unit,'_run',side_effect=self.run_mock),patch.object(unit.os.path,'ismount',side_effect=lambda _:self.mounted):return unit.run_exact(self.digest)
 def test_claim_precedes_every_mocked_side_effect_and_cleanup(self):
  result=self.invoke();self.assertEqual(result['status'],'resource_unit_observations_only');self.assertEqual(self.calls,['create','attach',str(self.root/'resource-launcher'),'detach']);self.assertFalse(self.mounted);self.assertEqual((self.root/'resource-launcher').stat().st_mode&0o777,0o600)
 def test_creation_failure_consumes_claim_no_retry(self):
  self.fail='create'
  with self.assertRaises(PackageUnavailable):self.invoke()
  with self.assertRaises(FileExistsError):self.invoke()
  self.assertEqual(self.calls,['create']);self.assertTrue((self.root/'resource-result.json').exists())
 def test_partial_attach_failure_detaches_once(self):
  self.fail='attach'
  with self.assertRaises(PackageUnavailable):self.invoke()
  self.assertEqual(self.calls,['create','attach','detach']);self.assertFalse(self.mounted)
 def test_attack_failure_preserves_failed_matrix_and_detaches(self):
  self.fail=str(self.root/'resource-launcher');result=self.invoke();self.assertEqual(result['status'],'resource_matrix_failed');self.assertEqual(self.calls.count('detach'),1)
 def test_binary_change_refuses_before_claim(self):
  (self.root/'resource-attack').write_bytes(b'changed')
  with self.assertRaises(PackageUnavailable):self.invoke()
  self.assertFalse((self.root/'experiment-claim.json').exists());self.assertEqual(self.calls,[])
 def test_mismatched_binary_name_refuses_even_with_valid_hash(self):
  data=json.loads(self.manifest.read_text());other=self.root/'other';other.write_bytes((self.root/'resource-attack').read_bytes());data['resourceAttackPrepared']['binary']=str(other);self.manifest.write_text(json.dumps(data));self.digest=hashlib.sha256(self.manifest.read_bytes()).hexdigest()
  with self.assertRaises(PackageUnavailable):self.invoke()
  self.assertFalse((self.root/'experiment-claim.json').exists());self.assertEqual(self.calls,[])
 def test_wrong_manifest_refuses_before_claim(self):
  self.manifest.write_text('{}')
  with self.assertRaises(PackageUnavailable):self.invoke()
  self.assertFalse((self.root/'experiment-claim.json').exists());self.assertEqual(self.calls,[])
 def test_detach_exception_never_positive_even_if_mount_disappears(self):
  original=self.run_mock
  def callback(argv,timeout):
   if argv[0]=='detach':self.mounted=False;raise OSError('simulated cleanup observation lost')
   return original(argv,timeout)
  self.run_mock=callback;result=self.invoke();self.assertEqual(result['status'],'unknown_no_retry')
 def test_change_during_detach_is_observed_after_cleanup(self):
  original=self.run_mock
  def callback(argv,timeout):
   result=original(argv,timeout)
   if argv[0]=='detach':(self.root/'package.dmg').write_bytes(b'changed during cleanup')
   return result
  self.run_mock=callback;result=self.invoke();self.assertEqual(result['status'],'resource_matrix_failed');self.assertNotEqual(result['before']['file']['sha256'],result['afterCleanup']['file']['sha256'])
 def test_mode_restore_failure_never_positive(self):
  original=Path.chmod
  def chmod(path,mode,*args,**kwargs):
   if path==self.root/'resource-launcher' and mode==0o600:raise OSError('simulated restore failure')
   return original(path,mode,*args,**kwargs)
  with patch.object(Path,'chmod',chmod):result=self.invoke()
  self.assertEqual(result['status'],'unknown_no_retry')
 def test_unexpected_selector_error_kills_actual_owned_ordinary_child(self):
  original=subprocess.Popen;children=[]
  def spawn(*args,**kwargs):
   child=original(*args,**kwargs);children.append(child);return child
  with patch.object(unit.subprocess,'Popen',side_effect=spawn),patch.object(unit.selectors,'DefaultSelector',side_effect=OSError('simulated selector error')):
   with self.assertRaises(OSError):unit._run([sys.executable,'-c','import time; time.sleep(60)'],1)
  self.assertEqual(len(children),1);self.assertIsNotNone(children[0].poll())
if __name__=='__main__':unittest.main()
