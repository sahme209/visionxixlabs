"""Bounded arm64 Mach-O load metadata observation, never runtime attestation.

Only each image's own @loader_path LC_RPATH is interpreted. Inherited search,
dlopen, environment injection and executable-relative search are not qualified.
System install names declare trusted macOS host prerequisites, not copied bytes.
"""
from __future__ import annotations
import hashlib, os, platform, plistlib, stat, struct, subprocess
from pathlib import Path
from .manifest import refuse, PackageUnavailable

MAX_FILES=250000
MAX_MACH_FILES=4096
MAX_PATH_BYTES=32*1024*1024
MAX_COMMAND_BYTES=16*1024*1024
MAX_TOTAL_COMMAND_BYTES=64*1024*1024
MAX_NATIVE_BYTES=2*1024*1024*1024
MAGICS={b'\xcf\xfa\xed\xfe',b'\xfe\xed\xfa\xcf',b'\xce\xfa\xed\xfe',b'\xfe\xed\xfa\xce',b'\xca\xfe\xba\xbe',b'\xbe\xba\xfe\xca',b'\xca\xfe\xba\xbf',b'\xbf\xba\xfe\xca'}
LOADS={0xc,0x80000018,0x8000001f,0x80000023,0x20}
# Commands with no loader path/search or environment semantics in this profile.
METADATA={0x19,0x2,0xb,0x1b,0x32,0x2a,0x80000028,0x1d,0x26,0x29,
          0x22,0x80000022,0x80000034,0x80000033,0x1a,0x16,0x24,0x25,0x2f,0x30}

def _state(s):
 return (s.st_dev,s.st_ino,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)

def _read(path, consume_commands):
 """Read only the bounded header/load-command region from one stable FD."""
 before=path.lstat()
 if not stat.S_ISREG(before.st_mode)or before.st_nlink!=1:refuse('native_regular_singlelink_required')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  opened=os.fstat(fd)
  if not stat.S_ISREG(opened.st_mode)or opened.st_nlink!=1 or _state(before)!=_state(opened):refuse('native_regular_singlelink_required')
  header=os.read(fd,32)
  if header[:4]not in MAGICS:
   if _state(opened)!=_state(os.fstat(fd))or _state(opened)!=_state(path.lstat()):refuse('native_changed')
   return None
  if len(header)!=32 or not 32<=opened.st_size<=MAX_NATIVE_BYTES:refuse('native_header_bounds')
  architectures=[];selected=None;slice_offset=0;slice_size=opened.st_size
  if header[:4]==b'\xca\xfe\xba\xbe':
   arch_count=struct.unpack_from('>I',header,4)[0]
   if not 1<=arch_count<=32:refuse('native_fat_architecture_count')
   table_end=8+20*arch_count
   if table_end>opened.st_size:refuse('native_fat_table_bounds')
   os.lseek(fd,8,os.SEEK_SET);table=os.read(fd,20*arch_count)
   if len(table)!=20*arch_count:refuse('native_fat_table_truncated')
   seen=set();ranges=[];arm=[]
   for i in range(arch_count):
    cpu,subtype,start,length,alignment=struct.unpack_from('>iiIII',table,i*20)
    if (cpu,subtype)in seen:refuse('native_fat_duplicate_architecture')
    seen.add((cpu,subtype))
    if alignment>30 or start<table_end or start%(1<<alignment)or length<32 or start+length>opened.st_size:refuse('native_fat_slice_bounds')
    if any(start<end and begin<start+length for begin,end in ranges):refuse('native_fat_slice_overlap')
    ranges.append((start,start+length))
    descriptor={'cpuType':cpu,'cpuSubtype':subtype,'offset':start,'size':length,'alignmentExponent':alignment}
    architectures.append(descriptor)
    if cpu==0x100000c:arm.append(descriptor)
   if len(arm)!=1 or arm[0]['cpuSubtype']!=0:refuse('native_fat_exact_arm64_required')
   selected=arm[0];slice_offset=selected['offset'];slice_size=selected['size']
   os.lseek(fd,slice_offset,os.SEEK_SET);header=os.read(fd,32)
   if len(header)!=32:refuse('native_header_bounds')
  magic,cpu,subtype,kind,count,size,flags,reserved=struct.unpack('<IiiIIIII',header)
  if (magic,cpu,subtype,reserved)!=(0xfeedfacf,0x100000c,0,0)or kind not in {2,6,8}:refuse('unsupported_native_header')
  if not 0<count<=4096 or not 8*count<=size<=MAX_COMMAND_BYTES or size>slice_size-32:refuse('native_command_bounds')
  consume_commands(size)
  data=bytearray()
  while len(data)<size:
   chunk=os.read(fd,min(size-len(data),1024*1024))
   if not chunk:refuse('native_commands_truncated')
   data.extend(chunk)
  os.lseek(fd,0,os.SEEK_SET);full_hash=hashlib.sha256();hashed=0
  while True:
   chunk=os.read(fd,min(1024*1024,opened.st_size-hashed+1))
   if not chunk:break
   hashed+=len(chunk)
   if hashed>opened.st_size:refuse('native_changed')
   full_hash.update(chunk)
  if hashed!=opened.st_size or _state(opened)!=_state(os.fstat(fd))or _state(opened)!=_state(path.lstat()):refuse('native_changed')
 finally:os.close(fd)
 offset=0;loads=[];rpaths=[];install_id=None;linker=None
 for _ in range(count):
  if offset+8>size:refuse('native_command_truncated')
  command,length=struct.unpack_from('<II',data,offset)
  if length<8 or length%8 or offset+length>size:refuse('native_command_size')
  def name(minimum):
   if length<minimum:refuse('native_string_command_truncated')
   start=struct.unpack_from('<I',data,offset+8)[0]
   if not minimum<=start<length:refuse('native_name_offset')
   raw=bytes(data[offset+start:offset+length]);end=raw.find(b'\0')
   if not 0<end<=4096:refuse('native_name_bounds')
   try:value=raw[:end].decode('ascii')
   except UnicodeError:refuse('native_name_encoding')
   if any(ord(c)<32 or ord(c)==127 for c in value):refuse('native_name_encoding')
   return value
  if command in LOADS:loads.append(name(24))
  elif command==0xd:
   if install_id is not None or kind!=6:refuse('native_install_id_invalid')
   install_id=name(24)
  elif command==0x8000001c:rpaths.append(name(12))
  elif command==0xe:
   if linker is not None:refuse('native_dynamic_linker_duplicate')
   linker=name(12)
   if linker!='/usr/lib/dyld':refuse('native_dynamic_linker_unbound')
  elif command not in METADATA:refuse('native_loader_command_unsupported')
  offset+=length
 if offset!=size:refuse('native_command_count')
 return {'size':opened.st_size,'sha256':full_hash.hexdigest(),'architectures':architectures,
         'selectedArchitecture':selected,'otherArchitecturesQualification':'not_inspected'if selected else'not_applicable',
         'kind':kind,'installId':install_id,'installNames':loads,'rpaths':rpaths,'dynamicLinker':linker,'commandBytes':size}

