"""Exact fixture delivery inputs/copies. File observations never grant execution."""
from pathlib import Path
import hashlib,json,re,os,stat
from . import system_preparation as prep,system_build_inputs as system,manifest
RECEIPT='_axiom_fixture_delivery_inputs.json'
PROFILE='compiled-private-fixture/1'
HELPER='.next/server/__axiom_private_fixture__/fixture-producer.cjs'
SCHEMA_SHA='50e1fbbf50d5d28ba08e862a72789de3c5a9fdad5d7589751a86e0135c5eb031'
ENGINE_SHA='57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a'
RESOURCE_NAMES={'producer':'fixture-producer.cjs','schema':'fixture-schema.sql','binding':'fixture-schema.binding.json','seed':'fixture-seed.sql'}
COORDINATES={k:prep.APP+'/Contents/Resources/qualification/'+v for k,v in RESOURCE_NAMES.items()}
NODE_COORDINATE=prep.ROOT+'/fixture-tools/node'
SOURCE_PATHS=('scripts/emit-synthetic-fixture-producer.cjs','scripts/prepare-synthetic-fixture-recipe.cjs','scripts/private-bootstrap-typescript-loader.cjs','lib/governance/qualification/privateSyntheticFixtureEntry.ts','lib/governance/qualification/privateSyntheticFixtureProducer.ts','lib/governance/qualification/syntheticFixtureSchema.ts','lib/security/privateAuthorityDatabase.ts','lib/governance/qualification/fixture-seed.sql','prisma/schema.prisma')
PRISMA_ANCHORS=('node_modules/@prisma/client/package.json','node_modules/@prisma/client/default.js','node_modules/@prisma/client/runtime/library.js','node_modules/.prisma/client/package.json','node_modules/.prisma/client/default.js','node_modules/.prisma/client/index.js','node_modules/.prisma/client/schema.prisma','node_modules/.prisma/client/libquery_engine-darwin-arm64.dylib.node')
def _need(ok,reason):
 if not ok:raise ValueError(reason)
def preimport_banner():
 root=json.dumps(prep.PACKAGE_ROOT);verifier=json.dumps(prep.PACKAGE_ROOT+'/node_modules/@axiom/verified-issuer-runtime/internal/verify-package.cjs')
 return ("'use strict';\n{const observation=require("+verifier+").verifyPackageFiles("+root+");if(!observation||observation.qualification!==\"package_file_set_verified\")throw Error(\"fixture_package_unavailable\");}\n").encode()
def _bound(item,cap=32*1024*1024):
 _need(type(item)is dict and set(item)=={'path','sha256','size','mode'},'exact_fixture_binding_required');data,s=prep._snapshot(Path(item['path']),cap)
 _need(system.binding(item['path'])==item and s['sha256']==item['sha256'],'fixture_bound_input_changed');return data
