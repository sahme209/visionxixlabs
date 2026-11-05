"""Separate v2 container preparation. Never launches, signs or installs anything."""
from pathlib import Path
import copy,hashlib,json,os,plistlib,stat
from . import system_preparation as old
PROFILE='axiom.synthetic-container-seal/2'
SOURCE='scripts/governance_local_issuer/container_main.c'
SEALED_CONTROL_SOURCE='packages/verified-issuer-runtime/native/origin_root_binding.m'
MAIN_SOURCE=b'/* Fixed synthetic container only: no issuer role, selectors or effects. */\nint main(void) { return 78; }\n'
MAIN_NAME='AxiomSyntheticContainerMain'
MAIN_IDENTIFIER='com.visionxixlabs.axiom.synthetic.custodian'
AUTHORITATIVE_LEAVES={
 'owner':{'path':old.OWNER_PATH,'identifier':'com.visionxixlabs.axiom.synthetic.launch-owner'},
 'broker':{'path':old.APP+'/Contents/MacOS/AxiomIssuerBroker','identifier':'com.visionxixlabs.axiom.synthetic.broker'},
 'controller':{'path':old.APP+'/Contents/MacOS/AxiomIssuerController','identifier':'com.visionxixlabs.axiom.synthetic.controller'},
 'maintenance':{'path':old.APP+'/Contents/Helpers/AxiomSyntheticProvisioner','identifier':'com.visionxixlabs.axiom.synthetic.provisioner'},
 'node':{'path':old.PACKAGE_ROOT+'/__axiom_runtime__/node','identifier':'com.visionxixlabs.axiom.synthetic-node'},
 'bootstrap':{'path':old.PACKAGE_ROOT+'/__axiom_runtime__/origin-bootstrap','identifier':'com.visionxixlabs.axiom.synthetic.bootstrap'},
 'guard':{'path':old.PACKAGE_ROOT+'/node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node','identifier':'com.visionxixlabs.axiom.synthetic.guard'},
}
EDGES=[['node','broker'],['controller','broker'],['broker','guard'],['guard','private-package'],['node','private-package'],['bootstrap','private-package'],['private-package','image'],['image','container-seal'],['owner','container-seal'],['broker','container-seal'],['controller','container-seal'],['maintenance','container-seal'],['container-main','container-seal']]
CONFIGURATION={'profile':PROFILE,'mainExecutable':MAIN_NAME,'mainIdentifier':MAIN_IDENTIFIER,'authoritativeLeaves':AUTHORITATIVE_LEAVES,'signTimeEdges':EDGES}
SIGNING_PLAN={'detachedMainSignatureRequired':False,'finalAppOperationSignsMain':True,'deepSigningAllowed':False,'authoritativeLeafBytesMustRemainUnchanged':True,'allowedFinalSealMutations':['container-main-signature','Contents/_CodeSignature/CodeResources'],'operationalAuthority':False}
RECEIPT='container-preparation-v2.json'
def _need(ok,reason):
 if not ok:raise ValueError(reason)
def _dag(edges):
 nodes=set(sum(edges,[]));pending={x:{a for a,b in edges if b==x}for x in nodes};order=[]
 while pending:
  ready=sorted(x for x,deps in pending.items()if not deps)
  _need(bool(ready),'container_sign_time_cycle')
  for node in ready:
   order.append(node);pending.pop(node)
   for deps in pending.values():deps.discard(node)
 return order
def _private(value):
 path=old._path(Path(value));i=path.stat()
 _need(path.is_dir()and i.st_uid==os.getuid()and stat.S_IMODE(i.st_mode)==0o700,'private_container_directory_required');return path
def _info():
 return {'CFBundleIdentifier':MAIN_IDENTIFIER,'CFBundleExecutable':MAIN_NAME,'CFBundleName':'Axiom Synthetic Custodian','CFBundlePackageType':'APPL','CFBundleVersion':'0'}
def _recipe(stage):
 output=stage/'leaves'/MAIN_NAME
 return {'operation':'compile_only','role':'non_authoritative_container_main','argv':['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-mmacosx-version-min=13.0',str(stage/'source/container_main.c'),'-o',str(output)],'output':str(output),'requiredOutputMode':0o600,'execute':False,'linkedPrivateResources':False}
