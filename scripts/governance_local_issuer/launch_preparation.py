"""Closed-package launch/handoff PREPARATION ONLY; never spawns or grants identity.

Descriptor instructions are symbolic, not live fds or subprocess kwargs. The
pending native capability inventory and real handoff must qualify separately.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from collections.abc import Mapping
import os
from pathlib import Path
import stat
from .manifest import PackageUnavailable, verify_package

NODE_RELATIVE = '__axiom_runtime__/node'
MAIN_RELATIVE = 'node_modules/@axiom/verified-issuer-runtime/index.cjs'
CLEAN_ENVIRONMENT = (('LANG','C'),('LC_ALL','C'),('PATH','/usr/bin:/bin:/usr/sbin:/sbin'),('TZ','UTC'))
PENDING = ('actual_descriptor_handoff_unqualified','native_capability_closure_unqualified',
           'readonly_package_and_backing_unqualified','same_artifact_compiled_consumer_unqualified')
FORBIDDEN_PREFIXES = ('NODE_','DYLD_','LD_','TS_NODE_','BABEL_','AXIOM_ISSUER_','V8_','UV_')
FORBIDDEN_NAMES = frozenset(('PYTHONPATH','PYTHONHOME','PYTHONSTARTUP'))

def forbidden_environment_present(inherited: Mapping[str,str]) -> bool:
    if not isinstance(inherited,Mapping) or len(inherited)>4096:
        raise PackageUnavailable('invalid_environment_metadata')
    forbidden=False
    for key,value in inherited.items():
        if not isinstance(key,str) or not isinstance(value,str) or not key or len(key)>4096 or '\0' in key or '=' in key:
            raise PackageUnavailable('invalid_environment_metadata')
        name=key.upper()
        forbidden=forbidden or name in FORBIDDEN_NAMES or name.startswith(FORBIDDEN_PREFIXES)
    return forbidden

@dataclass(frozen=True)
class DescriptorInstruction:
    operation: str
    role: str
    source: str
    flags: int | None = None

@dataclass(frozen=True)
class LaunchPreparation:
    package_root: str
    executable: str
    main: str
    argv: tuple[str,...]
    environment: tuple[tuple[str,str],...]
    stdin: DescriptorInstruction
    stdout: DescriptorInstruction
    stderr: DescriptorInstruction
    package_file_set_digest: str
    close_fds: bool = field(default=True,init=False)
    pass_fds: tuple[int,...] = field(default=(),init=False)
    shell: bool = field(default=False,init=False)
    execution_authorized: bool = field(default=False,init=False)
    pending: tuple[str,...] = field(default=PENDING,init=False)

    def review_contract(self) -> dict:
        # A new dict prevents mutation of the immutable source contract. This is
        # deliberately NOT Popen kwargs: stdin/out/err are not file descriptors.
        return {'format':'axiom.launch-preparation/1','qualification':'preparation_only',
                'executable':self.executable,'argv':list(self.argv),'cwd':self.package_root,
                'env':dict(self.environment),
                'descriptorInstructions':[vars(x).copy() for x in (self.stdin,self.stdout,self.stderr)],
                'close_fds':True,'pass_fds':[],'shell':False,
                'packageFileSetObservationDigest':self.package_file_set_digest,
                'executingIssuerIdentity':'unavailable','executionAuthorized':False,
                'pending':list(self.pending)}

def _canonical_root(raw: str | os.PathLike) -> Path:
    try:
        text=os.fspath(raw)
        if not isinstance(text,str) or not text or len(text.encode('utf-8'))>4096 or any(ord(c)<32 or ord(c)==127 for c in text):
            raise ValueError()
        root=Path(text)
        if not root.is_absolute() or str(root)!=text or '..' in root.parts or root.resolve(strict=True)!=root or not root.is_dir():
            raise ValueError()
        return root
    except (ValueError,TypeError,OSError,RuntimeError,UnicodeError):
        raise PackageUnavailable('canonical_package_root_required') from None

def _fixed_regular(root:Path,relative:str) -> Path:
    path=root
    try:
        for piece in relative.split('/'):
            path=path/piece
            if path.is_symlink():raise ValueError()
        if path.resolve(strict=True)!=path or not stat.S_ISREG(path.lstat().st_mode):raise ValueError()
    except (ValueError,OSError,RuntimeError):
        raise PackageUnavailable('fixed_canonical_entrypoint_required') from None
    return path

def prepare_launch(root: str | os.PathLike, *, inherited_environment:Mapping[str,str] | None=None,
                   caller_options:Mapping | None=None) -> LaunchPreparation:
    """Verify the existing closed file set and prepare only the fixed next launch.

    No native API, descriptor open, mount, process creation, initializer or identity.
    An eventual real launch must reverify; this plan is not a freshness receipt.
    """
    if caller_options is not None and (not isinstance(caller_options,Mapping) or len(caller_options)!=0):
        raise PackageUnavailable('caller_launch_options_forbidden')
    inherited=os.environ if inherited_environment is None else inherited_environment
    if forbidden_environment_present(inherited):raise PackageUnavailable('loader_or_self_report_override')
    package=_canonical_root(root)
    observation=verify_package(package)
    executable=_fixed_regular(package,NODE_RELATIVE)
    main=_fixed_regular(package,MAIN_RELATIVE)
    if not executable.stat().st_mode&0o111:raise PackageUnavailable('runtime_not_executable')
    # Explicit readonly open: subprocess.DEVNULL may use an O_RDWR descriptor.
    readonly_null=os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC
    return LaunchPreparation(str(package),str(executable),str(main),(str(executable),str(main)),
        CLEAN_ENVIRONMENT,DescriptorInstruction('open_readonly','stdin','/dev/null',readonly_null),
        DescriptorInstruction('create_anonymous_pipe','stdout','launcher_owned_child_write'),
        DescriptorInstruction('create_anonymous_pipe','stderr','launcher_owned_child_write'),
        observation['packageDigest'])

@dataclass(frozen=True)
class RecordedHandoffObservation:
    qualification:str=field(default='recorded_handoff_shape_only',init=False)
    executing_issuer_identity:str=field(default='unavailable',init=False)
    execution_authorized:bool=field(default=False,init=False)

def decode_recorded_handoff(raw:object) -> RecordedHandoffObservation:
    """Strict recorded/synthetic metadata decoder, NOT actual fd qualification.

    A caller saying 'anonymous_pipe' or 'readonly' is never process authority.
    No runtime launcher consumes this observation or descriptor numbers from JSON.
    """
    def fail():raise PackageUnavailable('recorded_handoff_unavailable')
    expected={'format','stdin','stdout','stderr','close_fds','pass_fds','shell','extra_descriptors'}
    if type(raw) is not dict or set(raw)!=expected or raw['format']!='axiom.recorded-handoff/1':fail()
    if raw['close_fds'] is not True or raw['shell'] is not False or raw['pass_fds']!=[] or type(raw['pass_fds']) is not list or raw['extra_descriptors']!=[] or type(raw['extra_descriptors']) is not list:fail()
    stdin=raw['stdin']
    if type(stdin) is not dict or stdin.get('close_on_exec') is not True or stdin!={'kind':'vnode','path':'/dev/null','access':'read_only','close_on_exec':True}:fail()
    for role in ('stdout','stderr'):
        if type(raw[role]) is not dict or raw[role].get('close_on_exec') is not True or raw[role]!={'kind':'anonymous_pipe','owner':'launcher','endpoint':'child_write','close_on_exec':True}:fail()
    return RecordedHandoffObservation()
