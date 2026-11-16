import importlib.util,json,tempfile,unittest,sys,ast,hashlib,io
from contextlib import redirect_stdout
from types import SimpleNamespace
from pathlib import Path
from unittest.mock import patch
HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
def load(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));unit=importlib.util.module_from_spec(spec);spec.loader.exec_module(unit);return unit
def canonical_ast(value):
 if isinstance(value,ast.AST):return {'node':type(value).__name__,'fields':{key:canonical_ast(item) for key,item in ast.iter_fields(value) if not (key=='type_params' and not item)}}
 if isinstance(value,list):return [canonical_ast(item) for item in value]
 if isinstance(value,bytes):return {'bytesHex':value.hex()}
 return value
def ast_digest(node):return hashlib.sha256(json.dumps(canonical_ast(node),sort_keys=True,separators=(',',':')).encode()).hexdigest()
def binding_fixture():
 env={'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_RUN_ATTEMPT':'1','CANDIDATE_RUN_ATTEMPT':'1','GITHUB_REPOSITORY':'sahme209/visionxixlabs','GITHUB_ACTOR':'sahme209','GITHUB_REF':'refs/tags/desktop-v0.1.23','RELEASE_TAG':'desktop-v0.1.23','VERSION':'0.1.23','SOURCE_SHA':'a'*40,'GITHUB_SHA':'a'*40,'CANDIDATE_RUN_ID':'123','GITHUB_RUN_ID':'123','TARGET':'x86_64-pc-windows-msvc'}
 return env,{'repository':{'id':1130181785,'full_name':'sahme209/visionxixlabs','private':False},'inputs':{'release_tag':'desktop-v0.1.23'}}
def completed_fixture():
 cycles=['msi-major-upgrade','nsis-silent-upgrade','nsis-update','nsis-collision-legacy','nsis-collision-current'];hashes={'msi':'b'*64,'nsis':'c'*64}
 return {'source':'a'*40,'accepted':True,'sourceUnchanged':True,'unsignedValidationOnly':True,'signingPerformed':False,'published':False,'keyringCleanupConfirmed':True,'ownedProcessCleanupConfirmed':True,'upgradeAcceptance':'automated-five-cycles-passed','installations':[{'kind':k,'installConfirmed':True,'uninstallConfirmed':True,'nativeTopLevelWindowObserved':True,'protocolRegistered':True,'metadata':{'signatureStatus':'NotSigned'},'expectedPayloadSha256':'d'*64,'installedPayloadSha256':'d'*64,'installerSha256':hashes[k]} for k in ['msi','nsis']],'upgradeCycles':[{'case':case,'installKind':'msi' if case.startswith('msi-') else 'nsis','oldInstallConfirmed':True,'cleanupConfirmed':True,'candidateSha256':hashes['msi' if case.startswith('msi-') else 'nsis'],'expectedCollisionRefused':True,'upgradeConfirmed':True,'nativeTopLevelWindowObserved':True} for case in cycles],'msiShortcutReturncheck':{k:True for k in ['returncheckVerified','foreignLinkPreserved','cleanupConfirmed','fixedActionObserved','fixedOwnershipErrorObserved']}}
