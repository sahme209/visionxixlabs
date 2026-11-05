from pathlib import Path
import subprocess,json,time,os,signal
repo=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion');r=repo/'docs/recovery/2026-11-04/current-persistent-preview';c=json.loads((r/'native-coordinates.json').read_text())
t=time.monotonic();p=subprocess.Popen(c['command'],cwd=c['cwd'],env=c['environment'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True);expired=False
try:out,_=p.communicate(timeout=240)
except subprocess.TimeoutExpired:expired=True;os.killpg(p.pid,signal.SIGKILL);out,_=p.communicate()
(r/'native.log').write_text(out);(r/'native-result.json').write_text(json.dumps({'exitCode':p.returncode,'timedOut':expired,'elapsedSeconds':round(time.monotonic()-t,3),'processReaped':True},indent=2)+'\n');print(out[-5000:]);print('exit',p.returncode)