def _inside(root,path,strict=False):
 """Resolve links componentwise; never stat/read a candidate outside root."""
 try:pending=list(path.relative_to(root).parts)
 except ValueError:refuse('native_path_escape')
 current=root;links=steps=0
 while pending:
  steps+=1
  if steps>4096:refuse('native_path_bounds')
  part=pending.pop(0)
  if part in {'','.'}:continue
  if part=='..':
   if current==root:refuse('native_path_escape')
   current=current.parent;continue
  candidate=current/part
  try:info=candidate.lstat()
  except FileNotFoundError:
   if strict:raise
   current=candidate;continue
  if stat.S_ISLNK(info.st_mode):
   links+=1
   if links>40:refuse('native_path_cycle')
   target=Path(os.readlink(candidate))
   if target.is_absolute():
    try:target=target.relative_to(root)
    except ValueError:refuse('native_path_escape')
    current=root
   pending=list(target.parts)+pending
  else:current=candidate
 return current

def _loader(root,image,name):
 if name=='@loader_path':return _inside(root,image.parent)
 if not name.startswith('@loader_path/')or '\\'in name:refuse('native_search_path_unsupported')
 return _inside(root,image.parent/name[len('@loader_path/'):])

def _system(name):
 return (name.startswith('/usr/lib/')or name.startswith('/System/Library/'))and all(p not in {'','.', '..'}for p in name.split('/')[1:])and '\\'not in name

def host_observation():
 os_build=subprocess.check_output(['/usr/bin/sw_vers','-buildVersion'],text=True,timeout=15).strip()
 info=plistlib.loads(subprocess.check_output(['/usr/sbin/diskutil','info','-plist','/'],timeout=15))
 return {'osBuild':os_build,'architecture':platform.machine(),'apfsSnapshot':info.get('APFSSnapshot')is True}

