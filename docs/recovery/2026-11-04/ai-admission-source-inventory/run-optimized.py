from pathlib import Path
import base64,hashlib,json,os,selectors,signal,subprocess,time
ROOT=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion');OUT=ROOT/'docs/recovery/2026-11-04/ai-admission-source-inventory';script=OUT/'inventory.cjs'
if hashlib.sha256(script.read_bytes()).hexdigest()!='fa597e7418f48943743525ff3b44141ccd05b42ef22ffe15d349578763687f45':raise SystemExit('reviewed script drift')
if (OUT/'inventory.json').exists():raise SystemExit('fresh inventory destination required')
cmd=['/usr/bin/sandbox-exec','-f',str(ROOT/'docs/recovery/2026-11-04/compiled-public-assistant-smoke/smoke.sb'),'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node','--max-old-space-size=3072','--no-experimental-webstorage',str(script)]
env={'PATH':'/usr/bin:/bin','HOME':'/nonexistent','TMPDIR':'/nonexistent','NODE_ENV':'test','NODE_DISABLE_COMPILE_CACHE':'1','TZ':'UTC','NO_COLOR':'1'}
t=time.monotonic();p=subprocess.Popen(cmd,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True);sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ,'stdout');sel.register(p.stderr,selectors.EVENT_READ,'stderr');data={'stdout':bytearray(),'stderr':bytearray()};reason=None;cap=16777216
while sel.get_map():
 if time.monotonic()-t>45:reason='timeout';break
 for key,_ in sel.select(0.1):
  total=sum(map(len,data.values()));part=os.read(key.fd,min(8192,cap+1-total))
  if not part:sel.unregister(key.fileobj);continue
  data[key.data].extend(part)
  if sum(map(len,data.values()))>cap:reason='output_cap';break
 if reason:break
sel.close()
if reason:
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
try:p.wait(timeout=max(0.1,45-(time.monotonic()-t)))
except subprocess.TimeoutExpired:
 reason='timeout'
 try:os.killpg(p.pid,signal.SIGKILL)
 except ProcessLookupError:pass
 p.wait(timeout=2)
p.stdout.close();p.stderr.close();report=None
if reason is None and p.returncode==0:
 try:
  report=json.loads(data['stdout']);assert isinstance(report,dict) and report['format']=='axiom.ai-admission-source-inventory/1'
  assert report['rootFileCount']==len(report['sources']) and report['resolvedCallCount']==len(report['resolved']) and report['ambiguousMethodNameCandidateCount']==len(report['ambiguous'])
  assert sum(report['classificationCounts'].values())==len(report['resolved'])
 except (ValueError,KeyError,AssertionError,TypeError):reason='invalid_report'
success=p.returncode==0 and reason is None and report is not None
if success:(OUT/'inventory.json').write_bytes(data['stdout'])
else:(OUT/'optimized-raw-output.json').write_text(json.dumps({'encoding':'base64','bytes':base64.b64encode(data['stdout']).decode('ascii')},indent=2)+'\n')
(OUT/'phase-log.json').write_text(json.dumps({'encoding':'base64','bytes':base64.b64encode(data['stderr']).decode('ascii'),'textPreview':data['stderr'].decode('utf-8',errors='replace')},indent=2)+'\n')
result={'command':cmd,'scriptSha256':hashlib.sha256(script.read_bytes()).hexdigest(),'exitCode':p.returncode,'stopReason':reason,'elapsedSeconds':round(time.monotonic()-t,3),'stdoutBytes':len(data['stdout']),'stderrBytes':len(data['stderr']),'processReaped':True,'success':success,'scope':'same app/lib source and all declaration queries; no app imports/inference/provider/DB/emit'}
(OUT/'optimized-execution.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
if success:print(json.dumps({k:report[k] for k in ['rootFileCount','resolvedCallCount','ambiguousMethodNameCandidateCount','classificationCounts','syntacticDiagnosticCount']}))
