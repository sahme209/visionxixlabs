"""Explicit fixture v3 wrapper; original v2 static-main prerequisite stays exact."""
from pathlib import Path
import json,os,stat,copy
from . import container_preparation as cp,container_assembly as old,system_preparation as prep,manifest
PROFILE='axiom.synthetic-fixture-container-seal/3'
RECEIPT='fixture-container-preparation.json'
RESOURCES={'producer':'Contents/Resources/qualification/fixture-producer.cjs','schema':'Contents/Resources/qualification/fixture-schema.sql','binding':'Contents/Resources/qualification/fixture-schema.binding.json','seed':'Contents/Resources/qualification/fixture-seed.sql'}
EXTERNAL_NODE=prep.APP.rsplit('/',1)[0]+'/fixture-tools/node'
def prepare_fixture_container(repo,stage):
 stage=prep._path(Path(stage));cp._private(stage.parent);old._need(not stage.exists(),'fresh_fixture_preparation_required');stage.mkdir(mode=0o700)
 cp.prepare_container(repo,stage/'v2-main')
 record={'format':'axiom.container-preparation/3','profile':PROFILE,'generation':prep.GENERATION,'staging':str(stage),'basePreparation':old.binding(stage/'v2-main'/cp.RECEIPT),'resources':copy.deepcopy(RESOURCES),'externalNode':EXTERNAL_NODE,'historicalV2':'unchanged_static_main_prerequisite','executionAuthorized':False,'installationReady':False,'activationAllowed':False}
 prep._write(stage/RECEIPT,manifest.canonical(record)+b'\n');return record
def verify_fixture_container(stage):
 stage=cp._private(Path(stage));r=old._json_bound(old.binding(stage/RECEIPT));keys={'format','profile','generation','staging','basePreparation','resources','externalNode','historicalV2','executionAuthorized','installationReady','activationAllowed'}
 old._need(set(r)==keys and r['format']=='axiom.container-preparation/3'and r['profile']==PROFILE and r['generation']==prep.GENERATION and r['staging']==str(stage)and r['resources']==RESOURCES and r['externalNode']==EXTERNAL_NODE and r['historicalV2']=='unchanged_static_main_prerequisite','fixed_fixture_preparation_required')
 old._need(all(r[k]is False for k in ('executionAuthorized','installationReady','activationAllowed')),'closed_fixture_preparation_required')
 old._need(r['basePreparation']['path']==str(stage/'v2-main'/cp.RECEIPT),'fixed_v2_prerequisite_coordinate_required');base=old._json_bound(r['basePreparation'])
 old._need(base['format']=='axiom.container-preparation/2'and base['profile']==cp.PROFILE and base['configuration']==cp.CONFIGURATION,'authentic_v2_main_prerequisite_required')
 expected={'v2-main/'+name:want for name,want in base['files'].items()};expected['v2-main/'+cp.RECEIPT]=r['basePreparation'];compiled=Path(base['compileRecipe']['output'])
 allowed_output=compiled.relative_to(stage).as_posix();seen=set()
 for path in stage.rglob('*'):
  relative=path.relative_to(stage).as_posix();s=path.lstat();old._need(not path.is_symlink()and s.st_uid==os.getuid(),'fixture_preparation_alias_or_owner')
  if path.is_dir():old._need(stat.S_IMODE(s.st_mode)==0o700,'fixture_preparation_directory_mode');continue
  old._need(stat.S_ISREG(s.st_mode)and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600,'fixture_preparation_file_mode');seen.add(relative)
  if relative in expected:
   current=old.binding(path);old._need(all(current[k]==expected[relative][k]for k in ('sha256','size')),'fixture_prerequisite_changed')
 old._need(set(expected)|{RECEIPT}<=seen and seen<=set(expected)|{RECEIPT,allowed_output},'fixture_preparation_inventory_changed');return r
