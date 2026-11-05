from pathlib import Path
import base64,hashlib,json,os,selectors,signal,subprocess,time
def valid_report(report):
 expected={'scope':'compiled userland POST ordinary isolated test, not Next HTTP server or native issuer qualification','sourceRevision':'201f5e77e70ba261e57958247f77a0fe23567824','records':[{'label':label,'status':503,'code':'ai.public_admission_unavailable'} for label in ['valid','malformed','claims']],'rateLimit':{'initialRefusals':10,'eleventhStatus':429},'network':'kernel denied','credentials':'absent','runtimeQualification':'unavailable','executionAuthorized':False}
 return isinstance(report,dict) and report.get('executionAuthorized') is False and report==expected

def main():
 ROOT=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-04/compiled-public-assistant-smoke')
 NODE='/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node'
 STAGE='/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds/axiom-security-containment-build-201f5e77-emidm655/stage'
 cmd=['/usr/bin/sandbox-exec','-f',str(ROOT/'smoke.sb'),NODE,'--no-experimental-webstorage',str(ROOT/'smoke.mjs')]
 env={'PATH':'/usr/bin:/bin','NODE_ENV':'production','NODE_OPTIONS':'--no-experimental-webstorage','HOME':'/nonexistent','TMPDIR':'/nonexistent','TZ':'UTC','NO_COLOR':'1'}
 pins={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in ['smoke.mjs','smoke.sb','input-pins.json']}
 expected={'smoke.mjs':'b84b5dfb01611d1c97f1663ee353b51a502abae1e5c9700ef6e4ee31316d1703','input-pins.json':'86a9ac5c3ed5ad5ead8b1a5d17dd55b4ee9d204f2f3f3c338a7809a08362fce7','smoke.sb':'d9a8bea93dac8e0bc3ab87c5d845ae03899f1e87b2f6e2498b3ca99a2fc961bc'}
 if pins!=expected:raise SystemExit('prepared input drift; not executed')
 started=time.monotonic();p=subprocess.Popen(cmd,cwd=STAGE,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
 output=bytearray();reason=None
 while sel.get_map():
  if time.monotonic()-started>20:reason='timeout';break
  for key,_ in sel.select(0.1):
   chunk=os.read(key.fd,min(8192,262145-len(output)))
   if not chunk:sel.unregister(key.fileobj);continue
   output.extend(chunk)
   if len(output)>262144:reason='output_cap';break
  if reason:break
 sel.close()
 if reason:
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
 try:p.wait(timeout=max(0.1,20-(time.monotonic()-started)))
 except subprocess.TimeoutExpired:
  reason='timeout'
  try:os.killpg(p.pid,signal.SIGKILL)
  except ProcessLookupError:pass
  p.wait(timeout=2)
 p.stdout.close()
 text=output.decode('utf-8',errors='replace');report=None
 if p.returncode==0 and reason is None:
  try:report=json.loads(text.strip().splitlines()[-1])
  except (ValueError,IndexError):reason='missing_json_report'
  if not valid_report(report):reason='invalid_report'
 result={'command':cmd,'inputSha256':pins,'exitCode':p.returncode,'stopReason':reason,'elapsedSeconds':round(time.monotonic()-started,3),'outputBytes':len(output),'processReaped':True,'processBounds':'owned child process group only; descendant quiescence unqualified','report':report,'success':p.returncode==0 and reason is None and report is not None}
 (ROOT/'output.log.json').write_text(json.dumps({'encoding':'base64','bytes':base64.b64encode(output).decode('ascii'),'textPreview':text},indent=2)+'\n')
 (ROOT/'result.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))

if __name__=='__main__':main()