class ReleaseAcceptance(unittest.TestCase):
 def test_release_authority_is_separate_and_exact(self):
  r=load('windows_release_acceptance');env,event=binding_fixture();self.assertEqual(r.release_source_binding(env,event,'0.1.23')['releaseTag'],'desktop-v0.1.23')
  for key,value in [('GITHUB_EVENT_NAME','push'),('GITHUB_RUN_ATTEMPT','2'),('GITHUB_REPOSITORY','foreign/repo'),('GITHUB_REF','refs/heads/main'),('SOURCE_SHA','b'*40),('CANDIDATE_RUN_ID','999'),('RELEASE_TAG','desktop-v0.1.22'),('GITHUB_ACTOR','foreign')]:
   with self.subTest(key=key),self.assertRaises(RuntimeError):r.release_source_binding({**env,key:value},event,'0.1.23')
 def test_prebuilt_fixed_paths_and_no_arbitrary_artifact_selector(self):
  r=load('windows_release_acceptance')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);base=root/'desktop/src-tauri/target/x86_64-pc-windows-msvc/release';(base/'bundle/msi').mkdir(parents=True);(base/'bundle/nsis').mkdir();(base/'axiom-desktop.exe').write_bytes(b'raw');(base/'bundle/msi/V19_0.1.23_x64.msi').write_bytes(b'msi');(base/'bundle/nsis/V19_0.1.23_x64.exe').write_bytes(b'nsis');snap=r.snapshot_prebuilt(root);self.assertEqual(set(snap['assets']),{'msi','nsis'});self.assertEqual(snap['raw']['sizeBytes'],3)
   (base/'bundle/msi/second.msi').write_bytes(b'extra')
   with self.assertRaises(RuntimeError):r.snapshot_prebuilt(root)
 def test_changed_installer_or_raw_payload_refuses(self):
  r=load('windows_release_acceptance');before={'raw':{'sha256':'a','sizeBytes':1},'assets':{'msi':{'fileName':'a.msi','sha256':'b','sizeBytes':2},'nsis':{'fileName':'a.exe','sha256':'c','sizeBytes':3}}}
  r.same_prebuilt(before,before)
  for group in ['raw','assets']:
   changed=json.loads(json.dumps(before));(changed[group] if group=='raw' else changed[group]['msi'])['sha256']='changed'
   with self.assertRaises(RuntimeError):r.same_prebuilt(before,changed)
 def test_receipt_requires_full_cycles_cleanup_and_unsigned_policy(self):
  r=load('windows_release_acceptance');identity=r.release_source_binding(*binding_fixture(),'0.1.23');evidence=completed_fixture();assets={'raw':{'sha256':'a'*64,'sizeBytes':2},'assets':{k:{'fileName':'v.'+('msi' if k=='msi' else 'exe'),'sha256':('b' if k=='msi' else 'c')*64,'sizeBytes':3} for k in ['msi','nsis']}}
  out=r.release_receipt(identity,evidence,assets);self.assertTrue(out['accepted']);self.assertEqual(len(out['assets']),2)
  for key in ['accepted','keyringCleanupConfirmed','ownedProcessCleanupConfirmed']:
   with self.assertRaises(RuntimeError):r.release_receipt(identity,{**evidence,key:False},assets)
  for group in ['installations','upgradeCycles']:
   bad=json.loads(json.dumps(evidence));bad[group].pop()
   with self.assertRaises(RuntimeError):r.release_receipt(identity,bad,assets)
  bad=json.loads(json.dumps(evidence));bad['installations'][0]['metadata']['signatureStatus']='Valid'
  with self.assertRaises(RuntimeError):r.release_receipt(identity,bad,assets)
 def test_actual_candidate_build_branches_skip_all_three_application_builds(self):
  tree=ast.parse((HERE/'windows_installed_acceptance.py').read_text());labels=['desktop-dependencies','frontend','unsigned-bundle'];nodes=[n for n in ast.walk(tree) if isinstance(n,ast.If) and ast.unparse(n.test)=='_prebuilt_release is None' and any(isinstance(x,ast.Constant) and x.value in labels for x in ast.walk(n))]
  self.assertEqual(len(nodes),3)
  with tempfile.TemporaryDirectory() as folder:
   for mode,expected in [(None,labels),({},[])]:
    calls=[];env={'_prebuilt_release':mode,'runner':SimpleNamespace(run=lambda label,*a,**kw:calls.append(label)),'tools':{'node.exe':'node.exe'},'npm':'npm','ROOT':Path(folder),'frozen':{},'receipt':{},'TARGET':'x86_64-pc-windows-msvc','cache':Path(folder)/'none','need':lambda *a:None,'source_snapshot':lambda *a:{},'locked_tauri':lambda *a,**kw:{},'require_webview_runtime':lambda:{},'same_prebuilt':lambda *a:None,'prebuilt_before':{},'snapshot_prebuilt':lambda *a:{},'vendor_cache_snapshot':lambda *a:{},'prebuilt_vendor_before':{}}
    for node in sorted(nodes,key=lambda x:x.lineno):exec(compile(ast.Module(body=[node],type_ignores=[]),'owned-pure-build-branch','exec'),env)
    self.assertEqual(calls,expected)
 def test_release_event_and_all_additional_coordinate_changes_refuse(self):
  r=load('windows_release_acceptance');env,event=binding_fixture()
  for key,value in [('CANDIDATE_RUN_ATTEMPT','2'),('GITHUB_SHA','b'*40),('GITHUB_RUN_ID','999'),('TARGET','aarch64-pc-windows-msvc'),('VERSION','0.1.22')]:
   with self.subTest(key=key),self.assertRaises(RuntimeError):r.release_source_binding({**env,key:value},event,'0.1.23')
  for key,value in [('private',True),('id',7),('full_name','foreign/repo')]:
   bad=json.loads(json.dumps(event));bad['repository'][key]=value
   with self.assertRaises(RuntimeError):r.release_source_binding(env,bad,'0.1.23')
  bad=json.loads(json.dumps(event));bad['inputs']['release_tag']='desktop-v0.1.22'
  with self.assertRaises(RuntimeError):r.release_source_binding(env,bad,'0.1.23')
 def test_symlink_installer_refuses_and_hash_snapshot_changes_with_payload(self):
  r=load('windows_release_acceptance')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);base=root/'desktop/src-tauri/target/x86_64-pc-windows-msvc/release';(base/'bundle/msi').mkdir(parents=True);(base/'bundle/nsis').mkdir();(base/'axiom-desktop.exe').write_bytes(b'raw');msi=base/'bundle/msi/v.msi';msi.write_bytes(b'msi');(base/'bundle/nsis/v.exe').write_bytes(b'nsis');prior=r.snapshot_prebuilt(root);msi.write_bytes(b'changed')
   with self.assertRaises(RuntimeError):r.same_prebuilt(prior,r.snapshot_prebuilt(root))
   msi.unlink();msi.symlink_to(base/'axiom-desktop.exe')
   with self.assertRaises(RuntimeError):r.snapshot_prebuilt(root)
 def test_each_upgrade_failure_returncheck_and_byte_mismatch_refuses_receipt(self):
  r=load('windows_release_acceptance');identity=r.release_source_binding(*binding_fixture(),'0.1.23');assets={'raw':{'sha256':'a'*64,'sizeBytes':2},'assets':{k:{'fileName':'v.'+('msi' if k=='msi' else 'exe'),'sha256':('b' if k=='msi' else 'c')*64,'sizeBytes':3} for k in ['msi','nsis']}}
  for key in ['returncheckVerified','foreignLinkPreserved','cleanupConfirmed','fixedActionObserved','fixedOwnershipErrorObserved']:
   bad=completed_fixture();bad['msiShortcutReturncheck'][key]=False
   with self.assertRaises(RuntimeError):r.release_receipt(identity,bad,assets)
  for n in range(5):
   for key in ['oldInstallConfirmed','cleanupConfirmed',('expectedCollisionRefused' if n>=3 else 'upgradeConfirmed')]:
    bad=completed_fixture();bad['upgradeCycles'][n][key]=False
    with self.assertRaises(RuntimeError):r.release_receipt(identity,bad,assets)
  for n in range(2):
   bad=completed_fixture();bad['installations'][n]['installerSha256']='f'*64
   with self.assertRaises(RuntimeError):r.release_receipt(identity,bad,assets)
 def test_pr_authority_and_full_install_upgrade_vault_cleanup_bodies_preserved(self):
  # Pinned AST digests from reviewed72736 source; no preparation-only fixture.
  candidate=ast.parse((HERE/'windows_installed_acceptance.py').read_text());new={n.name:n for n in candidate.body if isinstance(n,ast.FunctionDef)}
  expected={'authority': '6b08f594b20141fef9f6860a2f41b2748b6d447164b69db6a7482ea39322c230', 'source_binding': '7a674322d01f1b52285c52cce224413b6bd27a3c6c15a42cab9444c8b21c1473', 'install_one': 'e3d4d2cdf66f1414fb69b0bed2a71aa724d2864d317370e1ce0373b162c92deb', 'run_upgrade_cycle': '7c74712bb100b122d825e40d6c80e38cba1999550c79609c0ad6d129d49d09b6', 'msi_shortcut_returncheck': '3954bd51afcc5e943cd9144a2ecb07a5f7ea5fa56968211e2eb439a44ef1359d', 'child_environment': 'f25c021f291d479a7849887b717a66fca80f27979b4756a6202686ba61db3f3e', 'phase_deadline': '70f6c33f62aa8f796cbe9ef1897dd41f45c971c94f333ee4f09368ff4519fe80', 'legacy_fixtures': '086d31f9913c909f3039f8aee8db69d740f0443a80b11a679d78013afa91b61f'}
  digest=ast_digest
  for name,pin in expected.items():self.assertEqual(digest(new[name]),pin,name)
  vault={'vault-build': ['33b2f7414c922db3c85d916d2f5f2223b13a45bfd39a06b0385e8e4973c20276'], 'vault-roundtrip': ['4bcab5df7b70d6b1ba2df7458e7e075f06c971a7cca2bccfa3dcdb8b89f089b2'], 'vault-final-cleanup': ['757a56ed84efcd6f46aa0456d56ee2d3d76f7fd341b754cc78bbba167d10f66c']}
  for label,pins in vault.items():self.assertEqual([digest(x) for x in ast.walk(new['_run_installed_acceptance']) if isinstance(x,ast.Call) and x.args and isinstance(x.args[0],ast.Constant) and x.args[0].value==label],pins)
  self.assertEqual(next(n for n in candidate.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='TOTAL_SECONDS' for t in n.targets)).value.value,2100)
 def test_body_pins_ignore_only_python_added_empty_type_parameters(self):
  node=ast.parse('def fixed(): return 1').body[0];before=ast_digest(node);node._fields=(*node._fields,'type_params') if 'type_params' not in node._fields else node._fields;node.type_params=[];self.assertEqual(ast_digest(node),before);node.body[0].value.value=2;self.assertNotEqual(ast_digest(node),before)
 def test_release_fixed_artifact_tree_rejects_aliased_parent(self):
  r=load('windows_release_acceptance')
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);base=root/'desktop/src-tauri/target/x86_64-pc-windows-msvc/release';(base/'bundle/nsis').mkdir(parents=True);other=root/'outside';other.mkdir();(other/'v.msi').write_bytes(b'msi');(base/'bundle/msi').symlink_to(other,target_is_directory=True);(base/'bundle/nsis/v.exe').write_bytes(b'nsis');(base/'axiom-desktop.exe').write_bytes(b'raw')
   with self.assertRaisesRegex(RuntimeError,'release_artifact_directory_alias_refused'):r.snapshot_prebuilt(root)
 def test_actual_clean_and_upgrade_loops_refuse_changed_prebuilt_bytes(self):
  r=load('windows_release_acceptance');tree=ast.parse((HERE/'windows_installed_acceptance.py').read_text());shared=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='_run_installed_acceptance');loops=[n for n in ast.walk(shared) if isinstance(n,ast.For) and (ast.unparse(n.target)=='(kind, candidate)' or ast.unparse(n.target)=='case') and any(isinstance(x,ast.Constant) and x.value in ('source_changed_after_install_cycle','source_changed_after_upgrade_cycle') for x in ast.walk(n))]
  self.assertEqual(len(loops),2)
  for loop in loops:
   for mutate in (False,True):
    calls=[];before={'fixed':'before'};live=dict(before)
    def run(*args):
     calls.append(args[3])
     if mutate:live['fixed']='changed'
    env={'_prebuilt_release':{},'runner':None,'tools':{},'base':Path('/fixed-owned'),'codes':[],'candidates':{'msi':Path('a.msi'),'nsis':Path('b.exe')},'candidate_metadata':{'msi':{},'nsis':{}},'version':'0.1.23','payload_hashes':{'msi':'a'*64,'nsis':'b'*64},'receipt':{},'legacy':{},'APPLICATION_DIRECTORY':'application','absent_before_owned_cycle':lambda *a:None,'absent_after_cleanup':lambda *a:None,'upgrade_snapshot':lambda *a:{},'install_one':run,'run_upgrade_cycle':run,'remove_empty_application_directory':lambda *a:None,'need':r.qa.need,'source_snapshot':lambda *a:{},'frozen':{},'prebuilt_before':before,'snapshot_prebuilt':lambda *a:dict(live),'same_prebuilt':r.same_prebuilt,'format_payload_hash':r.qa.format_payload_hash,'ROOT':Path('/fixed-source')}
    code=compile(ast.Module(body=[loop],type_ignores=[]),'actual-prebuilt-cycle-loop','exec')
    if mutate:
     with self.assertRaisesRegex(RuntimeError,'prebuilt_release_bytes_changed'):exec(code,env)
     self.assertEqual(len(calls),1)
    else:exec(code,env);self.assertEqual(len(calls),2 if ast.unparse(loop.target)=='(kind, candidate)' else 5)
 def test_actual_final_cleanup_source_mutation_blocks_receipt_with_unchanged_bytes(self):
  r=load('windows_release_acceptance');tree=ast.parse((HERE/'windows_installed_acceptance.py').read_text());shared=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='_run_installed_acceptance');attempt=next(n for n in shared.body if isinstance(n,ast.Try));final=next(n for n in shared.body if isinstance(n,ast.If) and any(isinstance(x,ast.Name) and x.id=='release_receipt' for x in ast.walk(n)))
  for mutate in (False,True):
   with tempfile.TemporaryDirectory() as d:
    root=Path(d);(root/'desktop').mkdir();output=root/'owned-evidence';output.mkdir();frozen={'source':'reviewed'};live=dict(frozen);calls=[]
    def cleanup(label,*args):
     calls.append(label)
     if mutate:live['source']='changed-during-owned-cleanup'
    runner=SimpleNamespace(run=cleanup,records=[{'ownedJobEmpty':True}],deadline=0)
    env={'vault_started':True,'vault_args':['synthetic-vault.exe'],'vault_executable_hash':'a'*64,'digest':lambda *a:'a'*64,'Path':Path,'time':SimpleNamespace(monotonic=lambda:1),'runner':runner,'tools':{},'receipt':{'accepted':True,'keyringCleanupConfirmed':False},'key':'fixed-synthetic','ROOT':root,'need':r.qa.need,'primary_receipt':r.qa.primary_receipt,'json':json,'output':output,'_prebuilt_release':{},'frozen':frozen,'source_snapshot':lambda *a:dict(live),'prebuilt_before':{'bytes':'unchanged'},'snapshot_prebuilt':lambda *a:{'bytes':'unchanged'},'same_prebuilt':r.same_prebuilt,'cache':root/'cache','vendor_cache_snapshot':lambda *a:{},'prebuilt_vendor_before':{},'release_receipt':lambda *a:{'accepted':True}}
    with redirect_stdout(io.StringIO()):exec(compile(ast.Module(body=attempt.finalbody,type_ignores=[]),'actual-owned-final-cleanup','exec'),env)
    self.assertEqual(calls,['vault-final-cleanup']);self.assertTrue(env['receipt']['keyringCleanupConfirmed'])
    code=compile(ast.Module(body=[final],type_ignores=[]),'actual-post-cleanup-release-gate','exec');destination=root/'desktop/windows-installed-release-qa.json'
    if mutate:
     with self.assertRaisesRegex(RuntimeError,'source_changed_after_release_cleanup'):exec(code,env)
     self.assertFalse(destination.exists())
    else:exec(code,env);self.assertTrue(destination.is_file())
 def test_shared_prebuilt_path_preserves_pr_default_and_build_command_gates(self):
  text=(HERE/'windows_installed_acceptance.py').read_text();self.assertIn('def main():\n    return _run_installed_acceptance(authority())',text);self.assertIn('if _prebuilt_release is None:',text);self.assertIn('same_prebuilt(',text);self.assertIn('release_receipt(',text)
if __name__=='__main__':unittest.main()
