"""Source-order regression only; no runtime/native acceptance claim."""
import pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class OwnerOrdering(unittest.TestCase):
 def test_owner_before_any_supplier_startup(self):
  source=(ROOT/'origin_broker.c').read_text()
  main=source[source.index('int main('):]
  self.assertIn('axiom_owner_binding_startup()',main)
  self.assertLess(main.index('axiom_owner_binding_startup()'),main.index('axiom_private_supplier_startup()'))
 def test_worker_current_and_delivery_require_owner(self):
  source=(ROOT/'origin_broker.c').read_text()
  for name in ['work_current','delivery_current']:
   start=source.index('static int '+name+'(')
   body=source[start:source.index('\n}',start)+2] if name=='delivery_current' else source[start:source.index('\n',start)]
   self.assertIn('axiom_owner_binding_current()',body)
 def test_supplier_read_revalidates_owner_before_and_after(self):
  source=(ROOT/'origin_broker.c').read_text()
  start=source.index('AxiomPrivateMaterial material;')
  body=source[start:source.index('axiom_private_material_wipe',start)]
  call=body.index('axiom_private_supplier_read(')
  self.assertIn('axiom_owner_binding_current()',body[:call])
  self.assertIn('axiom_owner_binding_current()',body[call:])
 def test_binding_rejects_validation_that_returns_after_deadline(self):
  source=(ROOT/'origin_owner_binding.c').read_text()
  body=source[source.index('static int validate('):source.index('int axiom_owner_binding_startup(')]
  auth=body.index('message_matches(r)')
  self.assertIn('now_ns()>=response_deadline',body[:auth])
  self.assertIn('now_ns()>=response_deadline',body[auth:])
 def test_supplier_internal_context_retains_closed_gate_then_current_owner(self):
  source=(ROOT/'origin_private_resource_supplier.m').read_text()
  self.assertIn('return axiom_private_supplier_operational()&&axiom_owner_binding_current();',source)
  startup=source[source.index('int axiom_private_supplier_startup('):source.index('static int compatible_datasource(')]
  self.assertLess(startup.index('axiom_owner_binding_current()'),startup.index('OSStatus result=SecKeychainSetUserInteractionAllowed'))
  lookup=source[source.index('static SecKeychainItemRef resolve_reference('):source.index('static int load_references(void){')]
  self.assertIn('installation_context()',lookup[:lookup.index('SecItemCopyMatching')])
  inspection=source[source.index('static int ax_synthetic_inspect_item('):source.index('static SecKeychainRef selected_keychain;')]
  self.assertIn('installation_context()',inspection[:inspection.index('SecKeychainItemCopyKeychain')])
 def test_unknown_echild_is_not_successful_broker_cleanup(self):
  source=(ROOT/'origin_broker.c').read_text()
  body=source[source.index('static void reap_owned('):source.index('static void revoke_slot(')]
  self.assertNotIn('result==child||(result<0&&errno==ECHILD)',body)
  self.assertIn('if(result==child)',body)
 def test_owner_lock_refusal_is_permanent(self):
  source=(ROOT/'origin_owner_binding.c').read_text()
  self.assertEqual(source.count('if(pthread_mutex_trylock(&lock)){axiom_owner_binding_revoke();return 0;}'),2)
if __name__=='__main__': unittest.main()