def prepare_container(repo,stage,configuration=None):
 config=copy.deepcopy(CONFIGURATION if configuration is None else configuration)
 _need(config==CONFIGURATION,'exact_fixed_container_v2_profile_required');order=_dag(config['signTimeEdges'])
 repo=old._path(Path(repo));stage=old._path(Path(stage));_private(stage.parent)
 _need(not stage.exists()and not stage.is_symlink(),'fresh_container_stage_required')
 data,source=old._snapshot(repo/SOURCE)
 _need(data==MAIN_SOURCE,'fixed_no_effect_container_source_required')
 control,control_snapshot=old._snapshot(repo/SEALED_CONTROL_SOURCE)
 _need(b'static int sealed_control(void)'in control and b'!sealed_control()'in control,'sealed_control_prerequisite_missing')
 stage.mkdir(mode=0o700);old._write(stage/'source/container_main.c',data)
 old._mkdir(stage/'leaves')
 info=_info()
 old._write(stage/'metadata/Info.plist',plistlib.dumps(info,sort_keys=True))
 recipe=_recipe(stage);old._write(stage/'compile-plan.json',(json.dumps([recipe],sort_keys=True,indent=2)+'\n').encode())
 # Recheck original bytes after real staging effects; no old stage is changed.
 _need(old._snapshot(repo/SOURCE)[1]==source and old._snapshot(repo/SEALED_CONTROL_SOURCE)[1]==control_snapshot,'container_preparation_inputs_changed')
 files={p.relative_to(stage).as_posix():{'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':p.stat().st_size}for p in sorted(stage.rglob('*'))if p.is_file()}
 result={'format':'axiom.container-preparation/2','profile':PROFILE,'staging':str(stage),'repo':str(repo),'generation':old.GENERATION,'source':{'path':str(repo/SOURCE),**source},'configuration':config,'compileRecipe':recipe,'authoritativeLeaves':copy.deepcopy(AUTHORITATIVE_LEAVES),'intendedMain':{'path':old.APP+'/Contents/MacOS/'+MAIN_NAME,'identifier':MAIN_IDENTIFIER,'authoritative':False},'signTimeEdges':copy.deepcopy(EDGES),'signTimeOrder':order,'signingPlan':copy.deepcopy(SIGNING_PLAN),'sealedControlPrerequisite':{'required':True,'qualification':'unavailable','path':str(repo/SEALED_CONTROL_SOURCE),**control_snapshot},'files':files,'historicalV1':'immutable_unresolved_broker_main_seal_cycle','assemblyPerformed':False,'prospectiveInstalledMainMode':0o755,'modeMappingApplied':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'containerExecuted':False,'identityQualified':False,'unresolved':['actual_main_compilation_unqualified','actual_package_image_and_final_seal_missing','sealed_control_dynamic_qualification_missing','root_peer_topology_and_resource_custody_unqualified']}
 old._write(stage/RECEIPT,(json.dumps(result,sort_keys=True,indent=2)+'\n').encode());return result
def verify_container(stage):
 stage=_private(stage);raw,snap=old._snapshot(stage/RECEIPT)
 _need(snap['mode']==0o600,'private_container_receipt_required');r=json.loads(raw)
 _need(r.get('format')=='axiom.container-preparation/2'and r.get('profile')==PROFILE and r.get('staging')==str(stage)and r.get('configuration')==CONFIGURATION,'fixed_container_receipt_required')
 _need(all(r.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed','containerExecuted','identityQualified','modeMappingApplied','assemblyPerformed')),'closed_container_preparation_required')
 _need(r.get('generation')==old.GENERATION and type(r.get('prospectiveInstalledMainMode'))is int and r.get('prospectiveInstalledMainMode')==0o755,'fixed_container_generation_and_mode_required')
 _need(r.get('signingPlan')==SIGNING_PLAN and r.get('historicalV1')=='immutable_unresolved_broker_main_seal_cycle','fixed_container_signing_plan_required')
 _need(r.get('compileRecipe')==_recipe(stage)and r.get('signTimeOrder')==_dag(EDGES)and r.get('signTimeEdges')==EDGES,'container_recipe_or_dag_changed')
 actual=set()
 for p in stage.rglob('*'):
  _need(not p.is_symlink(),'container_stage_alias')
  i=p.stat();_need(i.st_uid==os.getuid()and stat.S_IMODE(i.st_mode)==(0o700 if p.is_dir()else 0o600),'container_stage_mode_changed')
  if p.is_file():actual.add(p.relative_to(stage).as_posix())
 _need(actual==set(r['files'])|{RECEIPT},'container_file_set_changed')
 for name,want in r['files'].items():
  _need(not Path(name).is_absolute()and '..'not in Path(name).parts,'container_file_escape')
  _,current=old._snapshot(stage/name)
  _need(current['sha256']==want['sha256']and current['size']==want['size'],'container_staged_bytes_changed')
 _need((stage/'source/container_main.c').read_bytes()==MAIN_SOURCE,'fixed_container_main_changed')
 _need((stage/'metadata/Info.plist').read_bytes()==plistlib.dumps(_info(),sort_keys=True),'fixed_container_metadata_changed')
 _need((stage/'compile-plan.json').read_bytes()==(json.dumps([_recipe(stage)],sort_keys=True,indent=2)+'\n').encode(),'fixed_container_compile_plan_changed')
 _need(r.get('authoritativeLeaves')==AUTHORITATIVE_LEAVES and r.get('intendedMain')=={'path':old.APP+'/Contents/MacOS/'+MAIN_NAME,'identifier':MAIN_IDENTIFIER,'authoritative':False},'fixed_container_role_metadata_changed')
 repo=old._path(Path(r['repo']))
 _need(r['source']['path']==str(repo/SOURCE)and r['sealedControlPrerequisite']['path']==str(repo/SEALED_CONTROL_SOURCE),'fixed_container_source_coordinates_required')
 for record in (r['source'],r['sealedControlPrerequisite']):
  _,current=old._snapshot(Path(record['path']));_need(all(current[k]==record[k]for k in ('sha256','size','mode','dev','ino','mtimeNs','ctimeNs')),'container_source_input_changed')
 _need(r['sealedControlPrerequisite']['required']is True and r['sealedControlPrerequisite']['qualification']=='unavailable','sealed_control_must_remain_mandatory')
 return r
