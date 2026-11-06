from pathlib import Path
import hashlib,json,os,stat
old=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-a-source-diagnostics-b8ced685/packet.json');p=json.loads(old.read_text());source=Path(p['repo']);dest=old.parent.parent/'2026-11-06-source-fixture-b8ced685-v2';dest.mkdir(mode=0o700);repo=dest/'repo';repo.mkdir(mode=0o700)
manifest={}
def state(s):return (s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode,s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)
def copy_file(src,dst,expected=None,mode=None):
 before=src.lstat();assert stat.S_ISREG(before.st_mode) and not src.is_symlink();assert before.st_size<=256*1024*1024
 data=src.read_bytes();after=src.lstat();assert state(before)==state(after)
 sha=hashlib.sha256(data).hexdigest()
 if expected:assert sha==expected['sha256'] and len(data)==expected['size']
 dst.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
 fd=os.open(dst,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode if mode is not None else 0o600)
 with os.fdopen(fd,'wb') as out:out.write(data)
 assert hashlib.sha256(dst.read_bytes()).hexdigest()==sha
 manifest[str(dst.relative_to(dest))]={'sha256':sha,'size':len(data),'mode':stat.S_IMODE(dst.stat().st_mode)}
for name,binding in p['sourceBindings'].items():copy_file(source/name,repo/name,binding,binding['mode'])
gitdir=repo/'.git';gitdir.mkdir(mode=0o700);(gitdir/'objects').mkdir(mode=0o700)
count=total=0
for root,dirs,files in os.walk(source/'.git/objects',followlinks=False):
 for name in dirs:assert not (Path(root)/name).is_symlink()
 for name in files:
  src=Path(root)/name;relative=src.relative_to(source/'.git/objects');assert relative.parts[0]!='info' or name!='alternates'
  total+=src.stat().st_size;count+=1;assert total<=256*1024*1024 and count<=20000
  copy_file(src,gitdir/'objects'/relative)
for name,data in [('HEAD','ref: refs/heads/qualification\n'),('refs/heads/qualification',p['sourceRevision']+'\n'),('config','[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tfilemode = true\n')]:
 dst=gitdir/name;dst.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
 fd=os.open(dst,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as out:out.write(data)
 manifest[str(dst.relative_to(dest))]={'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'size':dst.stat().st_size,'mode':stat.S_IMODE(dst.stat().st_mode)}
receipt={'sourceRevision':p['sourceRevision'],'originalRepo':str(source),'stagedRepo':str(repo),'gitObjectFiles':count,'gitObjectBytes':total,'sourceFileCount':len(p['sourceBindings']),'files':manifest,'gitExecuted':False,'artifactExecutionPerformed':False,'qualification':'unavailable'}
(dest/'copy-receipt.json').write_text(json.dumps(receipt,sort_keys=True,indent=2)+'\n');(dest/'copy-receipt.json').chmod(0o600)
print(json.dumps({k:v for k,v in receipt.items() if k!='files'}))
