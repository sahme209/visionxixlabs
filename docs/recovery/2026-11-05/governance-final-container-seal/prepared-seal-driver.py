"""Fixed conditional final-seal operation. Prepared only; ROOT executes once."""
import hashlib,json,os,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
REPO=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
INPUTS=REPO/'docs/recovery/2026-11-05/governance-final-container-seal/operation-inputs.json'
INPUTS_SHA256='f15b476c66b67267c42dd376dab97cbac71c0a1932669ac6db55e86604228935'
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as out:out.write(json.dumps(value,sort_keys=True)+'\n')
def main():
 if len(sys.argv)!=1 or hashlib.sha256(INPUTS.read_bytes()).hexdigest()!=INPUTS_SHA256:raise RuntimeError('fixed_seal_inputs_required')
 inputs=json.loads(INPUTS.read_text())
 for name,want in inputs['helperBindings'].items():
  if hashlib.sha256(Path(name).read_bytes()).hexdigest()!=want['sha256']:raise RuntimeError('frozen_seal_helper_changed')
 sys.path.insert(0,str(REPO/'scripts'))
 from governance_local_issuer import final_seal as seal
 if str(seal.APP)!=inputs['app']or seal.KEY!=inputs['signerSha1']or seal.PRESEAL_SHA!=inputs['presealReceiptSha256']:raise RuntimeError('fixed_seal_profile_mismatch')
 for key in ('presealReceipt','originalMain','emptyEntitlements'):seal.assembly._bound(inputs[key])
 root=Path(inputs['runRoot']);seal.cp._private(Path(inputs['labParent']))
 if root.exists()or root.is_symlink():raise RuntimeError('fresh_seal_run_required')
 os.umask(0o077);root.mkdir(mode=0o700);seal.cp._private(root)
 write_new(root/'claimed.json',{'inputsSha256':INPUTS_SHA256,'conditionalApproval':inputs['conditionalApproval'],'attempts':1,'retryAuthorized':False,'executionAuthorized':False})
 start=time.monotonic();phase='preseal-baseline'
 try:
  baseline=seal.capture_baseline(root);phase='fixed-codesign-sequence'
  records=seal.execute_sequence(baseline,root);phase='actual-postseal-validation'
  result=seal.validate_postseal(baseline,records,root)
  write_new(root/'result.json',{'state':'ordinary_seal_and_scope_observed','elapsedSeconds':time.monotonic()-start,'baseline':baseline,'postsealReceipt':seal.assembly.binding(root/'postseal.json'),'strictStaticVerificationObserved':result['strictStaticVerificationObserved'],'allowedMutationScopeVerified':result['allowedMutationScopeVerified'],'executionAuthorized':False,'installationReady':False,'runtimeIdentityQualified':False,'activationAllowed':False,'retryAuthorized':False})
  print('COMPLETE ordinary_static_seal_observed_runtime_unavailable',flush=True)
 except BaseException as error:
  write_new(root/'result.json',{'state':'failed_or_unknown_no_retry','phase':phase,'errorType':type(error).__name__,'appMayBePartiallySigned':phase!='preseal-baseline','elapsedSeconds':time.monotonic()-start,'executionAuthorized':False,'installationReady':False,'runtimeIdentityQualified':False,'activationAllowed':False,'retryAuthorized':False})
  raise
if __name__=='__main__':main()
