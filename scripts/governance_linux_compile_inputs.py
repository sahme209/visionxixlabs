"""Pinned, owned source preparation. Never runs compiler/downloaded code/network.

Only the exact hash-reviewed local archive validator is imported. Its network
entry points are never called. No archive member is imported or executed.
"""
from pathlib import Path
import hashlib,json,os,re,stat,types

VENDOR='packages/verified-issuer-runtime/linux/vendor'
ARCHIVE=VENDOR+'/clock-bound-371058f8-source.tar.gz'
TREE=VENDOR+'/UPSTREAM-TREE.json'
EXPECTED=VENDOR+'/EXPECTED-PATCHED-SHA256.json'
PATCH='packages/verified-issuer-runtime/linux/clockbound-precise-origin.patch'
ADAPTER='packages/verified-issuer-runtime/linux/time_publication_adapter.rs'
READER='docs/recovery/2026-11-13/real-governance-qualification/design/linux-artifact-integration/archive-read/reader.py'
ARCHIVE_SHA='468fde829962d7c2a9fbb9cb981c07ccc2e44c34eed48d43dafce95bda2c2f02'
TREE_SHA='dc5518ce9b96bce6fa4a59e468287c02f970f843bc722ea26567ccc04b4f8b2c'
EXPECTED_SHA='1b6cc9ea0ae9d1a7e2a6dd4eb0e26da5487d451c6b2b99a2ed2fcf0f54a56cff'
MODULE='clock-bound/src/daemon/time_publication_adapter.rs'
REVISION='371058f8f6a1786d4a4ab3eed9f5f2f16eea7777'

def fail():raise ValueError('linux_compile_inputs_unavailable')
def need(ok):
    if not ok:fail()
def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return (json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=True)+'\n').encode('ascii')
def safe_path(value):
    need(isinstance(value,str) and 0<len(value.encode('utf-8'))<=512 and not value.startswith('/') and '\\' not in value)
    need(all(part not in ('','.','..') for part in value.split('/')) and all(ord(c)>=32 and ord(c)!=127 for c in value))
    return value

def apply_exact_patch(files,patch,expected):
    """No patch/git executable, fuzzy matching, new files or metadata handling."""
    try:
        need(isinstance(files,dict) and isinstance(expected,dict) and bool(expected))
        need(isinstance(patch,bytes) and 0<len(patch)<=2*1024*1024 and patch.endswith(b'\n') and b'\r' not in patch)
        lines=patch.decode('utf-8','strict').split('\n');result=dict(files);changed=set();i=0
        while i<len(lines)-1:
            need(lines[i].startswith('--- a/'));old=safe_path(lines[i][6:]);i+=1
            need(i<len(lines) and lines[i].startswith('+++ b/'));new=safe_path(lines[i][6:]);i+=1
            need(new==old and old in expected and old in files and old not in changed and isinstance(files[old],bytes))
            original=files[old].decode('utf-8','strict').split('\n');out=[];cursor=0;hunks=0
            while i<len(lines)-1 and lines[i].startswith('@@ '):
                h=re.fullmatch(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: [^\r\n]*)?',lines[i]);need(h is not None);i+=1
                at=int(h[1])-1;new_at=int(h[3])-1;old_count=int(h[2] or 1);new_count=int(h[4] or 1)
                need(0<=cursor<=at<=len(original) and old_count+new_count>0)
                out.extend(original[cursor:at]);cursor=at;need(new_at==len(out));removed=added=0
                while removed<old_count or added<new_count:
                    need(i<len(lines)-1 and bool(lines[i]) and lines[i][0] in ' +-');line=lines[i];i+=1
                    if line[0] in ' -':
                        need(removed<old_count and cursor<len(original) and original[cursor]==line[1:]);cursor+=1;removed+=1
                    if line[0] in ' +':
                        need(added<new_count);out.append(line[1:]);added+=1
                hunks+=1
            need(hunks>0);out.extend(original[cursor:]);value='\n'.join(out).encode('utf-8')
            need(sha(value)==expected[old]);result[old]=value;changed.add(old)
        need(i==len(lines)-1 and lines[i]=='' and changed==set(expected))
        return result
    except (UnicodeError,KeyError,TypeError,IndexError,OverflowError):fail()

def _read(path,maximum):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        s=os.fstat(fd);need(stat.S_ISREG(s.st_mode) and 0<s.st_size<=maximum)
        data=bytearray()
        while True:
            block=os.read(fd,min(65536,maximum+1-len(data)))
            if not block:break
            data.extend(block);need(len(data)<=maximum)
        need(len(data)==s.st_size);return bytes(data)
    finally:os.close(fd)

