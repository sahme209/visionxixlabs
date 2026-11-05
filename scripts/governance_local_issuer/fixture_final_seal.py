"""Bounded structural v3 seal observation; no codesign or cryptographic executor."""
from pathlib import Path
import hashlib,json,os,plistlib,re,stat,struct
from . import fixture_container_assembly as assembly,fixture_container_preparation as fp,container_preparation as cp,container_assembly as old,system_preparation as prep,manifest
MAIN='Contents/MacOS/'+cp.MAIN_NAME
CAP=65536
TEAM='FG5N98FE6W'
def _need(value,reason):
 if not value:raise ValueError(reason)
def _layout(data):
 _need(type(data)is bytes and 32<=len(data)<=2*1024*1024,'bounded_thin_main_required')
 magic,cpu,sub,filetype,count,size,flags,reserved=struct.unpack_from('<8I',data)
 _need(magic==0xfeedfacf and cpu==0x100000c and sub==0 and filetype==2 and reserved==0 and 0<count<=128 and 0<size<=65536 and 32+size<=len(data),'thin_arm64_execute_header_required')
 at=32;segments={};signature=None;ranges=[]
 for _ in range(count):
  _need(at+8<=32+size,'main_command_header_bounds');kind,length=struct.unpack_from('<II',data,at)
  _need(length>=8 and length%8==0 and at+length<=32+size,'main_command_extent')
  if kind==0x19:
   _need(length>=72,'main_segment_command_bounds');name=data[at+8:at+24].split(b'\0',1)[0];vm,vs,fo,fs,mp,ip,nsects,sflags=struct.unpack_from('<QQQQIIII',data,at+24)
   _need(length==72+80*nsects and name not in segments and fo<=len(data)and fs<=len(data)-fo,'main_segment_bounds_or_duplicate');segments[name]=(at,vm,vs,fo,fs)
   if fs:ranges.append((fo,fo+fs))
  if kind==0x1d:
   _need(length==16 and signature is None,'unique_signature_command_required');offset,extent=struct.unpack_from('<II',data,at+8);signature=(at,offset,extent)
  at+=length
 _need(at==32+size and signature is not None and b'__TEXT'in segments and b'__LINKEDIT'in segments,'complete_main_load_commands_required')
 end=0
 for start,stop in sorted(ranges):_need(start>=end,'overlapping_main_segments');end=stop
 text=segments[b'__TEXT'];link=segments[b'__LINKEDIT'];command,offset,extent=signature
 _need(text[3]==0 and 32+size<=text[4]<=offset and link[3]>=text[4]and link[3]<=offset and link[3]+link[4]==len(data)and offset>=32+size and extent>0 and offset+extent==len(data)and link[2]>=link[4],'main_signature_or_linkedit_bounds')
 return {'signatureOffset':offset,'signatureSize':extent,'signatureSizeField':command+12,'linkeditVmSizeField':link[0]+32,'linkeditFileSizeField':link[0]+48,'linkeditFileOffset':link[3],'textOffset':text[3],'textSize':text[4]}
