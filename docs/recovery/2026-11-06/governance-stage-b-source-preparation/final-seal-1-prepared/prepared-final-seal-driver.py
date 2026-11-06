"""Prepared exact current-v3 final seal; new key-use approval required."""
import hashlib,json,os,sys
from pathlib import Path
sys.dont_write_bytecode=True
INPUTS=Path(__file__).with_name('operation-inputs.json')
INPUTS_SHA256='16cbe8844f61b33045838e9472b1c35db5b3b947405770c516a56a218c46d606'
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as out:json.dump(value,out,sort_keys=True);out.write('\n')
def main():
 if len(sys.argv)!=1 or hashlib.sha256(INPUTS.read_bytes()).hexdigest()!=INPUTS_SHA256:raise RuntimeError('fixed_final_seal_inputs_required')
 config=json.loads(INPUTS.read_bytes())
 for bound in config['helpers'].values():
  if hashlib.sha256(Path(bound['path']).read_bytes()).hexdigest()!=bound['sha256']:raise RuntimeError('frozen_final_seal_helper_changed')
 sys.path.insert(0,str(Path(config['procedureRepo'])/'scripts'))
 from governance_local_issuer import fixture_seal_sequence as sequence,fixture_final_seal as validator,container_preparation as cp
 if str(sequence.APP)!=config['targetApp']or str(sequence.OUTPUT)!=config['output']or sequence.commands()!=config['commands']or sequence.TIMEOUTS!=config['timeouts']:raise RuntimeError('fixed_final_seal_coordinates_changed')
 cp._private(sequence.OUTPUT.parent)
 if sequence.OUTPUT.exists()or sequence.OUTPUT.is_symlink():raise RuntimeError('fresh_final_seal_run_required_no_retry')
 for bound in config['helpers'].values():validator.old._bound(bound)
 if validator.old._bound(config['presealReceipt'])!=config['presealReceipt']:raise RuntimeError('fixed_unsigned_receipt_changed')
 os.umask(0o077);sequence.OUTPUT.mkdir(mode=0o700);cp._private(sequence.OUTPUT)
 write_new(sequence.OUTPUT/'claimed.json',{'inputsSha256':INPUTS_SHA256,'attempts':1,'executionAuthorized':False,'installationReady':False,'retryAuthorized':False})
 phase='capture-current-baseline'
 try:
  print('PHASE',phase,flush=True);baseline=validator.capture_fixture_seal_baseline(sequence.DESTINATION,sequence.OUTPUT)
  baseline_data=validator.old._json_bound(baseline)
  if baseline_data['emptyInput']['sha256']!=config['expectedEmptyInput']['sha256']or baseline_data['presealReceipt']!=config['presealReceipt']:raise RuntimeError('captured_baseline_input_mismatch')
  phase='exact-sign-static-verify-display';print('PHASE',phase,flush=True);records=sequence.execute_fixture_sequence(baseline)
  phase='validate-postseal-mutations';print('PHASE',phase,flush=True);result=validator.validate_fixture_postseal(baseline,records,sequence.OUTPUT)
  write_new(sequence.OUTPUT/'result.json',{'state':'completed','phase':phase,'baseline':baseline,'records':records,'postsealReceipt':validator.old.binding(sequence.OUTPUT/'fixture-postseal.json'),'allowedMutationScopeVerified':result['allowedMutationScopeVerified'],'strictStaticVerificationObserved':result['strictStaticVerificationObserved'],'cryptographicVerificationPerformedHere':False,'runtimeIdentityQualified':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False});print('COMPLETE static_fixture_seal_observed_unqualified',flush=True)
 except BaseException as error:
  write_new(sequence.OUTPUT/'result.json',{'state':'stopped_unknown_or_failed','phase':phase,'errorType':type(error).__name__,'error':str(error),'runtimeIdentityQualified':False,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False});raise
if __name__=='__main__':main()