def _write_new(path,data):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as target:target.write(data)

def materialize(repo:Path,destination:Path)->dict:
    """Prepare a fresh owned workspace and immutable receipt/lock snapshots.

    Failure leaves any new owned partial output in place, never overwrites or
    retries. It does not grant an invocation of a compiler or a source program.
    """
    try:
        repo=Path(repo).resolve(strict=True);destination=Path(destination)
        need(not os.path.lexists(destination));parent=destination.parent.resolve(strict=True)
        need(destination.name not in ('','.','..'));destination=parent/destination.name
        need(not os.path.lexists(destination));ps=parent.stat();need(stat.S_ISDIR(ps.st_mode) and ps.st_uid==os.getuid())
        expected_bytes=_read(repo/EXPECTED,65536);need(sha(expected_bytes)==EXPECTED_SHA)
        expected=json.loads(expected_bytes);need(expected['format']==1 and expected['pinnedRevision']==REVISION and len(expected['patchedSha256'])==19)
        required={PATCH,ADAPTER,READER,'packages/verified-issuer-runtime/linux/time_publication.c','packages/verified-issuer-runtime/linux/time_publication.h'}
        need(set(expected['inputSha256'])==required)
        inputs={}
        for name,want in expected['inputSha256'].items():
            data=_read(repo/safe_path(name),2*1024*1024);need(sha(data)==want);inputs[name]=data
        archive=_read(repo/ARCHIVE,8*1024*1024);tree=_read(repo/TREE,1024*1024)
        need(sha(archive)==ARCHIVE_SHA and sha(tree)==TREE_SHA)
        # Hash checked BEFORE executing only this approved local reader module.
        # No downloaded module, initializer, macro or build script is imported.
        reader=types.ModuleType('approved_pinned_archive_validator');reader.__file__=str(repo/READER)
        exec(compile(inputs[READER],str(repo/READER),'exec'),reader.__dict__)
        files=reader.validate_archive(archive,tree);need(len(files)==322)
        patched=apply_exact_patch(files,inputs[PATCH],expected['patchedSha256']);need(MODULE not in patched)
        patched[MODULE]=inputs[ADAPTER];lock=bytes(patched['Cargo.lock'])
        manifest=tuple((name,sha(data),len(data)) for name,data in sorted(patched.items()))
        manifest_bytes=canonical([{'path':name,'sha256':digest,'bytes':length} for name,digest,length in manifest])
        receipt_data={'format':1,'revision':REVISION,'sourceRoot':str(destination/'source'),'upstreamFiles':322,'patchedFiles':19,'materializedFiles':len(patched),'archiveSha256':ARCHIVE_SHA,'treeSha256':TREE_SHA,'expectedManifestSha256':EXPECTED_SHA,'inputSha256':dict(expected['inputSha256']),'sourceManifestSha256':sha(manifest_bytes),'lockSha256':sha(lock),'downloadedSourceExecuted':False,'compilerInvoked':False}
        receipt=canonical(receipt_data)
        os.mkdir(destination,0o700);source=destination/'source';reader.save_verified(str(source),patched)
        native=destination/'native';reader.save_verified(str(native),{'time_publication.c':inputs['packages/verified-issuer-runtime/linux/time_publication.c'],'time_publication.h':inputs['packages/verified-issuer-runtime/linux/time_publication.h']})
        for current,dirs,names in os.walk(source,followlinks=False):
            s=os.lstat(current);need(stat.S_ISDIR(s.st_mode) and stat.S_IMODE(s.st_mode)==0o700 and s.st_uid==os.getuid())
            for name in dirs:
                need(stat.S_ISDIR(os.lstat(Path(current)/name).st_mode))
            for name in names:
                p=Path(current)/name;s=os.lstat(p);relative=p.relative_to(source).as_posix()
                need(stat.S_ISREG(s.st_mode) and stat.S_IMODE(s.st_mode)==0o600 and s.st_uid==os.getuid())
                need(_read(p,16*1024*1024)==patched[relative] if patched[relative] else s.st_size==0)
        _write_new(destination/'SOURCE-MANIFEST.json',manifest_bytes);_write_new(destination/'INPUTS.json',receipt)
        return {'sourceRoot':source,'receipt':receipt,'receiptSha256':sha(receipt),'lockBytes':lock,'manifest':manifest,'manifestSha256':sha(manifest_bytes),'nativeC':native/'time_publication.c','nativeHeader':native/'time_publication.h'}
    except (OSError,UnicodeError,KeyError,TypeError,IndexError,json.JSONDecodeError):fail()
