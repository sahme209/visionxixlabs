"""Source routing evidence only; actual OS qualification is separate."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class SystemProfile(unittest.TestCase):
 def test_explicit_system_consumption_never_uses_legacy_claim(self):
  s=(ROOT/'origin_broker.c').read_text()
  body=s[s.index('static int startup_consumption('):s.index('static void drain(')]
  self.assertIn('AX_OWNER_PROFILE==AX_OWNER_PROFILE_SYSTEM',body)
  self.assertIn('return axiom_owner_binding_current();',body)
  self.assertIn('AX_OWNER_PROFILE==AX_OWNER_PROFILE_LEGACY',body)
  self.assertIn('return claim_startup();',body)
  self.assertTrue(body.rstrip().endswith('return 0;\n}'))
  prepare=s[s.index('static void prepare_start('):s.index('static int delivery_current(')]
  self.assertIn('startup_consumption()',prepare)
  self.assertNotIn('claim_startup()',prepare)
 def test_protected_owner_is_bound_before_connection(self):
  s=(ROOT/'origin_owner_binding.c').read_text()
  startup=s[s.index('int axiom_owner_binding_startup('):s.index('int axiom_owner_binding_current(')]
  self.assertLess(startup.index('ax_system_peer_prepare(&expected_owner,AX_SYSTEM_PEER_OWNER)'),startup.index('xpc_connection_create_mach_service('))
  self.assertNotIn('AX_OWNER_REQUIREMENT',startup)
  body=s[s.index('static int message_matches('):s.index('void axiom_owner_binding_revoke(')]
  auth=body.index('SecCodeCheckValidity(')
  self.assertIn('ax_system_peer_current(',body[:auth]);self.assertIn('ax_system_peer_current(',body[auth:])
if __name__=='__main__': unittest.main()
