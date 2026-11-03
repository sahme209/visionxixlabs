"""Explicit bounded file-set profiles; no runtime/issuer authority."""
import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import manifest as m
class TraceProfiles(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-trace-profile-',dir='/private/tmp');self.root=Path(self.temp.name)
  for name,body in {'.next/BUILD_ID':b'fixture','.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}','node_modules/next/dist/bin/next':b'FIXTURE','__axiom_runtime__/node':b'FIXTURE NOT NODE'}.items():
   path=self.root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body)
  (self.root/'__axiom_runtime__/node').chmod(0o755);self.trace=self.root/'.next/trace.nft.json'
 def tearDown(self):self.temp.cleanup()
 def test_explicit_v2_accepts_250001_but_legacy_and_512001_refuse(self):
  self.trace.write_text(json.dumps({'version':1,'files':['BUILD_ID']*250001}))
  with self.assertRaises(m.PackageUnavailable):m.snapshot(self.root,profile='next-start-darwin-arm64/1')
  observed=m.snapshot(self.root,profile='next-start-darwin-arm64/2');self.assertTrue(observed['files'])
  self.trace.write_text(json.dumps({'version':1,'files':['BUILD_ID']*512001}))
  with self.assertRaises(m.PackageUnavailable):m.snapshot(self.root,profile='next-start-darwin-arm64/2')
 def test_manifest_keeps_known_profile_and_no_authority(self):
  self.trace.write_text('{"version":1,"files":["BUILD_ID"]}')
  m.write_manifest(self.root,{'sourceRevision':'a'*40,'archiveSha256':'b'*64,'buildReceiptSha256':'c'*64,'materializationReceiptSha256':'d'*64},'v24.21.0',profile='next-start-darwin-arm64/2')
  result=m.verify_package(self.root);self.assertFalse(result['executionAuthorized']);self.assertEqual(result['executingIssuerIdentity'],'unavailable')
  data=json.loads((self.root/m.MANIFEST).read_text());self.assertEqual(data['profile'],'next-start-darwin-arm64/2');data['profile']='next-start-darwin-arm64/3'
  with self.assertRaises(m.PackageUnavailable):m.validate_manifest(data)
if __name__=='__main__':unittest.main()