def _json(item):return manifest.strict_json(_bound(item))
def _observe(stage,packet_path,after_build):
 stage=system._private(Path(stage));p=_json(system.binding(packet_path));keys={'format','profile','generation','sourceRevision','stage','schemaSource','engine','resources','toolNode'}
 _need(type(p)is dict and set(p)==keys and p['format']=='axiom.fixture-delivery-inputs/1'and p['profile']==PROFILE and p['generation']==prep.GENERATION and p['stage']==str(stage),'fixed_fixture_input_profile_required')
 current=system.verify_system_inputs(stage,after_build=after_build);_need(current is not None and current['sourceRevision']==p['sourceRevision']and p['toolNode']==current['runtimeNode'],'paired_fixture_system_inputs_required')
 _bound(p['toolNode'],2*1024**3);_need(p['toolNode']['mode']==0o600,'quarantined_fixture_node_required')
 configs=[_json(item)['config']for item in current['preparationReceipts']]
 _need(bool(configs)and all('fixtureTools'in c and 'fixturePrincipal'in c for c in configs),'selected_native_fixture_profile_required')
 pins=configs[0]['fixtureTools'];principal=configs[0]['fixturePrincipal']
 _need(all(c['fixtureTools']==pins and c['fixturePrincipal']==principal for c in configs)and pins['nodeSha256']==p['toolNode']['sha256'],'native_fixture_profile_join_required')
 schema=_bound(p['schemaSource'],8*1024*1024);_bound(p['engine'],256*1024*1024)
 _need(p['schemaSource']['sha256']==SCHEMA_SHA and p['engine']['sha256']==ENGINE_SHA,'pinned_fixture_schema_engine_required')
 sources={name:system.binding(stage/name)for name in SOURCE_PATHS}
 _need(_bound(sources['prisma/schema.prisma'],8*1024*1024)==schema,'fixture_schema_source_changed')
 _need(system.binding(stage/'node_modules/@prisma/engines/schema-engine-darwin-arm64')['sha256']==p['engine']['sha256'],'fixture_generation_engine_changed')
 r=p['resources'];_need(type(r)is dict and set(r)=={'schema','binding','seed'},'exact_fixture_recipe_resources_required')
 for item in r.values():_bound(item,8*1024*1024);_need(item['mode']==0o600,'quarantined_fixture_recipe_required')
 _need(_bound(r['seed'])==_bound(sources['lib/governance/qualification/fixture-seed.sql']),'fixture_seed_source_changed')
 recipe=_json(r['binding']);expected={'format':'axiom.synthetic-fixture-schema/1','schemaSha256':SCHEMA_SHA,'engineSha256':ENGINE_SHA,'diffInputSha256':hashlib.sha256(schema.replace(b'url      = env("DATABASE_URL")',b'url      = "postgresql://qualification.invalid/qualification"')).hexdigest(),'sqlSha256':r['schema']['sha256'],'seedSha256':r['seed']['sha256'],'models':sorted(re.findall(r'^model ([A-Za-z0-9_]+) \{',schema.decode('utf8'),re.M)),'completeSchema':True,'qualification':False}
 _need(recipe==expected and type(recipe.get('completeSchema'))is bool and type(recipe.get('qualification'))is bool,'fixture_recipe_provenance_mismatch')
 emitter=system.binding(stage/'scripts/emit-synthetic-fixture-producer.cjs')
 if after_build:
  helper=system.binding(stage/HELPER);data=_bound(helper);_need(helper['mode']==0o600 and helper['sha256']==pins['producerSha256']and data.startswith(preimport_banner())and json.dumps(prep.PACKAGE_ROOT+'/node_modules/@prisma/client').encode()in data,'fixture_helper_preimport_mapping_required')
  for name in PRISMA_ANCHORS:_bound(system.binding(stage/name),128*1024*1024)
  _need((stage/'node_modules/.prisma/client/schema.prisma').read_bytes()==schema,'fixture_generated_client_schema_changed')
 return {'format':'axiom.prebuild-fixture-delivery/1','profile':PROFILE,'generation':prep.GENERATION,'sourceRevision':p['sourceRevision'],'stage':str(stage),'packet':system.binding(packet_path),'systemInputs':system.binding(stage/system.RECEIPT),'emitter':emitter,'sourceFiles':sources,'nativePins':{'tools':pins,'principal':principal},'schemaSource':p['schemaSource'],'engine':p['engine'],'resources':r,'toolNode':p['toolNode'],'executionAuthorized':False,'installationReady':False,'activationAllowed':False}
def record_fixture_delivery_inputs(stage,packet_path):
 stage=system._private(Path(stage));_need(not(stage/RECEIPT).exists()and not(stage/RECEIPT).is_symlink()and not(stage/'.next').exists(),'fresh_fixture_source_record_required');r=_observe(stage,packet_path,False);prep._write(stage/RECEIPT,manifest.canonical(r)+b'\n');return r
def verify_fixture_delivery_inputs(stage,*,after_build=False):
 stage=system._private(Path(stage));path=stage/RECEIPT
 if not path.exists()and not path.is_symlink():return None
 raw,snap=prep._snapshot(path,32*1024*1024);r=manifest.strict_json(raw);_need(snap['mode']==0o600 and raw==manifest.canonical(r)+b'\n','canonical_fixture_source_record_required');_need(_observe(stage,r['packet']['path'],after_build)==r,'fixture_source_inputs_changed');return r
