"""Pure config/source-inventory assertions; no staging/build/native operations."""
import sys,pathlib,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from governance_local_issuer import system_preparation as p
class IngressInputs(unittest.TestCase):
 def test_explicit_desktop_requirement_is_bound_but_absence_stays_closed(self):
  c={'format':'axiom.system-preparation-config/1','generation':p.GENERATION,'principal':{'account':'_axiomissuer_synthetic','uid':501,'gid':20},'lifetimeNs':180000000000,'nativeProfile':'hardened-runtime-no-exceptions/1','systemProfile':'trusted-owner-root-journal/1','team':'FG5N98FE6W','node':{'path':'/synthetic/not-read/node','sha256':'a'*64,'headers':'/synthetic/not-read/headers'},'requirements':{}}
  p._config(c,'independent-leaves');self.assertNotIn(b'AXIOM_ISSUER_DESKTOP_REQUIREMENT',p._header(c,'independent-leaves'))
  c['desktopRequirement']='cdhash H"'+'b'*40+'"';p._config(c,'independent-leaves');self.assertIn(b'AXIOM_ISSUER_DESKTOP_REQUIREMENT',p._header(c,'independent-leaves'))
  c['fixturePrincipal']={'uid':502,'gid':20};c['fixtureTools']={'nodeSha256':'c'*64,'producerSha256':'d'*64};p._config(c,'independent-leaves');header=p._header(c,'independent-leaves');self.assertIn(b'AX_FIXTURE_FIXED_UID 502',header);self.assertIn(b'AX_FIXTURE_NODE_SHA256',header);self.assertIn(b'AX_FIXTURE_PRODUCER_SHA256',header)
  c['fixturePrincipal']['uid']=501;self.assertRaises(p.SystemPreparationUnavailable,p._config,c,'independent-leaves');c['fixturePrincipal']['uid']=502
  c['fixtureTools']['nodeSha256']='C'*64;self.assertRaises(p.SystemPreparationUnavailable,p._config,c,'independent-leaves');c['fixtureTools']['nodeSha256']='c'*64
  del c['fixtureTools'];self.assertRaises(p.SystemPreparationUnavailable,p._config,c,'independent-leaves');del c['fixturePrincipal']
  c['desktopRequirement']='caller-ready';self.assertRaises(p.SystemPreparationUnavailable,p._config,c,'independent-leaves')
 def test_fixed_owner_job_advertises_exact_owned_child_namespaces(self):
  daemon=p._launch_daemon();self.assertEqual(daemon['MachServices'],{p.OWNER_SERVICE:True,p.BROKER_SERVICE:True,p.REQUEST_SERVICE:True});self.assertEqual(daemon['ProgramArguments'],[p.OWNER_PATH]);self.assertFalse(daemon['RunAtLoad']);self.assertFalse(daemon['KeepAlive'])
 def test_only_current_system_roles_bind_new_sources(self):
  for role in ('broker','guard'):self.assertIn('request_protocol.c',p.ROLE_SOURCES[role])
  for role in ('owner','broker','maintenance'):self.assertIn('synthetic_fixture_readiness.c',p.ROLE_SOURCES[role])
  self.assertIn('synthetic_fixture_supplier_context.c',p.ROLE_SOURCES['broker']);self.assertNotIn('synthetic_fixture_supplier_context.c',p.ROLE_SOURCES['owner'])
  self.assertNotIn('native/request_protocol.c',p.PACKAGE_SOURCE_PATHS)
if __name__=='__main__':unittest.main()
