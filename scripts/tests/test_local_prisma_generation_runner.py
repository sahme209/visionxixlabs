"""Real owned Node/Seatbelt mechanics; simulated preparation/CLI, never Prisma engines."""
import importlib.util,json,os,sys,tempfile,unittest,signal,subprocess,time,uuid
from pathlib import Path
from unittest.mock import patch
s=importlib.util.spec_from_file_location('runner',Path(__file__).parents[1]/'local_prisma_engine_inputs.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
@unittest.skipUnless(sys.platform=='darwin'and Path('/usr/bin/sandbox-exec').exists(),'requires owned Darwin controls')
class GenerationMechanics(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-generation-mechanics-',dir='/private/tmp');self.root=Path(self.temp.name);self.root.chmod(0o700)
  self.stage=self.root/'stage';self.stage.mkdir(mode=0o700);(self.stage/'prisma').mkdir();(self.stage/'prisma/schema.prisma').write_text('SIMULATED SCHEMA NOT PRISMA')
  self.bound=self.root/'engines';self.bound.mkdir(mode=0o700);(self.bound/m.KINDS['query'][1]).write_bytes(b'FIXTURE QUERY BYTES NEVER LOADED')
  self.repo=self.root/'protected-repo';self.repo.mkdir();self.cache=self.root/'protected-cache';self.cache.mkdir();self.run=self.root/'run';self.run.mkdir(mode=0o700);self.home=self.root/'simulated-home';self.enginecache=self.home/'.cache/prisma';self.enginecache.mkdir(parents=True)
  for directory in [self.repo,self.cache,self.bound,self.enginecache]:(directory/'sentinel').write_text('unchanged')
  self.cli=self.stage/'node_modules/prisma/build/index.js';self.cli.parent.mkdir(parents=True)
  self.plan={'status':'prepared_not_executed','schemaSha256':m.hashlib.sha256((self.stage/'prisma/schema.prisma').read_bytes()).hexdigest(),'sourceRevision':'a'*40,'engineEnvironment':{'PRISMA_QUERY_ENGINE_LIBRARY':str(self.bound/m.KINDS['query'][1]),'PRISMA_SCHEMA_ENGINE_BINARY':str(self.bound/'schema-engine')},'engines':{'inputs':{'query':{'sha256':m.hashlib.sha256((self.bound/m.KINDS['query'][1]).read_bytes()).hexdigest(),'size':len((self.bound/m.KINDS['query'][1]).read_bytes())}}}}
 def tearDown(self):self.temp.cleanup()
 def execute(self,timeout=5,source_error=None):
  with patch.object(m.Path,'home',return_value=self.home),patch.object(m,'prepare_generation',return_value=self.plan),patch.object(m,'verify_generation_sources',side_effect=source_error,return_value={'status':'simulated_source_fixture'}),patch.object(m,'verify_bound_engines',return_value=self.plan['engines']),patch.object(m,'verify_archived_inputs',return_value={'schemaSha256':self.plan['schemaSha256']}):
   return m.execute_generation(self.stage,self.bound,self.repo,'a'*40,self.cache,NODE,self.run,timeout=timeout)
 def formatter_js(self,delay=0):
  # Deliberately limited fixture formatting for named fixture fields; NOT a Prisma parser.
  return "if(process.argv[2]==='format'){const fs=require('node:fs');const file=process.argv[process.argv.indexOf('--schema')+1];"+("Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,%d);"%delay if delay else '')+"const text=fs.readFileSync(file,'utf8').split('\\n').map(line=>line.trimStart().replace(/^(id|value)[ \\t]+/,'$1 ')).join('\\n');fs.writeFileSync(file,text);process.exit(0);}"
 def output_js(self,emitted=None,delay=0):
  body=self.formatter_js(delay)+"const fs=require('node:fs'),p=require('node:path');const out=p.join(process.cwd(),'node_modules/.prisma/client');fs.mkdirSync(out,{recursive:true});for(const n of ['index.js','default.js','index.d.ts'])fs.writeFileSync(p.join(out,n),'SIMULATED GENERATED OUTPUT');"
  body+=("fs.copyFileSync('prisma/schema.prisma',p.join(out,'schema.prisma'));"if emitted is None else "fs.writeFileSync(p.join(out,'schema.prisma'),%s);"%json.dumps(emitted))
  return body+"fs.copyFileSync(process.env.PRISMA_QUERY_ENGINE_LIBRARY,p.join(out,p.basename(process.env.PRISMA_QUERY_ENGINE_LIBRARY)));"
 def test_actual_fixed_node_fixture_denies_network_and_protected_writes(self):
  probes='';paths=[self.repo/'sentinel',self.cache/'sentinel',self.bound/'sentinel',self.enginecache/'sentinel']
  for path in paths:probes+="try{fs.writeFileSync(%s,'BAD');throw Error('write escaped')}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;}"%json.dumps(str(path))
  self.cli.write_text(self.output_js()+probes+"if(process.env.NPM_TOKEN||process.env.NODE_OPTIONS||process.env.HTTP_PROXY)throw Error('ambient env');const net=require('node:net');const socket=net.connect({host:'127.0.0.1',port:9});socket.on('error',e=>{if(e.code!=='EPERM'&&e.code!=='EACCES')process.exitCode=9;else fs.writeFileSync('network-denied.txt',e.code)});")
  with patch.dict(os.environ,{'NPM_TOKEN':'SECRET','HTTP_PROXY':'SECRET','NODE_OPTIONS':'SECRET'}):result=self.execute()
  self.assertEqual(result['status'],'generated_outputs_observed_unqualified');self.assertTrue(result['generatedOutputsVerified']);self.assertFalse(result['generationCompatibilityVerified']);self.assertEqual(result['descendantQuiescence'],'unavailable');self.assertFalse(result['executionAuthorized']);self.assertEqual(result['upstreamAuthenticity'],'unavailable')
  for path in paths:self.assertEqual(path.read_text(),'unchanged')
  self.assertTrue((self.stage/'network-denied.txt').is_file());self.assertTrue((self.run/'attempt.json').exists());self.assertTrue((self.run/'result.json').exists())
 def test_real_owned_slow_child_timeout_is_killed_and_no_compatibility(self):
  self.cli.write_text("require('node:fs').writeFileSync('fixture.pid',String(process.pid));setInterval(()=>{},1000)")
  with self.assertRaises(m.Unavailable):self.execute(timeout=0.25)
  pid=int((self.stage/'fixture.pid').read_text())
  with self.assertRaises(ProcessLookupError):os.kill(pid,0)
  result=json.loads((self.run/'result.json').read_text());self.assertEqual(result['reason'],'generation_parent_wall_timeout');self.assertFalse(result['generationCompatibilityVerified'])
 def test_missing_outputs_and_nonzero_exit_never_qualify(self):
  self.cli.write_text('process.exitCode=7')
  with self.assertRaises(m.Unavailable):self.execute()
  self.assertFalse(json.loads((self.run/'result.json').read_text())['generationCompatibilityVerified'])
 def test_copied_query_output_mismatch_refuses_compatibility(self):
  self.cli.write_text(self.output_js()+"require('node:fs').appendFileSync('node_modules/.prisma/client/libquery_engine-darwin-arm64.dylib.node','TAMPER')")
  with self.assertRaises(m.Unavailable):self.execute()
  result=json.loads((self.run/'result.json').read_text());self.assertEqual(result['reason'],'generated_query_engine_mismatch');self.assertFalse(result['generationCompatibilityVerified'])
 def test_second_preparation_refusal_prevents_fixed_cli_launch(self):
  self.cli.write_text("require('node:fs').writeFileSync('SHOULD_NOT_RUN','bad')")
  with patch.object(m,'prepare_generation',side_effect=[self.plan,m.Unavailable('source_changed_before_launch')]):
   with self.assertRaises(m.Unavailable):m.execute_generation(self.stage,self.bound,self.repo,'a'*40,self.cache,NODE,self.run,timeout=5)
  self.assertFalse((self.stage/'SHOULD_NOT_RUN').exists())
  self.assertFalse(json.loads((self.run/'result.json').read_text())['generationStarted'])

 def test_changed_recomputed_preparation_refuses_before_cli_launch(self):
  self.cli.write_text("require('node:fs').writeFileSync('SHOULD_NOT_RUN','bad')")
  with patch.object(m,'prepare_generation',side_effect=[self.plan,{**self.plan,'schemaSha256':'c'*64}]):
   with self.assertRaises(m.Unavailable):m.execute_generation(self.stage,self.bound,self.repo,'a'*40,self.cache,NODE,self.run,timeout=5)
  self.assertFalse((self.stage/'SHOULD_NOT_RUN').exists())

 def test_actual_foreign_builder_unavailable_after_version_records_safe_failure(self):
  self.cli.write_text("require('node:fs').writeFileSync('SHOULD_NOT_RUN','bad')")
  foreign=m.builder().Unavailable('PRIVATE_FOREIGN_ERROR_CONTENT')
  with patch.object(m,'prepare_generation',side_effect=[self.plan,foreign]):
   with self.assertRaises(RuntimeError):m.execute_generation(self.stage,self.bound,self.repo,'a'*40,self.cache,NODE,self.run,timeout=5)
  result=json.loads((self.run/'result.json').read_text())
  self.assertFalse(result['generationStarted']);self.assertFalse(result['generatedOutputsVerified'])
  self.assertNotIn('PRIVATE_FOREIGN_ERROR_CONTENT',json.dumps(result));self.assertFalse((self.stage/'SHOULD_NOT_RUN').exists())
 def test_actual_foreign_builder_unavailable_postsource_records_safe_failure(self):
  self.cli.write_text(self.output_js())
  with self.assertRaises(RuntimeError):self.execute(source_error=m.builder().Unavailable('PRIVATE_POSTSOURCE_ERROR'))
  result=json.loads((self.run/'result.json').read_text())
  self.assertTrue(result['generationStarted']);self.assertFalse(result['generatedOutputsVerified']);self.assertNotIn('PRIVATE_POSTSOURCE_ERROR',json.dumps(result))
 def test_detached_owned_writer_survives_group_and_never_gains_qualification(self):
  token=uuid.uuid4().hex;marker=self.stage/'owned-detached.json';heartbeat=self.stage/'owned-heartbeat.txt';pidfile=self.stage/'owned-child.pid'
  child="const fs=require('node:fs');fs.writeFileSync(%s,JSON.stringify({pid:process.pid,token:process.argv[1]}));setInterval(()=>fs.writeFileSync(%s,String(Date.now())),30);setTimeout(()=>process.exit(0),4000);"%(json.dumps(str(marker)),json.dumps(str(heartbeat)))
  launch="const child=require('node:child_process').spawn(process.execPath,['-e',%s,%s],{detached:true,stdio:'inherit'});fs.writeFileSync(%s,String(child.pid));child.unref();"%(json.dumps(child),json.dumps(token),json.dumps(str(pidfile)))
  self.cli.write_text(self.output_js()+launch)
  pid=None
  try:
   result=self.execute();pid=int(pidfile.read_text());deadline=time.monotonic()+1
   while not heartbeat.exists()and time.monotonic()<deadline:time.sleep(0.02)
   observed=json.loads(marker.read_text());self.assertEqual(observed,{'pid':pid,'token':token});self.assertEqual(os.getpgid(pid),pid)
   before=heartbeat.read_text();time.sleep(0.08);self.assertNotEqual(heartbeat.read_text(),before)
   self.assertFalse(result['generationCompatibilityVerified']);self.assertEqual(result['descendantQuiescence'],'unavailable');self.assertEqual(result['status'],'generated_outputs_observed_unqualified');self.assertTrue(result['generatedOutputsVerified'])
  finally:
   if pid is None and pidfile.exists():pid=int(pidfile.read_text())
   if pid is not None:
    command=subprocess.check_output(['/bin/ps','-p',str(pid),'-o','command='],text=True).strip()
    self.assertIn(token,command);self.assertIn(str(marker),command);self.assertEqual(os.getpgid(pid),pid)
    os.kill(pid,signal.SIGKILL)
    deadline=time.monotonic()+2
    while time.monotonic()<deadline:
     try:os.kill(pid,0)
     except ProcessLookupError:break
     time.sleep(0.02)
    else:self.fail('known owned detached fixture was not reaped by host')

 def test_formatting_only_difference_compares_scratch_canonical_bytes(self):
  original='model Thing {\n    id    Int @id\n    value   String @default("x y")\n}\n'
  emitted='model Thing {\nid Int @id\n value String @default("x y")\n}\n'
  (self.stage/'prisma/schema.prisma').write_text(original);self.plan['schemaSha256']=m.hashlib.sha256(original.encode()).hexdigest()
  self.cli.write_text(self.output_js(emitted=emitted));result=self.execute()
  self.assertTrue(result['generatedOutputsVerified']);self.assertEqual(result['schemaComparison']['kind'],'canonical_formatted_scratch_bytes')
  self.assertNotEqual(result['schemaComparison']['rawArchiveSha256'],result['schemaComparison']['rawGeneratedSha256'])
  self.assertEqual((self.stage/'prisma/schema.prisma').read_text(),original)
  self.assertEqual((self.stage/'node_modules/.prisma/client/schema.prisma').read_text(),emitted)
 def test_model_field_type_attribute_changes_refuse_canonical_match(self):
  original='model Thing {\n id Int @id\n value String @default("x y")\n}\n'
  (self.stage/'prisma/schema.prisma').write_text(original);self.plan['schemaSha256']=m.hashlib.sha256(original.encode()).hexdigest()
  for label,emitted in [('model',original.replace('Thing','Other')),('field',original.replace('value','other')),('type',original.replace('String','Int')),('attribute',original.replace('x y','x  y'))]:
   with self.subTest(change=label):
    self.run=self.root/('run-'+label);self.run.mkdir(mode=0o700);self.cli.write_text(self.output_js(emitted=emitted))
    with self.assertRaises(m.Unavailable):self.execute()
    result=json.loads((self.run/'result.json').read_text());self.assertEqual(result['reason'],'generated_schema_canonical_mismatch');self.assertFalse(result['generatedOutputsVerified'])
 def test_format_phases_share_overall_remaining_deadline(self):
  self.cli.write_text(self.output_js(delay=180));start=time.monotonic()
  with self.assertRaises(m.Unavailable):self.execute(timeout=0.4)
  result=json.loads((self.run/'result.json').read_text());self.assertEqual(result['reason'],'generation_parent_wall_timeout');self.assertLess(time.monotonic()-start,0.9)

 def test_preexisting_log_refuses_before_child(self):
  self.cli.write_text("require('node:fs').writeFileSync('SHOULD_NOT_RUN','bad')")
  (self.run/'generation.log').write_text('original')
  with self.assertRaises((m.Unavailable,OSError)):self.execute()
  self.assertFalse((self.stage/'SHOULD_NOT_RUN').exists());self.assertEqual((self.run/'generation.log').read_text(),'original')
if __name__=='__main__':unittest.main()
