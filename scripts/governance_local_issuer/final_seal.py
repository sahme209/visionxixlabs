"""Fixed container seal preparation/validation. Never grants runtime identity."""
from pathlib import Path
import hashlib,json,os,plistlib,re,stat,struct,selectors,signal,subprocess,time
from . import container_assembly as assembly,container_preparation as cp,system_preparation as prep,manifest
APP=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-real-container-assembly-558f12f1/assembled/Axiom Synthetic Custodian.app')
PRESEAL=APP.parent/'container-assembly.json'
PRESEAL_SHA='53008642e48af49efc0a09cedaa7f63cb71f70050139a5c90f97d502bf5e0cea'
EMPTY=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-05-remaining-leaf-signing-6018e44c/native-empty-entitlements.plist')
EMPTY_SHA='97704a8960b4facceef54397a08fb5d0a456247c3627359215aa2a27df22656c'
KEY='4C2E59F247CA275001586AE020A9269464529452'
MAIN='Contents/MacOS/AxiomSyntheticContainerMain'
MAIN_SHA='b3a4f59e49b2f8a172a9071a16fbcb6c0b829f8eb2cbe53c7ca6d426dbe155d8'
CS_START=16560
CAP=65536
TIMEOUTS={'sign':60,'verify':30,'display':30}
def commands():return {'sign':['/usr/bin/codesign','--force','--sign',KEY,'--identifier',cp.MAIN_IDENTIFIER,'--options','runtime','--entitlements',str(EMPTY),'--timestamp=none',str(APP)],'verify':['/usr/bin/codesign','--verify','--strict','--verbose=2',str(APP)],'display':['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',str(APP)]}

def _need(value,reason):
 if not value:raise ValueError(reason)
def _write(path,value):prep._write(path,manifest.canonical(value)+b'\n')
def _metadata(path):
 before=Path(path).lstat();bound=assembly.binding(path);after=Path(path).lstat()
 fields=('st_dev','st_ino','st_mode','st_nlink','st_uid','st_gid','st_size','st_mtime_ns','st_ctime_ns')
 _need(all(getattr(before,k)==getattr(after,k)for k in fields),'seal_metadata_changed')
 return {**bound,'uid':before.st_uid,'gid':before.st_gid,'nlink':before.st_nlink,'dev':before.st_dev,'ino':before.st_ino,'mtimeNs':before.st_mtime_ns,'ctimeNs':before.st_ctime_ns}
def _read_main(path):
 data,_=prep._snapshot(Path(path),CS_START+1024*1024);return data
def capture_baseline(output):
 output=cp._private(Path(output));_need(output!=APP and APP not in output.parents and output not in APP.parents,'seal_records_outside_target_required');_need(not(output/'baseline.json').exists(),'fresh_seal_baseline_required')
 receipt=assembly.binding(PRESEAL);_need(receipt['sha256']==PRESEAL_SHA,'fixed_preseal_receipt_required');pre=assembly.verify_assembly(APP.parent)
 data=_read_main(APP/MAIN);_need(hashlib.sha256(data).hexdigest()==MAIN_SHA and len(data)==16856,'fixed_original_main_required')
 empty_data,empty_meta=prep._snapshot(EMPTY,CAP);empty={'path':str(EMPTY),'sha256':empty_meta['sha256'],'size':empty_meta['size'],'mode':empty_meta['mode']};_need(empty['sha256']==EMPTY_SHA,'fixed_empty_entitlements_required');_need(type(plistlib.loads(empty_data))is dict and not plistlib.loads(empty_data),'empty_entitlements_required')
 files={str(Path(name).relative_to(APP.name)):_metadata(bound['path'])for name,bound in pre['files'].items()}
 dirs={}
 for path in [APP,*APP.rglob('*')]:
  if path.is_dir():
   x=path.lstat();dirs[path.relative_to(APP).as_posix()]={'uid':x.st_uid,'gid':x.st_gid,'mode':stat.S_IMODE(x.st_mode),'dev':x.st_dev,'ino':x.st_ino}
 prep._write(output/'main-before.bin',data)
 r={'format':'axiom.final-seal-baseline/1','app':str(APP),'presealReceipt':receipt,'emptyInput':empty,'mainBefore':assembly.binding(output/'main-before.bin'),'files':files,'directories':dirs,'executionAuthorized':False,'runtimeIdentityQualified':False}
 _write(output/'baseline.json',r);return assembly.binding(output/'baseline.json')
