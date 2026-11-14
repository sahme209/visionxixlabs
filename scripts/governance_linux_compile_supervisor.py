"""Bound one reviewed argv command; import is inert, no compiler is selected here.

Cleanup confirmation covers our retained leader and its original process group.
It is not containment of foreign code which deliberately creates a new session;
that remains the ephemeral CI job's boundary, not runtime qualification.
"""
import errno
import math
import os
from pathlib import Path
import selectors
import signal
import subprocess
import time

MAX_OUTPUT_BYTES=16*1024*1024

class _TerminationRequested(BaseException):
    pass


def supervise(argv, *, cwd, env, stdout_path, stderr_path, timeout_seconds,
              max_output_bytes=MAX_OUTPUT_BYTES, cleanup_seconds=5):
    """Return fixed status/byte/exit facts, retaining bounded actual diagnostics.

    Arguments/environment belong to a frozen reviewed driver, never user input.
    No ambient environment, shell, command retry or output execution is used.
    Invalid options refuse before opening logs or starting any process.
    """
    if (not isinstance(argv,list) or not argv or
        any(not isinstance(v,str) or '\0' in v for v in argv) or
        not os.path.isabs(argv[0]) or not isinstance(env,dict) or
        any(not isinstance(k,str) or not k or '=' in k or '\0' in k or
            not isinstance(v,str) or '\0' in v for k,v in env.items()) or
        not isinstance(timeout_seconds,(int,float)) or isinstance(timeout_seconds,bool) or
        not math.isfinite(timeout_seconds) or timeout_seconds<=0 or
        not isinstance(cleanup_seconds,(int,float)) or isinstance(cleanup_seconds,bool) or
        not math.isfinite(cleanup_seconds) or not 0<cleanup_seconds<=5 or
        not isinstance(max_output_bytes,int) or isinstance(max_output_bytes,bool) or
        not 0<max_output_bytes<=MAX_OUTPUT_BYTES):
        raise ValueError('compile_supervisor_options_invalid')
    cwd=Path(cwd);stdout_path=Path(stdout_path);stderr_path=Path(stderr_path)
    if not cwd.is_absolute() or not stdout_path.is_absolute() or not stderr_path.is_absolute() or stdout_path==stderr_path:
        raise ValueError('compile_supervisor_paths_invalid')
    started=time.monotonic();deadline=started+timeout_seconds
    counts={'stdout':0,'stderr':0};logs={};streams=[];proc=None;selector=None
    status='supervisor_error';returncode=None;cleanup_confirmed=False
    previous_sigterm=None;handler_installed=False;launching=False;termination_pending=False
    def terminate(signum,frame):
        nonlocal termination_pending
        termination_pending=True
        if not launching:raise _TerminationRequested()
    try:
        previous_sigterm=signal.getsignal(signal.SIGTERM)
        signal.signal(signal.SIGTERM,terminate);handler_installed=True
        flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW
        logs['stdout']=os.open(stdout_path,flags,0o600)
        logs['stderr']=os.open(stderr_path,flags,0o600)
        # Do not interrupt Popen between child creation and ownership return.
        # A termination received there is acted on immediately after assignment.
        launching=True
        proc=subprocess.Popen(list(argv),cwd=str(cwd),env=dict(env),shell=False,
            stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            bufsize=0,close_fds=True,start_new_session=True)
        launching=False
        if termination_pending:raise _TerminationRequested()
        selector=selectors.DefaultSelector()
        for name,stream in [('stdout',proc.stdout),('stderr',proc.stderr)]:
            if stream is None:raise RuntimeError('compile_pipe_missing')
            streams.append(stream);os.set_blocking(stream.fileno(),False)
            selector.register(stream,selectors.EVENT_READ,name)
        active=2
        while True:
            remaining=deadline-time.monotonic()
            if remaining<=0:status='timeout';break
            # WNOWAIT retains the owned leader's PID until group termination and
            # wait, avoiding a poll/reap followed by a recycled-PGID signal.
            exited=os.waitid(os.P_PID,proc.pid,os.WEXITED|os.WNOHANG|os.WNOWAIT)
            if exited is not None and active==0:
                status='success';break
            for key,_events in selector.select(min(remaining,0.1)):
                try:data=os.read(key.fileobj.fileno(),65536)
                except BlockingIOError:continue
                if not data:
                    selector.unregister(key.fileobj);key.fileobj.close();active-=1;continue
                available=max_output_bytes-sum(counts.values())
                kept=data[:available];offset=0
                while offset<len(kept):
                    wrote=os.write(logs[key.data],kept[offset:])
                    if wrote<=0:raise OSError('compile_log_write_failed')
                    offset+=wrote;counts[key.data]+=wrote
                if len(data)>available:status='output_limit';break
            if status=='output_limit':break
    except _TerminationRequested:
        status='terminated'
    except BaseException:
        status='supervisor_error'
    finally:
        if proc is not None:
            cleanup_deadline=time.monotonic()+cleanup_seconds
            try:
                try:os.killpg(proc.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                except OSError as exc:
                    if exc.errno!=errno.ESRCH:raise
                remaining=cleanup_deadline-time.monotonic()
                if remaining<=0:raise subprocess.TimeoutExpired(argv[0],cleanup_seconds)
                returncode=proc.wait(timeout=remaining)
                # A reaped leader alone does not prove its original group is
                # gone. Probe only: never signal a potentially recycled group.
                while True:
                    remaining=cleanup_deadline-time.monotonic()
                    if remaining<=0:raise subprocess.TimeoutExpired(argv[0],cleanup_seconds)
                    try:os.killpg(proc.pid,0)
                    except ProcessLookupError:break
                    except OSError as exc:
                        if exc.errno==errno.ESRCH:break
                        raise
                    time.sleep(min(0.01,remaining))
                cleanup_confirmed=True
                if status=='success' and returncode!=0:status='exit_nonzero'
            except BaseException:
                status='cleanup_unknown';cleanup_confirmed=False
        else:
            cleanup_confirmed=True
        if proc is not None:
            for stream in (proc.stdout,proc.stderr):
                if stream is not None and stream not in streams:streams.append(stream)
        for stream in streams:
            try:stream.close()
            except Exception:
                if status!='cleanup_unknown':status='supervisor_error'
        if selector is not None:
            try:selector.close()
            except Exception:
                if status!='cleanup_unknown':status='supervisor_error'
        for fd in logs.values():
            try:os.close(fd)
            except Exception:
                if status!='cleanup_unknown':status='supervisor_error'
        if handler_installed:
            try:signal.signal(signal.SIGTERM,previous_sigterm)
            except Exception:
                if status!='cleanup_unknown':status='supervisor_error'
    return {'status':status,'returncode':returncode,'stdout_bytes':counts['stdout'],
            'stderr_bytes':counts['stderr'],'elapsed_seconds':time.monotonic()-started,
            'cleanup_confirmed':cleanup_confirmed}
