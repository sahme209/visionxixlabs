from pathlib import Path
import sys,unittest
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import system_preparation as s
class FixtureControllerConfigTests(unittest.TestCase):
 def config(self):return {'format':'axiom.system-preparation-config/1','generation':s.GENERATION,'principal':{'account':'_axiomissuer_synthetic','uid':503,'gid':503},'lifetimeNs':60000000000,'nativeProfile':'hardened-runtime-no-exceptions/1','systemProfile':'trusted-owner-root-journal/1','team':'FG5N98FE6W','node':{'path':'/private/tmp/synthetic-node-input','sha256':'a'*64,'headers':'/private/tmp/synthetic-headers'},'requirements':{'node':'cdhash H"'+'1'*40+'"','controller':'cdhash H"'+'2'*40+'"','brokerForGuard':'cdhash H"'+'3'*40+'"'},'controllerPrincipal':{'uid':505,'gid':505},'desktopRequirement':'cdhash H"'+'2'*40+'"'}
 def test_exact_controller_binding_and_source_compile_closure(self):
  c=self.config();self.assertEqual(s._config(c,'complete'),c);header=s._header(c,'complete');self.assertIn(b'AX_FIXTURE_CONTROLLER_UID 505',header);self.assertIn(b'AX_FIXTURE_CONTROLLER_GID 505',header)
  roles={r['role']:r for r in s._recipes(Path('/private/tmp/owned-synthetic-stage'),'complete')};self.assertTrue(any(x.endswith('/fixture_qualification_controller.m')for x in roles['controller']['argv']));self.assertTrue(any(x.endswith('/fixture_controller_handoff.c')for x in roles['maintenance']['argv']));self.assertEqual(roles['controller']['requiredOutputMode'],0o600)
 def test_missing_or_mismatched_requirement_refuses(self):
  for value in (None,'cdhash H"'+'7'*40+'"'):
   c=self.config();c['desktopRequirement']=value;self.assertRaises(s.SystemPreparationUnavailable,s._config,c,'complete')
 def test_root_or_unknown_controller_principal_refuses(self):
  for p in ({'uid':0,'gid':505},{'uid':505,'gid':505,'path':'/arbitrary'}):
   c=self.config();c['controllerPrincipal']=p;self.assertRaises(s.SystemPreparationUnavailable,s._config,c,'complete')
 def test_no_implicit_controller_or_operational_enablement(self):
  c=self.config();del c['controllerPrincipal'];del c['desktopRequirement'];s._config(c,'complete');self.assertNotIn(b'AX_FIXTURE_CONTROLLER_UID',s._header(c,'complete'));self.assertNotIn(b'AX_OWNER_OPERATIONAL 1',s._header(c,'complete'))