def _profile(data):
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
 _need((declared,version,flags,identoff,special,codes,limit,hs,ht,platform,shift,spare)==(len(cd),0x20500,0x10000,96,7 if encoded else 3,2,CS_START,32,2,0,14,0),'known_execute_runtime_directory_required')
 scatter,teamoff,spare3,limit64=struct.unpack_from('>IIIQ',cd,44);base,size,execflags,runtime,preencrypt=struct.unpack_from('>QQQII',cd,64)
 _need((scatter,spare3,limit64,base,size,execflags,preencrypt)==(0,0,0,0,16384,1,0)and runtime>0,'known_execute_segment_directory_required')
 ident=cp.MAIN_IDENTIFIER.encode()+b'\0';team=b'FG5N98FE6W\0';_need(teamoff==96+len(ident)and hashoff-special*32==teamoff+len(team)and hashoff+codes*32==len(cd)and cd[96:teamoff]==ident and cd[teamoff:hashoff-special*32]==team,'exact_execute_directory_identity_required')
 return {'identifier':cp.MAIN_IDENTIFIER,'team':'FG5N98FE6W','cdhash':hashlib.sha256(cd).hexdigest()[:40],'entitlementsRepresentation':'encoded_empty'if encoded else'structurally_absent','cryptographicSignatureVerifiedHere':False}
