"""V3 copy/strict-inventory tests on synthetic files; provenance boundary mocked."""
from pathlib import Path
import json,sys,unittest,hashlib,plistlib
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.tests.test_container_assembly import ContainerAssemblyTests
from governance_local_issuer import fixture_container_preparation as fp,fixture_container_assembly as fa,container_assembly as old,container_preparation as cp
class FixtureContainerTests(unittest.TestCase):
 def setUp(self):
  self.f=ContainerAssemblyTests();self.f.setUp();self.addCleanup(self.f.doCleanups);f=self.f
  self.base=old._inputs(f.packet);self.node=f.put(f.root/'node-inputs'/'node',b'FIXTURE NODE');self.base['materialization']['systemBuildInputs']['runtimeNode']=old.binding(self.node)
  self.stage=f.root/'fixture-prep';self.prepared=fp.prepare_fixture_container(f.root/'repo',self.stage)
  # Use original authentic main prerequisite for this copy-only mocked boundary.
  self.prepared['basePreparation']=old.binding(f.prep);f.js(self.stage/fp.RECEIPT,self.prepared)
  self.delivery={'format':'axiom.fixture-delivery/1','profile':'compiled-private-fixture/1','generation':cp.old.GENERATION,'sourceRevision':f.revision,'packageDigest':self.base['packet']['packageDigest'],'dependencyRoot':cp.old.PACKAGE_ROOT,'mainMaterialization':old.binding(f.mat),'sourceInputs':old.binding(f.prep),'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'resources':{}}
  for role,coordinate in fa.RESOURCES.items():
   source=f.put(f.root/'resources'/role,('FIXTURE '+role).encode());bound=old.binding(source);self.delivery['resources'][role]={'source':bound,'materializedPath':str(source),'sha256':bound['sha256'],'size':bound['size'],'intendedInstalledCoordinate':cp.old.APP+'/'+coordinate}
  bound=old.binding(self.node);self.delivery['toolNode']={'source':bound,'materializedPath':str(self.node),'sha256':bound['sha256'],'size':bound['size'],'intendedInstalledCoordinate':cp.old.APP.rsplit('/',1)[0]+'/fixture-tools/node'}
  self.receipt=f.js(f.root/'fixture-delivery.json',self.delivery)
  self.packet=f.js(f.root/'v3-inputs.json',{'format':fa.INPUT_FORMAT,'profile':fp.PROFILE,'generation':cp.old.GENERATION,'basePacket':old.binding(f.packet),'fixtureInputs':old.binding(self.receipt),'containerPreparation':old.binding(self.stage/fp.RECEIPT)})
  self.patches=[patch.object(fa,'_base_inputs',return_value=self.base),patch.object(fa,'_fixture_delivery',return_value=self.delivery),patch.object(fp,'verify_fixture_container',return_value=self.prepared)]
  for p in self.patches:p.start();self.addCleanup(p.stop)
  self.destination=f.root/'fixture-assembled'
 def test_exact_thirteen_copy_inventory_and_outside_node(self):
  before=self.node.read_bytes();r=fa.assemble_fixture_container_inputs(self.packet,self.destination);self.assertEqual(fa.verify_fixture_assembly(self.destination),r);self.assertEqual(len(r['files']),13);self.assertEqual(len([x for x in r['files']if x.startswith('Axiom Synthetic Custodian.app/')]),12);self.assertEqual(self.node.read_bytes(),before);self.assertEqual((self.destination/'fixture-tools/node').read_bytes(),before);self.assertFalse(r['activationAllowed'])
 def test_extra_file_mode_or_resource_mutation_refuses(self):
  fa.assemble_fixture_container_inputs(self.packet,self.destination);extra=self.destination/'extra';extra.write_bytes(b'x')
  with self.assertRaises(ValueError):fa.verify_fixture_assembly(self.destination)
  extra.unlink();node=self.destination/'fixture-tools/node';node.chmod(0o600)
  with self.assertRaises(ValueError):fa.verify_fixture_assembly(self.destination)
 def test_wrong_node_or_resource_coordinate_refuses_before_destination(self):
  self.delivery['toolNode']['sha256']='f'*64
  with self.assertRaises(ValueError):fa.assemble_fixture_container_inputs(self.packet,self.destination)
  self.assertFalse(self.destination.exists())
 def test_legacy_validator_does_not_accept_v3_input(self):
  with self.assertRaises(ValueError):old._inputs(self.packet)
if __name__=='__main__':unittest.main()
