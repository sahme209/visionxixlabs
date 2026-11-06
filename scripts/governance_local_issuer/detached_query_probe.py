"""One approved detached signing/load bundle. No issuer or production authority."""
from pathlib import Path
import hashlib,json,os,plistlib,re,stat,sys
if __package__ in (None,''):sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from governance_local_issuer import runtime_query_probe as p,query_derivative as diff
ROOT=p.BASE/'2026-11-06-detached-query-compat-1'
COPY=ROOT/'query-review-copy.node'
IDENT='com.visionxixlabs.axiom.synthetic-query'
KEY='4C2E59F247CA275001586AE020A9269464529452'
SCRIPT=p.SCRIPT.replace(json.dumps(str(p.QUERY)).encode(),json.dumps(str(COPY)).encode())
ENT=plistlib.dumps({},fmt=plistlib.FMT_XML)
def commands():return [
 ['/usr/bin/codesign','--force','--sign',KEY,'--identifier',IDENT,'--options','runtime','--entitlements',str(ROOT/'empty.plist'),'--timestamp=none',str(COPY)],
 ['/usr/bin/codesign','--verify','--strict','--verbose=2',str(COPY)],
 ['/usr/bin/codesign','--display','--verbose=4','--entitlements',':-',str(COPY)]]
def sources():return list(dict.fromkeys(p.source_paths()+[Path(__file__).resolve(),Path(diff.__file__).resolve()]))
def check_file(path,sha=None):
 b=p.binding(path)
 diff.need(b['state'][2]==os.getuid()and b['state'][4]==1 and b['mode']==0o600,'owned_private_file')
 if sha:diff.need(b['sha256']==sha,'pinned_hash')
 return b
def prepare():
 diff.need(not ROOT.exists(),'fresh_directory')
 p.private(p.NODE.parent);node=check_file(p.NODE,p.NODE_SHA);query=check_file(p.QUERY,p.QUERY_SHA)
 original=p.binding(p.ORIGINAL);diff.need(original['sha256']==p.ORIGINAL_SHA,'original_node')
 ROOT.mkdir(mode=0o700)
 for sub in ('work','work/home','work/tmp'):(ROOT/sub).mkdir(mode=0o700)
 raw=p.QUERY.read_bytes();diff.layout(raw)
 for name,data in [('query-review-copy.node',raw),('fixture.cjs',SCRIPT),('empty.plist',ENT)]:
  with p.exclusive(ROOT/name)as f:f.write(data)
 packet={'format':'axiom.detached-query-compat/1','node':node,'query':query,'originalNode':original,'copy':check_file(COPY,p.QUERY_SHA),'script':check_file(ROOT/'fixture.cjs'),'entitlements':check_file(ROOT/'empty.plist'),'sources':{str(x):p.binding(x)for x in sources()},'device':p.device(),'commands':commands(),'seconds':10,'cleanupSeconds':5,'cap':p.CAP,'governanceQualified':False}
 p.save(ROOT/'packet.json',packet);verify(packet);return p.binding(ROOT/'packet.json')
def verify(packet,node_after=None,copy_after=None):
 diff.need(set(packet)=={'format','node','query','originalNode','copy','script','entitlements','sources','device','commands','seconds','cleanupSeconds','cap','governanceQualified'},'packet_fields')
 diff.need(packet['format']=='axiom.detached-query-compat/1'and packet['commands']==commands()and(packet['seconds'],packet['cleanupSeconds'],packet['cap'],packet['governanceQualified'])==(10,5,p.CAP,False),'fixed_packet')
 for directory in (ROOT,ROOT/'work',ROOT/'work/home',ROOT/'work/tmp',p.NODE.parent):p.private(directory)
 fixed={'node':p.NODE,'query':p.QUERY,'originalNode':p.ORIGINAL,'copy':COPY,'script':ROOT/'fixture.cjs','entitlements':ROOT/'empty.plist'}
 for k,path in fixed.items():
  want=node_after if k=='node'and node_after is not None else copy_after if k=='copy'and copy_after is not None else packet[k]
  diff.need(want['path']==str(path)and p.binding(path)==want,'input_changed_'+k)
 for k,sha in [('node',p.NODE_SHA),('query',p.QUERY_SHA),('originalNode',p.ORIGINAL_SHA),('copy',p.QUERY_SHA),('script',hashlib.sha256(SCRIPT).hexdigest()),('entitlements',hashlib.sha256(ENT).hexdigest())]:diff.need(packet[k]['sha256']==sha,'fixed_input_hash')
 diff.need(packet['device']==p.device()and set(packet['sources'])=={str(x)for x in sources()},'fixed_sources_device')
 for name,b in packet['sources'].items():diff.need(p.binding(name)==b,'source_changed')
