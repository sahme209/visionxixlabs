"""Read-only, fixed installation-directory evidence. No traversal/cleanup authority."""
import hashlib,os,stat
from pathlib import Path
MAX_ENTRIES=32
MAX_DEPTH=2
MAX_FILE_BYTES=64*1024
MAX_HASH_BYTES=256*1024
REPARSE=0x400

def reparse(st):
    return stat.S_ISLNK(st.st_mode) or bool(getattr(st,'st_file_attributes',0)&REPARSE)

def safe_name(parts):
    text='/'.join(parts)
    return text if len(text)<=360 and all(32<=ord(c)<127 for c in text) else '[redacted-relative-name]'

def _read_small(path,initial):
    """No bytes read until opened regular-file identity/physical path checks."""
    if os.name=='nt':
        import ctypes,msvcrt
        from ctypes import wintypes as W
        k=ctypes.WinDLL('kernel32',use_last_error=True)
        k.CreateFileW.argtypes=[W.LPCWSTR,W.DWORD,W.DWORD,ctypes.c_void_p,W.DWORD,W.DWORD,W.HANDLE];k.CreateFileW.restype=W.HANDLE
        k.GetFinalPathNameByHandleW.argtypes=[W.HANDLE,W.LPWSTR,W.DWORD,W.DWORD];k.GetFinalPathNameByHandleW.restype=W.DWORD
        k.CloseHandle.argtypes=[W.HANDLE];k.CloseHandle.restype=W.BOOL
        handle=k.CreateFileW(str(path),0x80000000,0x7,None,3,0x00200000,None) # OPEN_REPARSE_POINT, no execution
        if handle==ctypes.c_void_p(-1).value:raise OSError('residual_open_refused')
        try:
            final=ctypes.create_unicode_buffer(32768);n=k.GetFinalPathNameByHandleW(handle,final,len(final),0)
            if not 0<n<len(final) or final.value.removeprefix('\\\\?\\').casefold()!=str(path.absolute()).casefold():raise OSError('residual_physical_path_changed')
            descriptor=msvcrt.open_osfhandle(handle,os.O_RDONLY|os.O_BINARY);handle=None
        finally:
            if handle is not None:k.CloseHandle(handle)
    else:
        if not hasattr(os,'O_NOFOLLOW'):raise OSError('residual_nofollow_unavailable')
        descriptor=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(descriptor,'rb') as stream:
        opened=os.fstat(stream.fileno())
        if reparse(opened) or not stat.S_ISREG(opened.st_mode) or any(getattr(initial,k)!=getattr(opened,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns']):raise OSError('residual_identity_changed')
        data=stream.read(MAX_FILE_BYTES+1);after=os.fstat(stream.fileno())
        if len(data)>MAX_FILE_BYTES or len(data)!=opened.st_size or any(getattr(opened,k)!=getattr(after,k) for k in ['st_dev','st_ino','st_size','st_mtime_ns']):raise OSError('residual_read_changed')
    return data

def installation_residual_metadata(base):
    base=Path(os.path.abspath(base));directory=base/'application'
    result={'schema':'axiom.windows-installation-residuals/1','maxEntries':MAX_ENTRIES,'maxDepth':MAX_DEPTH,'entries':[],'entryLimitReached':False,'depthLimitReached':False,'hashBytes':0,'metadataUnavailable':False}
    try:
        if reparse(base.lstat()) or not stat.S_ISDIR(base.lstat().st_mode):raise OSError('owned_base_refused')
        try:root=directory.lstat()
        except FileNotFoundError:result['directoryPresent']=False;return result
        result['directoryPresent']=True
        if reparse(root) or not stat.S_ISDIR(root.st_mode):result['directoryRefused']=True;return result
        def walk(folder,parts):
            st=folder.lstat()
            if reparse(st) or not stat.S_ISDIR(st.st_mode):raise OSError('residual_directory_changed')
            # Retain at most33 names to detect the32-entry cap; never list an unbounded directory.
            with os.scandir(folder) as listing:
                for item in listing:
                    if len(result['entries'])>=MAX_ENTRIES:result['entryLimitReached']=True;break
                    rel=parts+(item.name,);row={'relativeName':safe_name(rel)};result['entries'].append(row)
                    try:
                        st=item.stat(follow_symlinks=False)
                        if reparse(st):row['type']='reparse';continue
                        if stat.S_ISDIR(st.st_mode):
                            row['type']='directory'
                            if len(rel)<MAX_DEPTH:walk(Path(item.path),rel)
                            else:result['depthLimitReached']=True
                        elif stat.S_ISREG(st.st_mode):
                            row.update(type='file',sizeBytes=st.st_size)
                            if st.st_size<=MAX_FILE_BYTES and result['hashBytes']+st.st_size<=MAX_HASH_BYTES:
                                try:data=_read_small(Path(item.path),st);row['sha256']=hashlib.sha256(data).hexdigest();result['hashBytes']+=len(data)
                                except OSError:row['hashUnavailable']=True
                            else:row['hashSkippedBound']=True
                        else:row['type']='other'
                    except OSError:row['type']='unavailable'
        walk(directory,())
    except OSError:result['metadataUnavailable']=True
    return result

def bounded_msi_log_tail(path):
    """4KiB raw tail; UTF16 MSI logs decoded on even code-unit boundaries."""
    path=Path(path);initial=path.lstat()
    if reparse(initial) or not stat.S_ISREG(initial.st_mode):return {'tailUnavailable':True}
    size=initial.st_size
    with path.open('rb') as stream:
        first=stream.read(2);utf16=first in [b'\xff\xfe',b'\xfe\xff'];offset=max(0,size-4096)
        if utf16:offset+=offset%2
        stream.seek(offset);tail=stream.read(4096)
    encoding=('utf-16-le' if first==b'\xff\xfe' else 'utf-16-be') if utf16 else 'utf-8'
    text=tail.decode(encoding,errors='replace').lstrip('\ufeff')
    clean=''.join(c for c in text if c in '\n\r\t' or ord(c)>=32)
    return {'tailText':clean,'tailOffsetBytes':offset,'tailBytes':len(tail),'tailTruncated':offset>0,'tailEncoding':'utf16' if utf16 else 'utf8'}