def validate_main_change(before,after):
 _need(type(before)is bytes and hashlib.sha256(before).hexdigest()==MAIN_SHA and len(before)==16856,'fixed_original_main_required')
 _need(type(after)is bytes and CS_START<len(after)<=CS_START+1024*1024,'bounded_postseal_main_required')
 old=bytearray(before[:CS_START]);new=bytearray(after[:CS_START])
 for offset,size in ((368,8),(384,8),(772,4)):old[offset:offset+size]=bytes(size);new[offset:offset+size]=bytes(size)
 _need(old==new,'main_non_signature_bytes_changed')
 _need(struct.unpack_from('<Q',after,384)[0]==len(after)-16384 and struct.unpack_from('<Q',after,368)[0]==((len(after)-16384+16383)//16384)*16384 and struct.unpack_from('<I',after,772)[0]==len(after)-CS_START,'main_signature_extent_mismatch')
 return _profile(after)
def _tool_records(records,baseline,main,profile):
 _need(type(records)is dict and set(records)==set(TIMEOUTS),'exact_three_seal_records_required');outputs={}
 for kind,want in records.items():
  r=assembly._json_bound(want)
  _need(r.get('format')=='axiom.final-seal-command/1'and r.get('kind')==kind and r.get('argv')==commands()[kind]and r.get('state')=='completed'and type(r.get('exit'))is int and r['exit']==0 and r.get('cleanup')=='reaped_original_child'and r.get('errorType')is None,'successful_exact_seal_tool_required')
  _need(r.get('baselineSha256')==baseline['sha256']and r.get('targetAfter')==main,'seal_tool_baseline_target_join_required')
  streams=[]
  for key in ('stdout','stderr'):
   b=r[key];_need(type(b.get('size'))is int and 0<=b['size']<=CAP,'seal_tool_output_bound');data,current=prep._snapshot(Path(b['path']),CAP)
   _need(current['sha256']==b['sha256']and current['size']==b['size']and current['mode']==b['mode'],'seal_tool_output_changed');streams.append(data)
  _need(sum(map(len,streams))<=CAP,'seal_tool_output_bound');outputs[kind]=streams
 out,err=outputs['display'];text=err.decode('utf8')
 for key,value in (('Identifier',cp.MAIN_IDENTIFIER),('TeamIdentifier','FG5N98FE6W'),('CDHash',profile['cdhash'])):_need(re.findall('^'+key+'=(.*)$',text,re.M)==[value],'seal_display_identity_mismatch')
 _need(re.findall(r'^CodeDirectory .*flags=0x([a-f0-9]+)\(runtime\)',text,re.M)==['10000'],'seal_display_runtime_mismatch')
 if profile['entitlementsRepresentation']=='encoded_empty':_need(bool(out)and type(plistlib.loads(out))is dict and not plistlib.loads(out),'seal_display_empty_entitlements_required')
 else:_need(out==b''or(type(plistlib.loads(out))is dict and not plistlib.loads(out)),'seal_display_absence_mismatch')
def validate_postseal(baseline,records,output):
 output=cp._private(Path(output));_need(output!=APP and APP not in output.parents and output not in APP.parents,'seal_records_outside_target_required');b=assembly._json_bound(baseline);pre=assembly._json_bound(b['presealReceipt'])
 _need(b.get('format')=='axiom.final-seal-baseline/1'and b.get('app')==str(APP)and b['presealReceipt']['path']==str(PRESEAL)and b['presealReceipt']['sha256']==PRESEAL_SHA and b.get('executionAuthorized')is False and b.get('runtimeIdentityQualified')is False,'fixed_seal_baseline_required')
 expected={str(Path(name).relative_to(APP.name)):bound for name,bound in pre['files'].items()};_need(set(b['files'])==set(expected),'seal_baseline_inventory_mismatch')
 for name,bound in expected.items():_need(all(b['files'][name][k]==bound[k]for k in ('sha256','size','mode')),'seal_baseline_prestate_mismatch')
 current={};directories={}
 for path in [APP,*APP.rglob('*')]:
  x=path.lstat();_need(not path.is_symlink()and x.st_uid==os.getuid(),'seal_app_alias_or_owner')
  name=path.relative_to(APP).as_posix()
  if stat.S_ISDIR(x.st_mode):directories[name]={'uid':x.st_uid,'gid':x.st_gid,'mode':stat.S_IMODE(x.st_mode),'dev':x.st_dev,'ino':x.st_ino}
  else:_need(stat.S_ISREG(x.st_mode),'seal_special_file');current[name]=_metadata(path)
 _need(set(current)==set(expected)|{'Contents/_CodeSignature/CodeResources'}and set(directories)==set(b['directories'])|{'Contents/_CodeSignature'},'seal_output_inventory_mismatch')
 for name,old in b['directories'].items():_need(directories[name]==old,'seal_directory_metadata_changed')
 _need(directories['Contents/_CodeSignature']['mode']in(0o700,0o755)and directories['Contents/_CodeSignature']['gid']==b['directories']['.']['gid'],'private_code_resources_directory_required')
 for name in expected:
  if name!=MAIN:_need(current[name]==b['files'][name],'authoritative_or_resource_changed')
 _need(current[MAIN]['mode']==b['files'][MAIN]['mode']and current[MAIN]['uid']==b['files'][MAIN]['uid']and current[MAIN]['gid']==b['files'][MAIN]['gid']and current[MAIN]['nlink']==1,'seal_main_permission_changed')
 _need(b['mainBefore'].get('size')==16856 and b['mainBefore'].get('sha256')==MAIN_SHA,'fixed_baseline_main_required')
 before=assembly._bound(b['mainBefore']);data,_=prep._snapshot(Path(before['path']),CS_START+1024*1024);profile=validate_main_change(data,_read_main(APP/MAIN))
 resource=current['Contents/_CodeSignature/CodeResources'];_need(resource['mode']in(0o600,0o644)and resource['gid']==b['directories']['.']['gid']and resource['size']<=1024*1024,'bounded_code_resources_required');raw,_=prep._snapshot(APP/'Contents/_CodeSignature/CodeResources',1024*1024);_need(type(plistlib.loads(raw))is dict and bool(plistlib.loads(raw)),'code_resources_plist_required')
 main={k:current[MAIN][k]for k in ('path','sha256','size','mode')};_tool_records(records,baseline,main,profile)
 _need(assembly.binding(EMPTY)==b['emptyInput']and b['emptyInput']['sha256']==EMPTY_SHA,'empty_input_changed')
 result={'format':'axiom.actual-postseal-observation/1','baseline':baseline,'presealReceipt':b['presealReceipt'],'commands':records,'files':current,'mainProfile':profile,'strictStaticVerificationObserved':True,'allowedMutationScopeVerified':True,'executionAuthorized':False,'installationReady':False,'runtimeIdentityQualified':False,'activationAllowed':False,'custodyQualification':'unavailable'}
 _write(output/'postseal.json',result);return result

def _run(kind):
 _need(kind in TIMEOUTS,'fixed_codesign_command_required');argv=commands()[kind];seconds=TIMEOUTS[kind]
 _need(signal.getsignal(signal.SIGCHLD)==signal.SIG_DFL,'exclusive_image_child_reaping_required')
 p=None;selector=None;data={'stdout':bytearray(),'stderr':bytearray()};state='completed';error=None;start=time.monotonic()
 try:
  p=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','LC_ALL':'C'})
  selector=selectors.DefaultSelector()
  for name,pipe in (('stdout',p.stdout),('stderr',p.stderr)):os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name)
  while selector.get_map():
   if time.monotonic()-start>=seconds:state='timeout';break
   for key,_ in selector.select(.1):
    remaining=CAP-sum(map(len,data.values()));part=os.read(key.fileobj.fileno(),min(4096,remaining+1))
    if not part:selector.unregister(key.fileobj);continue
    data[key.data].extend(part[:remaining])
    if len(part)>remaining:state='output_bound';break
   if state!='completed':break
  if state=='completed':
   try:p.wait(timeout=max(.001,seconds-(time.monotonic()-start)))
   except subprocess.TimeoutExpired:state='timeout'
 except BaseException as exc:state='monitor_or_launch_error';error=type(exc).__name__
 finally:
  if p is not None and p.returncode is None:
   try:p.kill()
   except ProcessLookupError:pass
   except BaseException as exc:error=error or type(exc).__name__
   try:p.wait(timeout=5)
   except BaseException as exc:error=error or type(exc).__name__
  if p is not None:
   for pipe in (p.stdout,p.stderr):
    try:pipe.close()
    except BaseException as exc:error=error or type(exc).__name__
  if selector is not None:
   try:selector.close()
   except BaseException as exc:error=error or type(exc).__name__
 return {'argv':argv,'state':state,'exit':p.returncode if p is not None else None,'stdout':bytes(data['stdout']),'stderr':bytes(data['stderr']),'cleanup':'reaped_original_child'if p is not None and p.returncode is not None else'unknown','errorType':error}

def execute_sequence(baseline,output):
 output=cp._private(Path(output));_need(output!=APP and APP not in output.parents and output not in APP.parents,'seal_records_outside_target_required')
 b=assembly._json_bound(baseline);_need(b['app']==str(APP)and b['presealReceipt']['sha256']==PRESEAL_SHA,'fixed_seal_baseline_required')
 _need(assembly.binding(APP/MAIN)['sha256']==MAIN_SHA,'original_main_changed_before_key_use');records={}
 for kind in ('sign','verify','display'):
  _write(output/(kind+'-attempt.json'),{'kind':kind,'argv':commands()[kind],'baselineSha256':baseline['sha256'],'attempts':1,'retryAuthorized':False,'executionAuthorized':False})
  r=_run(kind)
  record={k:v for k,v in r.items()if k not in ('stdout','stderr')};record.update({'format':'axiom.final-seal-command/1','kind':kind,'baselineSha256':baseline['sha256']})
  for stream in ('stdout','stderr'):
   _need(type(r[stream])is bytes and len(r[stream])<=CAP,'bounded_seal_tool_stream');path=output/(kind+'-'+stream+'.log');prep._write(path,r[stream]);record[stream]=assembly.binding(path)
  try:record['targetAfter']=assembly.binding(APP/MAIN)
  except (ValueError,OSError):record['targetAfter']=None
  path=output/(kind+'-command.json');_write(path,record);records[kind]=assembly.binding(path)
  _need(r.get('state')=='completed'and type(r.get('exit'))is int and r['exit']==0 and r.get('cleanup')=='reaped_original_child'and r.get('errorType')is None,'seal_tool_failed_unknown_no_retry')
 return records
