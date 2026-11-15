"""Private ORIGINAL attempt file/claim primitive — NOT a qualified supervisor.

Import has no I/O. There is deliberately NO authentic binding supplier, registry
registration API, provider callback/SDK, CLI or positive owner-start receipt seam.
The future fixed controller must be separately qualified before integration.
Local tests populate private registry records themselves; no fixture switch or
constructor in this module enrolls a binding. A local claim is not live authority.
Trusted controller/OS/storage and fsync durability are explicit premises, not
malicious-root, physical persistence, distributed exactly-once or cost guarantees.
"""
import hashlib,hmac,os,re,stat,threading,time,weakref
from dataclasses import dataclass,field

class AttemptUnavailable(Exception):
    def __init__(self):super().__init__('original_attempt_unavailable')

def _need(value):
    if not value:raise AttemptUnavailable()

class _OriginalJournalBinding:pass
class _Grant:pass
class _CreationClaim:
    __slots__=()
    @property
    def qualified(self):return False

@dataclass(frozen=True)
class _Directory:
    fd:int
    parent_fd:int
    name:str
    original:object

@dataclass
class _BindingState:
    directories:tuple
    manifest_digest:str
    deadline_ns:int
    cancelled:object
    pid:int
    uid:int
    gid:int
    lock:object=field(default_factory=threading.Lock)
    attempted:bool=False

@dataclass
class _GrantState:
    binding:object
    fd:int
    original:object
    raw:bytes
    pid:int
    lock:object=field(default_factory=threading.Lock)
    phase:str='consumed'
    finalizer:object=None

# No runtime enrollment function. Shape, a raw FD, JSON or hash cannot register
# an original controller. Tests alone inject records into this private seam.
_BINDINGS=weakref.WeakKeyDictionary()
_GRANTS=weakref.WeakKeyDictionary()
_DIGEST=re.compile(r'[0-9a-f]{64}\Z')
_NAME=re.compile(r'[A-Za-z0-9_-]{1,96}\Z')
_MARKER='consumed'
_MAX_NS=9223372036854775807

def _record(raw):
    _need(type(raw) is bytes and 0<len(raw)<=4096)
    try:parts=raw.decode('ascii').split('\n')
    except (ValueError,UnicodeError):raise AttemptUnavailable() from None
    _need(len(parts)==10 and parts[0]=='AXIOM_ORIGINAL_ATTEMPT_V1' and parts[-2:]==['END',''])
    _need(all(_NAME.fullmatch(p) for p in parts[1:4]))
    _need(all(_DIGEST.fullmatch(p) for p in parts[4:8]))
    return raw

def _lookup(registry,key,kind):
    if type(key) is not kind:return None
    try:return registry.get(key)
    except (TypeError,AttributeError):return None

def _no_extra_access(fd):
    # macOS's bundled Python lacks these APIs: refuse, never infer absence.
    if not hasattr(os,'listxattr'):return False
    try:names=os.listxattr(fd)
    except (OSError,TypeError,ValueError):return False
    return not any(n in ('system.posix_acl_access','system.posix_acl_default','security.capability') for n in names)

def _stable(a,b):
    return (a.st_dev,a.st_ino,a.st_mode,a.st_uid,a.st_gid)==(b.st_dev,b.st_ino,b.st_mode,b.st_uid,b.st_gid)

def _version(a):
    return (a.st_dev,a.st_ino,a.st_mode,a.st_uid,a.st_gid,a.st_size,a.st_nlink,a.st_mtime_ns,a.st_ctime_ns)

def _live(b):
    _need(b.pid==os.getpid() and type(b.deadline_ns) is int and 0<b.deadline_ns<=_MAX_NS)
    _need(time.monotonic_ns()<b.deadline_ns and not b.cancelled.is_set())
def _current_binding(b):
    _live(b)
    _need(type(b.directories) is tuple and 1<=len(b.directories)<=32)
    for index,d in enumerate(b.directories):
        _need(type(d) is _Directory and type(d.name) is str and d.name not in ('.','..') and 0<len(d.name)<=255 and '/' not in d.name and '\x00' not in d.name)
        if index:_need(d.parent_fd==b.directories[index-1].fd)
        held=os.fstat(d.fd);named=os.stat(d.name,dir_fd=d.parent_fd,follow_symlinks=False)
        _need(stat.S_ISDIR(held.st_mode) and stat.S_ISDIR(named.st_mode))
        _need(_stable(held,d.original) and _stable(held,named))
        _need(held.st_uid==b.uid and held.st_gid==b.gid and (held.st_mode&0o7777)==0o700 and _no_extra_access(d.fd))
    # Authentic provenance of the outside anchor, mount persistence, manifest
    # grant and whole supervisor deadline is NOT supplied by these local checks.

