"""Reconcile saved signed bytes, then one explicitly approved load; no key use."""
from pathlib import Path
import hashlib,json,os,re
from governance_local_issuer import runtime_query_probe as p,query_derivative as diff,saved_profile_observation as profile
ROOT=p.BASE/'2026-11-06-signed-query-load-1'
SIGN_ROOT=p.BASE/'2026-11-06-detached-query-compat-3'
COPY=SIGN_ROOT/'query-review-copy.node'
SHA='d9113d36ac4cfea42e5a0e329d70160b7bb5559b4cbcbd32b233bf7715d884f2'
PRIOR_PACKET='d28c2eb9d2b68fab262119293ac0f463188db7ad18e935901aef71bafcf79064'
IDENT='com.visionxixlabs.axiom.synthetic-query'
SCRIPT=p.SCRIPT.replace(json.dumps(str(p.QUERY)).encode(),json.dumps(str(COPY)).encode())
def source_paths():return list(dict.fromkeys(p.source_paths()+[Path(__file__).resolve(),Path(diff.__file__).resolve(),Path(profile.__file__).resolve()]))
def record_paths():return [SIGN_ROOT/name for name in ('packet.json','attempt.json','authorization.json','result.json','command-0.json','command-1.json','command-2.json','work/command-0.log','work/command-1.log','work/command-2.log')]
def reconcile():
 records={str(x):p.binding(x)for x in record_paths()}
 diff.need(records[str(SIGN_ROOT/'packet.json')]['sha256']==PRIOR_PACKET,'prior_packet')
 diff.need(p.load(SIGN_ROOT/'attempt.json')['packetSha256']==PRIOR_PACKET,'prior_attempt')
 for n in range(3):
  record=p.load(SIGN_ROOT/('command-'+str(n)+'.json'));log=SIGN_ROOT/('work/command-'+str(n)+'.log')
  diff.need(record['exit']==0 and record['error']is None and record['bytes']==log.stat().st_size and record['bytes']<p.CAP,'saved_static_command')
 before=p.binding(p.QUERY);copy=p.binding(COPY)
 diff.need(before['sha256']==p.QUERY_SHA and copy['sha256']==SHA and copy['mode']==0o600 and copy['state'][2]==os.getuid()and copy['state'][4]==1,'fixed_query_inputs')
 diff.need(p.load(SIGN_ROOT/'result.json')['unqualifiedCopyAfter']==copy,'signed_result_binding')
 source=p.QUERY.read_bytes();signed=COPY.read_bytes()
 derivative=diff.validate_derivative(source,signed)
 observed=profile.inspect_library_no_entitlements(signed,IDENT,'FG5N98FE6W',original=source)
 diff.need((derivative['inputSha256'],derivative['derivedSha256'])==(before['sha256'],copy['sha256']),'compared_bytes')
 text=(SIGN_ROOT/'work/command-2.log').read_text()
 diff.need(re.findall(r'^Identifier=(.*)$',text,re.M)==[IDENT]and re.findall(r'^TeamIdentifier=(.*)$',text,re.M)==['FG5N98FE6W']and re.findall(r'^CDHash=(.*)$',text,re.M)==[observed['cdhash']],'saved_identity_cdhash')
 diff.need(p.binding(p.QUERY)==before and p.binding(COPY)==copy,'comparison_currentness')
 diff.need(all(p.binding(name)==b for name,b in records.items()),'saved_evidence_changed')
 return {'profile':observed,'derivative':derivative,'copy':copy,'records':records,'historicalResultRewritten':False,'governanceQualified':False}
