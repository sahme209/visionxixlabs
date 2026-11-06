"""Fixed private composition; all subprocess boundaries mocked."""
from pathlib import Path
import io,os,sys,tempfile,types,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import stage_a_tools as t
class ContainedTools(unittest.TestCase):
 def test_fixed_git_has_no_nested_sandbox_and_strict_grammar(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
   root=Path(tmp);root.chmod(0o700);(root/'tmp').mkdir(mode=0o700)
   packet={'repo':str(root),'sourceRevision':'a'*40,'work':str(root),'node':{'path':'/fixed/node'},'npmCli':{'path':'/fixed/npm'},'cache':str(root/'cache'),'boundInputs':{'path':str(root/'bound')}};tools=t._create_stage_a_tools(packet)
   def run(argv,**kw):self.assertEqual(argv,['/usr/bin/git','-C',str(root),'show','a'*40+':package.json']);kw['stdout'].write(b'OK');return types.SimpleNamespace(returncode=0)
   with patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':str(root/'tmp')},clear=True),patch.object(t.builder.subprocess,'run',side_effect=run):self.assertEqual(tools.builder.git_bytes(root,['show','a'*40+':package.json']),b'OK')
   with patch.object(t.builder.subprocess,'run')as run:
    for args in (['status'],['show','b'*40+':package.json'],['archive','--format=tar','b'*40],['show','a'*40+':.env']):self.assertRaises(Exception,tools.builder.git_bytes,root,args)
    run.assert_not_called()
 def test_engine_uses_same_captured_builder_for_archived_checks(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
   root=Path(tmp);stage=root/'offline/stage';(stage/'prisma').mkdir(parents=True);(stage/'package.json').write_bytes(b'{}');(stage/'package-lock.json').write_bytes(b'{}');(stage/'prisma/schema.prisma').write_bytes(b'SCHEMA')
   packet={'repo':str(root),'sourceRevision':'a'*40,'work':str(root),'node':{'path':'/fixed/node'},'npmCli':{'path':'/fixed/npm'},'cache':str(root/'cache'),'boundInputs':{'path':str(root/'bound')}};tools=t._create_stage_a_tools(packet)
   with patch.object(tools.builder,'source_inputs',return_value=({}, {},{'packageSha256':t.builder.sha(b'{}'),'lockSha256':t.builder.sha(b'{}')}))as source,patch.object(tools.builder,'git_bytes',return_value=b'SCHEMA')as git,patch.object(t.engine,'builder',side_effect=AssertionError('must not create standalone builder')):
    self.assertEqual(tools.engine.verify_archived_inputs(stage,root,'a'*40)['schemaSha256'],t.builder.sha(b'SCHEMA'));source.assert_called_once();git.assert_called_once()
 def test_actual_generation_algorithm_four_commands_contained_and_legacy(self):
  import hashlib,json
  for contained in (True,False):
   with self.subTest(contained=contained),tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
    root=Path(tmp);root.chmod(0o700);work=root/'work';stage=work/'offline/stage';run=work/'generation';bound=root/'bound';repo=root/'repo';cache=root/'cache'
    for directory in (stage,run,bound,repo,cache):directory.mkdir(parents=True,mode=0o700)
    (stage/'prisma').mkdir();schema=b'SYNTHETIC SCHEMA';(stage/'prisma/schema.prisma').write_bytes(schema);query=b'FAKE QUERY NEVER LOADED';(bound/t.engine.KINDS['query'][1]).write_bytes(query)
    node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node');packet={'repo':str(repo),'sourceRevision':'a'*40,'work':str(work),'node':{'path':str(node)},'npmCli':{'path':'/fixed/npm'},'boundInputs':{'path':str(bound)},'cache':str(cache)};tools=t._create_stage_a_tools(packet)
    plan={'sourceRevision':'a'*40,'schemaSha256':hashlib.sha256(schema).hexdigest(),'engines':{'inputs':{'query':{'sha256':hashlib.sha256(query).hexdigest(),'size':len(query)}}}}
    calls=[]
    def child(argv,cwd,env,log,timeout,**kw):
     calls.append(argv);self.assertEqual(argv.count('/usr/bin/sandbox-exec'),0 if contained else 1)
     if argv[-1]=='--version':log.write(b'v24.21.0\n')
     if 'generate'in argv:
      out=stage/'node_modules/.prisma/client';out.mkdir(parents=True)
      for name in ('index.js','default.js','index.d.ts'):(out/name).write_bytes(b'FAKE')
      (out/'schema.prisma').write_bytes(schema);(out/t.engine.KINDS['query'][1]).write_bytes(query)
     return 0,None
    original_hash=t.engine.stable_file_hash
    with patch('platform.system',return_value='Darwin'),patch('platform.machine',return_value='arm64'),patch.object(t.engine,'stable_file_hash',side_effect=lambda path,*args:({'sha256':'a'*64,'size':1}if Path(path)==node else original_hash(path,*args))),patch.object(t.engine,'_prepare_generation',return_value=plan),patch.object(t.engine,'verify_generation_sources',return_value={}),patch.object(t.engine,'_verify_generation_sources',return_value={}),patch.object(t.engine,'verify_bound_engines',return_value=plan['engines']),patch.object(t.engine,'verify_archived_inputs',return_value={'schemaSha256':plan['schemaSha256']}),patch.object(t.engine,'_verify_archived_inputs',return_value={'schemaSha256':plan['schemaSha256']}),patch.object(t.engine,'_run_generation_child',side_effect=child):
     result=tools.engine.execute_generation(stage,bound,repo,'a'*40,cache,node,run)if contained else t.engine.execute_generation(stage,bound,repo,'a'*40,cache,node,run)
    self.assertEqual(len(calls),4);self.assertTrue(result['generatedOutputsVerified']);self.assertFalse(result['executionAuthorized'])
 def test_actual_offline_install_fixed_commands_contained_and_legacy(self):
  for contained in (True,False):
   with self.subTest(contained=contained),tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
    root=Path(tmp);root.chmod(0o700);work=root/'work';stage=work/'offline/stage';cache=work/'offline/npm-cache';repo=root/'repo';original_cache=root/'cache'
    for directory in (stage,cache,repo,original_cache):directory.mkdir(parents=True,mode=0o700)
    work.chmod(0o700);stage.parent.chmod(0o700)
    (stage/'package-lock.json').write_bytes(b'{}');packet={'repo':str(repo),'sourceRevision':'a'*40,'work':str(work),'node':{'path':'/fixed/node'},'npmCli':{'path':'/fixed/npm'},'cache':str(root/'cache'),'boundInputs':{'path':str(root/'bound')}};tools=t._create_stage_a_tools(packet);calls=[]
    def version(argv,**kw):calls.append(argv);self.assertEqual(argv.count('/usr/bin/sandbox-exec'),0 if contained else 1);return 'v24.21.0'if '--version'in argv and '/fixed/npm'not in argv else'11.19.0'
    def install(argv,**kw):calls.append(argv);self.assertEqual(argv.count('/usr/bin/sandbox-exec'),0 if contained else 1);self.assertIn('--offline',argv);self.assertIn('--ignore-scripts',argv);self.assertIn('--fetch-retries=0',argv);return types.SimpleNamespace(returncode=0)
    with patch.object(t.builder.subprocess,'check_output',side_effect=version),patch.object(t.builder.subprocess,'run',side_effect=install):
     result=tools.builder.install_offline(stage,{'localLinks':[]},cache,Path('/fixed/node'),Path('/fixed/npm'),original_cache,repo)if contained else t.builder.install_offline(stage,{'localLinks':[]},cache,Path('/fixed/node'),Path('/fixed/npm'),original_cache,repo)
    self.assertEqual(len(calls),3);self.assertFalse(result['lifecycleScriptsExecuted']);self.assertEqual(result['exit'],0)

 def test_selected_coordinates_refuse_foreign_inputs_before_core_or_reads(self):
  with tempfile.TemporaryDirectory(dir='/private/tmp')as tmp:
   root=Path(tmp);packet={'repo':str(root/'repo'),'sourceRevision':'a'*40,'work':str(root/'work'),'node':{'path':'/fixed/node'},'npmCli':{'path':'/fixed/npm'},'cache':str(root/'cache'),'boundInputs':{'path':str(root/'bound')}};tools=t._create_stage_a_tools(packet);stage=root/'work/offline/stage'
   with patch.object(t.builder,'_install_offline_core')as install,patch.object(t.engine,'_prepare_generation')as prepare:
    self.assertRaises(Exception,tools.builder.install_offline,stage,{},root/'work/offline/npm-cache',Path('/fixed/node'),Path('/fixed/npm'),root/'foreign-cache',root/'repo')
    self.assertRaises(Exception,tools.engine.prepare_generation,root/'foreign-stage',root/'bound',root/'repo','a'*40,root/'cache',Path('/fixed/node'))
    packet['cache']=str(root/'changed');packet['node']['path']='/changed/node'
    self.assertRaises(Exception,tools.engine.prepare_generation,stage,root/'bound',root/'repo','a'*40,root/'changed',Path('/fixed/node'))
    install.assert_not_called();prepare.assert_not_called()
