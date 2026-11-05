"""Fixed v2 container copy preparation; no image/signing/runtime executor."""
from pathlib import Path
import copy,hashlib,json,os,plistlib,stat
from . import container_preparation as cp,system_preparation as prep,materialize,manifest
from .system_build_inputs import binding,LAYOUT
INPUT_FORMAT='axiom.container-assembly-inputs/2'
MODE_MAP='axiom.container-assembly-copy-modes/2'
SEAL_OBSERVATION_FORMAT='axiom.recorded-container-seal-observation/1'
RECEIPT='container-assembly.json'
UNRESOLVED=['actual_image_operation_and_final_seal_unqualified','sealed_control_dynamic_qualification_missing','same_compiled_consumer_unqualified','root_topology_resources_custody_and_fleet_unqualified']

def _image_argv(package,image):
 return ['/usr/bin/hdiutil','create','-srcfolder',str(package),'-volname',Path(prep.PACKAGE_ROOT).name,'-format','UDRO','-fs','HFS+',str(image)]
def _need(ok,reason):
 if not ok:raise ValueError(reason)
def _mode(value):
 return int(value,8)if isinstance(value,str)else value
def binding(path):
 p=prep._path(Path(path));before=p.lstat()
 _need(stat.S_ISREG(before.st_mode)and before.st_nlink==1 and before.st_uid==os.getuid()and not(before.st_mode&0o7000)and 0<=before.st_size<=manifest.MAX_BYTES,'bounded_owned_singlelink_file_required')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW);h=hashlib.sha256();count=0
 try:
  opened=os.fstat(fd)
  while True:
   data=os.read(fd,min(1024*1024,before.st_size-count+1))
   if not data:break
   count+=len(data);_need(count<=before.st_size,'assembly_input_grew');h.update(data)
  after=os.fstat(fd)
 finally:os.close(fd)
 fields=lambda x:(x.st_dev,x.st_ino,x.st_uid,x.st_nlink,x.st_mode,x.st_size,x.st_mtime_ns,x.st_ctime_ns)
 _need(fields(before)==fields(opened)==fields(after)==fields(p.lstat())and count==before.st_size,'assembly_file_changed')
 return {'path':str(p),'sha256':h.hexdigest(),'size':count,'mode':stat.S_IMODE(before.st_mode)}
def _bound(want):
 _need(isinstance(want,dict)and {'path','sha256','size','mode'}<=set(want),'bound_assembly_file_required')
 got=binding(want['path']);_need(all(got[k]==want[k]for k in ('path','sha256','size'))and got['mode']==_mode(want['mode']),'assembly_bound_input_changed');return got
def _json_bound(want):
 got=_bound(want);_need(got['size']<=64*1024**2,'assembly_json_bound')
 raw,_=prep._snapshot(Path(got['path']),64*1024**2);_need(hashlib.sha256(raw).hexdigest()==got['sha256'],'assembly_json_changed');return manifest.strict_json(raw)