def _marker_current(b,fd,original,raw):
    _current_binding(b)
    held=os.fstat(fd);named=os.stat(_MARKER,dir_fd=b.directories[-1].fd,follow_symlinks=False)
    _need(stat.S_ISREG(held.st_mode) and stat.S_ISREG(named.st_mode))
    _need(held.st_uid==b.uid and held.st_gid==b.gid and (held.st_mode&0o7777)==0o600 and held.st_nlink==1)
    _need(_version(held)==_version(original) and _version(named)==_version(held) and _no_extra_access(fd))
    _need(os.pread(fd,len(raw)+1,0)==raw)
    _need(_version(os.fstat(fd))==_version(original))

def _close_original_fd(fd,original,pid):
    if os.getpid()!=pid:return
    try:
        held=os.fstat(fd)
        if (held.st_dev,held.st_ino)==(original.st_dev,original.st_ino):os.close(fd)
    except OSError:pass

def _retire(s):
    if s.phase=='retired':return
    s.phase='retired'
    if s.finalizer is not None:s.finalizer.detach()
    _close_original_fd(s.fd,s.original,s.pid)

def consume_original_attempt(original_journal_binding,manifest,expected_manifest_digest,original_deadline_ns):
    b=_lookup(_BINDINGS,original_journal_binding,_OriginalJournalBinding)
    _need(type(b) is _BindingState and b.pid==os.getpid()) # BEFORE inherited lock
    fd=-1
    try:
        with b.lock:
            _need(b.pid==os.getpid() and not b.attempted)
            b.attempted=True # Also holds an unrecorded precreation failure in this process.
            _record(manifest)
            _need(type(expected_manifest_digest) is str and _DIGEST.fullmatch(expected_manifest_digest))
            _need(expected_manifest_digest==b.manifest_digest and hmac.compare_digest(hashlib.sha256(manifest).hexdigest(),b.manifest_digest))
            _need(type(original_deadline_ns) is int and original_deadline_ns==b.deadline_ns)
            _current_binding(b)
            fd=os.open(_MARKER,os.O_RDWR|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600,dir_fd=b.directories[-1].fd)
            initial=os.fstat(fd)
            _need(stat.S_ISREG(initial.st_mode) and initial.st_uid==b.uid and initial.st_gid==b.gid and initial.st_nlink==1 and initial.st_size==0 and (initial.st_mode&0o7777)==0o600 and _no_extra_access(fd))
            offset=0
            while offset<len(manifest):
                _current_binding(b)
                n=os.write(fd,manifest[offset:])
                _need(type(n) is int and 0<n<=len(manifest)-offset)
                offset+=n
            _current_binding(b);os.fsync(fd)
            original=os.fstat(fd)
            _marker_current(b,fd,original,manifest)
            os.fsync(b.directories[-1].fd)
            _marker_current(b,fd,original,manifest)
            _live(b) # Non-I/O check AFTER all potentially blocking filesystem work.
            grant=_Grant();s=_GrantState(b,fd,original,manifest,os.getpid())
            s.finalizer=weakref.finalize(grant,_close_original_fd,fd,original,s.pid)
            _GRANTS[grant]=s;fd=-1
            return grant
    except (OSError,ValueError,TypeError,AttributeError,OverflowError):raise AttemptUnavailable() from None
    finally:
        if fd>=0:
            try:os.close(fd)
            except OSError:pass
        # NEVER remove/truncate/repair/reopen the marker on error.

def claim_creation(original_grant):
    s=_lookup(_GRANTS,original_grant,_Grant)
    _need(type(s) is _GrantState and s.pid==os.getpid()) # BEFORE inherited lock
    with s.lock:
        try:
            _need(s.pid==os.getpid() and s.phase=='consumed')
            _marker_current(s.binding,s.fd,s.original,s.raw)
            _live(s.binding) # Cancellation/deadline may change during final read.
            s.phase='creation_claimed' # Irrevocable BEFORE returning the local claim.
            return _CreationClaim()
        except (AttemptUnavailable,OSError,ValueError,TypeError,AttributeError,OverflowError):
            _retire(s);raise AttemptUnavailable() from None

def close_original_grant(original_grant):
    s=_lookup(_GRANTS,original_grant,_Grant)
    _need(type(s) is _GrantState and s.pid==os.getpid())
    with s.lock:
        _need(s.pid==os.getpid());_retire(s)

def claim_owner_start(original_grant,original_resource_receipt):
    # Authentic original provider receipt supplier is ABSENT. No constructor,
    # structural true/hash/fixture ID may turn this production seam positive.
    close_original_grant(original_grant)
    raise AttemptUnavailable()
