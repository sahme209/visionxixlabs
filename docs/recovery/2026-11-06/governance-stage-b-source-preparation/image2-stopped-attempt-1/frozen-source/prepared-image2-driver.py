"""Prepared fixed genuine-main-reuse/image/unsigned-v3-copy unit; no authority to run yet."""
import hashlib,json,os,resource,shutil,subprocess,sys,time,math
from pathlib import Path
sys.dont_write_bytecode=True
INPUTS=Path(__file__).with_name('image-operation-inputs.json')
INPUTS_SHA256='bb632c9479a9590306a8ef0a729d865570324215e46fffa23d32d4efa2adeb66'
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as out:json.dump(value,out,sort_keys=True);out.write('\n')
MAIN_PREPARATION={'mode': 384, 'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-fixture-container-source-1/stage/v2-main/container-preparation-v2.json', 'sha256': 'aaa91e0069688f30bcdfcb596572e8f17bb6fee1855b9ee0a8d524caa5c99447', 'size': 9637}
MAIN_COMPILE={'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-image-1/container-compile.json', 'sha256': '70d91c064d45a091d819a07a5c4aa542ed745f6ee8c3894eda68f7d5b83addbe', 'size': 1378, 'mode': 384}
FIXTURE_PREPARATION={'mode': 384, 'path': '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-fixture-container-source-1/stage/fixture-container-preparation.json', 'sha256': '5e0f7029ac7ac02693da1b0ca41423ade989b0c8c9bcbd431dfb30b0ef200042', 'size': 1158}

def _reuse_main(config,run):
 from governance_local_issuer import container_assembly as a,fixture_container_preparation as fp
 a._need(config['containerPreparation']==MAIN_PREPARATION and config['containerCompile']==MAIN_COMPILE and config['fixturePreparation']==FIXTURE_PREPARATION,'original_main_proof_required')
 wrapper=fp.verify_fixture_container(Path(FIXTURE_PREPARATION['path']).parent);a._need(wrapper['basePreparation']==MAIN_PREPARATION,'original_own_v3_v2_join_required')
 artifact,preparation=a._main(MAIN_PREPARATION,MAIN_COMPILE)
 write_new(run/'main-reuse-observation.json',{'originalPreparation':MAIN_PREPARATION,'originalCompileReceipt':MAIN_COMPILE,'unsignedArtifact':artifact,'recompiled':False,'historyRestamped':False,'targetExecuted':False})
 return MAIN_COMPILE

