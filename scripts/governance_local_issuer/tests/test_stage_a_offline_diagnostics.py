"""Synthetic offline boundaries only: no Git, npm, engines or sandbox launched."""
import json,os,sys,unittest
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer import stage_a_packet as p

class OfflineDiagnosticsTests(unittest.TestCase):
 def test_each_failure_has_finite_phase_without_exception_text(self):
  packet={'work':'/synthetic-work','repo':'/synthetic-repo','sourceRevision':'a'*40,'sourceBindings':{'package.json':{'sha256':'p'},'package-lock.json':{'sha256':'l'}}}
  cases=[('verify_stage_a_packet','packet'),('source_inputs','source'),('git_bytes','archive'),('extract_archive','extraction')]
  for operation,phase in cases:
   with self.subTest(phase=phase),ExitStack() as stack:
    stack.enter_context(patch.object(p,'verify_stage_a_packet',return_value=packet))
    stack.enter_context(patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':'/synthetic-work/tmp'}))
    tools=stack.enter_context(patch.object(p.stage_a_tools,'_create_stage_a_tools')).return_value
    tools.builder.source_inputs.return_value=({}, {}, {'packageSha256':'p','lockSha256':'l'})
    tools.builder.git_bytes.return_value=b'synthetic'
    failure=ValueError('PRIVATE PATH TOKEN DO NOT LOG')
    if operation=='verify_stage_a_packet':p.verify_stage_a_packet.side_effect=failure
    elif operation=='extract_archive':stack.enter_context(patch.object(p.builder,'extract_archive',side_effect=failure))
    else:getattr(tools.builder,operation).side_effect=failure
    with self.assertRaises(ValueError) as raised:p.run_offline_child('/synthetic-packet')
    diagnostic=getattr(raised.exception,'offlineDiagnostic',None)
    self.assertEqual(diagnostic,{'phase':phase,'reason':'offline_operation_unavailable'})
    self.assertNotIn('PRIVATE',json.dumps(diagnostic))
 def test_unknown_error_is_never_serialized(self):
  self.assertEqual(p._offline_diagnostic('source',RuntimeError('secret')),{'phase':'source','reason':'offline_operation_unavailable'})
  self.assertIsNone(p._offline_diagnostic('secret',ValueError('secret')))
 def test_only_allowlisted_refusal_is_disclosed(self):
  self.assertEqual(p._offline_diagnostic('context',p.StageAUnavailable('fixed_child_context_required')),{'phase':'context','reason':'fixed_child_context_required'})
  self.assertEqual(p._offline_diagnostic('context',p.StageAUnavailable('secret')),{'phase':'context','reason':'offline_operation_unavailable'})
if __name__=='__main__':unittest.main()