def command(argv,index):
 logpath=ROOT/'work'/('command-'+str(index)+'.log')
 env={'PATH':'/usr/bin:/bin','HOME':str(ROOT/'work/home'),'TMPDIR':str(ROOT/'work/tmp'),'LANG':'C','TZ':'UTC'}
 with p.exclusive(logpath)as log:code,error=p.files.engine_tools._run_generation_child(argv,ROOT/'work',env,log,10,file_size_limit=p.CAP,creation_mask=0o077)
 result={'exit':code,'error':error,'bytes':logpath.stat().st_size}
 p.save(ROOT/('command-'+str(index)+'.json'),result)
 return result
def validate_signed(packet):
 text=(ROOT/'work/command-2.log').read_text()
 diff.need(re.findall(r'^Identifier=(.*)$',text,re.M)==[IDENT]and re.findall(r'^TeamIdentifier=(.*)$',text,re.M)==['FG5N98FE6W'],'signed_identity')
 diff.need(re.findall(r'flags=(0x[0-9a-f]+)\(runtime\)',text)==['0x10000'],'runtime_profile')
 at=text.find('<?xml');diff.need(at>=0,'empty_entitlements_required')
 end=text.find('</plist>',at);diff.need(end>=at,'complete_entitlements')
 diff.need(plistlib.loads(text[at:end+8].encode())=={},'empty_entitlements')
 original=check_file(p.QUERY,p.QUERY_SHA);derived=check_file(COPY)
 r=diff.validate_derivative(p.QUERY.read_bytes(),COPY.read_bytes())
 diff.need(check_file(p.QUERY,p.QUERY_SHA)==original and check_file(COPY)==derived,'comparison_currentness')
 diff.need((r['inputSha256'],r['inputSize'],r['derivedSha256'],r['derivedSize'])==(original['sha256'],original['size'],derived['sha256'],derived['size']),'comparison_binding')
 p.save(ROOT/'derivative.json',r);return derived
def load_once(packet):
 def child(_):
  q=json.dumps;work=ROOT/'work'
  policy='(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+q(str(work))+'))(allow file-write-data (literal "/dev/null"))'
  r=command(['/usr/bin/sandbox-exec','-p',policy,str(p.NODE),str(ROOT/'fixture.cjs')],'load')
  return p.classify(r['exit'],r['error'],(work/'command-load.log').read_bytes())
 return p.run_candidate(packet,child=child)
def sign_and_load(packet):
 for index,argv in enumerate(commands()):
  r=command(argv,index)
  diff.need(r['exit']==0 and r['error']is None and r['bytes']<p.CAP,'signing_or_static_check_refused')
 copy_after=validate_signed(packet);verify(packet,copy_after=copy_after)
 result=load_once(packet);result['derivedCopy']=copy_after
 return result
def execute(path):
 diff.need(Path(path)==ROOT/'packet.json','fixed_packet')
 packet=p.load(path);verify(packet)
 p.save(ROOT/'attempt.json',{'packetSha256':p.binding(path)['sha256'],'invocations':1,'retryAuthorized':False,'status':'reserved'})
 with p.exclusive(ROOT/'result.json')as out:
  r={'status':'unknown','reason':'bundle_unavailable','governanceQualified':False}
  try:r=sign_and_load(packet)
  except BaseException:pass
  try:
   observed=check_file(COPY)
   expected=r.get('derivedCopy',observed)
   verify(packet,node_after=r.get('nodeAfter'),copy_after=expected)
   diff.need(observed==expected,'postload_copy_changed')
   r['finalInputCurrentness']='verified'
   if 'derivedCopy'not in r:r['unqualifiedCopyAfter']=observed
  except BaseException:r.update(status='unknown',finalInputCurrentness='unavailable')
  out.write(p.encoded(r));out.flush();os.fsync(out.fileno())
 return r
