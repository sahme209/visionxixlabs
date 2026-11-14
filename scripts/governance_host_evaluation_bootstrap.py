"""Fixed NEW-disposable-host bootstrap SOURCE ONLY until exact run authorization.

No import-time host action. This is neither a production policy issuer nor an
installer. The separately approved packet must already be root-owned/installed.
"""
from pathlib import Path
import hashlib,json,os,re,selectors,signal,stat,subprocess,time

ROOT=Path('/run/axiom-host-evaluation')
PACKAGE=Path('/opt/axiom-host-evaluation')
PACKET=Path('/etc/axiom-host-evaluation/packet.json')
SERVICES=('chronyd.service','ntpd.service','systemd-timesyncd.service','ecs.service')
FIXED_FILES=frozenset(('bin/axiom-host-evaluation','bin/time_worker','bin/node','bin/host_reader_launcher','reader/host_reader.node','reader/host_reader.mjs','COMPATIBILITY.json','LICENSES.txt'))
CATEGORIES=frozenset(('packet_refused','resource_refused','permission_refused','service_refused','source_unavailable','producer_exited','reader_refused','timeout','cleanup_unknown','cancelled'))

def need(value,reason):
    if not value:raise ValueError(reason)

SOURCE_FAILURES=frozenset(('permission_refused','bind_failure','sample_timeout','malformed_response','source_unsynchronized','source_unavailable','counter_order_failure','sample_io_failure'))

class DeferredCancellation:
    """Ordinary signals record intent only; never throw across Popen handoff."""
    def __init__(self):self.requested=False
    def request(self,_signal,_frame):self.requested=True
    def checkpoint(self):need(not self.requested,'cancelled')

def source_event(event):
    need(type(event) is dict and event.get('format')==1,'resource_refused')
    if event.get('event')=='producer_started':
        need(event=={'format':1,'event':'producer_started','strictTimeAuthority':False,'vmclockSupport':False},'resource_refused')
        return ('started',None)
    if event.get('event')=='ntp_failure':
        need(set(event)=={'format','event','category','strictTimeAuthority'} and event['strictTimeAuthority'] is False and event['category'] in SOURCE_FAILURES,'resource_refused')
        return ('failure',event['category'])
    need(set(event)=={'format','event','requests','responses','strictTimeAuthority','vmclockSupport'} and event.get('event')=='ntp_observation' and event['strictTimeAuthority'] is False and event['vmclockSupport'] is False,'resource_refused')
    need(all(type(event[n]) is int and 0<=event[n]<=18446744073709551615 for n in ('requests','responses')),'resource_refused')
    return ('observation',event['responses'])

def validate_packet(value):
    need(type(value) is dict and set(value)=={'format','assurance','ami','readerUid','readerGid','files'},'packet_refused')
    need(value['format']==1 and value['assurance']=='trusted-operational-host-evaluation-only' and value['ami']=='ami-001cbfee94278a792','packet_refused')
    for name in ('readerUid','readerGid'):
        need(type(value[name]) is int and 0<value[name]<=4294967295,'packet_refused')
    files=value['files'];need(type(files) is dict and FIXED_FILES<=set(files) and len(files)<=256,'packet_refused')
    total=0
    for name,item in files.items():
        need(name in FIXED_FILES or re.fullmatch(r'lib/[A-Za-z0-9_.+-]+',name) is not None,'packet_refused')
        need(type(item) is dict and set(item)=={'sha256','bytes'} and type(item['bytes']) is int and 0<item['bytes']<=1024*1024*1024 and isinstance(item['sha256'],str) and re.fullmatch('[0-9a-f]{64}',item['sha256']),'packet_refused')
        total+=item['bytes'];need(total<=1024*1024*1024,'packet_refused')
    return value

def validate_reader_result(value):
    fields={'format','event','strictTimeAuthority','sourceGeneration','publication','disruptionMarker','device','inode','realtimeNs','p0Ns','p1Ns','p2Ns'}
    need(type(value) is dict and set(value)==fields,'reader_refused')
    need(value['format']==1 and value['event']=='reader_complete' and value['strictTimeAuthority'] is False and value['sourceGeneration']=='host-evaluation-1','reader_refused')
    numbers={}
    for name in ('publication','disruptionMarker','device','inode','realtimeNs','p0Ns','p1Ns','p2Ns'):
        text=value[name]
        need(type(text) is str and re.fullmatch(r'0|[1-9][0-9]{0,19}',text),'reader_refused')
        numbers[name]=int(text)
        maximum=9223372036854775807 if name.endswith('Ns') else 18446744073709551615
        need(numbers[name]<=maximum,'reader_refused')
    need(numbers['publication']>0 and numbers['p0Ns']<=numbers['p1Ns']<=numbers['p2Ns'],'reader_refused')
    return value

