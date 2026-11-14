"""Pure and mocked executor checks: never starts a program or sandbox."""
import importlib.util, io, json, tarfile, tempfile, unittest
from pathlib import Path
from unittest.mock import patch,MagicMock

SPEC=importlib.util.spec_from_file_location('calm_executor',Path(__file__).with_name('executor.py'))
m=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(m)

class ExecutorTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name).resolve()
 def archive(self,entries):
  p=self.root/'source.tar.gz'
  with tarfile.open(p,'w:gz') as t:
   for name,body,kind in entries:
    info=tarfile.TarInfo(name);info.size=len(body);info.type=kind
    t.addfile(info,io.BytesIO(body))
  return p
 def test_exact_archive(self):
  a=self.archive([('app/a.ts',b'hello',tarfile.REGTYPE)]);out=self.root/'out';out.mkdir()
  m.extract_snapshot(a,{'app/a.ts':m.digest_bytes(b'hello')},out,5)
  self.assertEqual((out/'app/a.ts').read_bytes(),b'hello')
 def test_archive_wrong_bytes(self):
  a=self.archive([('a',b'bad',tarfile.REGTYPE)]);out=self.root/'out';out.mkdir()
  with self.assertRaises(m.Refusal):m.extract_snapshot(a,{'a':m.digest_bytes(b'good')},out,3)
 def test_archive_links_traversal_extra_duplicate(self):
  for entries in [[('../a',b'x',tarfile.REGTYPE)],[('a',b'',tarfile.SYMTYPE)],[('a',b'x',tarfile.REGTYPE),('a',b'x',tarfile.REGTYPE)],[('b',b'x',tarfile.REGTYPE)]]:
   with self.subTest(entries=entries):
    a=self.archive(entries);out=self.root/('out'+str(len(list(self.root.iterdir()))));out.mkdir()
    with self.assertRaises(m.Refusal):m.extract_snapshot(a,{'a':m.digest_bytes(b'x')},out,1)
 def test_loaded_env_refuses(self):
  for name in ['.env','nested/.env.local','node_modules/a','work/secret','../a','a//b']:
   with self.subTest(name=name),self.assertRaises(m.Refusal):m.source_name(name)
  self.assertEqual(m.source_name('.env.example'),'.env.example')
 def test_sandbox_limits_writes_and_network(self):
  profile=m.sandbox_profile(self.root)
  self.assertIn('(deny network*)',profile);self.assertIn('(deny file-write*)',profile)
  self.assertIn('(subpath '+json.dumps(str(self.root))+')',profile)
  self.assertIn('(literal "/dev/null")',profile)
 def test_environment_is_fresh(self):
  with patch.dict('os.environ',{'AWS_SECRET_ACCESS_KEY':'secret','DATABASE_URL':'sql','NODE_OPTIONS':'bad'}):
   env=m.child_environment(self.root,Path('/pinned/node'),Path('/pinned/engine'))
  self.assertNotIn('AWS_SECRET_ACCESS_KEY',env);self.assertNotIn('DATABASE_URL',env)
  self.assertEqual(env['HOME'],str(self.root/'home'));self.assertEqual(env['NPM_CONFIG_OFFLINE'],'true')
  self.assertNotIn('bad',env['NODE_OPTIONS'])
 def test_marker_is_exclusive(self):
  p=self.root/'attempt';m.consume_attempt(p,'abc')
  with self.assertRaises(FileExistsError):m.consume_attempt(p,'abc')
  self.assertEqual(json.loads(p.read_text())['packetSha256'],'abc')
 def test_cache_change_detected(self):
  p=self.root/'cache';p.mkdir();(p/'a').write_text('first');manifest=m.inventory([p])
  (p/'a').write_text('other')
  with self.assertRaises(m.Refusal):m.verify_inventory(manifest)
 def test_namespace_file_dependency_and_local_bins(self):
  cache=self.root/'cache';cache.mkdir();(cache/'.bin').mkdir();(cache/'pkg').mkdir();(cache/'pkg'/'cli.js').write_text('fixture');(cache/'.bin'/'x').symlink_to('../pkg/cli.js');(cache/'zod').mkdir();(cache/'zod'/'index.js').write_text('fixture')
  source=self.root/'source';(source/'packages/verified-issuer-runtime').mkdir(parents=True)
  m.stage_namespace(cache,source/'node_modules',source,True)
  self.assertEqual((source/'node_modules/@axiom/verified-issuer-runtime').resolve(),source/'packages/verified-issuer-runtime')
  self.assertEqual((source/'node_modules/.bin/x').resolve(),cache/'pkg/cli.js')
  self.assertFalse((source/'node_modules/zod').is_symlink())
 def test_conditional_pipeline_and_remaining_budget(self):
  calls=[]
  def invoke(name,budget):calls.append((name,budget));return {'exitCode':1,'cleanupConfirmed':True}
  result=m.build_pipeline(invoke,lambda:20)
  self.assertEqual([c[0] for c in calls],['website']);self.assertFalse(result['accepted']);self.assertEqual(result['desktop'],'skipped')
  calls.clear();times=iter([100,80])
  result=m.build_pipeline(lambda n,b:(calls.append((n,b)) or {'exitCode':0,'cleanupConfirmed':True}),lambda:next(times))
  self.assertTrue(result['accepted']);self.assertEqual(calls,[('website',100),('desktop',80)])
 def test_postchild_drift_preserves_exit_and_cleanup(self):
  receipt={'accepted':False};outcome={'exitCode':0,'cleanupConfirmed':True,'logSha256':'captured'}
  def changed():raise m.Refusal('cache_changed')
  with self.assertRaises(m.Refusal):m.record_phase(receipt,'website',outcome,changed)
  self.assertEqual(receipt['phases']['website'],outcome);self.assertEqual(receipt['desktop'],'skipped');self.assertFalse(receipt['accepted'])
 def test_uncertain_cleanup_stops_desktop(self):
  calls=[];r=m.build_pipeline(lambda n,b:(calls.append(n) or {'exitCode':0,'cleanupConfirmed':False}),lambda:30)
  self.assertEqual(calls,['website']);self.assertFalse(r['accepted'])
 def test_no_child_after_expired_budget(self):
  calls=[]
  with self.assertRaises(m.Refusal):m.build_pipeline(lambda n,b:calls.append(n),lambda:0)
  self.assertEqual(calls,[])

 def mock_child(self,owner,*,chunk=b'output',group_denied=False,cancel_at_spawn=False):
  process=MagicMock();process.pid=123;process.stdout=io.BytesIO();process.wait.return_value=0
  selector=MagicMock();live={1:True};selector.get_map.side_effect=lambda:live.copy()
  key=MagicMock();key.fd=9;key.fileobj=process.stdout
  selector.select.return_value=[(key,1)];selector.unregister.side_effect=lambda _:live.clear()
  manager=MagicMock();manager.__enter__.return_value=selector
  reads=iter([chunk,b''])
  def spawn(*args,**kwargs):
   if cancel_at_spawn:owner.signal()
   return process
  calls=[]
  def kill(pid,sig):
   calls.append((pid,sig))
   if group_denied:raise PermissionError('unknown group')
   if sig==0:raise ProcessLookupError()
  with patch.object(m.subprocess,'Popen',side_effect=spawn) as start,patch.object(m.selectors,'DefaultSelector',return_value=manager),patch.object(m.os,'read',side_effect=lambda *_:next(reads)),patch.object(m.os,'killpg',side_effect=kill),patch.object(m.time,'monotonic',return_value=100):
   result=owner.run(['fixed'],self.root,{'ONLY':'fixed'},self.root/'phase.log',10)
  return result,start,process,calls
 def test_mocked_child_group_owned_and_reaped(self):
  result,start,process,calls=self.mock_child(m.ProcessOwner())
  self.assertEqual(result['exitCode'],0);self.assertTrue(result['cleanupConfirmed'])
  self.assertEqual(calls,[(123,m.signal.SIGKILL),(123,0)])
  self.assertTrue(start.call_args.kwargs['start_new_session']);self.assertTrue(start.call_args.kwargs['close_fds'])
  self.assertEqual(start.call_args.kwargs['stdin'],m.subprocess.DEVNULL)
  self.assertEqual(start.call_args.kwargs['env'],{'ONLY':'fixed'});self.assertTrue(process.stdout.closed)
 def test_mocked_cancel_during_spawn_owns_cleanup(self):
  result,_,_,calls=self.mock_child(m.ProcessOwner(),cancel_at_spawn=True)
  self.assertEqual(result['reason'],'cancelled');self.assertIsNone(result['exitCode']);self.assertTrue(result['cleanupConfirmed']);self.assertEqual(calls[0],(123,m.signal.SIGKILL))
 def test_mocked_log_overflow_is_not_success(self):
  with patch.object(m,'LOG_BYTES',3):result,_,_,_=self.mock_child(m.ProcessOwner(),chunk=b'four')
  self.assertEqual(result['reason'],'log_limit');self.assertIsNone(result['exitCode']);self.assertEqual((self.root/'phase.log').stat().st_size,0)
 def test_mocked_denied_cleanup_is_unknown(self):
  result,_,_,_=self.mock_child(m.ProcessOwner(),group_denied=True)
  self.assertFalse(result['cleanupConfirmed']);self.assertIsNone(result['exitCode'])
 def test_mocked_expired_deadline_kills(self):
  owner=m.ProcessOwner();process=MagicMock();process.pid=123;process.stdout=io.BytesIO()
  selector=MagicMock();selector.get_map.return_value={1:True};manager=MagicMock();manager.__enter__.return_value=selector
  # First read starts deadline, second expires it; cleanup still gets its own bound.
  ticks=iter([0,11,11,11,11,11,11])
  def kill(pid,sig):
   if sig==0:raise ProcessLookupError()
  with patch.object(m.subprocess,'Popen',return_value=process),patch.object(m.selectors,'DefaultSelector',return_value=manager),patch.object(m.os,'killpg',side_effect=kill),patch.object(m.time,'monotonic',side_effect=lambda:next(ticks)):
   result=owner.run(['fixed'],self.root,{},self.root/'deadline.log',10)
  self.assertEqual(result['reason'],'deadline');self.assertIsNone(result['exitCode']);self.assertTrue(result['cleanupConfirmed'])

if __name__=='__main__':unittest.main()
