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
 def test_child_output_redacts_forged_diagnostics_and_keeps_launch_priority(self):
  error=RuntimeError('PRIVATE TOKEN')
  error.offlineDiagnostic={'phase':'source','reason':'PRIVATE TOKEN'}
  self.assertEqual(p._child_failure_message(error),'stage_a_artifact_unavailable\n')
  error.offlineDiagnostic={'phase':'source','reason':'offline_operation_unavailable'}
  self.assertEqual(json.loads(p._child_failure_message(error)),{'error':'stage_a_artifact_unavailable','offlineDiagnostic':{'phase':'source','reason':'offline_operation_unavailable'}})
  error.launchDiagnostic={'phase':'git_spawn','class':'OSError','errno':'EPERM'}
  self.assertEqual(json.loads(p._child_failure_message(error)),{'error':'stage_a_artifact_unavailable','launchDiagnostic':{'phase':'git_spawn','class':'OSError','errno':'EPERM'}})
  error.launchDiagnostic={'phase':'git_spawn','class':'OSError','errno':'SECRET'}
  error.offlineDiagnostic={'phase':'source','reason':'offline_operation_unavailable','extra':'SECRET'}
  self.assertEqual(p._child_failure_message(error),'stage_a_artifact_unavailable\n')
 def test_late_offline_failures_keep_phase_without_exception_text(self):
  packet={'work':'/synthetic-work','repo':'/synthetic-repo','sourceRevision':'a'*40,'cacheCopy':'/synthetic-cache','cache':'/synthetic-original-cache','node':{'path':'/synthetic-node'},'npmCli':{'path':'/synthetic-npm'},'sourceBindings':{'package.json':{'sha256':'p'},'package-lock.json':{'sha256':'l'}}}
  for failing,phase in [('context','context'),('archived_sources','archived_sources'),('install','install'),('receipt','receipt')]:
   with self.subTest(phase=phase),ExitStack() as stack:
    stack.enter_context(patch.object(p,'verify_stage_a_packet',return_value=packet))
    stack.enter_context(patch.dict(os.environ,{'AXIOM_PRIVATE_GIT_SCRATCH':'/synthetic-work/tmp'}))
    tools=stack.enter_context(patch.object(p.stage_a_tools,'_create_stage_a_tools')).return_value
    tools.builder.source_inputs.return_value=({}, {}, {'packageSha256':'p','lockSha256':'l'})
    tools.builder.git_bytes.return_value=b'synthetic'
    tools.builder.install_offline.return_value={'status':'offline_dependencies_installed','exit':0,'network':'kernel_denied','lifecycleScriptsExecuted':False}
    stack.enter_context(patch.object(p.builder,'extract_archive',return_value={'synthetic':True}))
    archived=stack.enter_context(patch.object(p,'_stage_sources',return_value=None))
    stack.enter_context(patch.object(p.builder,'lock_plan',return_value={}))
    saved=stack.enter_context(patch.object(p,'_write'))
    error=ValueError('PRIVATE TOKEN')
    if failing=='context':p.stage_a_tools._create_stage_a_tools.side_effect=error
    elif failing=='archived_sources':archived.side_effect=error
    elif failing=='install':tools.builder.install_offline.side_effect=error
    else:saved.side_effect=error;packet['cacheSelection']={}
    with self.assertRaises(ValueError) as raised:p.run_offline_child('/synthetic-packet')
    self.assertEqual(raised.exception.offlineDiagnostic,{'phase':phase,'reason':'offline_operation_unavailable'})
if __name__=='__main__':unittest.main()