def _main(prepbound,compilebound):
 r=_json_bound(prepbound);comp=_json_bound(compilebound);stage=cp._private(Path(r['staging']))
 _need(r.get('format')=='axiom.container-preparation/2'and r.get('configuration')==cp.CONFIGURATION and r.get('profile')==cp.PROFILE and r.get('generation')==prep.GENERATION,'fixed_v2_main_preparation_required')
 _need(all(r.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed','containerExecuted','identityQualified','modeMappingApplied','assemblyPerformed')),'closed_main_preparation_required')
 _need(type(r.get('prospectiveInstalledMainMode'))is int and r['prospectiveInstalledMainMode']==0o755 and r.get('historicalV1')=='immutable_unresolved_broker_main_seal_cycle','main_fixed_mode_and_history_required')
 repo=prep._path(Path(r['repo']))
 _need(r.get('source',{}).get('path')==str(repo/cp.SOURCE)and r.get('sealedControlPrerequisite',{}).get('path')==str(repo/cp.SEALED_CONTROL_SOURCE),'main_fixed_source_coordinates_required')
 _need(r['sealedControlPrerequisite'].get('required')is True and r['sealedControlPrerequisite'].get('qualification')=='unavailable','main_sealed_control_unqualified_required')
 _need(r.get('authoritativeLeaves')==cp.AUTHORITATIVE_LEAVES and r.get('intendedMain')=={'path':prep.APP+'/Contents/MacOS/'+cp.MAIN_NAME,'identifier':cp.MAIN_IDENTIFIER,'authoritative':False}and r.get('signTimeEdges')==cp.EDGES and r.get('signTimeOrder')==cp._dag(cp.EDGES),'main_fixed_role_graph_required')
 _need(r.get('signingPlan')==cp.SIGNING_PLAN and r.get('compileRecipe')==cp._recipe(stage),'main_fixed_recipe_required')
 _need(comp.get('preparationSha256')==prepbound['sha256']and comp.get('stage')==str(stage)and comp.get('argv')==r['compileRecipe']['argv']and type(comp.get('compilerExit'))is int and comp['compilerExit']==0 and comp.get('state')=='completed','main_compile_preparation_mismatch')
 _need(all(comp.get(k)is False for k in ('targetExecuted','companySigningKeyUsed','appAssembled','installationReady','activationAllowed','runtimeIdentityQualified'))and comp.get('originalInputClosureUnchanged')is True and comp.get('onlyDeclaredOutputAdded')is True,'unqualified_main_compile_required')
 main=_bound(comp['artifact']);_need(main['path']==r['compileRecipe']['output']and main['mode']==0o600,'exact_quarantined_main_required')
 expected=set(r['files'])|{cp.RECEIPT,str(Path(main['path']).relative_to(stage))};actual=set()
 for p in stage.rglob('*'):
  _need(not p.is_symlink(),'main_stage_alias')
  if p.is_file():actual.add(p.relative_to(stage).as_posix())
 _need(actual==expected,'main_stage_file_set_changed')
 for name,want in r['files'].items():
  _need(not Path(name).is_absolute()and '..'not in Path(name).parts,'main_stage_escape');current=binding(stage/name)
  _need(current['sha256']==want['sha256']and current['size']==want['size']and current['mode']==0o600,'main_frozen_preparation_changed')
 _need((stage/'source/container_main.c').read_bytes()==cp.MAIN_SOURCE and (stage/'metadata/Info.plist').read_bytes()==plistlib.dumps(cp._info(),sort_keys=True),'main_fixed_source_metadata_required')
 _need(r.get('sealedControlPrerequisite',{}).get('required')is True,'sealed_control_mandatory')
 for record in (r['source'],r['sealedControlPrerequisite']):
  current=binding(record['path']);_need(all(current[k]==record[k]for k in ('sha256','size','mode')),'main_original_source_changed')
 return main,r

def _inputs_impl(packet_path,*,_input_format=INPUT_FORMAT,_materialization_format='axiom.local-issuer-materialization/2',_profile=cp.PROFILE,_mode_map=MODE_MAP):
 packet_binding=binding(packet_path);p=_json_bound(packet_binding)
 keys={'format','profile','generation','sourceRevision','packageRoot','packageDigest','packageManifest','materializationReceipt','containerPreparation','containerCompile','imageCompletion','modeMap'}
 _need(type(p)is dict and set(p)==keys and p['format']==_input_format and p['profile']==_profile and p['generation']==prep.GENERATION and p['modeMap']==_mode_map,'fixed_container_assembly_profile_required')
 root=prep._path(Path(p['packageRoot']));observed=manifest.verify_package(root);manifest_bound=_bound(p['packageManifest']);tree=manifest.strict_json((root/manifest.MANIFEST).read_bytes())
 _need(manifest_bound['path']==str(root/manifest.MANIFEST)and observed['packageDigest']==p['packageDigest']and tree['provenance']['sourceRevision']==p['sourceRevision'],'assembly_package_provenance_mismatch')
 mat=_json_bound(p['materializationReceipt']);_need(mat.get('format')==_materialization_format and mat.get('source')==p['sourceRevision']and tree['provenance']['materializationReceiptSha256']==p['materializationReceipt']['sha256'],'assembly_materialization_mismatch')
 _need(all(mat.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed')),'unqualified_materialization_required')
 files=mat['systemCompanions']['files'];_need(set(files)==set(materialize.SYSTEM_COMPANIONS)and mat['systemBuildInputs']['layout']==LAYOUT,'fixed_companion_graph_required')
 companion_root=Path(p['materializationReceipt']['path']).parent/'system-companions'
 # The existing inventory verifier requires original copied metadata and exact closure.
 materialize._verify_companion_inventory(companion_root,files)
 companions={}
 for role,coordinate in materialize.SYSTEM_COMPANIONS.items():
  item=files[role];original=_bound(item['source']);selected=mat['systemBuildInputs']['companionArtifacts'][role]
  _need(original==selected and item['sha256']==original['sha256']and item['intendedInstalledCoordinate']==prep.APP+'/'+coordinate,'companion_original_provenance_mismatch')
  current=binding(item['materializedPath']);_need(current['sha256']==original['sha256']and current['size']==original['size']and current['mode']==0o600,'companion_current_bytes_changed');companions[role]=current
 main,mainprep=_main(p['containerPreparation'],p['containerCompile']);image=_json_bound(p['imageCompletion'])
 _need(image.get('format')=='axiom.package-image-completion/1'and image.get('imageCreated')is True and image.get('executionAuthorized')is False,'recorded_image_completion_required')
 _need(image.get('sourcePackage')==str(root)and image.get('sourceRevision')==p['sourceRevision']and image.get('packageDigest')==p['packageDigest']and image.get('manifestSha256')==manifest_bound['sha256'],'image_package_provenance_mismatch')
 imagebound=_bound(image['image']);_need(imagebound['mode']==0o600,'quarantined_image_required')
 operation=_json_bound(image.get('operationRecord'))
 _need(operation.get('format')=='axiom.recorded-package-image-operation/1'and operation.get('argv')==_image_argv(root,Path(imagebound['path']))and operation.get('state')=='completed'and type(operation.get('exit'))is int and operation['exit']==0,'recorded_image_operation_required')
 _need(all(operation.get(k)==image.get(k)for k in ('sourcePackage','sourceRevision','packageDigest','manifestSha256','image')),'image_operation_provenance_mismatch')
 from .image_inspection import verify_recorded_inspection
 verify_recorded_inspection(image.get('mountedObservation'),imagebound,{'sourcePackage':str(root),'sourceRevision':p['sourceRevision'],'packageDigest':p['packageDigest'],'manifestSha256':manifest_bound['sha256']})
 return {'packet':p,'packetBinding':packet_binding,'materialization':mat,'companions':companions,'main':main,'mainPreparation':mainprep,'image':imagebound,'manifest':manifest_bound}

def _inputs(packet_path):
 try:return _inputs_impl(packet_path)
 except (manifest.PackageUnavailable,OSError,KeyError,TypeError)as error:raise ValueError('assembly_input_unavailable:'+str(error))from None

def _copy_bound(bound,target,mode):
 original=_bound(bound);target=Path(target);prep._mkdir(target.parent)
 src=os.open(original['path'],os.O_RDONLY|os.O_NOFOLLOW);before=os.fstat(src);written=0;h=hashlib.sha256()
 try:
  fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb')as out:
   while True:
    data=os.read(src,min(1024*1024,original['size']-written+1))
    if not data:break
    written+=len(data);_need(written<=original['size'],'assembly_copy_grew');out.write(data);h.update(data)
  after=os.fstat(src)
 finally:os.close(src)
 _need(written==original['size']and h.hexdigest()==original['sha256']and all(getattr(before,k)==getattr(after,k)for k in ('st_dev','st_ino','st_size','st_mode','st_mtime_ns','st_ctime_ns')),'assembly_copy_changed')
 _need(_bound(bound)==original,'assembly_source_changed_during_copy');target.chmod(mode);result=binding(target)
 _need(result['sha256']==original['sha256']and result['size']==original['size']and result['mode']==mode,'assembly_copy_mismatch');return result

def assemble_container_inputs(packet_path,destination):
 destination=prep._path(Path(destination));cp._private(destination.parent)
 _need(not destination.exists()and not destination.is_symlink(),'fresh_container_assembly_required')
 inputs=_inputs(packet_path);p=inputs['packet']
 protected=[Path(p['packageRoot']),Path(inputs['mainPreparation']['staging']),Path(inputs['mainPreparation']['repo']),Path(p['materializationReceipt']['path']).parent/'system-companions']
 _need(all(destination!=root and root not in destination.parents and destination not in root.parents for root in protected),'assembly_destination_overlaps_input')
 destination.mkdir(mode=0o700);app=destination/'Axiom Synthetic Custodian.app';copies={}
 for role,coordinate in materialize.SYSTEM_COMPANIONS.items():copies[role]=_copy_bound(inputs['companions'][role],app/coordinate,0o755)
 maincopy=_copy_bound(inputs['main'],app/'Contents/MacOS'/cp.MAIN_NAME,0o755)
 imagecopy=_copy_bound(inputs['image'],app/'Contents/Resources/issuer-package.dmg',0o600)
 prep._write(app/'Contents/Info.plist',plistlib.dumps(cp._info(),sort_keys=True))
 control={'format':'axiom.local-issuer-control/1','packageRoot':prep.PACKAGE_ROOT,'imageBacking':LAYOUT['image'],'manifestSha256':inputs['manifest']['sha256'],'sourceRevision':p['sourceRevision']}
 prep._write(app/'Contents/Resources/issuer-binding.plist',plistlib.dumps(control,sort_keys=True))
 _need(_inputs(packet_path)==inputs,'assembly_inputs_changed_during_copy')
 files={q.relative_to(destination).as_posix():binding(q)for q in destination.rglob('*')if q.is_file()}
 r={'format':'axiom.container-assembly/2','profile':cp.PROFILE,'destination':str(destination),'inputPacket':inputs['packetBinding'],'sourceRevision':p['sourceRevision'],'packageDigest':p['packageDigest'],'rawManifestSha256':inputs['manifest']['sha256'],'authoritativeCopies':copies,'mainCopy':maincopy,'imageCopy':imagecopy,'files':files,'controlBinding':control,'modeMap':MODE_MAP,'originalModesChanged':False,'signTimeEdges':copy.deepcopy(cp.EDGES),'signingPlan':copy.deepcopy(cp.SIGNING_PLAN),'sealedControlRequired':True,'imageEvidenceQualification':'recorded_only_actual_operation_unqualified','historicalV1':'immutable_unresolved_broker_main_seal_cycle','executionAuthorized':False,'installationReady':False,'activationAllowed':False,'identityQualified':False,'finalSealQualified':False,'unresolved':copy.deepcopy(UNRESOLVED)}
 prep._write(destination/RECEIPT,manifest.canonical(r)+b'\n');return r

def verify_assembly(destination):
 destination=cp._private(Path(destination));raw,_=prep._snapshot(destination/RECEIPT,64*1024**2);r=manifest.strict_json(raw)
 _need(raw==manifest.canonical(r)+b'\n'and r.get('format')=='axiom.container-assembly/2'and r.get('profile')==cp.PROFILE and r.get('destination')==str(destination),'fixed_assembly_receipt_required')
 _need(all(r.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed','identityQualified','finalSealQualified','originalModesChanged'))and r.get('sealedControlRequired')is True,'closed_assembly_required')
 _need(r.get('unresolved')==UNRESOLVED and r.get('imageEvidenceQualification')=='recorded_only_actual_operation_unqualified'and r.get('historicalV1')=='immutable_unresolved_broker_main_seal_cycle','fixed_assembly_unqualified_status_required')
 _need(r.get('signTimeEdges')==cp.EDGES and r.get('signingPlan')==cp.SIGNING_PLAN,'fixed_assembly_signing_graph_required')
 inputs=_inputs(r['inputPacket']['path']);_need(binding(r['inputPacket']['path'])==r['inputPacket'],'assembly_packet_changed')
 app=destination/'Axiom Synthetic Custodian.app';expected={};copies={}
 def expect(relative,source,mode):
  result={'path':str(destination/relative),'sha256':source['sha256'],'size':source['size'],'mode':mode};expected[relative]=result;return result
 for role,coordinate in materialize.SYSTEM_COMPANIONS.items():copies[role]=expect('Axiom Synthetic Custodian.app/'+coordinate,inputs['companions'][role],0o755)
 maincopy=expect('Axiom Synthetic Custodian.app/Contents/MacOS/'+cp.MAIN_NAME,inputs['main'],0o755)
 imagecopy=expect('Axiom Synthetic Custodian.app/Contents/Resources/issuer-package.dmg',inputs['image'],0o600)
 control={'format':'axiom.local-issuer-control/1','packageRoot':prep.PACKAGE_ROOT,'imageBacking':LAYOUT['image'],'manifestSha256':inputs['manifest']['sha256'],'sourceRevision':inputs['packet']['sourceRevision']}
 fixedmetadata={'Axiom Synthetic Custodian.app/Contents/Info.plist':plistlib.dumps(cp._info(),sort_keys=True),'Axiom Synthetic Custodian.app/Contents/Resources/issuer-binding.plist':plistlib.dumps(control,sort_keys=True)}
 for name,body in fixedmetadata.items():expect(name,{'sha256':hashlib.sha256(body).hexdigest(),'size':len(body)},0o600)
 _need(r.get('files')==expected and r.get('authoritativeCopies')==copies and r.get('mainCopy')==maincopy and r.get('imageCopy')==imagecopy,'assembly_derived_output_inventory_mismatch')
 _need(r.get('controlBinding')==control and r.get('packageDigest')==inputs['packet']['packageDigest']and r.get('rawManifestSha256')==inputs['manifest']['sha256']and r.get('sourceRevision')==inputs['packet']['sourceRevision']and r.get('modeMap')==MODE_MAP,'assembly_derived_provenance_mismatch')
 directories={'.'}
 for name in expected:
  directories.update(str(parent)for parent in Path(name).parents)
 actual=set()
 for q in destination.rglob('*'):
  rel=q.relative_to(destination).as_posix();info=q.lstat()
  _need(not q.is_symlink()and info.st_uid==os.getuid(),'assembly_output_alias_or_owner')
  if stat.S_ISDIR(info.st_mode):_need(rel in directories and stat.S_IMODE(info.st_mode)==0o700,'assembly_unexpected_or_unsafe_directory')
  else:
   _need(stat.S_ISREG(info.st_mode)and rel in set(expected)|{RECEIPT},'assembly_special_or_unexpected_file');actual.add(rel)
 _need(actual==set(expected)|{RECEIPT},'assembly_output_file_set_changed')
 for name,bound in expected.items():_need(binding(destination/name)==bound,'assembly_derived_output_bytes_changed')
 return r

def verify_final_seal_observation(destination,observation):
 """Recorded synthetic/preseal shape only, not actual post-seal validation.

 verify_assembly requires original preseal main/resource bytes. A real final
 signature changes those bytes and needs a separately reviewed validator.
 """
 r=verify_assembly(destination)
 _need(type(observation)is dict and set(observation)=={'format','assemblyReceiptSha256','deepSigningUsed','authoritativeLeaves','mutatedPaths','signatureValidity'}and observation['format']==SEAL_OBSERVATION_FORMAT,'recorded_seal_shape_required')
 _need(observation['assemblyReceiptSha256']==binding(Path(destination)/RECEIPT)['sha256']and observation['deepSigningUsed']is False,'recorded_seal_scope_required')
 _need(observation['authoritativeLeaves']=={k:v['sha256']for k,v in r['authoritativeCopies'].items()}and observation['mutatedPaths']==cp.SIGNING_PLAN['allowedFinalSealMutations']and observation['signatureValidity']=='unavailable','recorded_seal_leaf_or_mutation_mismatch')
 return {'qualification':'recorded_seal_shape_only','finalSealQualified':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False}
