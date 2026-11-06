"""Fixed principal-free producer emission only; prepared, not executed."""
import hashlib,json,sys
from pathlib import Path
sys.dont_write_bytecode=True
REPO=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-lab-source-4/repo')
PACKET=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-socket-producer-1/packet/packet.json')
PACKET_SHA='b759a7f395c102adb27e7a76ea05d616bb39a8f44816d9e96f3f399dd59099e2'
SOURCE=Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab/2026-11-06-stage-b-lab-source-4/SOURCE.json')
SOURCE_SHA='2852f6b0fb0f494dac6fe0c2457f39c8105c77e06daefd64666e62307a2615b4'
def main():
 if len(sys.argv)!=1 or hashlib.sha256(PACKET.read_bytes()).hexdigest()!=PACKET_SHA or hashlib.sha256(SOURCE.read_bytes()).hexdigest()!=SOURCE_SHA:raise RuntimeError('fixed_inputs_changed')
 sys.path.insert(0,str(REPO/'scripts'))
 from governance_local_issuer import stage_a_packet as api
 p=api.verify_stage_a_packet(PACKET)
 if p['repo']!=str(REPO) or p['sourceRevision']!='1369f4837f3fde73eb873449501fb2b7c7947587':raise RuntimeError('fixed_source_required')
 result=api.execute_stage_a_packet(PACKET)
 print(json.dumps({'status':result['status'],'executionAuthorized':False,'installationReady':False}))
 return 0 if result['status']=='artifact_observed' else 1
if __name__=='__main__':raise SystemExit(main())
