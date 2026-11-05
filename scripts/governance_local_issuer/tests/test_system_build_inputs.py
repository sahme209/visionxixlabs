"""Synthetic saved observations only; no compiler, signature or runtime calls."""
from pathlib import Path
import hashlib,json,sys,tempfile,unittest
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import system_build_inputs as s
from governance_local_issuer import system_preparation as prep
class SystemBuildInputsTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(dir='/private/tmp');self.addCleanup(self.t.cleanup)
  self.root=Path(self.t.name);self.root.chmod(0o700)
  self.repo=self.root/'repo';self.repo.mkdir(mode=0o700)
  self.stage=self.root/'stage';self.stage.mkdir(mode=0o700)
  self.run=self.root/'run';self.run.mkdir(mode=0o700)
  self.build=self.write('build-node',b'ORIGINAL BUILD TOOL',0o755)
  self.revision='a'*40
  source={}
  for name in sorted(set(prep.PACKAGE_SOURCE_PATHS)|set(prep.ROLE_SOURCE_PATHS)):
   p=self.repo/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(('SOURCE '+name).encode());p.chmod(0o600)
   q=self.stage/name;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes());q.chmod(0o600)
   source[name]=s.binding(p)
  self.headers=self.root/'headers';self.headers.mkdir(mode=0o700)
  for name in ('node_api.h','node_api_types.h','js_native_api.h','js_native_api_types.h'):self.write('headers/'+name,b'HEADER '+name.encode())
  self.config={'format':'axiom.system-preparation-config/1','lifetimeNs':60000000000,'node':{'path':str(self.build),'sha256':s.binding(self.build)['sha256'],'headers':str(self.headers)},'requirements':{},'generation':prep.GENERATION,'principal':{'account':'_axiomissuer_synthetic','uid':503,'gid':503},'systemProfile':'trusted-owner-root-journal/1','nativeProfile':'hardened-runtime-no-exceptions/1','team':'FG5N98FE6W'}
  self.preparation=self.json('preparation.json',{'format':'axiom.system-preparation/1','generation':prep.GENERATION,'preparationPhase':'independent-leaves','config':self.config,'sourceInputs':source,'headerInputs':{p.name:s.binding(p)for p in self.headers.iterdir()},'staging':str(self.root/'native-stage'),'compileRecipes':[],'executionAuthorized':False,'installationReady':False,'activationAllowed':False})
  roles={}
  for role,identifier in s.ROLE_IDENTIFIERS.items():
   artifact=self.write(role,('SIGNED SYNTHETIC '+role).encode())
   out=self.write(role+'-stdout',b'')
   import plistlib
   out.write_bytes(b'' if role=='guard'else plistlib.dumps({'com.apple.security.cs.allow-jit':True} if role=='node' else {}));out.chmod(0o600)
   err=self.write(role+'-stderr',f'Identifier={identifier}\nTeamIdentifier=FG5N98FE6W\nCDHash={"1"*40}\n'.encode())
   result=self.json(role+'-result',{'artifact_after':s.binding(artifact),'profile_matches':True,'results':[{'state':'completed','exit':0}]*3,'targetExecuted':False})
   roles[role]={'identifier':identifier,'artifact':s.binding(artifact),'resultReceipt':s.binding(result),'displayStdout':s.binding(out),'displayStderr':s.binding(err)}
  self.config['node']['path']=roles['node']['artifact']['path'];self.config['node']['sha256']=roles['node']['artifact']['sha256'];self.config['requirements']={'node':'cdhash H"'+'1'*40+'"','controller':'cdhash H"'+'1'*40+'"','brokerForGuard':'cdhash H"'+'1'*40+'"'}
  native=self.root/'native-stage'
  r=prep.prepare_system(self.repo,native,self.config,phase='complete');self.preparation=native/prep.RECEIPT
  for role,item in roles.items():
   rec=json.loads(Path(item['resultReceipt']['path']).read_text())
   commands=[['codesign',kind,item['artifact']['path']]for kind in ('sign','verify','display')]
   for command,argv in zip(rec['results'],commands):command['argv']=argv
   raw=[]
   for i,command in enumerate(rec['results']):
    stdout=Path(item['displayStdout']['path'])if i==2 else self.write(role+f'-{i}-stdout',b'')
    stderr=Path(item['displayStderr']['path'])if i==2 else self.write(role+f'-{i}-stderr',b'SAVED STATIC OBSERVATION')
    raw.append({'stdout':s.binding(stdout),'stderr':s.binding(stderr)})
    command.update({'elapsed_seconds':0.01,'stdout_bytes':stdout.stat().st_size,'stderr_bytes':stderr.stat().st_size})
   item['rawLogs']=raw
   if role=='node':
    rec['original_before']=s.binding(self.build);rec['original_after']=s.binding(self.build);rec['original_unchanged']=True
    sign=self.json('node-signing-packet',{'target':item['artifact']['path'],'commands':commands})
    item['provenance']={'signingPacket':s.binding(sign)}
   else:
    recipe=next(x for x in r['compileRecipes']if x['role']==role)
    unsigned={'path':recipe['output'],'sha256':hashlib.sha256(('UNSIGNED '+role).encode()).hexdigest(),'size':32,'mode':0o600}
    comp=self.json(role+'-compile',{'stage':r['staging'],'manifestSha256':s.binding(self.preparation)['sha256'],'exit':0,'argv':recipe['argv'],'artifact':unsigned})
    sign=self.json(role+'-signing-packet',{'artifact':unsigned,'commands':commands})
    item['provenance']={'signingPacket':s.binding(sign),'compileReceipt':s.binding(comp),'preparationReceipt':s.binding(self.preparation)}
   Path(item['resultReceipt']['path']).write_text(json.dumps(rec));item['resultReceipt']=s.binding(Path(item['resultReceipt']['path']))
  batchsign=self.json('batch-sign',{'leaves':[{'role':role,'identifier':roles[role]['identifier'],'sourceArtifact':json.loads((self.root/(role+'-signing-packet')).read_text())['artifact'],'target':{'path':roles[role]['artifact']['path'],'sha256':json.loads((self.root/(role+'-signing-packet')).read_text())['artifact']['sha256']},'commands':json.loads((self.root/(role+'-signing-packet')).read_text())['commands']}for role in ('owner','maintenance','bootstrap','guard')]})
  for role in ('owner','maintenance','bootstrap','guard'):
   roles[role]['provenance']['signingPacket']=s.binding(batchsign)
   c=self.json(role+'-saved-commands',json.loads((self.root/(role+'-result')).read_text())['results']);roles[role]['provenance']['savedCommands']=s.binding(c)
  historical=self.json('historical-result',{'allFourStaticSequencesAccepted':False})
  sup=self.json('supplement',{'format':'axiom.saved-static-profile-supplement/1','historicalBatchAccepted':False,'allFourRepresentationsObserved':True,'executionAuthorized':False,'installationReady':False,'cryptographicSignatureVerifiedHere':False,'packetSha256':s.binding(batchsign)['sha256'],'historicalResultSha256':s.binding(historical)['sha256'],'representations':[{'role':r,'artifactSha256':roles[r]['artifact']['sha256'],'commandsSha256':roles[r]['provenance']['savedCommands']['sha256'],'observation':({'representation':'no_encoded_entitlement_payload_observed','cdhash':'1'*40,'executionAuthorized':False,'installationReady':False,'cryptographicSignatureVerifiedHere':False}if r=='guard'else{'representation':'explicit_empty_dictionary_observed','executionAuthorized':False,'installationReady':False})}for r in ('owner','maintenance','bootstrap','guard')]})
  self.packet=self.json('packet',{'format':'axiom.system-build-packet/1','sourceRevision':self.revision,'generation':prep.GENERATION,'layout':s.LAYOUT,'preparationReceipts':[s.binding(self.preparation)],'roles':roles,'guardSupplement':s.binding(sup),'guardHistoricalResult':s.binding(historical),'executionAuthorized':False,'installationReady':False})
 def write(self,name,data,mode=0o600):
  p=self.root/name;p.write_bytes(data);p.chmod(mode);return p
 def json(self,name,data):return self.write(name,(json.dumps(data,sort_keys=True)+'\n').encode())
 def record(self):return s.record_system_inputs(self.stage,self.repo,self.revision,self.run,self.build,self.packet)
 def test_connected_copy_distinguishes_nodes_and_preserves_quarantine(self):
  r=self.record();self.assertEqual(r,s.verify_system_inputs(self.stage));self.assertNotEqual(r['buildNode']['sha256'],r['runtimeNode']['sha256'])
  self.assertEqual(set(r['stageArtifacts']),set(s.GENERATED_STAGE));self.assertEqual(set(r['companionArtifacts']),{'owner','broker','controller','maintenance'})
  for name in s.GENERATED_STAGE:self.assertEqual((self.stage/name).stat().st_mode&0o777,0o600)
  self.assertFalse(r['executionAuthorized']);self.assertFalse(r['installationReady']);self.assertFalse(r['modeMappingApplied'])
 def test_unrelated_unsigned_compile_refuses(self):
  p=self.root/'broker-compile';r=json.loads(p.read_text());r['artifact']['sha256']='0'*64;p.write_text(json.dumps(r))
  v=json.loads(self.packet.read_text());v['roles']['broker']['provenance']['compileReceipt']=s.binding(p);self.packet.write_text(json.dumps(v))
  with self.assertRaises(ValueError):self.record()
 def test_frozen_preparation_file_mutation_refuses(self):
  self.record();(self.root/'native-stage/config/system-preparation.h').write_bytes(b'ALTERED')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_supplement_historical_chain_mismatch_refuses(self):
  p=self.root/'historical-result';p.write_text('{}')
  packet=json.loads(self.packet.read_text());packet['guardHistoricalResult']=s.binding(p);self.packet.write_text(json.dumps(packet))
  with self.assertRaises(ValueError):self.record()
 def test_omitted_frozen_source_inventory_entry_refuses(self):
  r=json.loads(self.preparation.read_text());r['files'].pop('source/'+prep.ROLE_SOURCE_PATHS[0]);self.preparation.write_text(json.dumps(r))
  v=json.loads(self.packet.read_text());old=v['preparationReceipts'][0];new=s.binding(self.preparation);v['preparationReceipts']=[new]
  for role,item in v['roles'].items():
   if role=='node':continue
   item['provenance']['preparationReceipt']=new
   cp=Path(item['provenance']['compileReceipt']['path']);c=json.loads(cp.read_text());c['manifestSha256']=new['sha256'];cp.write_text(json.dumps(c));item['provenance']['compileReceipt']=s.binding(cp)
  self.packet.write_text(json.dumps(v))
  with self.assertRaisesRegex(ValueError,'prepared_required_file_inventory_incomplete'):self.record()
 def test_final_app_seal_dependency_remains_unresolved(self):
  r=self.record();self.assertIn('final_outer_app_seal_broker_cdhash_dependency',r['unresolved']);self.assertFalse(r['installationReady'])
 def test_missing_headers_refuses(self):
  r=json.loads(self.preparation.read_text());r['headerInputs']={};self.preparation.write_text(json.dumps(r))
  p=json.loads(self.packet.read_text());p['preparationReceipts']=[s.binding(self.preparation)];self.packet.write_text(json.dumps(p))
  with self.assertRaises(ValueError):self.record()
 def test_incomplete_native_source_closure_refuses(self):
  r=json.loads(self.preparation.read_text());r['sourceInputs'].pop(prep.ROLE_SOURCE_PATHS[0]);self.preparation.write_text(json.dumps(r))
  p=json.loads(self.packet.read_text());p['preparationReceipts']=[s.binding(self.preparation)];self.packet.write_text(json.dumps(p))
  with self.assertRaises(ValueError):self.record()
 def test_actual_node_copy_after_without_path_joins_explicit_sign_target(self):
  p=self.root/'node-result';r=json.loads(p.read_text());r['copy_after']=r.pop('artifact_after');r['copy_after'].pop('path');p.write_text(json.dumps(r))
  packet=json.loads(self.packet.read_text());packet['roles']['node']['resultReceipt']=s.binding(p);self.packet.write_text(json.dumps(packet))
  self.assertEqual(self.record()['runtimeNode']['path'],str(self.root/'node'))
  self.assertNotIn('path',json.loads(p.read_text())['copy_after'])
 def test_pathless_node_copy_cannot_infer_missing_sign_target(self):
  p=self.root/'node-result';r=json.loads(p.read_text());r['copy_after']=r.pop('artifact_after');r['copy_after'].pop('path');p.write_text(json.dumps(r))
  sign=self.root/'node-signing-packet';v=json.loads(sign.read_text());v.pop('target');sign.write_text(json.dumps(v))
  packet=json.loads(self.packet.read_text());packet['roles']['node']['resultReceipt']=s.binding(p);packet['roles']['node']['provenance']['signingPacket']=s.binding(sign);self.packet.write_text(json.dumps(packet))
  with self.assertRaisesRegex(ValueError,'explicit_node_signing_target_required'):self.record()
 def test_node_entitlement_integer_one_is_not_boolean_true(self):
  import plistlib
  out=self.root/'node-stdout';out.write_bytes(plistlib.dumps({'com.apple.security.cs.allow-jit':1}))
  packet=json.loads(self.packet.read_text());item=packet['roles']['node'];item['displayStdout']=s.binding(out);item['rawLogs'][2]['stdout']=s.binding(out)
  result=Path(item['resultReceipt']['path']);r=json.loads(result.read_text());r['results'][2]['stdout_bytes']=out.stat().st_size;result.write_text(json.dumps(r));item['resultReceipt']=s.binding(result);self.packet.write_text(json.dumps(packet))
  with self.assertRaisesRegex(ValueError,'saved_entitlement_profile_mismatch'):self.record()
 def test_saved_sign_log_mutation_refuses(self):
  self.record();(self.root/'broker-0-stderr').write_bytes(b'CHANGED RAW LOG')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_external_role_mutation_refuses(self):
  self.record();(self.root/'broker').write_bytes(b'CHANGED')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_source_mutation_refuses(self):
  self.record();(self.repo/prep.PACKAGE_SOURCE_PATHS[0]).write_bytes(b'CHANGED')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_missing_generated_input_refuses_readonly_verification(self):
  self.record();(self.stage/s.GENERATED_STAGE[0]).unlink()
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_generated_mutation_refuses(self):
  self.record();(self.stage/s.GENERATED_STAGE[0]).write_bytes(b'CHANGED')
  with self.assertRaises(ValueError):s.verify_system_inputs(self.stage)
 def test_wrong_identity_and_mixed_generation_refuse(self):
  for key in ('identifier','generation'):
   v=json.loads(self.packet.read_text())
   if key=='identifier':v['roles']['broker'][key]='wrong'
   else:v[key]='0'*32
   self.packet.write_text(json.dumps(v))
   with self.assertRaises(ValueError):self.record()
 def test_old_overlay_refuses_before_copy(self):
  (self.stage/'_axiom_native_overlay.json').write_text('{}')
  with self.assertRaises(ValueError):self.record()
 def test_actual_guard_saved_byte_shape_is_supported_without_promoting_history(self):
  p=self.root/'guard-result';r=__import__('json').loads(p.read_text());r['actualCommandsCompleted']=r.pop('results');r.pop('profile_matches');p.write_text(__import__('json').dumps(r))
  packet=__import__('json').loads(self.packet.read_text());packet['roles']['guard']['resultReceipt']=s.binding(p);self.packet.write_text(__import__('json').dumps(packet))
  self.assertFalse(self.record()['historicalBatchAccepted'])
 def test_historical_failure_not_promoted(self):
  r=self.record();self.assertFalse(r['historicalBatchAccepted']);self.assertFalse(r['cryptographicSignatureVerifiedHere'])
 def test_completed_stage_refuses_record(self):
  (self.stage/'.next').mkdir()
  with self.assertRaises(ValueError):self.record()
if __name__=='__main__':unittest.main()
