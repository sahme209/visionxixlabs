"""Signature-only MH_DYLIB comparison. Not signature authentication or custody."""
import hashlib,struct

def need(ok,reason):
 if not ok:raise ValueError(reason)
def layout(data):
 need(type(data)is bytes and 192<=len(data)<=32*1024*1024,'bounded_dylib_required')
 magic,cpu,sub,kind,count,size,flags,reserved=struct.unpack_from('<8I',data)
 need((magic,cpu,sub,kind,reserved)==(0xfeedfacf,0x100000c,0,6,0)and 0<count<=128 and count*8<=size<=65536 and 32+size<=len(data),'arm64_dylib_header')
 at=32;segments={};signature=None;ranges=[];commands=[];section_ranges=[]
 for _ in range(count):
  need(at+8<=32+size,'command_header');cmd,n=struct.unpack_from('<II',data,at)
  need(n>=8 and n%8==0 and at+n<=32+size,'command_bounds')
  if cmd==0x19:
   need(n>=72,'segment_header');name=data[at+8:at+24].split(b'\0',1)[0]
   vm,vs,fo,fs,mp,ip,sections,sflags=struct.unpack_from('<QQQQIIII',data,at+24)
   need(n==72+80*sections and name not in segments and fo<=len(data)and fs<=len(data)-fo,'segment_bounds')
   need(name in (b'__TEXT',b'__DATA_CONST',b'__DATA',b'__LINKEDIT')and vs>=fs,'known_segment')
   seen=set()
   for index in range(sections):
    sn,sg,addr,extent,off,align,rel,nrel,fl,r1,r2,r3=struct.unpack_from('<16s16sQQIIIIIIII',data,at+72+80*index)
    need(sn not in seen and sg.split(b'\0',1)[0]==name and vm<=addr<=vm+vs and extent<=vm+vs-addr and align<=14 and nrel==0 and rel==0 and r3==0,'section_bounds');seen.add(sn)
    if fl&255 not in (1,0x12):
     need(fo<=off<=fo+fs and extent<=fo+fs-off and off>=32+size,'file_section_bounds')
     if extent:section_ranges.append((off,off+extent))
   segments[name]=(at,vm,vs,fo,fs)
   if fs:ranges.append((fo,fo+fs))
  elif cmd==0x1d:
   need(n==16 and signature is None,'unique_signature');offset,extent=struct.unpack_from('<II',data,at+8);signature=(at,offset,extent)
  else:
   need(cmd in (0xd,0xc,0x80000022,0x2,0xb,0x1b,0x32,0x2a,0x26,0x29),'unknown_command')
   commands.append((cmd,at,n))
  at+=n
 need(at==32+size and signature is not None and b'__TEXT'in segments and b'__LINKEDIT'in segments,'complete_layout')
 end=0
 for start,stop in sorted(ranges):need(start>=end,'segment_overlap');end=stop
 text=segments[b'__TEXT'];link=segments[b'__LINKEDIT'];command,offset,extent=signature
 need(text[3]==0 and 32+size<=text[4]<=offset and link[3]>=text[4] and link[3]<=offset and link[3]+link[4]==len(data)and offset>=32+size and 0<extent<=1024*1024 and offset+extent==len(data)and link[2]>=link[4],'signature_linkedit_bounds')
 for start,stop in sorted(section_ranges):need(stop<=offset,'section_signature_overlap')
 last=0
 for start,stop in sorted(section_ranges):need(start>=last,'section_overlap');last=stop
 def link_range(off,extent):
  need((extent==0 and off==0)or(link[3]<=off<=offset and extent<=offset-off),'linkedit_table_bounds')
 symcount=None;dysym=None
 for cmd,pos,n in commands:
  if cmd in (0xd,0xc):
   need(n>=24,'dylib_command');nameoff=struct.unpack_from('<I',data,pos+8)[0]
   need(24<=nameoff<n and b'\0'in data[pos+nameoff:pos+n],'dylib_name')
  elif cmd==0x80000022:
   need(n==48,'dyld_info_size')
   for j in range(5):link_range(*struct.unpack_from('<II',data,pos+8+8*j))
  elif cmd==0x2:
   need(n==24 and symcount is None,'symtab_size');so,symcount,st,ss=struct.unpack_from('<4I',data,pos+8);link_range(so,symcount*16);link_range(st,ss)
  elif cmd==0xb:
   need(n==80 and dysym is None,'dysymtab_size');dysym=struct.unpack_from('<18I',data,pos+8)
   for j,width in ((6,8),(8,56),(10,4),(12,4),(14,8),(16,8)):link_range(dysym[j],dysym[j+1]*width)
  elif cmd==0x1b:need(n==24,'uuid_size')
  elif cmd==0x32:need(n>=24 and n==24+8*struct.unpack_from('<I',data,pos+20)[0],'build_version_size')
  elif cmd==0x2a:need(n==16,'source_version_size')
  else:need(n==16,'linkedit_command_size');link_range(*struct.unpack_from('<II',data,pos+8))
 if dysym is not None:
  need(symcount is not None,'dysym_requires_symtab')
  for j in (0,2,4):need(dysym[j]<=symcount and dysym[j+1]<=symcount-dysym[j],'symbol_index_bounds')
 return {'signatureOffset':offset,'signatureSize':extent,'signatureSizeField':command+12,'linkeditVmSizeField':link[0]+32,'linkeditFileSizeField':link[0]+48,'linkeditFileOffset':link[3]}
def validate_derivative(before,after):
 a=layout(before);b=layout(after);start=a['signatureOffset']
 need(all(a[k]==b[k]for k in a if k!='signatureSize'),'signature_layout_changed')
 x=bytearray(before[:start]);y=bytearray(after[:start])
 for field,n in ((a['signatureSizeField'],4),(a['linkeditVmSizeField'],8),(a['linkeditFileSizeField'],8)):
  x[field:field+n]=bytes(n);y[field:field+n]=bytes(n)
 need(x==y,'non_signature_bytes_changed')
 fs=len(after)-a['linkeditFileOffset'];vs=struct.unpack_from('<Q',after,a['linkeditVmSizeField'])[0]
 need(vs==((fs+16383)//16384)*16384,'derived_linkedit_size')
 return {'inputSha256':hashlib.sha256(before).hexdigest(),'derivedSha256':hashlib.sha256(after).hexdigest(),'inputSize':len(before),'derivedSize':len(after),'signatureOffset':start,'signatureOnlyDifferenceObserved':True,'cryptographicVerificationPerformedHere':False,'upstreamAuthenticity':'unavailable','governanceQualified':False}
