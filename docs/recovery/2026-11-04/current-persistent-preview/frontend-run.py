from pathlib import Path
import subprocess,json,time,os,signal
repo=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion');o=Path(__file__).parent;r=repo/'docs/recovery/2026-11-04/current-persistent-preview';c=json.loads((r/'frontend-coordinates.json').read_text())
env={'HOME':str(o/'home'),'TMPDIR':str(o/'tmp'),'PATH':'/usr/bin:/bin','CI':'1','NO_COLOR':'1'}
t=time.monotonic();p=subprocess.Popen(c['command'],cwd=c['cwd'],env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True);expired=False
try:out,_=p.communicate(timeout=120)
except subprocess.TimeoutExpired:expired=True;os.killpg(p.pid,signal.SIGKILL);out,_=p.communicate()
(r/'frontend.log').write_text(out);(r/'frontend-result.json').write_text(json.dumps({'exitCode':p.returncode,'timedOut':expired,'elapsedSeconds':round(time.monotonic()-t,3),'processReaped':True},indent=2)+'\n');print(out[-3500:]);print('exit',p.returncode)
