from pathlib import Path
import json, subprocess, time, os, signal, selectors, base64, hashlib
repo=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
r=repo/'docs/recovery/2026-11-04/ai-provider-support-claims'
o=Path(json.loads((r/'preparation.json').read_text())['ownedDirectory'])
cmd=['/usr/bin/sandbox-exec','-f',str(o/'test.sb'),'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node','--no-experimental-webstorage',str(repo/'node_modules/vitest/vitest.mjs'),'run','--config',str(o/'vitest.config.mjs'),'--configLoader','native']
env={'HOME':str(o/'home'),'TMPDIR':str(o/'tmp'),'PATH':'/usr/bin:/bin','CI':'1','NODE_ENV':'test','NODE_OPTIONS':'--no-experimental-webstorage','NO_COLOR':'1','TZ':'UTC'}
t=time.monotonic();p=subprocess.Popen(cmd,cwd=repo,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);output=bytearray();reason=None
while s.get_map():
    remaining=45-(time.monotonic()-t)
    if remaining<=0: reason='timeout';break
    for key,_ in s.select(min(remaining,.25)):
        block=os.read(key.fileobj.fileno(), min(65536,1048577-len(output)))
        if not block: s.unregister(key.fileobj);continue
        output.extend(block)
        if len(output)>1048576: reason='output_limit';break
    if reason: break
if reason:
    try: os.killpg(p.pid,signal.SIGKILL)
    except ProcessLookupError: pass
p.wait(timeout=5);s.close()
result={'command':cmd,'exitCode':p.returncode,'stopReason':reason,'elapsedSeconds':round(time.monotonic()-t,3),'processReaped':True,'outputBytes':len(output),'outputBase64':base64.b64encode(output).decode(),'testSha256':hashlib.sha256((repo/'lib/validation/__tests__/legacyAiProviderReadiness.test.ts').read_bytes()).hexdigest()}
(r/(os.environ.get('AXIOM_TEST_PHASE','red')+'-execution.json')).write_text(json.dumps(result,indent=2)+'\n');(r/(os.environ.get('AXIOM_TEST_PHASE','red')+'.log')).write_bytes(output)
print(output.decode(errors='replace')[-5000:]);print('EXIT',p.returncode,'STOP',reason)