def prepare_fixture_materialization(stage,parent):
 from .materialize import _copy_companion
 stage=Path(stage);parent=system._private(Path(parent));r=verify_fixture_delivery_inputs(stage,after_build=True);_need(r is not None,'fixture_source_record_required');root=parent/'fixture-delivery-inputs';_need(not root.exists()and not root.is_symlink(),'fresh_fixture_copy_root_required');root.mkdir(mode=0o700)
 resources={}
 for role,name in RESOURCE_NAMES.items():
  source=system.binding(stage/HELPER)if role=='producer'else r['resources'][role];target=root/'qualification'/name;copied=_copy_companion(source,target);resources[role]={'source':source,'materializedPath':str(target),'sha256':copied['sha256'],'size':source['size'],'intendedInstalledCoordinate':COORDINATES[role]}
 source=r['toolNode'];target=root/'toolNode';copied=_copy_companion(source,target);tool={'source':source,'materializedPath':str(target),'sha256':copied['sha256'],'size':source['size'],'intendedInstalledCoordinate':NODE_COORDINATE}
 _need(verify_fixture_delivery_inputs(stage,after_build=True)==r,'fixture_inputs_changed_during_copy')
 return {'format':'axiom.fixture-delivery-inputs-materialized/1','profile':PROFILE,'generation':prep.GENERATION,'sourceRevision':r['sourceRevision'],'sourceInputs':system.binding(stage/RECEIPT),'dependencySources':{name:system.binding(stage/name)for name in PRISMA_ANCHORS},'resources':resources,'toolNode':tool}
def _copies(record,parent):
 root=Path(parent)/'fixture-delivery-inputs';resources=record['resources'];_need(type(resources)is dict and set(resources)==set(RESOURCE_NAMES),'fixed_fixture_copy_roles_required');expected={root/'qualification'/n for n in RESOURCE_NAMES.values()}|{root/'toolNode'}
 _need(root.is_dir()and not root.is_symlink(),'fixed_fixture_copy_root_required');actual=set()
 for directory,dirs,files in os.walk(root,followlinks=False):
  for name in dirs+files:
   path=Path(directory)/name;i=path.lstat();_need(not path.is_symlink()and i.st_uid==os.getuid()and not(i.st_mode&0o022),'unsafe_fixture_copy_tree');
   if path.is_file():actual.add(path)
   else:_need(path==root/'qualification'and stat.S_ISDIR(i.st_mode),'extra_fixture_copy_directory')
 _need(actual==expected,'exact_fixture_copy_inventory_required')
 for role,item in [*resources.items(),('toolNode',record['toolNode'])]:
  coordinate=NODE_COORDINATE if role=='toolNode'else COORDINATES[role];path=root/'toolNode'if role=='toolNode'else root/'qualification'/RESOURCE_NAMES[role]
  _need(type(item)is dict and set(item)=={'source','materializedPath','sha256','size','intendedInstalledCoordinate'}and item['materializedPath']==str(path)and item['intendedInstalledCoordinate']==coordinate,'fixed_fixture_copy_coordinate_required');_bound(item['source'],256*1024*1024);observed=system.binding(path);_need(observed['sha256']==item['sha256']==item['source']['sha256']and observed['size']==item['size']==item['source']['size']and observed['mode']==item['source']['mode']==0o600,'fixture_materialized_input_changed')
 return record