def _profile(data,layout):
 CS_START=layout['signatureOffset']
 tail=data[CS_START:];_need(len(tail)>=12,'signature_container_required');magic,total,count=struct.unpack_from('>III',tail)
 _need(magic==0xfade0cc0 and 0<count<=5 and 12+8*count<=total<=len(tail)and not any(tail[total:]),'bounded_signature_superblob_required')
 blobs={};ranges=[];magics={0:0xfade0c02,2:0xfade0c01,5:0xfade7171,7:0xfade7172,65536:0xfade0b01}
 for n in range(count):
  slot,offset=struct.unpack_from('>II',tail,12+8*n);_need(slot in magics and slot not in blobs and 12+8*count<=offset<=total-8,'known_signature_slot_required')
  bm,size=struct.unpack_from('>II',tail,offset);_need(bm==magics[slot]and size>=8 and offset+size<=total,'signature_blob_bounds');blobs[slot]=tail[offset:offset+size];ranges.append((offset,offset+size))
 end=12+8*count
 for start,stop in sorted(ranges):_need(start>=end and not any(tail[end:start]),'signature_blob_overlap_or_gap');end=stop
 _need(end==total,'signature_blob_extent')
 encoded=set(blobs)=={0,2,5,7,65536};absent=set(blobs)=={0,2,65536};_need(encoded or absent,'known_execute_entitlement_slots_required')
 if encoded:_need(plistlib.loads(blobs[5][8:])=={}and blobs[7][8:]==bytes.fromhex('7005020101b000'),'exact_empty_execute_entitlements_required')
 cd=blobs[0];_need(len(cd)>=96,'bounded_execute_directory_required')
 _,declared,version,flags,hashoff,identoff,special,codes,limit,hs,ht,platform,shift,spare=struct.unpack_from('>9I4BI',cd)
 _need((declared,version,flags,identoff,special,codes,limit,hs,ht,platform,shift,spare)==(len(cd),0x20500,0x10000,96,7 if encoded else 3,(CS_START+16383)//16384,CS_START,32,2,0,14,0),'known_execute_runtime_directory_required')
 scatter,teamoff,spare3,limit64=struct.unpack_from('>IIIQ',cd,44);base,size,execflags,runtime,preencrypt=struct.unpack_from('>QQQII',cd,64)
 _need((scatter,spare3,limit64,base,size,execflags,preencrypt)==(0,0,0,layout['textOffset'],layout['textSize'],1,0)and runtime>0,'known_execute_segment_directory_required')
 ident=cp.MAIN_IDENTIFIER.encode()+b'\0';team=b'FG5N98FE6W\0';_need(teamoff==96+len(ident)and hashoff-special*32==teamoff+len(team)and hashoff+codes*32==len(cd)and cd[96:teamoff]==ident and cd[teamoff:hashoff-special*32]==team,'exact_execute_directory_identity_required')
 return {'identifier':cp.MAIN_IDENTIFIER,'team':'FG5N98FE6W','cdhash':hashlib.sha256(cd).hexdigest()[:40],'entitlementsRepresentation':'encoded_empty'if encoded else'structurally_absent','cryptographicSignatureVerifiedHere':False}
def validate_fixture_main_change(before,after):
 layout=_layout(before);current=_layout(after);start=layout['signatureOffset']
 _need(start==current['signatureOffset']and start<len(after)<=start+1024*1024,'bounded_stable_signature_offset_required')
 _need(all(layout[k]==current[k]for k in ('signatureSizeField','linkeditVmSizeField','linkeditFileSizeField','linkeditFileOffset','textOffset','textSize')),'main_command_layout_changed')
 left=bytearray(before[:start]);right=bytearray(after[:start])
 for field,n in ((layout['signatureSizeField'],4),(layout['linkeditVmSizeField'],8),(layout['linkeditFileSizeField'],8)):left[field:field+n]=bytes(n);right[field:field+n]=bytes(n)
 _need(left==right,'main_non_signature_bytes_changed')
 file_size=len(after)-layout['linkeditFileOffset'];_need(struct.unpack_from('<Q',after,layout['linkeditFileSizeField'])[0]==file_size and struct.unpack_from('<Q',after,layout['linkeditVmSizeField'])[0]==((file_size+16383)//16384)*16384 and current['signatureSize']==len(after)-start,'derived_main_signature_extent_required')
 return _profile(after,layout)
def _main_bytes(path):
 data,_=prep._snapshot(Path(path),2*1024*1024);return data
def _metadata(path):
 before=Path(path).lstat();bound=old.binding(path);after=Path(path).lstat();fields=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
 _need(all(getattr(before,k)==getattr(after,k)for k in fields),'fixture_seal_metadata_changed')
 return {**bound,'uid':before.st_uid,'gid':before.st_gid,'nlink':before.st_nlink,'dev':before.st_dev,'ino':before.st_ino,'mtimeNs':before.st_mtime_ns,'ctimeNs':before.st_ctime_ns}
def _directory(path):
 info=path.lstat();return {'uid':info.st_uid,'gid':info.st_gid,'mode':stat.S_IMODE(info.st_mode),'dev':info.st_dev,'ino':info.st_ino}
def _outside(output,destination):
 output=cp._private(Path(output));_need(output!=destination and destination not in output.parents and output not in destination.parents,'fixture_seal_records_outside_target_required');return output
def capture_fixture_seal_baseline(destination,output):
 destination=cp._private(Path(destination));output=_outside(output,destination);r=assembly.verify_fixture_assembly(destination);app=destination/'Axiom Synthetic Custodian.app';main=app/MAIN;before=_main_bytes(main);_layout(before)
 _need(hashlib.sha256(before).hexdigest()==r['mainCopy']['sha256']and len(before)==r['mainCopy']['size'],'fixture_main_compile_binding_required')
 prep._write(output/'main-before.bin',before);prep._write(output/'empty-entitlements.plist',plistlib.dumps({},sort_keys=True))
 files={name:_metadata(destination/name)for name in r['files']};directories={'.':_directory(destination)}
 for path in destination.rglob('*'):
  if path.is_dir():directories[path.relative_to(destination).as_posix()]=_directory(path)
 result={'format':'axiom.fixture-seal-baseline/1','profile':fp.PROFILE,'destination':str(destination),'presealReceipt':old.binding(destination/assembly.RECEIPT),'inputPacket':r['inputPacket'],'files':files,'directories':directories,'mainBefore':old.binding(output/'main-before.bin'),'emptyInput':old.binding(output/'empty-entitlements.plist'),'executionAuthorized':False,'runtimeIdentityQualified':False}
 prep._write(output/'fixture-seal-baseline.json',manifest.canonical(result)+b'\n');return old.binding(output/'fixture-seal-baseline.json')
def fixture_seal_commands(baseline):
 b=old._json_bound(baseline);app=Path(b['destination'])/'Axiom Synthetic Custodian.app'
 return {'sign':['/usr/bin/codesign','--force','--sign','4C2E59F247CA275001586AE020A9269464529452','--identifier',cp.MAIN_IDENTIFIER,'--options','runtime','--entitlements',b['emptyInput']['path'],'--timestamp=none',str(app)],'verify':['/usr/bin/codesign','--verify','--strict','--verbose=2',str(app)],'display':['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',str(app)]}
def _tool_records(records,baseline,main,profile):
 _need(type(records)is dict and set(records)=={'sign','verify','display'},'exact_fixture_seal_records_required');outputs={};commands=fixture_seal_commands(baseline)
 for kind,bound in records.items():
  record=old._json_bound(bound);_need(record.get('format')=='axiom.fixture-seal-command/1'and record.get('kind')==kind and record.get('argv')==commands[kind]and record.get('state')=='completed'and type(record.get('exit'))is int and record['exit']==0 and record.get('cleanup')=='reaped_original_child'and record.get('errorType')is None,'successful_fixed_fixture_tool_required')
  _need(record.get('baselineSha256')==baseline['sha256']and record.get('targetAfter')==main,'fixture_tool_baseline_target_join_required');streams=[]
  for name in ('stdout','stderr'):
   item=record[name];_need(type(item.get('size'))is int and 0<=item['size']<=CAP,'fixture_tool_output_bound');data,snapshot=prep._snapshot(Path(item['path']),CAP);_need(all(snapshot[k]==item[k]for k in ('sha256','size','mode')),'fixture_tool_output_changed');streams.append(data)
  _need(sum(map(len,streams))<=CAP,'fixture_tool_output_bound');outputs[kind]=streams
 out,err=outputs['display'];text=err.decode('utf8')
 for key,value in [('Identifier',cp.MAIN_IDENTIFIER),('TeamIdentifier',TEAM),('CDHash',profile['cdhash'])]:_need(re.findall('^'+key+'=(.*)$',text,re.M)==[value],'fixture_seal_display_identity_mismatch')
 _need(re.findall(r'^CodeDirectory .*flags=0x([a-f0-9]+)\(runtime\)',text,re.M)==['10000'],'fixture_seal_display_runtime_mismatch')
 if profile['entitlementsRepresentation']=='encoded_empty':_need(bool(out)and type(plistlib.loads(out))is dict and not plistlib.loads(out),'fixture_seal_display_empty_entitlements_required')
 else:_need(out==b''or(type(plistlib.loads(out))is dict and not plistlib.loads(out)),'fixture_seal_display_absence_mismatch')
def validate_fixture_postseal(baseline,records,output):
 b=old._json_bound(baseline);_need(set(b)=={'format','profile','destination','presealReceipt','inputPacket','files','directories','mainBefore','emptyInput','executionAuthorized','runtimeIdentityQualified'}and b['format']=='axiom.fixture-seal-baseline/1'and b['profile']==fp.PROFILE and b['executionAuthorized']is False and b['runtimeIdentityQualified']is False,'fixed_fixture_seal_baseline_required')
 destination=cp._private(Path(b['destination']));output=_outside(output,destination);pre=old._json_bound(b['presealReceipt']);inputs=assembly._inputs(b['inputPacket']['path']);expected=assembly._derived(inputs,destination,False)
 _need(pre==expected and pre['inputPacket']==b['inputPacket']and b['presealReceipt']['path']==str(destination/assembly.RECEIPT),'fixture_seal_prestate_join_required')
 _need(set(b['files'])==set(expected['files']),'fixture_seal_baseline_inventory_mismatch')
 for name,bound in expected['files'].items():_need(all(b['files'][name][k]==bound[k]for k in ('path','sha256','size','mode')),'fixture_seal_baseline_source_mismatch')
 main_name='Axiom Synthetic Custodian.app/'+MAIN;_need(b['mainBefore']['sha256']==pre['mainCopy']['sha256']and b['mainBefore']['size']==pre['mainCopy']['size'],'fixture_before_compile_binding_required');before_bound=old._bound(b['mainBefore']);before=_main_bytes(before_bound['path'])
 signature_dir='Axiom Synthetic Custodian.app/Contents/_CodeSignature';resource=signature_dir+'/CodeResources';files={};directories={'.':_directory(destination)}
 for path in destination.rglob('*'):
  name=path.relative_to(destination).as_posix();info=path.lstat();_need(not path.is_symlink()and info.st_uid==os.getuid(),'fixture_seal_alias_or_owner')
  if stat.S_ISDIR(info.st_mode):directories[name]=_directory(path)
  else:_need(stat.S_ISREG(info.st_mode)and info.st_nlink==1,'fixture_seal_special_or_hardlink');files[name]=_metadata(path)
 _need(set(files)==set(expected['files'])|{assembly.RECEIPT,resource}and set(directories)==set(b['directories'])|{signature_dir},'fixture_seal_output_inventory_mismatch')
 for name,prior in b['directories'].items():_need(directories[name]==prior,'fixture_seal_directory_metadata_changed')
 _need(directories[signature_dir]['mode']in(0o700,0o755)and directories[signature_dir]['gid']==b['directories']['Axiom Synthetic Custodian.app']['gid'],'fixture_seal_signature_directory_mode')
 for name in expected['files']:
  if name!=main_name:_need(files[name]==b['files'][name],'fixture_authoritative_resource_or_external_node_changed')
 _need(all(files[main_name][key]==b['files'][main_name][key]for key in ('uid','gid','mode','nlink')),'fixture_main_identity_changed');after=_main_bytes(destination/main_name);profile=validate_fixture_main_change(before,after)
 resource_info=files[resource];_need(resource_info['mode']in(0o600,0o644)and resource_info['size']<=1024*1024 and resource_info['gid']==b['directories']['Axiom Synthetic Custodian.app']['gid'],'fixture_code_resources_bound');raw,_=prep._snapshot(destination/resource,1024*1024);_need(type(plistlib.loads(raw))is dict and bool(plistlib.loads(raw)),'fixture_code_resources_plist_required')
 empty=old._bound(b['emptyInput']);empty_data,_=prep._snapshot(Path(empty['path']),16384);_need(type(plistlib.loads(empty_data))is dict and not plistlib.loads(empty_data),'fixture_empty_input_required')
 main={key:files[main_name][key]for key in ('path','sha256','size','mode')};_tool_records(records,baseline,main,profile);_need(old.binding(destination/assembly.RECEIPT)==b['presealReceipt'],'fixture_preseal_receipt_changed')
 result={'format':'axiom.fixture-postseal-observation/1','baseline':baseline,'presealReceipt':b['presealReceipt'],'files':files,'mainProfile':profile,'strictStaticVerificationObserved':True,'allowedMutationScopeVerified':True,'cryptographicVerificationPerformedHere':False,'evidenceKind':'recorded_exact_tool_results','executionAuthorized':False,'installationReady':False,'runtimeIdentityQualified':False,'activationAllowed':False}
 prep._write(output/'fixture-postseal.json',manifest.canonical(result)+b'\n');return result