def main():
 if len(sys.argv)!=1 or hashlib.sha256(INPUTS.read_bytes()).hexdigest()!=INPUTS_SHA256:raise RuntimeError('fixed_image_inputs_required')
 config=json.loads(INPUTS.read_bytes());procedure=Path(config['procedureRepo']);run=Path(config['runRoot'])
 for bound in config['helpers'].values():
  if hashlib.sha256(Path(bound['path']).read_bytes()).hexdigest()!=bound['sha256']:raise RuntimeError('fixed_procedure_helper_changed')
 sys.path.insert(0,str(procedure/'scripts'))
 from governance_local_issuer import container_assembly as a,container_preparation as cp,fixture_container_preparation as fp,fixture_container_assembly as fa,fixture_delivery_inputs as fixture,manifest,image_inspection as inspection
 cp._private(run.parent)
 if run!=inspection.IMAGE2_ROOT or run.exists()or run.is_symlink():raise RuntimeError('fresh_fixed_image_run_required')
 if config['imagePath']!=str(run/'image/issuer-package.dmg')or config['assemblyDestination']!=str(run/'assembled')or config['packageRoot']!=str(run.parent/'2026-11-06-stage-b-materialization-2/package')or config['packageSourceRevision']!='b8b0314c39324ba3a918fd0f6672faf0297c2041':raise RuntimeError('fixed_image2_coordinates_required')
 for key in ('packageManifest','materializationReceipt','fixtureDelivery','terminalSummary','sourcePreparation','containerPreparation','fixturePreparation','containerCompile'):a._bound(config[key])
 for bound in config['helpers'].values():a._bound(bound)
 wrapper=fp.verify_fixture_container(Path(config['fixturePreparation']['path']).parent);cp.verify_container(Path(config['containerPreparation']['path']).parent)
 if wrapper['basePreparation']!=config['containerPreparation']:raise RuntimeError('own_v3_v2_preparation_required')
 package=Path(config['packageRoot']);observed=manifest.verify_package(package)
 if observed['packageDigest']!=config['packageDigest']:raise RuntimeError('accepted_package_changed')
 delivery=fixture.verify_fixture_materialization(config['fixtureDelivery']['path'])
 if delivery['packageDigest']!=config['packageDigest']or delivery['mainMaterialization']!=config['materializationReceipt']:raise RuntimeError('actual_fixture_delivery_join_required')
 free=shutil.disk_usage(run.parent).free
 if free<config['minimumFreeBytes']:raise RuntimeError('insufficient_free_space_no_attempt')
 os.umask(0o077);run.mkdir(mode=0o700);cp._private(run);write_new(run/'claimed.json',{'inputsSha256':INPUTS_SHA256,'attempts':1,'freeBytes':free,'minimumFreeBytes':config['minimumFreeBytes'],'executionAuthorized':False,'retryAuthorized':False})
 phase='main-reuse';started=time.monotonic()
 try:
  print('PHASE',phase,flush=True);compiled=_reuse_main(config,run)
  phase='image-create';print('PHASE',phase,flush=True);image=Path(config['imagePath']);image.parent.mkdir(mode=0o700);soft,hard=resource.getrlimit(resource.RLIMIT_FSIZE)
  if hard!=resource.RLIM_INFINITY and hard<config['imageMaximumBytes']:raise RuntimeError('existing_image_file_limit_too_small')
  resource.setrlimit(resource.RLIMIT_FSIZE,(config['imageMaximumBytes'],hard));os.umask(0o077);argv=a._image_argv(package,image)
  write_new(run/'image-attempt.json',{'argv':argv,'started':True,'retryAuthorized':False,'sourceRevision':config['packageSourceRevision'],'packageDigest':config['packageDigest'],'manifestSha256':config['packageManifest']['sha256'],'maximumBytes':config['imageMaximumBytes']})
  result=subprocess.run(argv,stdin=subprocess.DEVNULL,timeout=config['imageSeconds'],check=False)
  if result.returncode!=0:raise RuntimeError('image_command_failed_no_retry')
  if not image.is_file()or image.is_symlink()or image.stat().st_size>config['imageMaximumBytes']:raise RuntimeError('image_output_bound_failed')
  image.chmod(0o600);image_binding=a.binding(image)
  if manifest.verify_package(package)['packageDigest']!=config['packageDigest']:raise RuntimeError('package_changed_after_image')
  facts={'sourcePackage':str(package),'sourceRevision':config['packageSourceRevision'],'packageDigest':config['packageDigest'],'manifestSha256':config['packageManifest']['sha256'],'image':image_binding};operation={'format':'axiom.recorded-package-image-operation/1','argv':argv,'state':'completed','exit':0,**facts};operation_path=run/'image-operation.json';write_new(operation_path,operation)
  phase='image-inspection';print('PHASE',phase,flush=True);os.umask(0o077);mounted=inspection.inspect_image(image_binding,{k:v for k,v in facts.items()if k!='image'});completion={'format':'axiom.package-image-completion/1',**facts,'operationRecord':a.binding(operation_path),'mountedObservation':a.binding(mounted),'imageCreated':True,'executionAuthorized':False};completion_path=run/'image-completion.json';write_new(completion_path,completion)
  base={'format':fa.BASE_INPUT_FORMAT,'profile':fp.PROFILE,'generation':cp.old.GENERATION,'sourceRevision':config['packageSourceRevision'],'packageRoot':str(package),'packageDigest':config['packageDigest'],'packageManifest':config['packageManifest'],'materializationReceipt':config['materializationReceipt'],'containerPreparation':config['containerPreparation'],'containerCompile':compiled,'imageCompletion':a.binding(completion_path),'modeMap':fa.MODE_MAP};base_path=run/'fixture-base-inputs.json';write_new(base_path,base)
  packet={'format':fa.INPUT_FORMAT,'profile':fp.PROFILE,'generation':cp.old.GENERATION,'basePacket':a.binding(base_path),'fixtureInputs':config['fixtureDelivery'],'containerPreparation':config['fixturePreparation']};packet_path=run/'fixture-container-inputs.json';write_new(packet_path,packet)
  phase='unsigned-fixture-assembly';print('PHASE',phase,flush=True);assembled=fa.assemble_fixture_container_inputs(packet_path,Path(config['assemblyDestination']))
  if fa.verify_fixture_assembly(Path(config['assemblyDestination']))!=assembled:raise RuntimeError('fixture_assembly_readback_mismatch')
  write_new(run/'result.json',{'state':'completed','phase':'ordinary_fixture_preseal_assembly_observed','elapsedSeconds':time.monotonic()-started,'containerCompile':compiled,'assemblyReceipt':a.binding(Path(config['assemblyDestination'])/fa.RECEIPT),'copiedFileCount':len(assembled['files']),'inspectionReceipt':a.binding(mounted),'imageContentsMountedOrVerified':True,'companySigningPerformed':False,'executingIssuerIdentity':'unavailable','executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False});print('COMPLETE ordinary_fixture_preseal_assembly_unqualified',flush=True)
 except BaseException as error:
  write_new(run/'result.json',{'state':'stopped_unknown_or_failed','phase':phase,'errorType':type(error).__name__,'error':str(error),'possibleMountedImage':getattr(error,'possible_mounted_image',True)if phase=='image-inspection'else False,'elapsedSeconds':time.monotonic()-started,'executionAuthorized':False,'installationReady':False,'activationAllowed':False,'retryAuthorized':False});raise
if __name__=='__main__':main()
