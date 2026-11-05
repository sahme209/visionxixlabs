"""New fixed v3 fixture-container copy profile; never image/sign/install executor."""
from pathlib import Path
import copy,hashlib,json,os,plistlib,stat
from . import fixture_container_preparation as fp,container_preparation as cp,container_assembly as old,system_preparation as prep,materialize,manifest
PROFILE=fp.PROFILE
INPUT_FORMAT='axiom.fixture-container-inputs/3'
BASE_INPUT_FORMAT='axiom.fixture-base-inputs/3'
MODE_MAP='axiom.fixture-container-copy-modes/3'
RECEIPT='fixture-container-assembly.json'
RESOURCES=fp.RESOURCES
FLAGS=('executionAuthorized','installationReady','activationAllowed','identityQualified','finalSealQualified')
def _base_inputs(path):return old._inputs_impl(path,_input_format=BASE_INPUT_FORMAT,_materialization_format='axiom.local-issuer-materialization/3',_profile=PROFILE,_mode_map=MODE_MAP)
def _fixture_delivery(bound):
 from .fixture_delivery_inputs import verify_fixture_materialization
 old._bound(bound);return verify_fixture_materialization(bound['path'])
def _inputs(path):
 packet_binding=old.binding(path);p=old._json_bound(packet_binding);keys={'format','profile','generation','basePacket','fixtureInputs','containerPreparation'}
 old._need(set(p)==keys and p['format']==INPUT_FORMAT and p['profile']==PROFILE and p['generation']==prep.GENERATION,'fixed_fixture_input_packet_required')
 old._bound(p['basePacket']);base=_base_inputs(p['basePacket']['path']);old._need(old.binding(p['basePacket']['path'])==p['basePacket'],'fixture_base_packet_changed')
 wrapped=old._json_bound(p['containerPreparation']);preparation=fp.verify_fixture_container(wrapped['staging']);old._need(preparation==wrapped and wrapped['basePreparation']==base['packet']['containerPreparation'],'fixture_main_preparation_join_required')
 delivery=_fixture_delivery(p['fixtureInputs']);old._need(old.binding(p['fixtureInputs']['path'])==p['fixtureInputs'],'fixture_delivery_changed')
 expected_keys={'format','profile','generation','sourceRevision','packageDigest','dependencyRoot','resources','toolNode','mainMaterialization','sourceInputs','executionAuthorized','installationReady','activationAllowed'}
 old._need(set(delivery)==expected_keys and delivery['format']=='axiom.fixture-delivery/1'and delivery['profile']=='compiled-private-fixture/1'and delivery['generation']==prep.GENERATION and delivery['sourceRevision']==base['packet']['sourceRevision']and delivery['packageDigest']==base['packet']['packageDigest']and delivery['dependencyRoot']==prep.PACKAGE_ROOT and delivery['mainMaterialization']==base['packet']['materializationReceipt']and set(delivery['resources'])==set(RESOURCES)and all(delivery[k]is False for k in FLAGS[:3]),'fixture_delivery_provenance_required')
 resources={}
 for role,coordinate in RESOURCES.items():resources[role]=_item(delivery['resources'][role],prep.APP+'/'+coordinate)
 node=_item(delivery['toolNode'],fp.EXTERNAL_NODE);selected=base['materialization']['systemBuildInputs']['runtimeNode'];old._need(delivery['toolNode']['source']==selected,'fixture_node_original_binding_required');canonical=old.binding(Path(base['packet']['packageRoot'])/'__axiom_runtime__/node');old._need(all(canonical[k]==node[k]for k in ('sha256','size')),'fixture_node_package_bytes_required')
 return {'packet':p,'packetBinding':packet_binding,'base':base,'delivery':delivery,'resources':resources,'node':node}
def _item(item,coordinate):
 old._need(type(item)is dict and set(item)=={'source','materializedPath','sha256','size','intendedInstalledCoordinate'}and item['intendedInstalledCoordinate']==coordinate,'fixed_fixture_item_required');source=old._bound(item['source']);current=old.binding(item['materializedPath']);old._need(source['mode']==0o600 and current['mode']==0o600 and all(source[k]==current[k]==item[k]for k in ('sha256','size')),'fixture_item_current_bytes_required');return current
