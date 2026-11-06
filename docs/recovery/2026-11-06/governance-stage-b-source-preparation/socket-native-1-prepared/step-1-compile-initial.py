"""Fixed conditional native step; requires prior exact operator approval/review."""
from pathlib import Path
import hashlib,json,sys
sys.dont_write_bytecode=True
SCRIPTS=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts')
EXPECTED={'/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/socket_native_initial_batch.py': '8bbd92225a245aac6c3c98e08fba232764d6cf4399decda25260c976917cf709', '/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/scripts/governance_local_issuer/socket_native_peer_batch.py': 'd59f7ed60b181849b6f3b8f51169eb3dbef19a888799891c1c355a5591be8a6f', '/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-socket-native-1/compile-packet.json': '0c9d459cad82251fffc3a9fff5d00f8c644379232dfbe9fac6f53c951f3bc6f0'}
def main():
 if len(sys.argv)!=1:raise RuntimeError('no_selectors')
 for path,digest in EXPECTED.items():
  if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=digest:raise RuntimeError('fixed_source_changed')
 sys.path.insert(0,str(SCRIPTS))
 from governance_local_issuer import socket_native_initial_batch as initial,socket_native_peer_batch as peer
 value=initial.execute_compile(initial._json(initial.ROOT/'compile-packet.json'))
 print(json.dumps({'step':'1-compile-initial','executionAuthorized':False,'installationReady':False}))
if __name__=='__main__':main()
