import os,tempfile,unittest
from pathlib import Path
from governance_local_issuer.protected_fixture import inspect_alias_pair,claim_once,PackageUnavailable
class ProtectedFixtureTests(unittest.TestCase):
 def setUp(self):self.t=tempfile.TemporaryDirectory(prefix='axiom-protected-unit-',dir='/private/tmp');self.root=Path(self.t.name);self.root.chmod(0o700);self.a=self.root/'backing';self.a.write_bytes(b'owned fixture');self.b=self.root/'alias';os.link(self.a,self.b)
 def tearDown(self):self.t.cleanup()
 def test_actual_hardlink_bytes_and_inode(self):
  result=inspect_alias_pair(self.a,self.b);self.assertEqual(result['file']['size'],13);self.assertEqual(result['executingIssuerIdentity'],'unavailable')
 def test_copy_is_not_alias(self):
  self.b.unlink();self.b.write_bytes(self.a.read_bytes())
  with self.assertRaisesRegex(PackageUnavailable,'alias_not_same_backing'):inspect_alias_pair(self.a,self.b)
 def test_symlink_refuses(self):
  self.b.unlink();self.b.symlink_to(self.a)
  with self.assertRaises(PackageUnavailable):inspect_alias_pair(self.a,self.b)
 def test_size_bound(self):
  with self.assertRaises(PackageUnavailable):inspect_alias_pair(self.a,self.b,max_bytes=1)
 def test_same_path_refuses(self):
  with self.assertRaises(PackageUnavailable):inspect_alias_pair(self.a,self.a)
 def test_claim_consumed_even_without_terminal(self):
  claim=claim_once(self.root);self.assertEqual(claim.stat().st_mode&0o777,0o600)
  with self.assertRaises(FileExistsError):claim_once(self.root)
 def test_unowned_mode_refuses_claim(self):
  self.root.chmod(0o755)
  with self.assertRaises(PackageUnavailable):claim_once(self.root)
if __name__=='__main__':unittest.main()