def prepare():
 diff.need(not ROOT.exists(),'fresh_load_root');observed=reconcile()
 ROOT.mkdir(mode=0o700)
 for sub in ('work','work/home','work/tmp'):(ROOT/sub).mkdir(mode=0o700)
 with p.exclusive(ROOT/'fixture.cjs')as f:f.write(SCRIPT)
 packet={'format':'axiom.saved-query-load/1','node':p.binding(p.NODE),'query':p.binding(p.QUERY),'originalNode':p.binding(p.ORIGINAL),'copy':observed['copy'],'script':p.binding(ROOT/'fixture.cjs'),'records':observed['records'],'sources':{str(x):p.binding(x)for x in source_paths()},'device':p.device(),'seconds':10,'cleanupSeconds':5,'cap':p.CAP,'governanceQualified':False}
 p.save(ROOT/'reconciliation.json',observed);packet['reconciliation']=p.binding(ROOT/'reconciliation.json')
 p.save(ROOT/'packet.json',packet);verify(packet);return p.binding(ROOT/'packet.json')
def verify(packet,after=None):
 diff.need(set(packet)=={'format','node','query','originalNode','copy','script','records','sources','device','seconds','cleanupSeconds','cap','governanceQualified','reconciliation'},'packet_fields')
 diff.need(packet['format']=='axiom.saved-query-load/1'and(packet['seconds'],packet['cleanupSeconds'],packet['cap'],packet['governanceQualified'])==(10,5,p.CAP,False),'fixed_packet')
 for directory in (ROOT,ROOT/'work',ROOT/'work/home',ROOT/'work/tmp',p.NODE.parent,SIGN_ROOT):p.private(directory)
 for key,path,sha in (('node',p.NODE,p.NODE_SHA),('query',p.QUERY,p.QUERY_SHA),('originalNode',p.ORIGINAL,p.ORIGINAL_SHA),('copy',COPY,SHA),('script',ROOT/'fixture.cjs',hashlib.sha256(SCRIPT).hexdigest())):
  want=packet[key];diff.need(want['path']==str(path)and want['sha256']==sha,'pinned_input')
  now=p.binding(path)
  if key=='node'and after is not None:diff.need(now==after and p.same_candidate(now,want,0o600),'node_restoration')
  else:diff.need(now==want,'input_changed')
 diff.need(packet['node']['mode']==0o600 and packet['node']['state'][2]==os.getuid()and packet['node']['state'][4]==1,'node_owner_mode')
 diff.need(packet['device']==p.device()and set(packet['sources'])=={str(x)for x in source_paths()}and set(packet['records'])=={str(x)for x in record_paths()},'fixed_dependencies')
 for name,b in {**packet['sources'],**packet['records']}.items():diff.need(b['path']==name and p.binding(name)==b,'dependency_changed')
 proof=packet['reconciliation'];diff.need(proof['path']==str(ROOT/'reconciliation.json')and p.binding(proof['path'])==proof,'reconciliation_changed')
 diff.need(p.load(proof['path'])==reconcile(),'reconciliation_mismatch')
def child(_):
 work=ROOT/'work';q=json.dumps
 policy='(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+q(str(work))+'))(allow file-write-data (literal "/dev/null"))'
 env={'PATH':'/usr/bin:/bin','HOME':str(work/'home'),'TMPDIR':str(work/'tmp'),'LANG':'C','TZ':'UTC'}
 with p.exclusive(work/'output.log')as log:code,error=p.files.engine_tools._run_generation_child(['/usr/bin/sandbox-exec','-p',policy,str(p.NODE),str(ROOT/'fixture.cjs')],work,env,log,10,file_size_limit=p.CAP,creation_mask=0o077)
 return p.classify(code,error,(work/'output.log').read_bytes())
def execute(path):
 diff.need(Path(path)==ROOT/'packet.json','fixed_packet');packet=p.load(path);verify(packet)
 p.save(ROOT/'attempt.json',{'packetSha256':p.binding(path)['sha256'],'invocations':1,'retryAuthorized':False,'status':'reserved'})
 with p.exclusive(ROOT/'result.json')as out:
  r=p.run_candidate(packet,child=child)
  try:verify(packet,after=r.get('nodeAfter'));r['finalInputCurrentness']='verified'
  except BaseException:r.update(status='unknown',finalInputCurrentness='unavailable')
  out.write(p.encoded(r));out.flush();os.fsync(out.fileno())
 return r
