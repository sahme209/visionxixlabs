"""Pure synthetic link binding tests; no SDK/host file reads or child invocations."""
import importlib.util,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
D=Path(__file__).parent
spec=importlib.util.spec_from_file_location('fixed_runner',D/'run_step.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def setUp(self):self.assertTrue(hasattr(m,'verify_binding'),'explicit reviewed SDK-link binding verifier missing')
 def check(self,*,literal='libSystem.B.tbd',resolved=None,changed=False):
  target=m.SDK_SYSTEM_TARGET;link=m.SDK_SYSTEM_LINK;resolved=resolved or target
  before=SimpleNamespace(st_mode=0o120755,st_dev=1,st_ino=2,st_uid=0,st_gid=0,st_nlink=1,st_size=15,st_mtime_ns=1,st_ctime_ns=1)
  after=SimpleNamespace(**before.__dict__);after.st_ctime_ns=2 if changed else 1
  class Fake:
   def __init__(self,name):self.name=name;self.calls=0
   def __eq__(self,other):return isinstance(other,Fake)and self.name==other.name
   def lstat(self):self.calls+=1;return before if self.calls==1 else after
   def resolve(self,strict=True):return Fake(resolved)
  paths={link:Fake(link),target:Fake(target)}
  record={'kind':'sdk-system-link','path':link,'linkLiteral':'libSystem.B.tbd','target':{'path':target,'sha256':'a'*64,'size':42,'mode':420}}
  with patch.object(m,'Path',side_effect=lambda p:paths[p]),patch.object(m.os,'readlink',return_value=literal),patch.object(m,'bound',return_value={'sha256':'a'*64,'size':42,'mode':420}):m.verify_binding(record)
 def test_exact_alias_and_canonical_target_accept(self):self.check()
 def test_other_literal_or_resolution_refuses(self):
  for kw in [{'literal':'other.tbd'},{'resolved':'/sdk/foreign/libSystem.B.tbd'}]:
   with self.assertRaises(RuntimeError):self.check(**kw)
 def test_link_currentness_refuses(self):
  with self.assertRaises(RuntimeError):self.check(changed=True)
if __name__=='__main__':unittest.main()
