"""Pure/mocked contracts only: no child, compiler, filter or CI invocation."""
import hashlib,importlib.util,json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('cargo_error_test',ROOT/'scripts/governance_cargo_error_diagnostic.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def observed(**kw):return {'cleanup_confirmed':True,'status':'exit_nonzero','stderr_bytes':kw.pop('stderr_bytes',7),**kw}
def event():
 sha='a'*40;repo={'full_name':'sahme209/visionxixlabs','private':False}
 return {'action':'synchronize','number':331,'before':'47adbced23b378f4f4789a6bec8d836641785240','after':sha,'repository':repo,'pull_request':{'number':331,'base':{'ref':'main','repo':repo},'head':{'ref':'codex/governance-live-qualification-setup','sha':sha,'repo':repo}}}
class CargoErrorTests(unittest.TestCase):
 def test_exact_event(self):self.assertEqual(m.validate_event(event(),'pull_request','1'),'a'*40)
 def test_event_refusals(self):
  for field,value in [('before','b'*40),('number',332),('action','opened')]:
   e=event();e[field]=value
   with self.assertRaises(ValueError):m.validate_event(e,'pull_request','1')
  with self.assertRaises(ValueError):m.validate_event(event(),'pull_request','2')
 def test_exact_path_replacement_preserves_error(self):
  raw=b'error /tmp/owned/src; /repo/file; /toolchain/bin/rustc: EPERM\n/tmp/owned-other stays'
  v=m.sanitize_stderr(raw,observed(stderr_bytes=len(raw)),{'/tmp/owned':'<OWNED_ROOT>','/repo':'<CHECKOUT>','/toolchain':'<TOOLCHAIN>'})
  self.assertTrue(v['stderrReleased']);self.assertEqual(v['stderrBytes'],len(raw));self.assertEqual(v['stderrSha256'],hashlib.sha256(raw).hexdigest())
  self.assertIn('<OWNED_ROOT>/src',v['stderrText']);self.assertIn('/tmp/owned-other stays',v['stderrText']);self.assertIn('EPERM',v['stderrText'])
 def test_newline_controls_json_escape(self):
  raw=b'a\n\t\x1b';v=m.sanitize_stderr(raw,observed(stderr_bytes=len(raw)),{})
  line=json.dumps(v,ensure_ascii=True);self.assertNotIn('\n',line);self.assertIn('\\n',line);self.assertIn('\\u001b',line)
 def test_refuse_utf8_overflow_uncertain_and_bad_count(self):
  for raw,o,current in [(b'\xff',observed(stderr_bytes=1),True),(b'x'*16385,observed(stderr_bytes=16385),True),(b'private',observed(cleanup_confirmed=False),True),(b'private',observed(),False),(b'private',observed(status='output_limit'),True),(b'private',observed(stderr_bytes=8),True)]:
   v=m.sanitize_stderr(raw,o,{},current);self.assertFalse(v['stderrReleased']);self.assertNotIn('stderrText',v)
 def test_identity_matches_saved_receipt_only(self):
  saved={'toolSha256':{'rustc':'a','cargo':'b','cc':'c','git':'d','true':'e'},'standardLibrarySha256':{'std':'f','core':'g'},'filterProgramSha256':'h'}
  m.verify_saved_identity(saved,saved['toolSha256'],saved['standardLibrarySha256'],'h')
  with self.assertRaises(ValueError):m.verify_saved_identity(saved,{**saved['toolSha256'],'cargo':'changed'},saved['standardLibrarySha256'],'h')
 def test_no_probe_or_unbounded_log_fallback(self):
  source=(ROOT/'scripts/governance_cargo_error_diagnostic.py').read_text()
  self.assertNotIn("run('probe-compile'",source);self.assertNotIn("run('probe-once'",source)
  self.assertIn("'cargo-once'",source);self.assertIn("max_output_bytes=",source)
if __name__=='__main__':unittest.main()
