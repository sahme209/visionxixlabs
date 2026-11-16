"""20-second owned-file Windows metadata diagnostic. No MSI/app/tool acquisition."""
import sys
sys.dont_write_bytecode=True
import hashlib,importlib.util,json,os,shutil,time,uuid
from pathlib import Path
import windows_installed_acceptance as qa
from windows_msi_byte_diagnostic import authority

def load(name,file):
 spec=importlib.util.spec_from_file_location(name,file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def main():
 authority();base=qa.validated_runner_temp(os.environ.get('RUNNER_TEMP'))/('axiom-installed-stat-'+uuid.uuid4().hex);base.mkdir(exist_ok=False);output=base/'evidence';output.mkdir();runner=qa.OwnedWindowsProcess(output,time.monotonic()+20);result={'accepted':False,'installerExecuted':False,'appBuilt':False,'processes':runner.records};stage='source';junction=None
 try:
  packet=qa.ROOT/'scripts/windows-residual-stat-inputs.json';inputs=json.loads(packet.read_text());packet_hash=qa.digest(packet);qa.need(all(qa.digest(qa.ROOT/n)==h for n,h in inputs.items()),'source_changed')
  git=shutil.which('git.exe');qa.need(bool(git),'managed_git_missing');qa.need(runner.run('source-head',[git,'rev-parse','HEAD'],qa.ROOT,3).strip()==os.environ['GITHUB_SHA'],'head_changed')
  old=load('original_residual',qa.ROOT/'scripts/windows_residual_metadata_original.py');new=load('corrected_residual',qa.ROOT/'scripts/windows_residual_metadata.py');app=base/'application';app.mkdir();file=app/'owned-small.txt';data=b'fixed synthetic owned metadata fixture\n';file.write_bytes(data);expected=hashlib.sha256(data).hexdigest()
  stage='metadata_comparison'
  with os.scandir(app) as rows:entry=next(rows);directory_stat=entry.stat(follow_symlinks=False)
  path_stat=file.lstat()
  with file.open('rb') as stream:handle_stat=os.fstat(stream.fileno())
  result['statComparison']={'dirEntryInodeZero':directory_stat.st_ino==0,'dirEntryDeviceZero':directory_stat.st_dev==0,'pathHandleInodeMatch':path_stat.st_ino==handle_stat.st_ino,'pathHandleDeviceMatch':path_stat.st_dev==handle_stat.st_dev,'pathHandleSizeMatch':path_stat.st_size==handle_stat.st_size,'pathHandleMtimeMatch':path_stat.st_mtime_ns==handle_stat.st_mtime_ns}
  result['original']=old.installation_residual_metadata(base);qa.need(result['original']['entries'][0].get('hashUnavailable') is True,'original_refusal_not_reproduced')
  stage='corrected_hash'
  try:new._read_small(file,path_stat);result['directReadAccepted']=True
  except OSError as error:
   result['directReadFailure']=str(error) if str(error) in ('residual_open_refused','residual_physical_path_changed','residual_identity_changed','residual_read_changed') else 'owned_read_oserror';raise RuntimeError('corrected_direct_read_refused') from None
  result['corrected']=new.installation_residual_metadata(base);qa.need(result['corrected']['entries'][0].get('sha256')==expected,'corrected_hash_missing')
  stage='reparse_refusal';target=base/'owned-junction-target';target.mkdir();(target/'never-read.txt').write_bytes(b'fixed synthetic target');junction=app/'owned-junction';cmd=(Path(os.environ['SYSTEMROOT'])/'System32/cmd.exe').resolve(strict=True);runner.run('owned-junction',[cmd,'/d','/c','mklink','/J',junction,target],base,3);result['reparse']=new.installation_residual_metadata(base);row=next(r for r in result['reparse']['entries'] if r['relativeName']=='owned-junction');qa.need(row['type']=='reparse' and 'sha256' not in row and not any('never-read' in r['relativeName'] for r in result['reparse']['entries']),'reparse_followed');os.rmdir(junction);junction=None
  stage='entry_cap'
  for i in range(40):(app/('cap-%02d.txt'%i)).write_bytes(b'fixed')
  result['caps']=new.installation_residual_metadata(base);qa.need(result['caps']['entryLimitReached'] and len(result['caps']['entries'])==32 and result['caps']['hashBytes']<=new.MAX_HASH_BYTES,'cap_changed');result['sourceInputsMatched']=all(qa.digest(qa.ROOT/n)==h for n,h in inputs.items()) and qa.digest(packet)==packet_hash;result['accepted']=result['sourceInputsMatched']
 except Exception as error:result['failure']={'stage':stage,'code':str(error) if isinstance(error,RuntimeError) else 'fixed_owned_metadata_probe_failed'}
 finally:
  try:
   if junction is not None:
    qa.need(junction.parent==base/'application' and bool(os.lstat(junction).st_file_attributes&1024),'junction_cleanup_identity_changed');os.rmdir(junction)
   qa.need(not base.is_symlink() and all(not p.is_symlink() and not getattr(p,'is_junction',lambda:False)() for p in base.rglob('*')),'fixture_link_changed')
   for p in list(base.iterdir()):
    if p!=output:
     if p.is_dir():shutil.rmtree(p)
     else:p.unlink()
   result['ownedFixtureRemoved']=True
  except Exception:result['accepted']=False;result['cleanupFailure']='owned_fixture_cleanup_unconfirmed'
  result['ownedProcessesEmpty']=all(r['ownedJobEmpty'] for r in runner.records);result['accepted']=result['accepted'] and result.get('ownedFixtureRemoved',False) and result['ownedProcessesEmpty'];print('V19_RESIDUAL_STAT_RESULT:'+qa.primary_receipt(result),flush=True)
 return 0 if result['accepted'] else 1
if __name__=='__main__':raise SystemExit(main())
