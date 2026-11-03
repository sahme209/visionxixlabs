"""Owned compiler-fixture mechanics only; never Next or Prisma compilation."""
import importlib.util,io,json,os,sys,tarfile,tempfile,time,unittest,hashlib,base64,subprocess
from pathlib import Path
from unittest.mock import patch
s=importlib.util.spec_from_file_location('build',Path(__file__).parents[1]/'build-local-issuer-package-source.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
def archive(files):
 data=io.BytesIO()
 with tarfile.open(fileobj=data,mode='w')as out:
  for name,body,mode in files:
   item=tarfile.TarInfo(name);item.mode=mode;item.size=len(body);out.addfile(item,io.BytesIO(body))
 return data.getvalue()
class SourceInputs(unittest.TestCase):
 def test_all_archive_bytes_modes_and_link_identity_are_checked(self):
  with tempfile.TemporaryDirectory(prefix='axiom-build-source-',dir='/private/tmp')as tmp:
   root=Path(tmp);root.chmod(0o700);stage=root/'stage';stage.mkdir(mode=0o700)
   data=archive([('source.js',b'EXACT',0o644),('empty',b'',0o644)])
   (stage/'source.js').write_bytes(b'EXACT');(stage/'source.js').chmod(0o644);(stage/'empty').touch();(stage/'empty').chmod(0o644)
   with patch.object(m,'git_bytes',return_value=data):
    result=m.verify_build_archive(stage,root/'repo','a'*40);self.assertEqual(result['verifiedRegularFiles'],2)
    (stage/'source.js').chmod(0o755)
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)
    (stage/'source.js').chmod(0o644);(stage/'source.js').write_bytes(b'CHANGED')
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)
    (stage/'source.js').unlink();(stage/'source.js').symlink_to(stage/'empty')
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)
 def test_archive_symlink_target_exact_and_next_only_allowed_after_build(self):
  with tempfile.TemporaryDirectory(prefix='axiom-build-link-',dir='/private/tmp')as tmp:
   root=Path(tmp);root.chmod(0o700);stage=root/'stage';stage.mkdir(mode=0o700);data=io.BytesIO()
   with tarfile.open(fileobj=data,mode='w')as out:
    regular=tarfile.TarInfo('source.js');regular.size=5;regular.mode=0o644;out.addfile(regular,io.BytesIO(b'EXACT'))
    link=tarfile.TarInfo('alias.js');link.type=tarfile.SYMTYPE;link.mode=0o777;link.linkname='source.js';out.addfile(link)
   (stage/'source.js').write_bytes(b'EXACT');(stage/'source.js').chmod(0o644);(stage/'alias.js').symlink_to('source.js')
   with patch.object(m,'git_bytes',return_value=data.getvalue()):
    self.assertEqual(m.verify_build_archive(stage,root/'repo','a'*40)['verifiedSymlinks'],1)
    (stage/'.next').mkdir()
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)
    self.assertEqual(m.verify_build_archive(stage,root/'repo','a'*40,phase='after_build')['verifiedSymlinks'],1)
    (stage/'alias.js').unlink();(stage/'alias.js').symlink_to('.next')
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40,phase='after_build')

 def test_extra_route_and_symlink_refuse_closed_archive_source_tree(self):
  with tempfile.TemporaryDirectory(prefix='axiom-build-extra-source-',dir='/private/tmp')as tmp:
   root=Path(tmp);root.chmod(0o700);stage=root/'stage';stage.mkdir(mode=0o700)
   data=archive([('source.js',b'EXACT',0o644)]);(stage/'source.js').write_bytes(b'EXACT');(stage/'source.js').chmod(0o644)
   extra=stage/'app/new-route/page.tsx';extra.parent.mkdir(parents=True);extra.write_text('UNTRACKED EXECUTABLE ROUTE')
   with patch.object(m,'git_bytes',return_value=data):
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40,phase='after_build')
    extra.unlink();extra.parent.rmdir();extra.parent.parent.rmdir();(stage/'alias.ts').symlink_to(stage/'source.js')
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)

 def test_actual_pinned_type_writer_exact_postbuild_variant_and_tamper_refusal(self):
  pinned=Path('/private/tmp/axiom-isolated-b9649927-a6uzltb3/stage')
  writer=pinned/'node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js'
  if not writer.is_file()or not NODE.is_file():self.skipTest('retained pinned Next writer/Node prerequisite unavailable')
  with tempfile.TemporaryDirectory(prefix='axiom-next-types-fixture-',dir='/private/tmp')as tmp:
   root=Path(tmp);root.chmod(0o700);stage=root/'stage';stage.mkdir(mode=0o700);(stage/'app').mkdir();(stage/'app/page.tsx').write_bytes(b'FIXTURE NEVER COMPILED')
   config=(pinned/'next.config.ts').read_bytes();(stage/'next.config.ts').write_bytes(config)
   destination=stage/'node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js';destination.parent.mkdir(parents=True);destination.write_bytes(writer.read_bytes());(stage/'node_modules/next/package.json').write_text('{"version":"16.4.2"}')
   code="require(process.argv[1]).writeAppTypeDeclarations({baseDir:process.argv[2],distDir:'.next',imageImportsEnabled:true,hasPagesDir:false,hasAppDir:true,strictRouteTypes:false,typedRoutes:false}).catch(()=>process.exit(1))"
   profile='(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+json.dumps(str(stage))+'))'
   child=subprocess.run(['/usr/bin/sandbox-exec','-p',profile,str(NODE),'-e',code,str(destination),str(stage)],env={'PATH':'/usr/bin:/bin','LANG':'C'},capture_output=True,timeout=5,preexec_fn=lambda:os.umask(0o022))
   self.assertEqual(child.returncode,0,child.stderr.decode())
   data=io.BytesIO()
   with tarfile.open(fileobj=data,mode='w')as out:
    directory=tarfile.TarInfo('app');directory.type=tarfile.DIRTYPE;directory.mode=0o755;out.addfile(directory)
    for name,body in [('next.config.ts',config),('app/page.tsx',b'FIXTURE NEVER COMPILED')]:
     item=tarfile.TarInfo(name);item.size=len(body);item.mode=0o644;out.addfile(item,io.BytesIO(body))
   generated=stage/'next-env.d.ts';original=generated.read_bytes()
   with patch.object(m,'git_bytes',return_value=data.getvalue()):
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40)
    self.assertEqual(m.verify_build_archive(stage,root/'repo','a'*40,phase='after_build')['verifiedRegularFiles'],2)
    self.assertEqual(m.verify_framework_declaration(stage)['sha256'],hashlib.sha256(original).hexdigest())
    generated.write_bytes(original+b'import "./UNTRACKED";\n')
    with self.assertRaises(m.Unavailable):m.verify_build_archive(stage,root/'repo','a'*40,phase='after_build')
    generated.write_bytes(original);generated.chmod(0o600)
    with self.assertRaises(m.Unavailable):m.verify_framework_declaration(stage)
    generated.chmod(0o644);os.link(generated,root/'hardlink')
    with self.assertRaises(m.Unavailable):m.verify_framework_declaration(stage)

 def test_pinned_nested_compiler_package_is_independently_verified_not_ignored(self):
  with tempfile.TemporaryDirectory(prefix='axiom-build-nested-',dir='/private/tmp')as tmp:
   root=Path(tmp);root.chmod(0o700);stage=root/'stage';stage.mkdir(mode=0o700);cache=root/'cache';cache.mkdir();lock={'packages':{}}
   for location,name in [('node_modules/next','next'),('node_modules/next/node_modules/postcss','postcss')]:
    files=[('package/package.json',json.dumps({'name':name,'version':'1.0.0'}).encode(),0o644),('package/index.js',b'PINNED SOURCE',0o644)]
    data=archive(files);integrity='sha512-'+base64.b64encode(hashlib.sha512(data).digest()).decode();blob,_=m.cache_path(cache,integrity);blob.parent.mkdir(parents=True,exist_ok=True);blob.write_bytes(data)
    lock['packages'][location]={'version':'1.0.0','integrity':integrity}
    for path,body,_ in files:
     target=stage/location/path[len('package/'):];target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(body)
   with patch.object(m,'BUILD_PACKAGES',('node_modules/next',)):
    result=m.observe_build_sources(stage,lock,cache);self.assertEqual(result['verifiedRegularFiles'],4)
    self.assertEqual({item['location']for item in result['packages']},set(lock['packages']))
    extra=stage/'node_modules/next/node_modules/unlocked/index.js';extra.parent.mkdir(parents=True);extra.write_text('UNBOUND')
    with self.assertRaises(m.Unavailable):m.observe_build_sources(stage,lock,cache)
    extra.unlink();extra.parent.rmdir();(stage/'node_modules/next/node_modules/postcss/index.js').write_text('TAMPER')
    with self.assertRaises(m.Unavailable):m.observe_build_sources(stage,lock,cache)
    (stage/'node_modules/next/node_modules/postcss/index.js').write_bytes(b'PINNED SOURCE')
    overlapping=archive([('package/package.json',json.dumps({'name':'next','version':'1.0.0'}).encode(),0o644),('package/index.js',b'PINNED SOURCE',0o644),('package/node_modules/postcss/index.js',b'PINNED SOURCE',0o644)])
    integrity='sha512-'+base64.b64encode(hashlib.sha512(overlapping).digest()).decode();blob,_=m.cache_path(cache,integrity);blob.parent.mkdir(parents=True,exist_ok=True);blob.write_bytes(overlapping);lock['packages']['node_modules/next']['integrity']=integrity
    with self.assertRaises(m.Unavailable):m.observe_build_sources(stage,lock,cache)

