"""Connected assembly algorithm on owned synthetic package/image/main fixtures only."""
from pathlib import Path
import copy,hashlib,json,plistlib,sys,tempfile,unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import container_preparation as cp,manifest,materialize
from governance_local_issuer import container_assembly as a
class ContainerAssemblyTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory(dir='/private/tmp');self.addCleanup(self.t.cleanup);self.root=Path(self.t.name);self.root.chmod(0o700)
  self.revision='a'*40;self.package=self.root/'package';self.package.mkdir(mode=0o700)
  entries={'.next/BUILD_ID':b'FIXTURE','.next/required-server-files.json':b'{"files":[".next/BUILD_ID"]}','node_modules/next/dist/bin/next':b'FIXTURE CLI','__axiom_runtime__/node':b'FIXTURE NODE','__axiom_runtime__/origin-bootstrap':b'FIXTURE BOOTSTRAP','node_modules/@axiom/verified-issuer-runtime/index.cjs':b'FIXTURE CANONICAL CONSUMER','node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node':b'FIXTURE GUARD','.next/server/__axiom_private__/release-merge-bootstrap.cjs':b'FIXTURE COMPILED PRIVATE INITIALIZER'}
  for name,data in entries.items():self.put(self.package/name,data,0o755 if name=='__axiom_runtime__/node'else 0o600)
  self.companions=self.root/'system-companions';self.companions.mkdir(mode=0o700);files={};originals={}
  for role,coordinate in materialize.SYSTEM_COMPANIONS.items():
   source=self.put(self.root/'originals'/role,('FIXTURE SIGNED '+role).encode());originals[role]=a.binding(source)
   target=self.companions/'Axiom Synthetic Custodian.app'/coordinate;files[role]=materialize._copy_companion(originals[role],target);files[role]['intendedInstalledCoordinate']=cp.old.APP+'/'+coordinate
  self.mat=self.js(self.root/'materialization.json',{'format':'axiom.local-issuer-materialization/2','source':self.revision,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'systemBuildInputs':{'companionArtifacts':originals,'layout':a.LAYOUT,'executionAuthorized':False},'systemCompanions':{'files':files,'installationReady':False,'executingIdentity':'unavailable'}})
  provenance={'sourceRevision':self.revision,'archiveSha256':'b'*64,'buildReceiptSha256':'c'*64,'materializationReceiptSha256':a.binding(self.mat)['sha256']}
  digest=manifest.write_manifest(self.package,provenance,'v24.21.0')
  repo=self.root/'repo';repo.mkdir(mode=0o700);self.put(repo/cp.SOURCE,cp.MAIN_SOURCE);self.put(repo/cp.SEALED_CONTROL_SOURCE,b'static int sealed_control(void){return 0;}\nvoid fixture(void){if(!sealed_control())return;}')
  self.prepstage=self.root/'main-stage';r=cp.prepare_container(repo,self.prepstage);self.prep=self.prepstage/cp.RECEIPT;self.main=self.put(Path(r['compileRecipe']['output']),b'FIXTURE COMPILED MAIN')
  self.compile=self.js(self.root/'main-compile.json',{'sourceRevision':'d'*40,'stage':str(self.prepstage),'preparationSha256':a.binding(self.prep)['sha256'],'argv':r['compileRecipe']['argv'],'compilerExit':0,'state':'completed','targetExecuted':False,'companySigningKeyUsed':False,'appAssembled':False,'installationReady':False,'activationAllowed':False,'runtimeIdentityQualified':False,'originalInputClosureUnchanged':True,'onlyDeclaredOutputAdded':True,'artifact':a.binding(self.main)})
  self.image=self.put(self.root/'image/issuer-package.dmg',b'SYNTHETIC IMAGE BYTES; NO IMAGE TOOL')
  self.imageoperation=self.js(self.root/'image-operation.json',{'format':'axiom.recorded-package-image-operation/1','argv':a._image_argv(self.package,self.image),'state':'completed','exit':0,'sourcePackage':str(self.package),'sourceRevision':self.revision,'packageDigest':digest,'manifestSha256':a.binding(self.package/manifest.MANIFEST)['sha256'],'image':a.binding(self.image)})
  self.imageproof=self.js(self.root/'image-completion.json',{'format':'axiom.package-image-completion/1','sourcePackage':str(self.package),'sourceRevision':self.revision,'packageDigest':digest,'manifestSha256':a.binding(self.package/manifest.MANIFEST)['sha256'],'image':a.binding(self.image),'operationRecord':a.binding(self.imageoperation),'imageCreated':True,'executionAuthorized':False})
  from governance_local_issuer import image_inspection as inspection
  root_patch=patch.object(inspection,'RUN_ROOT',self.root);root_patch.start();self.addCleanup(root_patch.stop)
  identity={'stDev':7,'stIno':11,'readOnly':True};package_info={'sourcePackage':str(self.package),'sourceRevision':self.revision,'packageDigest':digest,'manifestSha256':a.binding(self.package/manifest.MANIFEST)['sha256']}
  def command(argv,seconds):return {'argv':argv,'state':'completed','exit':0,'stdout':plistlib.dumps({'system-entities':[{'dev-entry':'/dev/disk9s1','mount-point':str(self.root/'mount')}]})if 'attach'in argv else b'','stderr':b'','cleanup':'reaped_original_child'}
  with patch.object(inspection,'_namespace_restored',return_value=True),patch.object(inspection,'_run',side_effect=command),patch.object(inspection,'_mount_identity',return_value=identity),patch.object(inspection,'_content',return_value={'qualification':'package_file_set_verified',**{k:package_info[k]for k in ('sourceRevision','packageDigest','manifestSha256')}}):proof=inspection.inspect_image(a.binding(self.image),package_info)
  image_completion=json.loads(self.imageproof.read_text());image_completion['mountedObservation']=a.binding(proof);self.js(self.imageproof,image_completion)
  self.packet=self.js(self.root/'packet.json',{'format':a.INPUT_FORMAT,'profile':cp.PROFILE,'generation':cp.old.GENERATION,'sourceRevision':self.revision,'packageRoot':str(self.package),'packageDigest':digest,'packageManifest':a.binding(self.package/manifest.MANIFEST),'materializationReceipt':a.binding(self.mat),'containerPreparation':a.binding(self.prep),'containerCompile':a.binding(self.compile),'imageCompletion':a.binding(self.imageproof),'modeMap':a.MODE_MAP})
  self.destination=self.root/'assembly'
 def put(self,path,data,mode=0o600):
  path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);path.chmod(mode);return path
 def js(self,path,data):return self.put(path,(json.dumps(data,sort_keys=True)+'\n').encode())
 def packet_change(self,key,value):
  p=json.loads(self.packet.read_text());p[key]=value;self.js(self.packet,p)
 def assemble(self):return a.assemble_container_inputs(self.packet,self.destination)
 def test_positive_real_copy_graph_preserves_exact_bytes_control_and_closed_gates(self):
  before={p:p.read_bytes()for p in (self.main,self.image,self.mat,self.prep)}
  r=self.assemble();self.assertEqual(a.verify_assembly(self.destination),r)
  app=self.destination/'Axiom Synthetic Custodian.app';info=plistlib.loads((app/'Contents/Info.plist').read_bytes());self.assertEqual(info['CFBundleExecutable'],cp.MAIN_NAME)
  self.assertEqual((app/'Contents/MacOS'/cp.MAIN_NAME).read_bytes(),self.main.read_bytes())
  for role,coordinate in materialize.SYSTEM_COMPANIONS.items():
   self.assertEqual((app/coordinate).read_bytes(),(self.root/'originals'/role).read_bytes());self.assertEqual((app/coordinate).stat().st_mode&0o777,0o755)
  control=plistlib.loads((app/'Contents/Resources/issuer-binding.plist').read_bytes())
  self.assertEqual(set(control),{'format','packageRoot','imageBacking','manifestSha256','sourceRevision'});self.assertEqual(control['manifestSha256'],a.binding(self.package/manifest.MANIFEST)['sha256']);self.assertNotEqual(control['manifestSha256'],r['packageDigest'])
  self.assertTrue(r['sealedControlRequired']);self.assertEqual(r['signTimeEdges'],cp.EDGES)
  for k in ('executionAuthorized','installationReady','activationAllowed','identityQualified','finalSealQualified'):self.assertFalse(r[k])
  for p,data in before.items():self.assertEqual(p.read_bytes(),data)
 def test_missing_mounted_content_observation_refuses(self):
  p=json.loads(self.imageproof.read_text());p.pop('mountedObservation');self.js(self.imageproof,p);self.packet_change('imageCompletion',a.binding(self.imageproof))
  with self.assertRaises(ValueError):self.assemble()
 def test_missing_image_proof_refuses_before_destination(self):
  self.packet_change('imageCompletion',None)
  with self.assertRaises(ValueError):self.assemble()
  self.assertFalse(self.destination.exists())
 def test_unjoined_image_source_and_manifest_refuse(self):
  p=json.loads(self.imageproof.read_text());p['packageDigest']='e'*64;self.js(self.imageproof,p);self.packet_change('imageCompletion',a.binding(self.imageproof))
  with self.assertRaisesRegex(ValueError,'image_package_provenance_mismatch'):self.assemble()
  self.assertFalse(self.destination.exists())
 def test_wrong_v1_profile_and_extra_selector_refuse(self):
  self.packet_change('profile','axiom.synthetic-container-seal/1')
  with self.assertRaises(ValueError):self.assemble()
  self.packet_change('profile',cp.PROFILE);self.packet_change('mainExecutable','AxiomIssuerBroker')
  with self.assertRaises(ValueError):self.assemble()
 def replace_main_preparation(self,change):
  r=json.loads(self.prep.read_text());change(r);self.js(self.prep,r)
  comp=json.loads(self.compile.read_text());comp['preparationSha256']=a.binding(self.prep)['sha256'];self.js(self.compile,comp)
  packet=json.loads(self.packet.read_text());packet['containerPreparation']=a.binding(self.prep);packet['containerCompile']=a.binding(self.compile);self.js(self.packet,packet)
 def test_forged_control_source_and_affirmative_preparation_refuse(self):
  fake=self.put(self.root/'unrelated-control-source',Path(json.loads(self.prep.read_text())['sealedControlPrerequisite']['path']).read_bytes())
  self.replace_main_preparation(lambda r:r['sealedControlPrerequisite'].update({'path':str(fake)}))
  with self.assertRaisesRegex(ValueError,'main_fixed_source_coordinates_required'):self.assemble()
  self.assertFalse(self.destination.exists())
 def test_affirmative_preparation_flag_refuses(self):
  self.replace_main_preparation(lambda r:r.update({'executionAuthorized':True}))
  with self.assertRaisesRegex(ValueError,'closed_main_preparation_required'):self.assemble()
 def test_companion_and_main_currentness_refuse(self):
  self.main.write_bytes(b'CHANGED')
  with self.assertRaises(ValueError):self.assemble()
  self.assertFalse(self.destination.exists())
 def test_existing_destination_never_overwrites(self):
  self.destination.mkdir(mode=0o700);keep=self.put(self.destination/'keep',b'PRESERVE')
  with self.assertRaises(ValueError):self.assemble()
  self.assertEqual(keep.read_bytes(),b'PRESERVE')
 def test_symlink_and_hardlinked_image_inputs_refuse(self):
  import os
  saved=self.root/'saved-image';self.image.rename(saved);self.image.symlink_to(saved)
  with self.assertRaises(ValueError):self.assemble()
  self.assertFalse(self.destination.exists());self.image.unlink();saved.rename(self.image)
  alias=self.root/'image-hardlink';os.link(self.image,alias)
  with self.assertRaises(ValueError):self.assemble()
  self.assertFalse(self.destination.exists());alias.unlink()
 def test_mutation_during_copy_refuses_success_receipt(self):
  original=a._copy_bound;done=[]
  def mutate(bound,target,mode):
   result=original(bound,target,mode)
   if not done:self.image.write_bytes(b'MUTATED DURING COPY');done.append(True)
   return result
  with patch.object(a,'_copy_bound',side_effect=mutate):
   with self.assertRaises(ValueError):self.assemble()
  self.assertFalse((self.destination/a.RECEIPT).exists())
 def test_missing_image_operation_record_refuses_arbitrary_hash(self):
  p=json.loads(self.imageproof.read_text());p.pop('operationRecord');self.js(self.imageproof,p);self.packet_change('imageCompletion',a.binding(self.imageproof))
  with self.assertRaises(ValueError):self.assemble()
 def test_destination_inside_protected_package_refuses_before_mutation(self):
  self.destination=self.package/'new-assembly'
  with self.assertRaisesRegex(ValueError,'assembly_destination_overlaps_input'):self.assemble()
  self.assertFalse(self.destination.exists())
 def test_output_tamper_and_extra_files_refuse(self):
  self.assemble();self.put(self.destination/'unexpected',b'EXTRA')
  with self.assertRaises(ValueError):a.verify_assembly(self.destination)
 def test_forged_receipt_cannot_adopt_main_leaf_or_extra_file(self):
  original=self.assemble();app=self.destination/'Axiom Synthetic Custodian.app'
  for kind in ('main','broker','extra'):
   r=copy.deepcopy(original);target=app/'Contents/MacOS'/cp.MAIN_NAME if kind=='main'else app/materialize.SYSTEM_COMPANIONS['broker']if kind=='broker'else self.destination/'adopted-extra'
   old=target.read_bytes()if target.exists()else None;target.write_bytes(b'ADOPTED UNTRUSTED CHANGE');target.chmod(0o755 if kind!='extra'else 0o600)
   current=a.binding(target);r['files'][target.relative_to(self.destination).as_posix()]=current
   if kind=='main':r['mainCopy']=current
   elif kind=='broker':r['authoritativeCopies']['broker']=current
   (self.destination/a.RECEIPT).write_bytes(manifest.canonical(r)+b'\n')
   with self.subTest(kind=kind),self.assertRaisesRegex(ValueError,'assembly_derived_output_inventory_mismatch'):a.verify_assembly(self.destination)
   if old is None:target.unlink()
   else:target.write_bytes(old)
   (self.destination/a.RECEIPT).write_bytes(manifest.canonical(original)+b'\n')
 def test_final_seal_observation_never_accepts_leaf_mutation_or_deep_signing(self):
  r=self.assemble();observed={'format':a.SEAL_OBSERVATION_FORMAT,'assemblyReceiptSha256':a.binding(self.destination/a.RECEIPT)['sha256'],'deepSigningUsed':False,'authoritativeLeaves':{k:v['sha256']for k,v in r['authoritativeCopies'].items()},'mutatedPaths':['container-main-signature','Contents/_CodeSignature/CodeResources'],'signatureValidity':'unavailable'}
  result=a.verify_final_seal_observation(self.destination,observed);self.assertFalse(result['finalSealQualified'])
  observed['authoritativeLeaves']['broker']='0'*64
  with self.assertRaises(ValueError):a.verify_final_seal_observation(self.destination,observed)
  observed['authoritativeLeaves']['broker']=r['authoritativeCopies']['broker']['sha256'];observed['deepSigningUsed']=True
  with self.assertRaises(ValueError):a.verify_final_seal_observation(self.destination,observed)
if __name__=='__main__':unittest.main()
