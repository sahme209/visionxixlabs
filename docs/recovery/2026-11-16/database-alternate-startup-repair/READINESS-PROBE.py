"""Readiness protocol only; no SQL, application, real credential or Docker action."""
from pathlib import Path
import os,json,subprocess,tempfile,socket,time,signal,shutil,hashlib
HERE=Path(__file__).resolve().parent;PG=Path('/opt/homebrew/opt/postgresql@17/bin');CAP=1048576
root=Path(tempfile.mkdtemp(prefix='axiom-readiness-proof-',dir='/private/tmp'));os.umask(0o077)
env={'PATH':'/usr/bin:/bin','HOME':str(root),'TMPDIR':str(root),'LANG':'C','LC_ALL':'C'}
end=time.monotonic()+30;child=None;records=[];accepted=False;failure=None;clean=True
handlers={s:signal.getsignal(s) for s in (signal.SIGINT,signal.SIGTERM,signal.SIGHUP)}
def cancel(*_):raise RuntimeError('owned_cancelled')
for s in handlers:signal.signal(s,cancel)
def need(ok,code):
 if not ok:raise RuntimeError(code)
def stop():
 global child,clean
 if child is None:return
 if child.poll() is None:
  os.killpg(child.pid,signal.SIGINT)
  try:child.wait(timeout=3)
  except subprocess.TimeoutExpired:
   if child.poll() is None:os.killpg(child.pid,signal.SIGKILL)
   child.wait(timeout=1)
 try:os.killpg(child.pid,0);clean=False;raise RuntimeError('group_not_empty')
 except ProcessLookupError:pass
 child=None
def run(label,args,expected=0):
 need(time.monotonic()<end,'budget');p=root/(label+'.log')
 with p.open('xb') as out:
  proc=subprocess.Popen([str(x) for x in args],env=env,cwd=root,stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
  try:code=proc.wait(timeout=min(10,max(.1,end-time.monotonic())))
  except BaseException:
   if proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=1)
   raise
 need(p.stat().st_size<=CAP,'output_cap');need(code==expected,'phase_'+label)
 records.append({'phase':label,'exit':code,'logSha256':hashlib.sha256(p.read_bytes()).hexdigest()})
def start(label,address,sockets):
 global child
 p=root/(label+'.log');out=p.open('xb')
 try:child=subprocess.Popen([str(PG/'postgres'),'-D',str(root/'data'),'-h',address,'-k',sockets,'-p',str(port)],env=env,cwd=root,stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
 finally:out.close()
 while b'database system is ready to accept connections' not in p.read_bytes():
  need(time.monotonic()<end and child.poll() is None and p.stat().st_size<CAP,'start_failed');time.sleep(.025)
try:
 run('version',[PG/'postgres','--version']);need((root/'version.log').read_text().startswith('postgres (PostgreSQL) 17.11'),'version')
 run('initdb',[PG/'initdb','-D',root/'data','-U','axiom_local_fixture','--auth-local=trust','--auth-host=reject','--locale=C','--encoding=UTF8'])
 (root/'socket').mkdir()
 with socket.socket() as reserve:reserve.bind(('127.0.0.1',0));port=reserve.getsockname()[1]
 start('temporary-socket-only','',str(root/'socket'))
 run('old-socket-ready',[PG/'pg_isready','-h',root/'socket','-p',port,'-U','axiom_local_fixture','-t','1'])
 run('corrected-tcp-not-ready',[PG/'pg_isready','-h','127.0.0.1','-p',port,'-U','axiom_local_fixture','-t','1'],2)
 stop();start('final-tcp','127.0.0.1','')
 run('corrected-tcp-ready',[PG/'pg_isready','-h','127.0.0.1','-p',port,'-U','axiom_local_fixture','-t','1'])
 stop();run('stopped-not-ready',[PG/'pg_isready','-h','127.0.0.1','-p',port,'-U','axiom_local_fixture','-t','1'],2)
 accepted=True
except BaseException as e:accepted=False;failure=str(e) if isinstance(e,RuntimeError) else type(e).__name__
finally:
 for s in handlers:signal.signal(s,signal.SIG_IGN)
 try:stop()
 except BaseException:clean=False;accepted=False;failure='cleanup_unconfirmed'
 if clean:shutil.rmtree(root/'data',ignore_errors=True);shutil.rmtree(root/'socket',ignore_errors=True)
 result={'accepted':accepted,'failure':failure,'scope':'native PostgreSQL17 readiness protocol only, not Docker or app/TLS acceptance','phases':records,'socketOnlyOldReady':accepted,'socketOnlyTcpRefused':accepted,'finalTcpReady':accepted,'stoppedTcpRefused':accepted,'sqlQueries':0,'appBuild':False,'ownedGroupsEmpty':clean,'clusterRemoved':not(root/'data').exists(),'ownedDirectory':str(root)}
 (HERE/'RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
 for s,h in handlers.items():signal.signal(s,h)
raise SystemExit(0 if accepted else 1)
