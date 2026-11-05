"""Bounded saved-byte observations, not signature verification or authority.

Wire layouts/constants: installed MacOSX26.5.sdk Kernel Headers/kern/cs_blobs.h
CS_CodeDirectory/CS_SuperBlob/CS_GenericBlob and usr/include/mach-o/loader.h.
Only the observed arm64 MH_BUNDLE, v0x20500 SHA256/no-entitlement form is supported.
CMS/requirements payloads remain opaque: earlier exact static verification is
separate evidence. No Security API, process, network or executable loading here.
"""
import hashlib,plistlib,struct,json,os,stat,math,re
from pathlib import Path
class ObservationUnavailable(ValueError): pass
def _need(value,reason):
 if not value:raise ObservationUnavailable(reason)
def inspect_empty_dictionary(data):
 _need(type(data) is bytes and 0<len(data)<=65536,'dictionary_bytes_required')
 try:value=plistlib.loads(data)
 except Exception:raise ObservationUnavailable('dictionary_unreadable') from None
 _need(type(value) is dict and not value,'dictionary_not_empty')
 return {'representation':'explicit_empty_dictionary_observed','executionAuthorized':False,'installationReady':False}
def inspect_guard_no_entitlements(data,identifier,team):
 _need(type(data) is bytes and 48<=len(data)<=16*1024*1024,'bounded_macho_required')
 try:return _guard(data,identifier,team)
 except (struct.error,UnicodeError,IndexError,OverflowError):raise ObservationUnavailable('signature_structure_unreadable') from None
