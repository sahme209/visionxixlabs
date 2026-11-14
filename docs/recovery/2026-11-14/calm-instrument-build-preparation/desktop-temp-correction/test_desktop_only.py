"""Filesystem fixtures + mocked command; no actual build/sandbox/process."""
import importlib.util,tempfile,unittest
from pathlib import Path
from unittest.mock import MagicMock
spec=importlib.util.spec_from_file_location('desktop_only',Path(__file__).with_name('desktop_only.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class DesktopTests(unittest.TestCase):
 def test_original_receipt_requires_confirmed_website_and_cleanup(self):
  good={'accepted':False,'finalInputsMatched':True,'stage':str(m.STAGE),'packetSha256':m.OLD_PACKET_SHA,'phases':{'website':{'exitCode':0,'cleanupConfirmed':True},'desktop':{'exitCode':1,'cleanupConfirmed':True}}}
  m.check_prior_receipt(good)
  for phase,field,value in [('website','exitCode',1),('website','cleanupConfirmed',False),('desktop','cleanupConfirmed',False)]:
   changed={**good,'phases':{k:dict(v) for k,v in good['phases'].items()}};changed['phases'][phase][field]=value
   with self.subTest(phase=phase,field=field),self.assertRaises(m.Refusal):m.check_prior_receipt(changed)
 def test_exact_tree_rejects_changed_and_extra_outputs(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d);(p/'a').write_bytes(b'accepted');expected=m.tree_hashes(p);m.check_tree(p,expected)
   (p/'extra').write_text('extra')
   with self.assertRaises(m.Refusal):m.check_tree(p,expected)
   (p/'extra').unlink();(p/'a').write_text('changed')
   with self.assertRaises(m.Refusal):m.check_tree(p,expected)
 def test_only_desktop_runs_and_outcome_survives_postcheck_refusal(self):
  owner=MagicMock();outcome={'exitCode':0,'cleanupConfirmed':True,'logSha256':'fact'};owner.run.return_value=outcome
  old=MagicMock();old.SANDBOX=Path('/sandbox');old.NODE=Path('/node');old.NPM=Path('/npm')
  receipt={'accepted':False};checks=MagicMock(side_effect=m.Refusal('website_changed'))
  with self.assertRaises(m.Refusal):m.run_desktop(old,owner,{},'profile',receipt,checks)
  self.assertEqual(receipt['desktop'],outcome);owner.run.assert_called_once()
  args=owner.run.call_args.args
  self.assertEqual(args[0],['/sandbox','-p','profile','/node','/npm','run','build']);self.assertEqual(args[1],m.STAGE/'source/desktop');self.assertEqual(args[-1],600)
 def test_source_map_cannot_repin_changed_stage(self):
  m.exact_source_map({'a':'original'},{'a':'original'})
  for candidate in ({'a':'changed'},{'a':'original','extra':'value'},{}):
   with self.assertRaises(m.Refusal):m.exact_source_map(candidate,{'a':'original'})
 def test_unexpected_source_refuses_but_original_generated_tree_is_separate(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);(root/'lib/generated/prisma').mkdir(parents=True);(root/'lib/generated/prisma/generated.js').write_text('generated')
   m.check_extra_source(root,{})
   (root/'lib/extra.ts').write_text('unreviewed')
   with self.assertRaises(m.Refusal):m.check_extra_source(root,{})
 def test_alias_drift_cannot_be_blessed_by_freeze(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d).resolve();link=root/'alias';link.symlink_to(root/'actual');m.require_alias(link,root/'actual')
   with self.assertRaises(m.Refusal):m.require_alias(link,root/'expected')
   link.unlink();link.write_text('replacement')
   with self.assertRaises(m.Refusal):m.require_alias(link,root/'actual')
 def test_native_or_website_command_not_selectable(self):
  owner=MagicMock();owner.run.return_value={'exitCode':1,'cleanupConfirmed':True};old=MagicMock();old.SANDBOX=Path('/sandbox');old.NODE=Path('/node');old.NPM=Path('/npm')
  receipt={'accepted':False};m.run_desktop(old,owner,{},'profile',receipt,lambda:None)
  self.assertFalse(receipt['accepted']);self.assertEqual(owner.run.call_args.args[1],m.STAGE/'source/desktop')
if __name__=='__main__':unittest.main()
