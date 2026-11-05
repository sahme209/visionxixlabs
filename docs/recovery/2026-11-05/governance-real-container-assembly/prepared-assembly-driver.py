"""Prepared exact one-shot image/copy operation; NOT authorized to run yet."""
import hashlib,json,os,resource,shutil,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
REPO=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
INPUTS=REPO/'docs/recovery/2026-11-05/governance-real-container-assembly/operation-inputs.json'
INPUTS_SHA256='64171ac34aa43b8eefb5062cdc55eee7c5fd20c77ec6a28541d2ddb75d09f722'
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as out:out.write(json.dumps(value,sort_keys=True)+'\n')
def main():
 if len(sys.argv)!=1 or hashlib.sha256(INPUTS.read_bytes()).hexdigest()!=INPUTS_SHA256:raise RuntimeError('fixed_operation_inputs_required')
 config=json.loads(INPUTS.read_text());run=Path(config['runRoot']);lab=Path(config['labParent'])
 if run.exists()or run.is_symlink():raise RuntimeError('fresh_operation_root_required')
 for path,want in config['helpers'].items():
  if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=want['sha256']:raise RuntimeError('frozen_assembly_helper_changed')
 sys.path.insert(0,str(REPO/'scripts'))
 from governance_local_issuer import container_assembly as a,container_preparation as cp,manifest,image_inspection as inspection
 cp._private(lab)
 if inspection.RUN_ROOT!=run:raise RuntimeError('fixed_inspection_root_required')
 for key in ('packageManifest','materializationReceipt','containerPreparation','containerCompile','containerMain','executionObservation'):a._bound(config[key])
 a._main(config['containerPreparation'],config['containerCompile'])
 materialization=a._json_bound(config['materializationReceipt']);companions=materialization['systemCompanions']['files']
 a.materialize._verify_companion_inventory(Path(config['materializationReceipt']['path']).parent/'system-companions',companions)
 for role,coordinate in a.materialize.SYSTEM_COMPANIONS.items():
  if a._bound(companions[role]['source'])!=materialization['systemBuildInputs']['companionArtifacts'][role]or companions[role]['intendedInstalledCoordinate']!=a.LAYOUT['app']+'/'+coordinate:raise RuntimeError('native_companion_preflight_mismatch')
 package=Path(config['packageRoot']);observation=manifest.verify_package(package)
 if observation['packageDigest']!=config['packageDigest']:raise RuntimeError('fixed_completed_package_changed')
 free=shutil.disk_usage(lab).free
 if free<config['minimumFreeBytes']:raise RuntimeError('insufficient_free_space_no_attempt')
 os.umask(0o077)
 run.mkdir(mode=0o700);cp._private(run);write_new(run/'claimed.json',{'inputsSha256':INPUTS_SHA256,'attempts':1,'freeBytes':free,'minimumFreeBytes':config['minimumFreeBytes'],'executionAuthorized':False,'retryAuthorized':False})
 phase='image-create';started=time.monotonic();image=Path(config['imagePath']);image.parent.mkdir(mode=0o700)
 try:
  os.umask(0o177)
  soft,hard=resource.getrlimit(resource.RLIMIT_FSIZE)
  if hard!=resource.RLIM_INFINITY and hard<config['imageMaximumBytes']:raise RuntimeError('existing_file_limit_too_small')
  resource.setrlimit(resource.RLIMIT_FSIZE,(config['imageMaximumBytes'],hard))
  argv=a._image_argv(package,image)
  if argv!=config['imageArgv']:raise RuntimeError('fixed_image_command_mismatch')
  write_new(run/'image-attempt.json',{'argv':argv,'started':True,'retryAuthorized':False,'sourceRevision':config['packageSourceRevision'],'packageDigest':config['packageDigest'],'manifestSha256':config['packageManifest']['sha256'],'maximumBytes':config['imageMaximumBytes']})
  result=subprocess.run(argv,stdin=subprocess.DEVNULL,timeout=config['imageSeconds'],check=False)
  if result.returncode!=0:raise RuntimeError('image_command_failed_no_retry')
  if not image.is_file()or image.is_symlink()or image.stat().st_size>config['imageMaximumBytes']:raise RuntimeError('image_output_bound_failed')
  image.chmod(0o600);image_binding=a.binding(image)
  if manifest.verify_package(package)['packageDigest']!=config['packageDigest']:raise RuntimeError('package_changed_after_image')
  operation={'format':'axiom.recorded-package-image-operation/1','argv':argv,'state':'completed','exit':0,'sourcePackage':str(package),'sourceRevision':config['packageSourceRevision'],'packageDigest':config['packageDigest'],'manifestSha256':config['packageManifest']['sha256'],'image':image_binding}
  operation_path=run/'image-operation.json';write_new(operation_path,operation)
  phase='image-inspection';os.umask(0o077)
  mounted_observation=inspection.inspect_image(image_binding,{'sourcePackage':str(package),'sourceRevision':config['packageSourceRevision'],'packageDigest':config['packageDigest'],'manifestSha256':config['packageManifest']['sha256']})
  completion={'format':'axiom.package-image-completion/1','sourcePackage':str(package),'sourceRevision':config['packageSourceRevision'],'packageDigest':config['packageDigest'],'manifestSha256':config['packageManifest']['sha256'],'image':image_binding,'operationRecord':a.binding(operation_path),'mountedObservation':a.binding(mounted_observation),'imageCreated':True,'executionAuthorized':False}
  completion_path=run/'image-completion.json';write_new(completion_path,completion)
  packet={'format':a.INPUT_FORMAT,'profile':cp.PROFILE,'generation':cp.old.GENERATION,'sourceRevision':config['packageSourceRevision'],'packageRoot':str(package),'packageDigest':config['packageDigest'],'packageManifest':config['packageManifest'],'materializationReceipt':config['materializationReceipt'],'containerPreparation':config['containerPreparation'],'containerCompile':config['containerCompile'],'imageCompletion':a.binding(completion_path),'modeMap':a.MODE_MAP}
  packet_path=run/'assembly-inputs.json';write_new(packet_path,packet);phase='assembly-copy'
  os.umask(0o077)  # Preserve owner traversal for new 0700 assembly directories.
  assembly=a.assemble_container_inputs(packet_path,Path(config['assemblyDestination']))
  if a.verify_assembly(Path(config['assemblyDestination']))!=assembly:raise RuntimeError('independent_assembly_readback_mismatch')
  phase='ordinary-preseal-assembly-observed'
  write_new(run/'result.json',{'state':'completed','phase':phase,'elapsedSeconds':time.monotonic()-started,'assemblyReceipt':a.binding(Path(config['assemblyDestination'])/a.RECEIPT),'copiedFileCount':len(assembly['files']),'signatureVerified':False,'imageContentsMountedOrVerified':True,'inspectionReceipt':a.binding(mounted_observation),'executingIssuerIdentity':'unavailable','executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False})
  print('COMPLETE ordinary_preseal_assembly_unqualified',flush=True)
 except BaseException as error:
  write_new(run/'result.json',{'state':'stopped_unknown_or_failed','phase':phase,'errorType':type(error).__name__,'possibleMountedImage':getattr(error,'possible_mounted_image',True)if phase=='image-inspection'else False,'elapsedSeconds':time.monotonic()-started,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False})
  raise
if __name__=='__main__':main()