def _guard(data,identifier,team):
 magic,cpu,sub,kind,ncmds,cmdbytes,flags,reserved=struct.unpack_from('<8I',data)
 _need((magic,cpu,sub,kind,reserved)==(0xfeedfacf,0x100000c,0,8,0),'guard_arm64_bundle_required')
 _need(0<ncmds<=4096 and ncmds*8<=cmdbytes<=len(data)-32,'load_commands_bound')
 at=32;signatures=[]
 for _ in range(ncmds):
  _need(at+8<=32+cmdbytes,'load_command_truncated');command,size=struct.unpack_from('<II',data,at)
  _need(size>=8 and size%8==0 and at+size<=32+cmdbytes,'load_command_length')
  if command==0x1d:
   _need(size==16,'signature_command_length');signatures.append(struct.unpack_from('<II',data,at+8))
  at+=size
 _need(at==32+cmdbytes and len(signatures)==1,'one_signature_command_required')
 offset,length=signatures[0]
 _need(offset>=at and 36<=length<=1024*1024 and offset+length==len(data),'signature_range')
 signature=data[offset:];magic,total,count=struct.unpack_from('>III',signature)
 _need(magic==0xfade0cc0 and count==3 and 36<=total<=length and not any(signature[total:]),'known_superblob_required')
 blobs={};ranges=[];expected={0:0xfade0c02,2:0xfade0c01,65536:0xfade0b01}
 for i in range(count):
  slot,start=struct.unpack_from('>II',signature,12+8*i)
  _need(slot in expected and slot not in blobs and 36<=start<=total-8,'known_unique_signature_slot')
  magic,size=struct.unpack_from('>II',signature,start)
  _need(magic==expected[slot] and size>=8 and start+size<=total,'signature_blob_range_or_magic')
  blobs[slot]=signature[start:start+size];ranges.append((start,start+size))
 end=36
 for start,stop in sorted(ranges):
  _need(start==end,'signature_blob_overlap_or_gap');end=stop
 _need(end==total and set(blobs)==set(expected),'signature_complete_slots')
 cd=blobs[0];_need(len(cd)>=96,'code_directory_header')
 _,declared,version,cdflags,hashoff,identoff,special,codes,limit,hashsize,hashtype,platform,pageshift,spare=struct.unpack_from('>9I4BI',cd)
 _need(declared==len(cd) and version==0x20500 and cdflags==0x10000,'known_runtime_code_directory')
 _need((hashsize,hashtype,platform,pageshift,spare,special)==(32,2,0,14,0,2),'known_no_entitlement_hash_profile')
 scatter,teamoff,spare3,limit64=struct.unpack_from('>IIIQ',cd,44)
 base,execsize,execflags,runtime,preencrypt=struct.unpack_from('>QQQII',cd,64)
 _need((scatter,spare3,limit64,base,execflags,preencrypt)==(0,0,0,0,0,0) and 0<execsize<=offset and runtime>0,'known_guard_directory_options')
 _need(limit==offset and codes==(limit+16383)//16384 and 0<codes<=1024,'code_directory_image_range')
 _need(hashoff+codes*32==len(cd) and hashoff-64>=96,'code_directory_hash_range')
 _need(type(identifier) is str and type(team) is str and identifier.isascii() and team.isascii(),'fixed_ascii_identity')
 ident=identifier.encode()+b'\0';team_bytes=team.encode()+b'\0'
 _need(identoff==96 and teamoff==identoff+len(ident) and teamoff+len(team_bytes)==hashoff-64,'directory_identity_ranges')
 _need(cd[identoff:teamoff]==ident and cd[teamoff:hashoff-64]==team_bytes,'directory_identity_mismatch')
 _need(cd[hashoff-32:hashoff]==bytes(32) and cd[hashoff-64:hashoff-32]==hashlib.sha256(blobs[2]).digest(),'directory_special_hash_mismatch')
 for i in range(codes):
  page=data[i*16384:min((i+1)*16384,limit)]
  _need(cd[hashoff+i*32:hashoff+(i+1)*32]==hashlib.sha256(page).digest(),'directory_page_hash_mismatch')
 return {'representation':'no_encoded_entitlement_payload_observed','machOFileType':kind,'signatureSlots':sorted(blobs),'codeDirectorySha256':hashlib.sha256(cd).hexdigest(),'cdhash':hashlib.sha256(cd).hexdigest()[:40],'executionAuthorized':False,'installationReady':False,'cryptographicSignatureVerifiedHere':False}

def _read(path,limit=1024*1024):
 p=Path(path);_need(p.is_absolute() and p.resolve()==p,'canonical_evidence_path_required')
 for parent in p.parents:_need(not parent.is_symlink(),'evidence_ancestor_alias')
 a=p.lstat();_need(stat.S_ISREG(a.st_mode) and a.st_nlink==1 and a.st_uid==os.getuid() and a.st_size<=limit,'bounded_owned_evidence_required')
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  b=os.fstat(fd);chunks=[];total=0
  while True:
   part=os.read(fd,min(65536,limit-total+1))
   if not part:break
   total+=len(part);_need(total<=limit,'evidence_grew');chunks.append(part)
  after=os.fstat(fd)
 finally:os.close(fd)
 fields=lambda x:(x.st_dev,x.st_ino,x.st_mode,x.st_uid,x.st_nlink,x.st_size,x.st_mtime_ns,x.st_ctime_ns)
 _need(fields(a)==fields(b)==fields(after)==fields(p.lstat()),'evidence_changed_during_read')
 return b''.join(chunks),a
def _json(path):
 def unique(pairs):
  out={}
  for key,value in pairs:_need(key not in out,'duplicate_json_key');out[key]=value
  return out
 raw,_=_read(path)
 try:value=json.loads(raw,object_pairs_hook=unique)
 except (ValueError,TypeError):raise ObservationUnavailable('evidence_json_unreadable') from None
 return value,hashlib.sha256(raw).hexdigest()
def _binding(want):
 _need(type(want) is dict,'binding_required');raw,s=_read(want['path'],16*1024*1024)
 actual={'path':str(Path(want['path'])),'sha256':hashlib.sha256(raw).hexdigest(),'size':s.st_size,'uid':s.st_uid,'mode':oct(stat.S_IMODE(s.st_mode)),'dev':s.st_dev,'ino':s.st_ino,'mtime_ns':s.st_mtime_ns,'ctime_ns':s.st_ctime_ns}
 _need(actual==want and actual['mode']=='0o600','evidence_binding_changed')
 return raw
def _field(text,key,expected):
 values=re.findall(r'^'+re.escape(key)+r'=(.*)$',text,re.M)
 _need(values==[expected],'saved_display_field_mismatch')
def reconcile_saved_batch(packet_path,observation_dir):
 try:return _reconcile(Path(packet_path),Path(observation_dir))
 except (OSError,KeyError,TypeError,UnicodeError,struct.error):raise ObservationUnavailable('saved_batch_unavailable') from None
def _reconcile(packet_path,obs):
 packet,packetsha=_json(packet_path);claim,_=_json(obs/'approval-claimed.json');historical,historicalsha=_json(obs/'result.json')
 _need(claim.get('consumed') is True and claim.get('packetSha256')==packetsha,'consumed_bound_packet_required')
 _need(historical.get('allFourStaticSequencesAccepted') is False,'historical_failure_required')
 leaves=packet['leaves'];_need([x['role'] for x in leaves]==['owner','maintenance','bootstrap','guard'],'four_exact_roles_required')
 batch=Path(packet['batch']);_need(batch.resolve()==batch and stat.S_IMODE(batch.stat().st_mode)==0o700,'private_batch_required')
 plist=_binding(packet['entitlements']);inspect_empty_dictionary(plist)
 expected={Path(packet['entitlements']['path']).name}|{Path(x['target']['path']).name for x in leaves}
 _need({p.name for p in batch.iterdir()}==expected,'batch_files_changed')
 representations=[];snapshots=[]
 for leaf in leaves:
  role=leaf['role'];original=_binding(leaf['sourceArtifact']);snapshots.append(leaf['sourceArtifact']);target=Path(leaf['target']['path'])
  _need(target.parent==batch and not any(p.suffix=='.app' for p in target.parents),'detached_target_required')
  record,_=_json(obs/role/('saved-byte-inspection.json' if role=='guard' else 'result.json'));binding=record['artifact_after'];_need(binding['path']==str(target),'bound_signed_target_required');data=_binding(binding);snapshots.append(binding)
  commands,commandsha=_json(obs/role/'commands.json');_need(len(commands)==3 and [x['argv'] for x in commands]==leaf['commands'],'exact_saved_argv_required')
  outputs=[]
  for i,command in enumerate(commands,1):
   elapsed=command.get('elapsed_seconds');_need(command.get('exit')==0 and type(command.get('exit'))is int and command.get('state')=='completed' and type(elapsed)in(int,float) and math.isfinite(elapsed) and 0<=elapsed<=10,'successful_bounded_commands_required')
   stdout,_=_read(obs/role/f'{i}-stdout.log',65536);stderr,_=_read(obs/role/f'{i}-stderr.log',65536)
   _need(len(stdout)==command['stdout_bytes'] and len(stderr)==command['stderr_bytes'] and len(stdout)+len(stderr)<=65536,'raw_log_counts_mismatch');outputs.append((stdout,stderr))
  stdout,stderr=outputs[2];text=stderr.decode('utf8');_field(text,'Identifier',leaf['identifier']);_field(text,'TeamIdentifier','FG5N98FE6W');_field(text,'Info.plist','not bound');_field(text,'Sealed Resources','none')
  _need(re.findall(r'^Format=(.*)$',text,re.M)==['Mach-O thin (arm64)'] and re.findall(r'flags=(0x[0-9a-f]+)\(runtime\)',text)==['0x10000'],'standalone_runtime_profile_required')
  if role=='guard':
   _need(stdout==b'','guard_empty_saved_stdout_required');representation=inspect_guard_no_entitlements(data,leaf['identifier'],'FG5N98FE6W');_field(text,'CDHash',representation['cdhash'])
  else:representation=inspect_empty_dictionary(stdout)
  representations.append({'role':role,'observation':representation,'artifactSha256':binding['sha256'],'commandsSha256':commandsha})
 # Fresh ordinary reads fence local observation changes. They grant no runtime authority.
 for b in snapshots:_binding(b)
 _binding(packet['entitlements']);_need({p.name for p in batch.iterdir()}==expected,'batch_files_changed')
 _need(_json(obs/'result.json')[1]==historicalsha and _json(packet_path)[1]==packetsha,'original_evidence_changed')
 return {'format':'axiom.saved-static-profile-supplement/1','representations':representations,'allFourRepresentationsObserved':True,'historicalBatchAccepted':False,'historicalResultSha256':historicalsha,'packetSha256':packetsha,'executionAuthorized':False,'installationReady':False,'operationalIdentity':'unavailable','cryptographicSignatureVerifiedHere':False}

