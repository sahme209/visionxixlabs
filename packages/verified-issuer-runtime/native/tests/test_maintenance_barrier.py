"""Exact extracted existing native barrier; fake syscalls only, no provisioning."""
from pathlib import Path
import argparse,hashlib,json,re,subprocess,tempfile
parser=argparse.ArgumentParser();parser.add_argument('--evidence-dir',type=Path,required=True);args=parser.parse_args()
args.evidence_dir.mkdir(parents=True,exist_ok=False)
source=Path(__file__).resolve().parents[1]/'synthetic_resource_provisioner.m'
raw=source.read_bytes();text=raw.decode();matches=re.findall(r'static int sync_fd\(int fd\)\{[^{}]+\}',text)
assert len(matches)==1
harness='#define _DARWIN_C_SOURCE 1\n#include <fcntl.h>\n#include <unistd.h>\n#include <assert.h>\n#include <stdio.h>\nstatic int full,weak,fail;\nstatic int __attribute__((unused)) fake_fcntl(int fd,int cmd,...){assert(fd==23&&cmd==F_FULLFSYNC);full++;return fail?-1:0;}\nstatic int __attribute__((unused)) fake_fsync(int fd){assert(fd==23);weak++;return 0;}\n#define fcntl fake_fcntl\n#define fsync fake_fsync\n'+matches[0]+'\nint main(void){assert(sync_fd(23));assert(full==1&&weak==0);fail=1;assert(!sync_fd(23));assert(full==2&&weak==0);puts("actual maintenance barrier uses full sync once and refuses error: PASS");return 0;}\n'
with tempfile.TemporaryDirectory(prefix='axiom-maintenance-barrier-') as tmp:
 c=Path(tmp)/'case.c';binary=Path(tmp)/'case';c.write_text(harness)
 argv=['/usr/bin/clang','-std=c11','-Wall','-Wextra','-Werror',str(c),'-o',str(binary)]
 built=subprocess.run(argv,capture_output=True,timeout=20)
 (args.evidence_dir/'compile.log').write_bytes(built.stdout+built.stderr);assert built.returncode==0
 imports=subprocess.run(['/usr/bin/nm','-u',str(binary)],capture_output=True,timeout=10);assert imports.returncode==0
 (args.evidence_dir/'imports.log').write_bytes(imports.stdout);assert not re.search(rb'\b_(?:fcntl|fsync)\b',imports.stdout)
 result=subprocess.run([str(binary)],capture_output=True,timeout=10)
 (args.evidence_dir/'result.log').write_bytes(result.stdout+result.stderr)
 (args.evidence_dir/'receipt.json').write_text(json.dumps({'source_sha256':hashlib.sha256(raw).hexdigest(),'exact_function_sha256':hashlib.sha256(matches[0].encode()).hexdigest(),'transform':'exact one function extraction plus fixed fake syscall harness','exit':result.returncode,'actual_provisioner_run':False,'actual_barrier_call':False},indent=2)+'\n')
 print(json.dumps({'exit':result.returncode}));raise SystemExit(0 if result.returncode==0 else 1)
