"""Preparation-only namespace correction. No process/build entrypoint.

Copied from the frozen executor; no original executor/packet is rewritten.
"""
import os,stat
from pathlib import Path
class Refusal(Exception):pass
def refuse(reason):raise Refusal(reason)

def stage_namespace(cache,destination,source,physical_zod=False):
 destination.mkdir(mode=0o700)
 for item in sorted(cache.iterdir()):
  if item.name in ('.bin','@axiom','.cache','.prisma','.vite-temp'):continue
  target=destination/item.name
  if item.name=='zod' and physical_zod:
   # Physical identity is necessary for closed webpack source manifests.
   copy_regular_tree(item.resolve(strict=True),target)
  else:target.symlink_to(item.resolve(strict=True),target_is_directory=item.is_dir())
 (destination/'.vite-temp').mkdir(mode=0o700)
 bins=destination/'.bin';bins.mkdir(mode=0o700)
 if not (cache/'.bin').is_dir():refuse('missing_cached_bins')
 for entry in (cache/'.bin').iterdir():
  target=entry.resolve(strict=True)
  if not target.is_file():refuse('bad_cached_bin')
  (bins/entry.name).symlink_to(target)
 axiom=destination/'@axiom';axiom.mkdir(mode=0o700)
 (axiom/'verified-issuer-runtime').symlink_to(source/'packages/verified-issuer-runtime',target_is_directory=True)

def copy_regular_tree(src,dst):
 dst.mkdir(mode=0o700)
 for p in sorted(src.iterdir()):
  s=p.lstat()
  if stat.S_ISDIR(s.st_mode):copy_regular_tree(p,dst/p.name)
  elif stat.S_ISREG(s.st_mode):
   with (dst/p.name).open('xb') as f:f.write(p.read_bytes())
   os.chmod(dst/p.name,0o700 if s.st_mode&0o111 else 0o600)
  else:refuse('physical_package_nonregular')

def repair_owned_vite_temp(namespace,expected_cache_target):
 """Only the original owned stage alias may be replaced. Never touch its target.

 Caller must first independently bind the original stage/failed receipt and
 confirm its old child group is quiescent. This function launches no program.
 """
 namespace=Path(namespace);expected_cache_target=Path(expected_cache_target)
 if namespace.resolve(strict=True)!=namespace or not namespace.is_dir() or namespace.stat().st_uid!=os.getuid() or namespace.stat().st_mode&0o777!=0o700:refuse('stage_namespace_identity')
 temp=namespace/'.vite-temp'
 if not temp.is_symlink() or os.readlink(temp)!=str(expected_cache_target):refuse('unexpected_vite_temp')
 temp.unlink() # unlink ONLY the owned alias, not any file in the shared cache.
 temp.mkdir(mode=0o700)
 return {'path':str(temp),'mode':0o700,'cacheTargetUnmodified':True}
