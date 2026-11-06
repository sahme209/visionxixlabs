"""Prepared fixed compile/image/unsigned-v3-copy unit; no authority to run yet."""
import hashlib,json,os,resource,shutil,subprocess,sys,time,math
from pathlib import Path
sys.dont_write_bytecode=True
INPUTS=Path(__file__).with_name('operation-inputs.json')
INPUTS_SHA256='d2c853eb3e4ac61834e31e3af7cde93509b48b3543708b70300feb875efc1d9a'
def write_new(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w')as out:json.dump(value,out,sort_keys=True);out.write('\n')
def _compile_main(config,run):
 from governance_local_issuer import container_assembly as a,container_preparation as cp,fixture_container_preparation as fp,bounded_signing_tool as tool,native_initial_batch as saved
 prepared=a._json_bound(config['containerPreparation']);wrapper=a._json_bound(config['fixturePreparation']);a._need(fp.verify_fixture_container(wrapper['staging'])==wrapper,'fixture_source_preparation_changed');cp.verify_container(prepared['staging']);recipe=prepared['compileRecipe'];a._need(recipe==config['compileRecipe'],'fixed_main_recipe_changed');output=Path(recipe['output']);a._need(not output.exists()and not output.is_symlink(),'fresh_main_output_required')
 originals=[saved._full(p)for p in Path(wrapper['staging']).rglob('*')if p.is_file()]+[saved._full(Path(prepared[k]['path']))for k in ('source','sealedControlPrerequisite')]
 write_new(run/'main-compile-attempt.json',{'preparation':config['containerPreparation'],'argv':recipe['argv'],'targetExecuted':False,'retryAuthorized':False})
 previous_mask=os.umask(0o077)
 try:result=tool.run(recipe['argv'],prepared['staging'],dict(saved.ENV))
 finally:
  os.umask(previous_mask)
  if output.exists()or output.is_symlink():saved._quarantine(output)
 for name in ('stdout','stderr'):
  raw=result[name];a._need(type(raw)is bytes,'true_compile_streams_required');cp.old._write(run/('main-compile-'+name+'.log'),raw)
 elapsed=result['elapsed_seconds'];write_new(run/'main-compile-command.json',{**{k:v for k,v in result.items()if k not in ('stdout','stderr','output')},'argv':recipe['argv'],'stdout':a.binding(run/'main-compile-stdout.log'),'stderr':a.binding(run/'main-compile-stderr.log'),'stdout_bytes':len(result['stdout']),'stderr_bytes':len(result['stderr'])})
 a._need(result['state']=='completed'and type(result['exit'])is int and result['exit']==0 and result['cleanup']=='reaped_original_child'and result.get('error')is None and type(elapsed)in(int,float)and math.isfinite(elapsed)and 0<=elapsed<=10 and len(result['stdout'])+len(result['stderr'])<=65536,'main_compile_failed_or_unknown')
 for before in originals:saved._checkfull(before)
 a._need(fp.verify_fixture_container(wrapper['staging'])==wrapper,'main_source_inventory_changed');artifact=a.binding(output)
 comp={'sourceRevision':config['packageSourceRevision'],'stage':prepared['staging'],'preparationSha256':config['containerPreparation']['sha256'],'argv':recipe['argv'],'compilerExit':result['exit'],'state':'completed','targetExecuted':False,'companySigningKeyUsed':False,'appAssembled':False,'installationReady':False,'activationAllowed':False,'runtimeIdentityQualified':False,'originalInputClosureUnchanged':True,'onlyDeclaredOutputAdded':True,'artifact':artifact}
 path=run/'container-compile.json';write_new(path,comp);bound=a.binding(path);a._main(config['containerPreparation'],bound);return bound

def main():
 if len(sys.argv)!=1 or hashlib.sha256(INPUTS.read_bytes()).hexdigest()!=INPUTS_SHA256:raise RuntimeError('fixed_image_inputs_required')
 config=json.loads(INPUTS.read_bytes());procedure=Path(config['procedureRepo']);run=Path(config['runRoot'])
 for bound in config['helpers'].values():
  if hashlib.sha256(Path(bound['path']).read_bytes()).hexdigest()!=bound['sha256']:raise RuntimeError('fixed_procedure_helper_changed')
 sys.path.insert(0,str(procedure/'scripts'))
 from governance_local_issuer import container_assembly as a,container_preparation as cp,fixture_container_preparation as fp,fixture_container_assembly as fa,fixture_delivery_inputs as fixture,manifest,image_inspection as inspection
 cp._private(run.parent)
 if run!=inspection.FRESH_RUN_ROOT or run.exists()or run.is_symlink():raise RuntimeError('fresh_fixed_image_run_required')
 for key in ('packageManifest','materializationReceipt','fixtureDelivery','terminalSummary','sourcePreparation','containerPreparation','fixturePreparation'):a._bound(config[key])
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
 phase='main-compile';started=time.monotonic()
 try:
  print('PHASE',phase,flush=True);compiled=_compile_main(config,run)
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
