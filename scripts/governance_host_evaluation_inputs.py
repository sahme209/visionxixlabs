"""Source-data materialization only; never imports or executes archive members."""
from pathlib import Path
import hashlib, json, tarfile
from governance_linux_compile_inputs import apply_exact_patch, EXPECTED_SHA
BASE='packages/verified-issuer-runtime/linux/'
def base_files(repo):
 repo=Path(repo)
 raw=(repo/(BASE+'vendor/clock-bound-371058f8-source.tar.gz')).read_bytes()
 if hashlib.sha256(raw).hexdigest()!='468fde829962d7c2a9fbb9cb981c07ccc2e44c34eed48d43dafce95bda2c2f02':raise ValueError('archive_changed')
 import io
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:gz') as archive:
  files={m.name.split('/',1)[1]:archive.extractfile(m).read() for m in archive.getmembers() if m.isfile()}
 expected_raw=(repo/(BASE+'vendor/EXPECTED-PATCHED-SHA256.json')).read_bytes()
 if hashlib.sha256(expected_raw).hexdigest()!=EXPECTED_SHA:raise ValueError('historical_manifest_changed')
 expected=json.loads(expected_raw)
 for name,want in expected['inputSha256'].items():
  if hashlib.sha256((repo/name).read_bytes()).hexdigest()!=want:raise ValueError('historical_input_changed')
 result=apply_exact_patch(files,(repo/(BASE+'clockbound-precise-origin.patch')).read_bytes(),expected['patchedSha256'])
 result['clock-bound/src/daemon/time_publication_adapter.rs']=(repo/(BASE+'time_publication_adapter.rs')).read_bytes()
 return result

def evaluation_files(repo):
 repo=Path(repo)
 files=base_files(repo)
 expected=json.loads((repo/(BASE+'host-evaluation-patched-sha256.json')).read_text())
 files=apply_exact_patch(files,(repo/(BASE+'clockbound-host-evaluation.patch')).read_bytes(),expected)
 files['clock-bound/src/daemon/host_evaluation.rs']=(repo/(BASE+'host_evaluation.rs')).read_bytes()
 files['clock-bound/src/bin/axiom-host-evaluation.rs']=(repo/(BASE+'host_evaluation_main.rs')).read_bytes()
 return files
