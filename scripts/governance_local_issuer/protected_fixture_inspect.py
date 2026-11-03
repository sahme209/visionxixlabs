"""Fixed owned read-only inspection child; no mounts, profiles or process creation."""
import json,os,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from governance_local_issuer.protected_fixture import PACKAGE_DIGEST,inspect_alias_pair,PackageUnavailable
from governance_local_issuer.manifest import verify_package
ROOT=Path('/private/tmp/axiom-protected-fixture-prepared-sv2b99jz')
def inspect_fixed(mode):
 if mode=='aliases':observation=inspect_alias_pair(ROOT/'package.dmg',ROOT/'package-hardlink.dmg')
 elif mode=='mounted':
  mount=ROOT/'mount'
  if not os.path.ismount(mount) or not os.statvfs(mount).f_flag&os.ST_RDONLY:raise PackageUnavailable('actual_readonly_mount_required')
  observation=verify_package(mount)
  if observation['packageDigest']!=PACKAGE_DIGEST:raise PackageUnavailable('mounted_package_changed')
 else:raise PackageUnavailable('fixed_inspection_mode_required')
 return {'mode':mode,'observation':observation}
if __name__=='__main__':
 if len(sys.argv)!=2 or sys.argv[1] not in ('aliases','mounted'):raise SystemExit(64)
 print(json.dumps(inspect_fixed(sys.argv[1]),sort_keys=True))
