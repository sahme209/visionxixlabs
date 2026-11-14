import copy
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE=Path(__file__).resolve().parents[1]/'governance_rust_spawn_diagnostic.py'

class DiagnosticTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  spec=importlib.util.spec_from_file_location('spawn_diagnostic',MODULE)
  cls.m=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.m)
 def event(self):
  return {'action':'synchronize','number':331,'before':'010444b751e6ded03a01a99e772bf925280d3dcf','after':'a'*40,'repository':{'full_name':'sahme209/visionxixlabs','private':False},'pull_request':{'number':331,'base':{'ref':'main','repo':{'full_name':'sahme209/visionxixlabs'}},'head':{'sha':'a'*40,'ref':'codex/governance-live-qualification-setup','repo':{'full_name':'sahme209/visionxixlabs'}}}}
 def test_changed_transition_or_actor_repository_refuses(self):
  self.assertEqual(self.m.validate_event(self.event(),'pull_request','1'),'a'*40)
  for path,value in [(['before'],'b'*40),(['after'],'c'*40),(['number'],332),(['repository','private'],True),(['pull_request','number'],332),(['pull_request','head','repo','full_name'],'foreign/repo'),(['pull_request','base','ref'],'other')]:
   e=copy.deepcopy(self.event());node=e
   for k in path[:-1]:node=node[k]
   node[path[-1]]=value
   with self.subTest(path=path),self.assertRaises(ValueError):self.m.validate_event(e,'pull_request','1')
  with self.assertRaises(ValueError):self.m.validate_event(self.event(),'pull_request','2')
 def test_probe_observed_denial_is_data_not_retry(self):
  self.assertEqual(self.m.parse_probe('ordinary:exit-ok\npreexec:spawn-error:1\n'),{'ordinary':{'category':'exit-ok'},'preexec':{'category':'spawn-error','errno':1}})
 def test_malformed_or_incomplete_probe_stops(self):
  for value in ['','ordinary:exit-ok\n','preexec:exit-ok\nordinary:exit-ok\n','ordinary:exit-ok\npreexec:wait-timeout\n','ordinary:spawn-error:secret\npreexec:exit-ok\n','ordinary:exit-ok\npreexec:exit-ok\nextra\n']:
   with self.subTest(value=value),self.assertRaises(ValueError):self.m.parse_probe(value)
 def test_cargo_error_classification_never_returns_private_text(self):
  text='secret-private-path could not execute process rustc (never executed)\nOperation not permitted (os error 1)'
  result=self.m.classify_cargo({'status':'exit_nonzero','cleanup_confirmed':True},text)
  self.assertEqual(result,'compiler-launch-eperm')
  self.assertNotIn('secret',result)
  self.assertEqual(self.m.classify_cargo({'status':'exit_nonzero','cleanup_confirmed':True},'error[E0001]: source rejected'),'compiler-source-rejection')
 def test_timeout_or_unknown_cleanup_is_not_a_diagnostic_success(self):
  for value in [{'status':'timeout','cleanup_confirmed':True},{'status':'success','cleanup_confirmed':False}]:
   with self.assertRaises(ValueError):self.m.classify_cargo(value,'')
 def test_standalone_crate_is_offline_and_source_changes_refuse(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);frozen=self.m.prepare_crate(root/'crate')
   self.m.verify_frozen(frozen)
   self.assertIn('[workspace]',(root/'crate/Cargo.toml').read_text())
   self.assertNotIn('[dependencies]',(root/'crate/Cargo.toml').read_text())
   (root/'crate/Cargo.lock').write_text('changed')
   with self.assertRaises(ValueError):self.m.verify_frozen(frozen)
 def test_ambient_token_and_wrapper_are_excluded(self):
  env=self.m.clean_environment(Path('/owned'),Path('/tools/rustc'))
  self.assertNotIn('GITHUB_TOKEN',env);self.assertNotIn('RUSTC_WRAPPER',env)
  self.assertEqual(env['CARGO_NET_OFFLINE'],'true');self.assertEqual(env['RUSTC'],'/tools/rustc')
 def test_ancestor_cargo_configuration_refuses_before_native_work(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);crate=root/'project';crate.mkdir();home=root/'home';home.mkdir()
   self.m.assert_no_cargo_config(crate,home)
   (root/'.cargo').mkdir();(root/'.cargo/config.toml').write_text('[build]\nrustc-wrapper="untrusted"\n')
   with self.assertRaises(ValueError):self.m.assert_no_cargo_config(crate,home)

if __name__=='__main__':unittest.main()
