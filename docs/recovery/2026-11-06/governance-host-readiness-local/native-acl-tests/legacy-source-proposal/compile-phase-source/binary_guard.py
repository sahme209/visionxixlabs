"""Pure bounded file-format inspection; never invokes a binary or platform tool."""
import hashlib,stat,struct
from pathlib import Path
ALLOWED_IMPORTS={'_puts','_memset','___memset_chk','_memcpy','_memcmp','_malloc','_free','_bzero','___assert_rtn','___stack_chk_fail','___stack_chk_guard','dyld_stub_binder'}
METADATA={0x19,0x2,0xb,0x1b,0x32,0x2a,0x80000028,0x1d,0x26,0x29,0x22,0x80000022,0x80000034,0x80000033,0x1a,0x16,0x24,0x25,0x2f,0x30}
EXTRA_IMPORTS={'legacy-owner-journal-test':{'_strcmp','_strchr','_strlen','_strtok_r'},'legacy-maintenance-test':{'_strcmp','_strtok_r'}}
def inspect(path,target):
 if target not in EXTRA_IMPORTS:raise ValueError('unreviewed_legacy_target')
 allowed_imports=ALLOWED_IMPORTS|EXTRA_IMPORTS[target]
 p=Path(path);s=p.lstat()
 if not stat.S_ISREG(s.st_mode)or s.st_nlink!=1 or not 32<=s.st_size<=1024*1024:raise ValueError('test_binary_shape')
 data=p.read_bytes()
 if len(data)!=s.st_size:raise ValueError('test_binary_changed')
 magic,cpu,subtype,kind,count,size,flags,reserved=struct.unpack_from('<IiiIIIII',data)
 if (magic,cpu,subtype,kind,reserved)!=(0xfeedfacf,0x100000c,0,2,0)or not 0<count<=128 or not 8*count<=size<=65536 or 32+size>len(data):raise ValueError('test_binary_header')
 offset=32;symtab=None;libraries=[];linker=None
 for _ in range(count):
  cmd,n=struct.unpack_from('<II',data,offset)
  if n<8 or n%8 or offset+n>32+size:raise ValueError('test_binary_load_bounds')
  if cmd in (0xc,0xe):
   start=struct.unpack_from('<I',data,offset+8)[0]
   if not (24 if cmd==0xc else 12)<=start<n:raise ValueError('test_binary_name_bounds')
   text=data[offset+start:offset+n].split(b'\0',1)[0].decode('ascii')
   if cmd==0xc:libraries.append(text)
   else:linker=text
  elif cmd==2:
   if n!=24 or symtab is not None:raise ValueError('test_binary_symtab')
   symtab=struct.unpack_from('<IIII',data,offset+8)
  elif cmd not in METADATA:raise ValueError('test_binary_unreviewed_load_command')
  offset+=n
 if offset!=32+size or libraries!=['/usr/lib/libSystem.B.dylib']or linker!='/usr/lib/dyld'or symtab is None:raise ValueError('test_binary_loader')
 at,number,strings,length=symtab
 if number>4096 or at+16*number>len(data)or strings+length>len(data)or length>65536:raise ValueError('test_binary_symbols_bounds')
 imports=[]
 for i in range(number):
  index,kind,section,desc,value=struct.unpack_from('<IBBHQ',data,at+16*i)
  if kind&0xe0:continue
  if kind&0x0e==0:
   if index>=length or value!=0:raise ValueError('test_binary_undefined_shape')
   raw=data[strings+index:strings+length];end=raw.find(b'\0')
   if not 0<end<=128:raise ValueError('test_binary_symbol_name')
   name=raw[:end].decode('ascii')
   if name not in allowed_imports:raise ValueError('test_binary_unreviewed_import')
   imports.append(name)
 return {'sha256':hashlib.sha256(data).hexdigest(),'size':len(data),'imports':sorted(set(imports)),'libraries':libraries,'noAclSecurityProtectedOperationImports':True}
