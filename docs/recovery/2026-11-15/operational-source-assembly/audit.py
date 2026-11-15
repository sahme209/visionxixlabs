"""Text-only cross-check of current operational source layers. No compiler/output runs."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys,tempfile
ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'scripts'))
from governance_host_evaluation_inputs import evaluation_files
from governance_linux_compile_inputs import safe_path
BASE=ROOT/'packages/verified-issuer-runtime/linux'

def sha(data):return hashlib.sha256(data).hexdigest()
def exact(files,patch):
 lines=patch.decode('utf-8').splitlines(True);i=0;result=dict(files);changed=set()
 while i<len(lines):
  assert lines[i].startswith('--- a/');name=safe_path(lines[i][6:].strip());i+=1
  assert name not in changed and lines[i]=='+++ b/'+name+'\n';i+=1
  existed=name in files;original=files.get(name,b'').decode('utf-8').splitlines(True);out=[];cursor=0;hunks=0
  while i<len(lines) and lines[i].startswith('@@ '):
   h=re.fullmatch(r'@@ -(\d+),(\d+) \+(\d+),(\d+) @@[^\r\n]*\n',lines[i]);assert h;i+=1
   old_at,old_count,new_at,new_count=map(int,h.groups());at=max(0,old_at-1)
   assert cursor<=at<=len(original) and old_count+new_count>0
   if not existed:assert old_at==0 and old_count==0 and hunks==0
   out+=original[cursor:at];cursor=at;assert new_at-1==len(out);removed=added=0
   while removed<old_count or added<new_count:
    line=lines[i];i+=1;assert line and line[0] in ' +-'
    if line[0] in ' -':assert removed<old_count and cursor<len(original) and original[cursor]==line[1:];cursor+=1;removed+=1
    if line[0] in ' +':assert added<new_count;out.append(line[1:]);added+=1
   hunks+=1
  assert hunks;out+=original[cursor:];result[name]=''.join(out).encode();changed.add(name)
 return result,changed

def main():
 if not __debug__:raise RuntimeError('source_audit_requires_assertions')
 files=evaluation_files(ROOT);patch=(BASE/'clockbound-operational-time.patch').read_bytes()
 expected,changed=exact(files,patch)
 stage=Path(tempfile.mkdtemp(prefix='axiom-operational-source-assembly-'));os.chmod(stage,0o700)
 for name,data in files.items():
  target=stage/safe_path(name);target.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
  with target.open('xb') as out:out.write(data)
  os.chmod(target,0o600)
 commands=[]
 for args in [['/usr/bin/git','apply','--check',str(BASE/'clockbound-operational-time.patch')],['/usr/bin/git','apply','--whitespace=error-all',str(BASE/'clockbound-operational-time.patch')]]:
  p=subprocess.run(args,cwd=stage,env={'PATH':'/usr/bin:/bin','LANG':'C','GIT_CONFIG_NOSYSTEM':'1','GIT_CONFIG_GLOBAL':'/dev/null'},capture_output=True,timeout=15)
  commands.append({'argv':args,'exitCode':p.returncode,'stdout':p.stdout.decode('utf-8','replace'),'stderr':p.stderr.decode('utf-8','replace')})
  if p.returncode:break
 actual={p.relative_to(stage).as_posix():p.read_bytes() for p in stage.rglob('*') if p.is_file()}
 source_unchanged=set(files)-changed
 report={'scope':'text source assembly only','stage':str(stage),'inputFiles':len(files),'expectedAfterPatchFiles':len(expected),'patchChangedFiles':sorted(changed),'independentGit':commands,'byteIdenticalAlgorithms':actual==expected,'unchangedSourceFiles':len(source_unchanged),'unchangedFilesMatch':all(actual.get(n)==files[n] for n in source_unchanged),'nativeCompiled':False,'nativeExecuted':False,'targetCompatibilityVerified':False,'installedPackageQualified':False,'governanceEnabled':False,'pythonAssertionsEnabled':__debug__,'gitVersion':subprocess.check_output(['/usr/bin/git','--version'],env={'PATH':'/usr/bin:/bin','LANG':'C'}).decode().strip()}
 if actual==expected:
  expected['clock-bound/src/daemon/operational_publication.rs']=(BASE/'operational_publication.rs').read_bytes()
  p=stage/'clock-bound/src/daemon/operational_publication.rs';assert not p.exists();p.write_bytes(expected['clock-bound/src/daemon/operational_publication.rs']);os.chmod(p,0o600)
  report['completeRustSourceFiles']=len(expected)
  report['cargoLockUnchanged']=expected['Cargo.lock']==files['Cargo.lock']
  report['stockEntrypointUnchanged']=expected['clock-bound/src/bin/clockbound.rs']==files['clock-bound/src/bin/clockbound.rs']
  (HERE/'ASSEMBLED-RUST-SOURCE.json').write_text(json.dumps({n:{'sha256':sha(data),'bytes':len(data)} for n,data in sorted(expected.items())},indent=2)+'\n')
 inputs=['scripts/governance_host_evaluation_inputs.py','scripts/governance_linux_compile_inputs.py',*['packages/verified-issuer-runtime/linux/'+n for n in ['vendor/clock-bound-371058f8-source.tar.gz','vendor/EXPECTED-PATCHED-SHA256.json','vendor/UPSTREAM-TREE.json','clockbound-precise-origin.patch','clockbound-host-evaluation.patch','host-evaluation-patched-sha256.json','clockbound-operational-time.patch','time_publication_adapter.rs','host_evaluation.rs','host_evaluation_main.rs','operational_publication.rs','time_operational_owner.c','time_operational_status.c','time_operational_status.h','time_operational_binding.c','time_operational_binding.h','time_parent_binding.c','time_parent_binding.h','time_worker.c','time_worker_protocol.c','time_worker_protocol.h','time_publication.c','time_publication.h']],'scripts/linux-native-behavior/runtime_profile.h']
 report['sourceInputSha256']={n:sha((ROOT/n).read_bytes()) for n in inputs}
 report['auditSourceSha256']=sha(Path(__file__).read_bytes())
 (HERE/'SOURCE-ASSEMBLY-RESULT.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report))
 return 0 if report['byteIdenticalAlgorithms'] else 1
if __name__=='__main__':raise SystemExit(main())
