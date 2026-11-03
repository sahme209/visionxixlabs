"""Isolated planner tests; no application build or provider operation."""
import base64,hashlib,importlib.util,io,json,os,sys,tarfile,tempfile,unittest
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location("offline_build",Path(__file__).parents[1]/"build-local-issuer-package-source.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def tar_bytes(files):
 out=io.BytesIO()
 with tarfile.open(fileobj=out,mode="w:gz")as archive:
  for path,body in files.items():
   info=tarfile.TarInfo(path);info.size=len(body);info.mode=0o644;archive.addfile(info,io.BytesIO(body))
 return out.getvalue()
def fixture(base):
 blob=tar_bytes({"package/package.json":b'{"name":"fixture-dep","version":"1.0.0","scripts":{"install":"node install.js"}}',"package/index.js":b"module.exports=1","package/install.js":b"require('fs').writeFileSync('LIFECYCLE_RAN','bad')"})
 integrity="sha512-"+base64.b64encode(hashlib.sha512(blob).digest()).decode()
 package={"name":"fixture-app","version":"1.0.0","dependencies":{"fixture-dep":"1.0.0","@axiom/local":"file:packages/local"},"scripts":{"postinstall":"node postinstall.js"}}
 lock={"name":"fixture-app","version":"1.0.0","lockfileVersion":3,"requires":True,"packages":{"":{"name":"fixture-app","version":"1.0.0","dependencies":package["dependencies"],"hasInstallScript":True},"node_modules/fixture-dep":{"version":"1.0.0","resolved":"https://registry.npmjs.org/fixture-dep/-/fixture-dep-1.0.0.tgz","integrity":integrity,"hasInstallScript":True},"node_modules/@axiom/local":{"resolved":"packages/local","link":True},"packages/local":{"version":"0.0.0"}}}
 source=base/"source-cache";source.mkdir();path,_=m.cache_path(source,integrity);path.parent.mkdir(parents=True);path.write_bytes(blob)
 return package,lock,source,path

def archived_fixture_stage(base,package,lock):
 data=io.BytesIO()
 files={"package.json":json.dumps(package).encode(),"package-lock.json":json.dumps(lock).encode(),"postinstall.js":b"require('fs').writeFileSync('ROOT_LIFECYCLE_RAN','bad')","packages/local/package.json":b'{"name":"@axiom/local","version":"0.0.0"}'}
 with tarfile.open(fileobj=data,mode="w")as archive:
  for name,body in files.items():
   item=tarfile.TarInfo(name);item.size=len(body);item.mode=0o644;archive.addfile(item,io.BytesIO(body))
 stage=base/"stage";m.extract_archive(data.getvalue(),stage)
 return stage,stage/"packages/local"

class PlannerTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix="axiom-offline-unit-");self.base=Path(self.temp.name).resolve();self.base.chmod(0o700)
 def tearDown(self):self.temp.cleanup()
 def test_lock_integrity_platform_and_archive_local_links(self):
  p,l,cache,blob=fixture(self.base);plan=m.lock_plan(p,l)
  self.assertEqual(plan["localLinks"],[{"location":"node_modules/@axiom/local","target":"packages/local","version":"0.0.0"}])
  self.assertEqual(m.inspect_cache(plan,cache)["status"],"offline_tarballs_available")
  l["packages"]["node_modules/optional-windows"]={"version":"1","optional":True,"os":["win32"],"cpu":["x64"]}
  self.assertEqual(m.lock_plan(p,l)["platformOptionalExcluded"],["node_modules/optional-windows"])
 def test_cache_missing_tamper_and_no_network_fallback(self):
  p,l,cache,blob=fixture(self.base);plan=m.lock_plan(p,l);blob.write_bytes(b"tampered")
  self.assertEqual(m.inspect_cache(plan,cache)["status"],"unavailable")
  blob.unlink();self.assertEqual(m.inspect_cache(plan,cache)["missing"][0]["reason"],"pinned_tarball_cache_miss")
 def test_owned_cache_is_exact_copy_without_index_or_mutating_source(self):
  p,l,cache,blob=fixture(self.base);before=blob.read_bytes();plan=m.lock_plan(p,l)
  owned=m.snapshot_cache(plan,cache,self.base/"owned-cache")
  self.assertEqual(blob.read_bytes(),before)
  target,_=m.cache_path(owned/"_cacache",plan["tarballs"][0]["integrity"])
  self.assertEqual(target.read_bytes(),before);self.assertFalse((owned/"_cacache/index-v5").exists())
 def test_unsafe_source_lock_and_mutable_workspace_link_refuse(self):
  p,l,cache,blob=fixture(self.base)
  l["packages"]["node_modules/@axiom/local"]["resolved"]="../workspace"
  with self.assertRaises(m.Unavailable):m.lock_plan(p,l)
  l["packages"]["node_modules/@axiom/local"]["resolved"]="packages/local";plan=m.lock_plan(p,l)
  stage=self.base/"stage";stage.mkdir(mode=0o700);(stage/"packages").mkdir();(stage/"packages/local").symlink_to(self.base)
  with self.assertRaises(m.Unavailable):m.validate_local_links(stage,plan)
 def test_archive_exact_bytes_and_traversal_rejection(self):
  data=io.BytesIO()
  with tarfile.open(fileobj=data,mode="w")as t:
   body=b"exact";info=tarfile.TarInfo("nested/file");info.size=len(body);t.addfile(info,io.BytesIO(body))
  result=m.extract_archive(data.getvalue(),self.base/"stage")
  self.assertEqual(result["verifiedRegularFiles"],1);self.assertEqual((self.base/"stage/nested/file").read_bytes(),b"exact")
  bad=io.BytesIO()
  with tarfile.open(fileobj=bad,mode="w")as t:
   info=tarfile.TarInfo("../escape");info.size=0;t.addfile(info,io.BytesIO())
  with self.assertRaises(m.Unavailable):m.extract_archive(bad.getvalue(),self.base/"bad")
  self.assertFalse((self.base/"escape").exists())
 def test_archive_case_collision_and_parent_link_escape_refuse(self):
  data=io.BytesIO()
  with tarfile.open(fileobj=data,mode="w")as archive:
   for name in ["Dir","dir"]:
    item=tarfile.TarInfo(name);item.type=tarfile.DIRTYPE;archive.addfile(item)
  with self.assertRaises(m.Unavailable):m.extract_archive(data.getvalue(),self.base/"case-stage")
  p,l,cache,blob=fixture(self.base);plan=m.lock_plan(p,l)
  outside=self.base/"outside";(outside/"local").mkdir(parents=True);(outside/"local/package.json").write_text('{"name":"@axiom/local","version":"0.0.0"}')
  stage=self.base/"stage";stage.mkdir(mode=0o700);(stage/"packages").symlink_to(outside)
  with self.assertRaises(m.Unavailable):m.validate_local_links(stage,plan)
 def test_probe_required_missing_and_optional_tamper_refuse(self):
  p,l,source,blob=fixture(self.base);plan=m.lock_plan(p,l);blob.unlink()
  with self.assertRaises(m.Unavailable):m.probe_cache_plan(plan,source)
  l['packages']['node_modules/fixture-dep']['optional']=True
  plan=m.lock_plan(p,l);blob.write_bytes(b'tampered')
  with self.assertRaises(m.Unavailable):m.probe_cache_plan(plan,source)

 def test_installed_generation_source_observation_exact_and_tamper_refuses(self):
  p,l,source,blob=fixture(self.base);stage=self.base/'installed';target=stage/'node_modules/fixture-dep';target.mkdir(parents=True);stage.chmod(0o700)
  with tarfile.open(blob,'r:gz')as archive:
   for item in archive:
    path=target/item.name[len('package/'):];path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(archive.extractfile(item).read())
  with patch.object(m,'GENERATION_PACKAGES',('node_modules/fixture-dep',)):
   result=m.observe_generation_sources(stage,l,source)
   self.assertEqual(result['verifiedRegularFiles'],3);self.assertFalse(result['executionAuthorized'])
   (target/'index.js').write_bytes(b'tamper')
   with self.assertRaises(m.Unavailable):m.observe_generation_sources(stage,l,source)

 def test_engine_gate_requires_local_binding_not_vendor_authentication(self):
  p,l,cache,blob=fixture(self.base)
  l['packages']['node_modules/@prisma/engines']={**l['packages']['node_modules/fixture-dep'],'version':'5.22.0'}
  l['packages']['node_modules/@prisma/engines-version']={'version':'5.22.0-44.'+'a'*40}
  result=m.engine_plan(l,cache)
  self.assertEqual(result['reason'],'exact_local_engine_input_binding_required')
  self.assertEqual(result['upstreamAuthenticity'],'unavailable')
  self.assertEqual(result['engineCommitAuthenticity'],'unavailable')
  self.assertNotIn('engineCommit',result)

 def test_clean_environment_has_no_credentials_or_module_overrides(self):
  with patch.dict(os.environ,{"NODE_OPTIONS":"untrusted","NPM_TOKEN":"DO_NOT_COPY"}):
   env=m.clean_environment("/fixed/node",self.base)
  self.assertNotIn("NODE_OPTIONS",env);self.assertNotIn("NPM_TOKEN",env)
  self.assertFalse(any(k.upper().startswith("NPM_CONFIG_")for k in env))
  with self.assertRaises(m.Unavailable):m.execute_build({"ready":True})

