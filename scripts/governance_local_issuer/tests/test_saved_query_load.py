"""Mocked once-only load orchestration; no native execution."""
import sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import saved_query_load as l
class Tests(unittest.TestCase):
 def test_unknown_is_once_only(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve();l.p.save(root/'packet.json',{})
   with patch.object(l,'ROOT',root),patch.object(l,'verify'),patch.object(l.p,'run_candidate',return_value={'status':'unknown'})as run:
    r=l.execute(root/'packet.json')
    with self.assertRaises(FileExistsError):l.execute(root/'packet.json')
   run.assert_called_once();self.assertEqual(r['status'],'unknown')
 def test_final_source_failure_cannot_accept_load(self):
  with tempfile.TemporaryDirectory()as t:
   root=Path(t).resolve();l.p.save(root/'packet.json',{})
   with patch.object(l,'ROOT',root),patch.object(l,'verify',side_effect=[None,ValueError('PRIVATE')]),patch.object(l.p,'run_candidate',return_value={'status':'module_load_observed'}):r=l.execute(root/'packet.json')
   self.assertEqual(r['status'],'unknown');self.assertEqual(r['finalInputCurrentness'],'unavailable');self.assertNotIn('PRIVATE',str(r))
if __name__=='__main__':unittest.main()
