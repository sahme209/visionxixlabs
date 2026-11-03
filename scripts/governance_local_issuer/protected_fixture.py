"""Protected-resource fixture PREPARATION. No image/process/restriction/identity APIs."""
from __future__ import annotations
import hashlib,json,os,stat
from pathlib import Path
from .manifest import PackageUnavailable,verify_package
PACKAGE=Path('/private/tmp/axiom-private-package-fat-066d821a-u0zyrd12/package')
MANIFEST_SHA='f589e6e48a7c374d9d9edf7e50aea83e6bfbbaef9ffecce6352ea92fc40991a9'
PACKAGE_DIGEST='2a377866179b4096a5c809a847ac861770aebdecdff0f459fc4b0f9a8a335685'
RECEIPTS={'root-result.json':'d00aeea2fc52acbd27ac23b58ef26bf61152bda2b061cb447b38f1d412a66dc4','materialization.json':'86ab47cbc0ae445a861a5816c377133b78f3e02b593e47928aa866fbcfd1aae2','root-attempt.json':'b40c99f0d2f6f50c451bb87c8472273d980906382671395616db536e5eb667ef'}
MAIN='node_modules/@axiom/verified-issuer-runtime/index.cjs'
def _fail(reason):raise PackageUnavailable(reason)
def _canonical(path):
 p=Path(path)
 if not p.is_absolute() or p.resolve(strict=True)!=p or p.is_symlink():_fail('canonical_owned_path_required')
 return p

def inspect_alias_pair(backing:Path,alias:Path,max_bytes:int=8*1024**3)->dict:
 """Read actual regular-file identities/bytes, not caller-reported alias authority."""
 backing=_canonical(backing);alias=_canonical(alias)
 if backing==alias:_fail('distinct_alias_required')
 result=[]
 for path in (backing,alias):
  fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
  try:
   before=os.fstat(fd)
   if not stat.S_ISREG(before.st_mode) or before.st_uid!=os.getuid() or before.st_size>max_bytes:_fail('owned_regular_backing_required')
   h=hashlib.sha256();total=0
   while True:
    chunk=os.read(fd,1024*1024)
    if not chunk:break
    total+=len(chunk)
    if total>max_bytes:_fail('backing_size_bound')
    h.update(chunk)
   after=os.fstat(fd);current=path.lstat()
   identity=lambda s:(s.st_dev,s.st_ino,s.st_mode,s.st_uid,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
   if total!=before.st_size or identity(before)!=identity(after) or identity(after)!=identity(current):_fail('backing_changed_during_inspection')
   result.append({'dev':before.st_dev,'ino':before.st_ino,'size':before.st_size,'mode':stat.S_IMODE(before.st_mode),'sha256':h.hexdigest()})
  finally:os.close(fd)
 if result[0]!=result[1]:_fail('alias_not_same_backing')
 return {'format':'axiom.actual-owned-alias-observation/1','backing':str(backing),'alias':str(alias),'file':result[0],'qualification':'resource_observation_only','executingIssuerIdentity':'unavailable'}

def claim_once(owned_root:Path)->Path:
 """Future exact experiment claim; a failed/incomplete claim is never reusable."""
 root=_canonical(owned_root);s=root.stat()
 if not root.is_dir() or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o700:_fail('owned_claim_root_required')
 claim=root/'experiment-claim.json';fd=os.open(claim,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:os.write(fd,b'{"status":"claimed_unknown_until_terminal","retryAllowed":false}\n');os.fsync(fd)
 finally:os.close(fd)
 return claim

def prepare_resource_fixture(owned_root:Path)->dict:
 """Verify one pinned existing package and emit fixed future instructions only."""
 root=_canonical(owned_root);s=root.stat()
 if not root.is_dir() or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o700:_fail('owned_preparation_root_required')
 for name,digest in RECEIPTS.items():
  if hashlib.sha256((PACKAGE.parent/name).read_bytes()).hexdigest()!=digest:_fail('pinned_receipt_changed')
 if hashlib.sha256((PACKAGE/'_axiom_local_issuer_manifest.json').read_bytes()).hexdigest()!=MANIFEST_SHA:_fail('pinned_manifest_changed')
 observation=verify_package(PACKAGE)
 if observation['packageDigest']!=PACKAGE_DIGEST:_fail('pinned_package_changed')
 main=PACKAGE/MAIN
 # This deliberately captures the real existing refusal; it is NOT replaced by a test main.
 if b'verified_issuer_launch_unavailable' not in main.read_bytes():_fail('pinned_main_behavior_changed')
 mount=root/'mount';image=root/'package.dmg';alias=root/'package-hardlink.dmg'
 return {'format':'axiom.protected-resource-preparation/1','sourcePackage':str(PACKAGE),'packageDigest':PACKAGE_DIGEST,'manifestSha256':MANIFEST_SHA,'fileCount':observation['fileCount'],'symlinkCount':observation['symlinkCount'],
 'fixedCanonicalLaunch':{'argv':[str(mount/'__axiom_runtime__/node'),str(mount/MAIN)],'cwd':str(mount),'environment':{'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C'},'stdin':'readonly_devnull','stdout':'owned_anonymous_pipe','stderr':'owned_anonymous_pipe','close_fds':True,'shell':False,'pass_fds':[],'expected':'canonical_refuses_no_identity'},
 'futureImageCreate':['/usr/bin/hdiutil','create','-srcfolder',str(PACKAGE),'-volname','axiom-protected-package','-format','UDRO','-fs','HFS+',str(image)],
 'futureAttach':['/usr/bin/hdiutil','attach','-readonly','-nobrowse','-noautoopen','-mountpoint',str(mount),str(image)],'futureDetach':['/usr/bin/hdiutil','detach',str(mount)],
 'inspection':{'backing':str(image),'hardlink':str(alias),'requireSameInode':True,'requireMountedRootReadonly':True,'requireFullMountedPackageReverification':True,'beforeAfter':['sha256','device','inode','mode','size'],'aliasCreation':'host creates exact owned hardlink before launch; never copies as substitute'},
 'resourceUnit':'image/backing-alias mutation feasibility only; future test-only attacker is separate from canonical main and cannot qualify its identity',
 'executionAuthorized':False,'imageCreationAuthorized':False,'restrictionRunAuthorized':False,'executingIssuerIdentity':'unavailable','blockers':['resource_attack_requires_separate_exact_hash_binding_and_host_orchestration','new_image_mount_and_restriction_run_require_exact_approval','canonical_main_deliberately_refuses','kernel_authenticated_launch_origin_unimplemented','same_artifact_compiled_consumer_not_exercisable_through_current_main'],'noFullQualificationRunProposed':True}