@unittest.skipUnless(sys.platform=="darwin" and Path("/usr/bin/sandbox-exec").exists(),"Darwin offline control fixture")
class ActualOfflineInstall(unittest.TestCase):
 def test_copied_sri_blobs_suffice_offline_ci_and_lifecycle_never_runs(self):
  with tempfile.TemporaryDirectory(prefix="axiom-offline-install-",dir="/private/tmp")as tmp:
   base=Path(tmp);base.chmod(0o700);p,l,source,blob=fixture(base);plan=m.lock_plan(p,l)
   stage,local=archived_fixture_stage(base,p,l)
   owned=m.snapshot_cache(plan,source,base/"owned-cache")
   node=Path("/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node")
   cli=node.parent.parent/"lib/node_modules/npm/bin/npm-cli.js"
   result=m.install_offline(stage,plan,owned,node,cli,source,base/"protected-original-source")
   self.assertEqual(result["status"],"offline_dependencies_installed")
   self.assertEqual((stage/"node_modules/fixture-dep/index.js").read_bytes(),b"module.exports=1")
   self.assertEqual((stage/"node_modules/@axiom/local").resolve(),local)
   self.assertFalse((stage/"ROOT_LIFECYCLE_RAN").exists())
   self.assertFalse((stage/"node_modules/fixture-dep/LIFECYCLE_RAN").exists())
   self.assertFalse((source/"index-v5").exists())
   print("ACTUAL_OFFLINE_FIXTURE "+json.dumps({"format":"axiom.offline-ci-fixture/1","node":"v24.21.0","npm":"11.19.0","copiedSRIContentOnly":True,"cacheIndexCopied":False,"network":"kernel_denied","lifecycleMarkersPresent":False,"archiveOwnedLocalLink":True,"applicationBuildStarted":False,"executingIssuerIdentity":"unavailable"},sort_keys=True))

 def test_optional_miss_probe_observes_npm_without_qualification(self):
  with tempfile.TemporaryDirectory(prefix='axiom-offline-optional-',dir='/private/tmp')as tmp:
   base=Path(tmp);base.chmod(0o700);p,l,source,_=fixture(base)
   p['optionalDependencies']={'fixture-optional-missing':'1.0.0'}
   l['packages']['']['optionalDependencies']=p['optionalDependencies']
   l['packages']['node_modules/fixture-optional-missing']={'version':'1.0.0','resolved':'https://registry.npmjs.org/fixture-optional-missing/-/fixture-optional-missing-1.0.0.tgz','integrity':'sha512-'+base64.b64encode(hashlib.sha512(b'not-cached').digest()).decode(),'optional':True}
   plan=m.lock_plan(p,l);stage,local=archived_fixture_stage(base,p,l)
   self.assertEqual(m.inspect_cache(plan,source)['status'],'unavailable')
   result=m.observe_optional_probe(stage,plan,source,base/'probe-cache',Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'),Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/lib/node_modules/npm/bin/npm-cli.js'),base/'protected-original')
   self.assertEqual(result['status'],'offline_install_observed_unqualified')
   self.assertEqual(result['npmOutcome'],'succeeded')
   self.assertEqual(result['missingOptional'],[{'location':'node_modules/fixture-optional-missing','reason':'pinned_tarball_cache_miss','presentAfterInstall':False}])
   self.assertFalse(result['executionAuthorized']);self.assertEqual(result['runtimeQualification'],'unavailable')
   self.assertEqual((stage/'node_modules/fixture-dep/index.js').read_bytes(),b'module.exports=1')
   self.assertEqual((stage/'node_modules/@axiom/local').resolve(),local)
   self.assertFalse((stage/'ROOT_LIFECYCLE_RAN').exists())
   self.assertFalse((stage/'node_modules/fixture-dep/LIFECYCLE_RAN').exists())
   print('ACTUAL_OPTIONAL_PROBE '+json.dumps(result,sort_keys=True))

 def test_offline_missing_blob_refuses_without_lifecycle_or_network_fallback(self):
  with tempfile.TemporaryDirectory(prefix="axiom-offline-miss-",dir="/private/tmp")as tmp:
   base=Path(tmp);base.chmod(0o700);p,l,source,_=fixture(base);plan=m.lock_plan(p,l)
   stage,local=archived_fixture_stage(base,p,l)
   empty=base/"empty-owned-cache";empty.mkdir(mode=0o700)
   with self.assertRaises(m.Unavailable):m.install_offline(stage,plan,empty,Path("/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node"),Path("/Users/samirahmed/.nvm/versions/node/v24.21.0/lib/node_modules/npm/bin/npm-cli.js"),source,base/"protected-original")
   self.assertIn("ENOTCACHED",(base/"offline-ci.log").read_text())
   self.assertFalse((stage/"ROOT_LIFECYCLE_RAN").exists())
   print("ACTUAL_OFFLINE_MISS "+json.dumps({"status":"unavailable","npmReason":"ENOTCACHED","network":"kernel_denied","noFetchFallback":True,"applicationBuildStarted":False},sort_keys=True))

if __name__=="__main__":unittest.main()