def finish_fixture_materialization(main_receipt,package_root):
 main_receipt=Path(main_receipt);mat=_json(system.binding(main_receipt));r=mat['fixtureDeliveryInputs'];_copies(r,main_receipt.parent);observed=manifest.verify_package(Path(package_root));tree=manifest.strict_json((Path(package_root)/manifest.MANIFEST).read_bytes());_need(mat['format']=='axiom.local-issuer-materialization/3'and all(mat.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed'))and tree['provenance']['materializationReceiptSha256']==system.binding(main_receipt)['sha256'],'fixture_main_manifest_join_required')
 result={'format':'axiom.fixture-delivery/1','profile':PROFILE,'generation':prep.GENERATION,'sourceRevision':mat['source'],'packageDigest':observed['packageDigest'],'dependencyRoot':prep.PACKAGE_ROOT,'resources':r['resources'],'toolNode':r['toolNode'],'mainMaterialization':system.binding(main_receipt),'sourceInputs':r['sourceInputs'],'executionAuthorized':False,'installationReady':False,'activationAllowed':False};path=main_receipt.parent/'fixture-delivery.json';prep._write(path,manifest.canonical(result)+b'\n');return verify_fixture_materialization(path)
def verify_fixture_materialization(receipt_path):
 path=Path(receipt_path);r=_json(system.binding(path));keys={'format','profile','generation','sourceRevision','packageDigest','dependencyRoot','resources','toolNode','mainMaterialization','sourceInputs','executionAuthorized','installationReady','activationAllowed'}
 _need(type(r)is dict and set(r)==keys and r['format']=='axiom.fixture-delivery/1'and r['profile']==PROFILE and r['generation']==prep.GENERATION and r['dependencyRoot']==prep.PACKAGE_ROOT and all(r[k]is False for k in ('executionAuthorized','installationReady','activationAllowed')),'fixed_fixture_delivery_required')
 _need(path==Path(r['mainMaterialization']['path']).parent/'fixture-delivery.json','fixed_fixture_delivery_receipt_coordinate_required');mat=_json(r['mainMaterialization']);inputs=_json(r['sourceInputs']);_need(mat['format']=='axiom.local-issuer-materialization/3'and mat['source']==r['sourceRevision']==inputs['sourceRevision']and all(mat.get(k)is False for k in ('executionAuthorized','installationReady','activationAllowed'))and mat['fixtureDeliveryInputs']['sourceInputs']==r['sourceInputs'],'fixture_delivery_source_join_required')
 stage=Path(inputs['stage']);_need(verify_fixture_delivery_inputs(stage,after_build=True)==inputs,'fixture_delivery_source_stale');_need(r['resources']['producer']['source']==system.binding(stage/HELPER)and all(r['resources'][k]['source']==inputs['resources'][k]for k in ('schema','binding','seed')),'fixture_resource_source_join_required');m=mat['fixtureDeliveryInputs'];_need(m['resources']==r['resources']and m['toolNode']==r['toolNode']and r['toolNode']['source']==inputs['toolNode'],'fixture_delivery_copy_join_required');_copies(m,path.parent)
 # The fixed main receipt remains acyclic; actual payload is its adjacent package.
 package=Path(mat['fixturePackageRoot']);_need(system.binding(package/HELPER)['sha256']==r['resources']['producer']['sha256'],'fixture_payload_helper_changed');
 _need(type(m.get('dependencySources'))is dict and set(m['dependencySources'])==set(PRISMA_ANCHORS),'fixture_dependency_source_inventory_required')
 for name in PRISMA_ANCHORS:
  selected=m['dependencySources'][name];_need(selected==system.binding(stage/name),'fixture_dependency_source_changed');_bound(selected,128*1024*1024);actual=system.binding(package/name);_need(actual['sha256']==selected['sha256']and actual['size']==selected['size'],'fixture_packaged_dependency_mismatch')
 _need(system.binding(package/'node_modules/.prisma/client/schema.prisma')['sha256']==inputs['schemaSource']['sha256'],'fixture_payload_schema_changed');observed=manifest.verify_package(package);tree=manifest.strict_json((package/manifest.MANIFEST).read_bytes());_need(observed['packageDigest']==r['packageDigest']and tree['provenance']['sourceRevision']==r['sourceRevision']and tree['provenance']['materializationReceiptSha256']==r['mainMaterialization']['sha256'],'fixture_package_manifest_join_required');return r
