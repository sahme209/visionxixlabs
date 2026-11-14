"""Actual source-data and mocked orchestration only; no native calls or programs."""
import importlib.util,os,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts'))
import governance_host_evaluation_inputs as source
class HostEvaluationSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.base=source.base_files(ROOT)
  cls.files=cls.base if os.getenv('AXIOM_HOST_UPSTREAM_BASELINE')=='1' else source.evaluation_files(ROOT)
 def text(self,path):return self.files[path].decode()
 def test_actual_constructor_ntp_only(self):
  s=self.text('clock-bound/src/daemon.rs');self.assertIn('async fn construct_host_evaluation',s)
  body=s.split('async fn construct_host_evaluation',1)[1].split('/// Install the NTP sources',1)[0]
  self.assertIn('set_amazon_time_sync',body)
  for forbidden in ['Autodetect::detect','add_default_public_pool','set_phc','install_configured_sources']:self.assertNotIn(forbidden,body)
 def test_owned_compatibility_not_global(self):
  s=self.text('clock-bound/src/daemon/clock_state.rs');self.assertIn('fn construct_host_evaluation',s)
  body=s.split('fn construct_host_evaluation',1)[1].split('pub async fn run',1)[0]
  self.assertIn('/run/axiom-host-evaluation/compat/v2',body);self.assertIn('/run/axiom-host-evaluation/compat/v3',body)
  self.assertNotIn('CLOCKBOUND_SHM_DEFAULT_PATH',body)
 def test_stock_and_existing_private_constructor_preserved(self):
  def body(s,name):
   start=s.index(name);brace=s.index('{',start);depth=1;end=brace+1
   while depth:depth+=(s[end]=='{')-(s[end]=='}');end+=1
   return s[start:end]
  for path,names in [('clock-bound/src/daemon.rs',['pub async fn construct(','pub async fn construct_axiom(']),('clock-bound/src/daemon/clock_state.rs',['pub fn construct(','pub fn construct_axiom(']),('clock-bound/src/daemon/io.rs',['pub fn spawn_all(']),('clock-bound/src/daemon/io/amazon_time_sync.rs',['pub fn construct(','pub async fn run('])]:
   for name in names:self.assertEqual(body(self.base[path].decode(),name),body(self.text(path),name))
 def test_fixed_entry_feature_not_default(self):
  s=self.text('clock-bound/Cargo.toml');self.assertIn('axiom-host-evaluation = ["daemon"]',s);self.assertIn('name = "axiom-host-evaluation"',s)
  self.assertEqual(self.base['clock-bound/src/bin/clockbound.rs'],self.files['clock-bound/src/bin/clockbound.rs'])
 def test_run_once_cleanup_is_never_cancelled_by_observer(self):
  s=self.text('clock-bound/src/daemon.rs').split('async fn run_host_evaluation',1)[1].split('/// Install the NTP sources',1)[0]
  self.assertNotIn('tokio::select!',s);self.assertIn('self.run_once().await',s)
 def test_transitive_amazon_runner_is_ipv4_pinned(self):
  s=self.text('clock-bound/src/daemon/io/amazon_time_sync.rs');self.assertIn('run_host_evaluation_ipv4',s)
  body=s.split('async fn run_host_evaluation_ipv4',1)[1].split('async fn handle_interval_tick',1)[0]
  self.assertNotIn('swap_network_stack',body);self.assertNotIn('handle_ntp_sample_result(',body);self.assertIn('self.ntp.sample().await',body)
  io=self.text('clock-bound/src/daemon/io.rs');self.assertIn('spawn_host_evaluation_ntp_only',io);self.assertIn('amazon_time_sync.run_host_evaluation_ipv4().await',io)
  daemon=self.text('clock-bound/src/daemon.rs').split('async fn run_host_evaluation',1)[1].split('/// Install the NTP sources',1)[0]
  self.assertIn('spawn_host_evaluation_ntp_only()',daemon);self.assertNotIn('spawn_all()',daemon)
if __name__=='__main__':unittest.main()