def collect_native_prerequisites(root):
 root=Path(root)
 if root.is_symlink()or not root.is_dir()or root.resolve()!=root:refuse('canonical_native_root_required')
 parsed={};unresolved=[];total=paths=count=0
 def consume_commands(size):
  nonlocal total
  total+=size
  if total>MAX_TOTAL_COMMAND_BYTES:refuse('native_metadata_limit')
 def walk_error(_error):refuse('native_tree_unreadable')
 for base,dirs,names in os.walk(root,followlinks=False,onerror=walk_error):
  dirs.sort();names.sort()
  for name in dirs+names:
   count+=1;paths+=len((Path(base)/name).relative_to(root).as_posix().encode())
   if count>MAX_FILES or paths>MAX_PATH_BYTES:refuse('native_tree_limit')
  for name in names:
   path=Path(base)/name
   if path.is_symlink():continue
   try:
    record=_read(path,consume_commands)
    if record is None:continue
    if len(parsed)>=MAX_MACH_FILES:refuse('native_metadata_limit')
    parsed[path]=record
   except (PackageUnavailable,OSError,RuntimeError)as exc:
    unresolved.append({'file':path.relative_to(root).as_posix(),'reason':str(exc)if isinstance(exc,PackageUnavailable)else'native_unreadable'})
 system=set();bound=[]
 for path,record in sorted(parsed.items()):
  item={'path':path.relative_to(root).as_posix(),'installNames':record['installNames'],'installId':record['installId'],'rpaths':record['rpaths'],'resolvedDependencies':[]}
  for field in ('size','sha256','architectures','selectedArchitecture','otherArchitecturesQualification'):item[field]=record[field]
  if record['dynamicLinker']:system.add(record['dynamicLinker']);item['dynamicLinker']=record['dynamicLinker']
  search=[];item['unqualifiedSearchContexts']=[]
  for rpath in record['rpaths']:
   try:
    candidate=_loader(root,path,rpath)
    # Missing own paths are metadata, never asserted runtime search authority.
    try:directory=stat.S_ISDIR(candidate.lstat().st_mode)
    except FileNotFoundError:directory=False
    if not directory:
     item['unqualifiedSearchContexts'].append({'rpath':rpath,'reason':'missing_directory'})
    search.append(candidate)
   except (PackageUnavailable,OSError,RuntimeError)as exc:
    reason='outside_package'if str(exc)=='native_path_escape'else'unsupported_search_context'
    item['unqualifiedSearchContexts'].append({'rpath':rpath,'reason':reason})
  for name in record['installNames']:
   try:
    if _system(name):system.add(name);continue
    if name.startswith('@rpath/'):
     suffix=name[len('@rpath/'):]
     if not suffix or suffix.startswith('/')or '\\'in suffix or any(p in {'','.', '..'}for p in suffix.split('/')):refuse('native_rpath_name_invalid')
     if not search:refuse('inherited_rpath_unsupported')
     candidates=set()
     for base in search:
      try:candidate=_inside(root,base/suffix,True)
      except FileNotFoundError:continue
      candidates.add(candidate)
     if len(candidates)>1:refuse('ambiguous_rpath')
     if len(candidates)!=1:refuse('native_target_missing')
     target=next(iter(candidates))
    else:target=_loader(root,path,name);target=_inside(root,target,True)
    if target not in parsed or parsed[target]['kind']!=6:refuse('native_target_not_supported_dylib')
    item['resolvedDependencies'].append({'installName':name,'path':target.relative_to(root).as_posix()})
   except (PackageUnavailable,OSError,RuntimeError)as exc:
    unresolved.append({'file':item['path'],'installName':name,'reason':str(exc)if isinstance(exc,PackageUnavailable)else'native_target_unreadable'})
  bound.append(item)
 return {'kind':'trusted_macos_host_prerequisites_not_attestation',**host_observation(),
         'systemInstallNames':sorted(system),'machOFiles':bound,'unresolved':unresolved,
         'runtimeQualification':'unavailable','linkageProfile':'own_loader_path_rpaths_arm64_macho64_v1',
         'dynamicLoadingQualification':'unavailable','inheritedSearchQualification':'unavailable',
         'nativeSearchContextQualification':'unavailable','canConstructIssuerIdentity':False}