class OutputTraceBudget(unittest.TestCase):
 def test_large_legitimate_trace_set_remains_bounded_and_checks_references(self):
  with tempfile.TemporaryDirectory(prefix='axiom-trace-budget-',dir='/private/tmp')as tmp:
   stage=Path(tmp);root=stage/'.next';(root/'server').mkdir(parents=True)
   (root/'BUILD_ID').write_text('FIXTURE_ID')
   (root/'required-server-files.json').write_text(json.dumps({'files':[]}))
   (root/'server/app-paths-manifest.json').write_text(json.dumps({'/fixture':'fixture.js'}))
   (root/'server/fixture.js').write_text('FIXTURE ONLY')
   trace=root/'server/fixture.js.nft.json'
   trace.write_text(json.dumps({'version':1,'files':['fixture.js']*250001}))
   result=m.verify_build_outputs(stage)
   self.assertEqual(result['traceEntryCount'],250001)
   self.assertEqual(result['completeExecutableClosure'],'unavailable')
   trace.write_text(json.dumps({'version':1,'files':['fixture.js']*512001}))
   with self.assertRaisesRegex(m.Unavailable,'next_trace_entry_limit'):m.verify_build_outputs(stage)
   trace.write_text(json.dumps({'version':1,'files':['fixture.js']*250000+['../../../outside']}))
   with self.assertRaisesRegex(m.Unavailable,'next_trace_reference_escape'):m.verify_build_outputs(stage)