def evaluate(ops,packet):
    """The actual single orchestration path; fake ops test ordering only."""
    producer=None
    result={'format':1,'event':'host_evaluation','observed':False,'strictTimeAuthority':False,'cleanupKnown':False}
    checkpoint=getattr(ops,'checkpoint',lambda:None)
    try:
        checkpoint();ops.validate(packet)
        checkpoint();ops.reserve(packet)
        checkpoint();ops.isolate_services()
        checkpoint()
        producer=ops.start_producer()
        # A signal only sets a flag: ownership is recorded before this check.
        checkpoint();ops.await_source(producer)
        checkpoint();ops.assert_producer_running(producer)
        observation=ops.read_once(packet)
        need(observation.get('event')=='reader_complete' and observation.get('strictTimeAuthority') is False,'reader_refused')
        result['rawObservation']=observation
        checkpoint();ops.assert_producer_running(producer)
        result['observed']=True
    except BaseException as error:
        reason=str(error) if isinstance(error,ValueError) else 'resource_refused'
        result['reason']=reason if reason in CATEGORIES else 'resource_refused'
    finally:
        if producer is not None:
            try:ops.stop_owned(producer);result['cleanupKnown']=True
            except BaseException:
                result['observed']=False;result['cleanupKnown']=False;result['reason']='cleanup_unknown'
        close_local=getattr(ops,'close_local',None)
        if close_local is not None:
            try:close_local()
            except BaseException:
                result['observed']=False;result['cleanupKnown']=False;result['reason']='cleanup_unknown'
    try:checkpoint()
    except ValueError:
        result['observed']=False
        if result.get('reason')!='cleanup_unknown':result['reason']='cancelled'
    failures=getattr(ops,'source_failures',())
    result['sourceFailures']=[category for category in SOURCE_FAILURES if category in failures]
    result['hostTerminationVerified']=False
    return result