def _derived(inputs,destination,copying):
 base=inputs['base'];files={};copies={};app=destination/'Axiom Synthetic Custodian.app'
 def add(relative,bound,mode):
  target=destination/relative
  result=old._copy_bound(bound,target,mode)if copying else {'path':str(target),'sha256':bound['sha256'],'size':bound['size'],'mode':mode}
  files[relative]=result;return result
 for role,coordinate in materialize.SYSTEM_COMPANIONS.items():copies[role]=add('Axiom Synthetic Custodian.app/'+coordinate,base['companions'][role],0o755)
 main=add('Axiom Synthetic Custodian.app/Contents/MacOS/'+cp.MAIN_NAME,base['main'],0o755);image=add('Axiom Synthetic Custodian.app/Contents/Resources/issuer-package.dmg',base['image'],0o600)
 control={'format':'axiom.local-issuer-control/1','packageRoot':prep.PACKAGE_ROOT,'imageBacking':old.LAYOUT['image'],'manifestSha256':base['manifest']['sha256'],'sourceRevision':base['packet']['sourceRevision']}
 for relative,data in [('Axiom Synthetic Custodian.app/Contents/Info.plist',plistlib.dumps(cp._info(),sort_keys=True)),('Axiom Synthetic Custodian.app/Contents/Resources/issuer-binding.plist',plistlib.dumps(control,sort_keys=True))]:
  if copying:prep._write(destination/relative,data)
  files[relative]={'path':str(destination/relative),'sha256':hashlib.sha256(data).hexdigest(),'size':len(data),'mode':0o600}
 for role,coordinate in RESOURCES.items():add('Axiom Synthetic Custodian.app/'+coordinate,inputs['resources'][role],0o600)
 node=add('fixture-tools/node',inputs['node'],0o755)
 return {'format':'axiom.container-assembly/3','profile':PROFILE,'generation':prep.GENERATION,'destination':str(destination),'inputPacket':inputs['packetBinding'],'sourceRevision':base['packet']['sourceRevision'],'packageDigest':base['packet']['packageDigest'],'rawManifestSha256':base['manifest']['sha256'],'files':files,'authoritativeCopies':copies,'mainCopy':main,'imageCopy':image,'toolNodeCopy':node,'controlBinding':control,'modeMap':MODE_MAP,'signTimeEdges':cp.EDGES+[[role,'container-seal']for role in RESOURCES],'signingPlan':copy.deepcopy(cp.SIGNING_PLAN),'originalModesChanged':False,**{k:False for k in FLAGS}}
def assemble_fixture_container_inputs(packet_path,destination):
 destination=prep._path(Path(destination));cp._private(destination.parent);old._need(not destination.exists()and not destination.is_symlink(),'fresh_fixture_assembly_required');inputs=_inputs(packet_path)
 protected=[Path(inputs['base']['packet']['packageRoot']),Path(inputs['base']['mainPreparation']['staging']),Path(inputs['base']['mainPreparation']['repo']),Path(inputs['packet']['fixtureInputs']['path'])]+[Path(x['path']).parent for x in inputs['resources'].values()]+[Path(inputs['node']['path']).parent]
 old._need(all(destination!=root and root not in destination.parents and destination not in root.parents for root in protected),'fixture_assembly_overlaps_input')
 destination.mkdir(mode=0o700);r=_derived(inputs,destination,True);old._need(_inputs(packet_path)==inputs,'fixture_inputs_changed_during_copy');prep._write(destination/RECEIPT,manifest.canonical(r)+b'\n');return verify_fixture_assembly(destination)
def verify_fixture_assembly(destination):
 destination=cp._private(Path(destination));raw,_=prep._snapshot(destination/RECEIPT,64*1024**2);r=manifest.strict_json(raw);old._need(raw==manifest.canonical(r)+b'\n'and r.get('format')=='axiom.container-assembly/3'and r.get('profile')==PROFILE,'fixed_fixture_assembly_required');inputs=_inputs(r['inputPacket']['path']);expected=_derived(inputs,destination,False);old._need(r==expected,'fixture_derived_receipt_mismatch');_tree(destination,r['files'],{RECEIPT});return r
def _tree(destination,expected,extra):
 directories={'.'}
 for name in expected:directories.update(str(parent)for parent in Path(name).parents)
 actual=set()
 for path in destination.rglob('*'):
  name=path.relative_to(destination).as_posix();info=path.lstat();old._need(not path.is_symlink()and info.st_uid==os.getuid(),'fixture_output_alias_or_owner')
  if stat.S_ISDIR(info.st_mode):old._need(name in directories and stat.S_IMODE(info.st_mode)==0o700,'fixture_output_directory_changed')
  else:old._need(stat.S_ISREG(info.st_mode)and info.st_nlink==1 and name in set(expected)|extra,'fixture_output_extra_file');actual.add(name)
 old._need(actual==set(expected)|extra,'fixture_output_inventory_changed')
 for name,bound in expected.items():old._need(old.binding(destination/name)==bound,'fixture_output_bytes_or_mode_changed')