@unittest.skipUnless(sys.platform=='darwin'and Path('/usr/bin/sandbox-exec').exists(),'Darwin controls')
class BuildMechanics(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(prefix='axiom-build-mechanics-',dir='/private/tmp');self.root=Path(self.temp.name);self.root.chmod(0o700)
  for name in ['stage','repo','cache','bound','generation','run']:(self.root/name).mkdir(mode=0o700)
  self.stage=self.root/'stage';self.run=self.root/'run';(self.stage/'scripts').mkdir();self.check=self.stage/'scripts/check-vercel-build.mjs';self.check.write_text("console.log('FIXTURE CONTRACT ONLY')")
  self.cli=self.stage/'node_modules/next/dist/bin/next';self.cli.parent.mkdir(parents=True)
  self.home=self.root/'simulated-home';self.enginecache=self.home/'.cache/prisma';self.enginecache.mkdir(parents=True)
  self.inputs={'sourceRevision':'a'*40,'scope':'simulated_source_preparation_no_authority'}
 def tearDown(self):self.temp.cleanup()
 def execute(self,timeout=5):
  with patch.object(m.Path,'home',return_value=self.home),patch.object(m,'prepare_build_inputs',return_value=self.inputs),patch.object(m,'verify_framework_declaration',return_value={'profile':'simulated_Next_fixture_no_authority'}):
   return m.execute_build(self.stage,self.root/'repo','a'*40,self.root/'cache',self.root/'bound',self.root/'generation',NODE,self.run,timeout=timeout)
 def outputs(self):
  return "const fs=require('node:fs');fs.mkdirSync('.next/server/app',{recursive:true});fs.writeFileSync('.next/BUILD_ID','FIXTURE_NOT_NEXT');fs.writeFileSync('.next/required-server-files.json',JSON.stringify({files:['.next/BUILD_ID']}));fs.writeFileSync('.next/server/app-paths-manifest.json',JSON.stringify({'/fixture/route':'app/fixture.js'}));fs.writeFileSync('.next/server/app/fixture.js','FIXTURE COMPILED BY NOBODY');fs.writeFileSync('.next/server/app/fixture.js.nft.json',JSON.stringify({version:1,files:['../../BUILD_ID']}));"
 def test_fixed_fixture_build_clean_env_protected_writes_and_unqualified_result(self):
  protected=self.root/'repo/sentinel';protected.write_text('ORIGINAL')
  read_targets=[protected,self.root/'cache/sentinel',self.enginecache/'sentinel']
  for path in read_targets:path.write_text('ORIGINAL')
  read_probes=''.join("try{fs.readFileSync(%s);throw Error('readescaped')}catch(e){if(e.code!=='EPERM'&&e.code!=='EACCES')throw e;}"%json.dumps(str(path))for path in read_targets)
  self.cli.write_text(self.outputs()+read_probes+"if(process.env.NPM_TOKEN||process.env.NODE_OPTIONS||process.env.HTTP_PROXY)throw Error('ambientenv');if(process.env.NODE_ENV!=='production'||process.argv.slice(2).join(' ')!=='build --webpack')throw Error('wrong command');try{fs.writeFileSync("+json.dumps(str(protected))+",'BAD');throw Error('writeescaped')}catch(e){if(e.code!=='EPERM'&&e.code!=='EACCES')throw e;}")
  with patch.dict(os.environ,{'NPM_TOKEN':'SECRET','NODE_OPTIONS':'SECRET','HTTP_PROXY':'SECRET'}):result=self.execute()
  self.assertEqual(result['status'],'build_outputs_observed_unqualified');self.assertTrue(result['buildOutputsVerified']);self.assertFalse(result['executionAuthorized']);self.assertEqual(result['descendantQuiescence'],'unavailable');self.assertFalse(result['buildCompatibilityVerified']);self.assertEqual(protected.read_text(),'ORIGINAL')
 def test_stale_next_outputs_refuse_before_any_command(self):
  (self.stage/'.next').mkdir();self.check.write_text("import fs from 'node:fs';fs.writeFileSync('SHOULD_NOT_RUN','BAD')")
  with self.assertRaises(m.Unavailable):self.execute()
  self.assertFalse((self.stage/'SHOULD_NOT_RUN').exists())
 def test_preparation_tamper_after_version_refuses_contract_and_build(self):
  self.check.write_text("import fs from 'node:fs';fs.writeFileSync('SHOULD_NOT_RUN','BAD')")
  with patch.object(m,'prepare_build_inputs',side_effect=[self.inputs,{**self.inputs,'sourceRevision':'b'*40}]):
   with self.assertRaises(m.Unavailable):m.execute_build(self.stage,self.root/'repo','a'*40,self.root/'cache',self.root/'bound',self.root/'generation',NODE,self.run,timeout=5)
  self.assertFalse((self.stage/'SHOULD_NOT_RUN').exists());self.assertFalse(json.loads((self.run/'result.json').read_text())['buildOutputsVerified'])
 def test_real_owned_slow_build_child_deadline(self):
  self.cli.write_text("require('node:fs').writeFileSync('owned.pid',String(process.pid));setInterval(()=>{},1000)")
  with self.assertRaises(m.Unavailable):self.execute(timeout=0.6)
  pid=int((self.stage/'owned.pid').read_text())
  with self.assertRaises(ProcessLookupError):os.kill(pid,0)
  result=json.loads((self.run/'result.json').read_text());self.assertEqual(result['reason'],'build_parent_wall_timeout')
 def test_trace_escape_and_missing_output_refuse(self):
  self.cli.write_text(self.outputs()+"fs.writeFileSync('.next/server/app/fixture.js.nft.json',JSON.stringify({version:1,files:['/outside']}));")
  with self.assertRaises(m.Unavailable):self.execute()
  self.assertFalse(json.loads((self.run/'result.json').read_text())['buildOutputsVerified'])
 def test_existing_log_never_overwritten(self):
  (self.run/'next-build.log').write_text('ORIGINAL')
  with self.assertRaises((m.Unavailable,OSError)):self.execute()
  self.assertEqual((self.run/'next-build.log').read_text(),'ORIGINAL')
if __name__=='__main__':unittest.main()