class HostOps:
    """Actual fixed host APIs. NEVER instantiated by local source/mock tests."""
    def __init__(self,cancellation=None):
        self.cancellation=cancellation or DeferredCancellation()
        self.source_failures=[]
        self.packet=None;self.root_identity=None;self.directory_fd=-1
        self.logs={};self.source_facts=[];self.reader_started=False

    def checkpoint(self):self.cancellation.checkpoint()

    @staticmethod
    def _no_acl(path):
        need(not any(name in ('system.posix_acl_access','system.posix_acl_default','security.capability') for name in os.listxattr(path,follow_symlinks=False)),'permission_refused')

    @classmethod
    def _root_path(cls,path,directory=False):
        value=os.lstat(path)
        need((stat.S_ISDIR(value.st_mode) if directory else stat.S_ISREG(value.st_mode)) and value.st_uid==0 and not value.st_mode&0o6022,'permission_refused')
        cls._no_acl(path)
        return value

    def validate(self,packet,check_cancel=True):
        need(os.getuid()==0 and os.geteuid()==0,'permission_refused')
        self.packet=validate_packet(packet)
        for path in (Path('/opt'),PACKAGE,PACKAGE/'bin',PACKAGE/'reader'):
            self._root_path(path,True)
        for name,want in packet['files'].items():
            if check_cancel:self.checkpoint()
            path=PACKAGE/name
            if name.startswith('lib/'):self._root_path(PACKAGE/'lib',True)
            before=self._root_path(path)
            descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
            try:
                actual=os.fstat(descriptor);need((actual.st_dev,actual.st_ino)==(before.st_dev,before.st_ino) and actual.st_size==want['bytes'],'resource_refused')
                digest=hashlib.sha256()
                while True:
                    if check_cancel:self.checkpoint()
                    chunk=os.read(descriptor,65536)
                    if not chunk:break
                    digest.update(chunk)
                after=os.fstat(descriptor)
                need((after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns)==(actual.st_dev,actual.st_ino,actual.st_size,actual.st_mtime_ns) and digest.hexdigest()==want['sha256'],'resource_refused')
            finally:os.close(descriptor)
        # This is a root-approved target-binding input, NOT a locally minted ABI
        # proof. Actual ELF/GLIBC/GLIBCXX/Node evidence must exist before run.
        compatibility=json.loads((PACKAGE/'COMPATIBILITY.json').read_text())
        need(compatibility.get('targetAmi')==packet['ami'] and compatibility.get('architecture')=='x86_64' and compatibility.get('nodeVersion')=='24.22.2' and compatibility.get('evidenceKind')=='reviewed-target-elf-linkage','packet_refused')

    def reserve(self,packet):
        self._root_path(Path('/run'),True)
        need(not os.path.lexists(ROOT),'resource_refused')
        os.mkdir(ROOT,0o750);os.chown(ROOT,0,packet['readerGid']);os.chmod(ROOT,0o750)
        for name,mode in [('generation-1',0o750),('compat',0o700),('logs',0o700)]:
            self.checkpoint()
            path=ROOT/name;os.mkdir(path,mode);os.chown(path,0,packet['readerGid'] if name=='generation-1' else 0);os.chmod(path,mode);self._no_acl(path)
        self._no_acl(ROOT)
        self.root_identity=(ROOT.stat().st_dev,ROOT.stat().st_ino)
        # Reserve FD3 before opening logs or spawning. Never remap over an
        # unknown live descriptor; a noncanonical bootstrap environment refuses.
        self.directory_fd=os.open(ROOT/'generation-1',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW|os.O_CLOEXEC)
        need(self.directory_fd==3,'resource_refused')
        for name in ('producer.stdout','producer.stderr','reader.stdout','reader.stderr'):
            fd=os.open(ROOT/'logs'/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600)
            self.logs[name]=os.fdopen(fd,'wb',buffering=0)

    @staticmethod
    def _capture_owned(process,seconds,limit,streams=None,cancel_check=None):
        """Bound bytes and monotonic deadline WHILE reading owned pipes."""
        selector=selectors.DefaultSelector();buffers=[bytearray(),bytearray()]
        until=time.monotonic()+seconds
        for index,pipe in enumerate((process.stdout,process.stderr)):
            if pipe is not None and not pipe.closed:
                os.set_blocking(pipe.fileno(),False)
                selector.register(pipe,selectors.EVENT_READ,index)
        try:
            while selector.get_map():
                if cancel_check is not None:cancel_check()
                remaining=until-time.monotonic()
                need(remaining>0,'timeout')
                for key,_ in selector.select(min(remaining,0.1)):
                    try:chunk=os.read(key.fileobj.fileno(),4096)
                    except BlockingIOError:continue
                    if not chunk:
                        selector.unregister(key.fileobj);key.fileobj.close();continue
                    index=key.data
                    need(len(buffers[index])+len(chunk)<=limit,'resource_refused')
                    buffers[index].extend(chunk)
                    if streams is not None:streams[index].write(chunk)
            while True:
                if cancel_check is not None:cancel_check()
                remaining=until-time.monotonic();need(remaining>0,'timeout')
                try:
                    code=process.wait(timeout=min(remaining,0.1))
                    break
                except subprocess.TimeoutExpired:continue
            return bytes(buffers[0]),bytes(buffers[1]),code
        finally:selector.close()

    @classmethod
    def _kill_owned_session(cls,process):
        # This identifier originated ONLY from our Popen(start_new_session=True),
        # never packet JSON. Its fixed children cannot create another session.
        try:os.killpg(process.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        cls._capture_owned(process,2,32768)
        try:os.killpg(process.pid,0)
        except ProcessLookupError:return
        raise ValueError('cleanup_unknown')

    def _service(self,argv,allowed=(0,)):
        process=subprocess.Popen(['/usr/bin/systemctl',*argv],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,close_fds=True,start_new_session=True,env={'PATH':'/usr/bin:/bin','LANG':'C','LC_ALL':'C'})
        try:out,err,code=self._capture_owned(process,5,4096,cancel_check=self.checkpoint)
        except BaseException as error:
            self._kill_owned_session(process) # Cleanup deliberately ignores cancellation.
            if isinstance(error,ValueError) and str(error)=='cancelled':raise
            raise ValueError('service_refused')
        need(code in allowed,'service_refused')
        return code

    def isolate_services(self):
        for service in SERVICES:
            self.checkpoint()
            self._service(['mask','--runtime','--now',service])
            self._service(['is-active',service],(3,4))
        # The later host is disposable; do not unmask/restart a competing writer
        # during evaluation cleanup. Its external owned termination is separate.

    def start_producer(self):
        need(self.directory_fd==3,'resource_refused')
        return subprocess.Popen([str(PACKAGE/'bin/axiom-host-evaluation')],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,pass_fds=(3,),close_fds=True,start_new_session=True,env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'})

    def await_source(self,producer):
        selector=selectors.DefaultSelector();buffers={'stdout':bytearray(),'stderr':bytearray()};size=0;seen_started=False
        for name,pipe in [('stdout',producer.stdout),('stderr',producer.stderr)]:
            os.set_blocking(pipe.fileno(),False);selector.register(pipe,selectors.EVENT_READ,name)
        until=time.monotonic()+60
        try:
            while time.monotonic()<until:
                self.checkpoint()
                need(producer.poll() is None,'producer_exited')
                for key,_ in selector.select(0.1):
                    chunk=os.read(key.fileobj.fileno(),4096)
                    if not chunk:selector.unregister(key.fileobj);continue
                    size+=len(chunk);need(size<=32768,'resource_refused');self.logs['producer.'+key.data].write(chunk);buffers[key.data].extend(chunk)
                    if key.data=='stderr':continue
                    while b'\n' in buffers['stdout']:
                        line,_,tail=buffers['stdout'].partition(b'\n');buffers['stdout']=bytearray(tail)
                        event=json.loads(line.decode('utf-8','strict'))
                        kind,value=source_event(event)
                        if kind=='started':seen_started=True
                        elif kind=='failure':
                            if value not in self.source_failures:self.source_failures.append(value)
                        else:
                            self.source_facts.append(event)
                            if seen_started and value>0:return
            raise ValueError('source_unavailable')
        finally:selector.close()

    @staticmethod
    def assert_producer_running(producer):
        # This exact owned process, not a PID/config/JSON liveness assertion.
        need(producer.poll() is None,'producer_exited')

    def read_once(self,packet):
        need(not self.reader_started,'resource_refused');self.reader_started=True
        self.validate(packet)
        reader=subprocess.Popen([str(PACKAGE/'bin/host_reader_launcher')],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,close_fds=True,start_new_session=True,user=packet['readerUid'],group=packet['readerGid'],extra_groups=(),env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','LC_ALL':'C.UTF-8'})
        try:
            out,err,code=self._capture_owned(reader,5,8192,(self.logs['reader.stdout'],self.logs['reader.stderr']),cancel_check=self.checkpoint)
        except BaseException as error:
            self._kill_owned_session(reader) # No cancellation checkpoint in cleanup.
            if isinstance(error,ValueError) and str(error)=='cancelled':raise
            raise ValueError('reader_refused')
        # Even a failed trusted reader must not leave its owned worker group.
        try:os.killpg(reader.pid,0)
        except ProcessLookupError:pass
        else:
            self._kill_owned_session(reader)
            raise ValueError('reader_refused')
        need(code==0,'reader_refused')
        result=json.loads(out.decode('utf-8','strict'))
        return validate_reader_result(result)

    def stop_owned(self,producer):
        if producer.poll() is None:producer.terminate()
        try:
            out,err,code=self._capture_owned(producer,6,32768,(self.logs['producer.stdout'],self.logs['producer.stderr']))
        except BaseException:
            self._kill_owned_session(producer)
            raise ValueError('cleanup_unknown')
        need(code==0 and b'"event":"producer_stopped"' in out,'cleanup_unknown')
        self.validate(self.packet,check_cancel=False)

    def close_local(self):
        """Close controller-owned descriptors on every path, never delete files."""
        failed=False
        if self.directory_fd>=0:
            descriptor=self.directory_fd;self.directory_fd=-1
            try:os.close(descriptor)
            except OSError:failed=True
        for stream in self.logs.values():
            try:stream.close()
            except OSError:failed=True
        need(not failed,'cleanup_unknown')
        # Services remain masked on this disposable host. External host resource
        # termination/evidence export is NOT acknowledged by cleanupKnown here.


def main():
    # Install flag-only handlers BEFORE any resource/process ownership. No
    # asynchronous exception can discard a child returned by Popen.
    cancellation=DeferredCancellation()
    previous={}
    for selected in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP):
        previous[selected]=signal.signal(selected,cancellation.request)
    try:
        cancellation.checkpoint()
        HostOps._root_path(PACKET.parent,True)
        before=HostOps._root_path(PACKET)
        need(stat.S_IMODE(before.st_mode)==0o400 and before.st_size<=256*1024,'packet_refused')
        fd=os.open(PACKET,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
        with os.fdopen(fd,'rb') as stream:packet=validate_packet(json.load(stream))
        result=evaluate(HostOps(cancellation),packet)
    except BaseException as error:
        reason=str(error) if isinstance(error,ValueError) and str(error) in CATEGORIES else 'packet_refused'
        result={'format':1,'event':'host_evaluation','observed':False,'strictTimeAuthority':False,'cleanupKnown':False,'hostTerminationVerified':False,'reason':reason}
    finally:
        for selected,handler in previous.items():signal.signal(selected,handler)
    print(json.dumps(result,sort_keys=True))
    return 0 if result['observed'] and result['cleanupKnown'] else 1

# SIGKILL/power loss cannot run process-local cleanup. Preserve partial receipts
# and require the separately authorized external owned-host stop/verification.
if __name__=='__main__':raise SystemExit(main())
