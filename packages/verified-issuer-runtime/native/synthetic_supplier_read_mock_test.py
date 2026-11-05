"""Derived isolated read simulation; no production/native Security invocation."""
from pathlib import Path
import argparse,hashlib,json,subprocess,tempfile
root=Path(__file__).resolve().parents[3]
native=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--evidence-dir',type=Path,required=True,help='Fresh evidence directory; never overwrite historical receipts')
args=parser.parse_args()
evidence=args.evidence_dir
evidence.mkdir(parents=True,exist_ok=False)
source=native/'origin_private_resource_supplier.m'
original=source.read_bytes()
before=b'''static int installation_context(void){
 /* Actual installed backing identity, principal and pre-main integrity remain
  * unresolved. operational is immutable false; no manifest/flag can qualify. */
 return axiom_private_supplier_operational()&&axiom_owner_binding_current();
}'''
after=b'''static int installation_context(void){
 /* DERIVED ISOLATED TEST CONTEXT ONLY: not installation authority. */
 return ax_test_context();
}'''
assert original.count(before)==1,'exact context source port changed; review required'
derived=original.replace(before,after,1)
assert derived.count(after)==1 and derived.replace(after,before,1)==original
with tempfile.TemporaryDirectory(prefix='axiom-supplier-read-mock-') as temp:
 temp=Path(temp);copy=temp/'supplier-context-derived.m';copy.write_bytes(derived)
 binary=temp/'isolated-read-mock'
 cmd=['clang','-fobjc-arc','-Wall','-Wextra','-Werror','-Wno-deprecated-declarations','-I',str(native),'-DAX_DERIVED_SUPPLIER_SOURCE="'+str(copy)+'"',str(native/'synthetic_supplier_read_mock_test.m'),str(native/'synthetic_resource_contract.c'),str(native/'cssm_policy_copy.c'),str(native/'cssm_policy_inspect.c'),'-framework','Foundation','-framework','Security','-o',str(binary)]
 build=subprocess.run(cmd,capture_output=True,text=True)
 (evidence/'read-build.log').write_text(build.stdout+build.stderr)
 assert build.returncode==0,'read mock compile failed'
 nm=subprocess.run(['nm','-u',str(binary)],capture_output=True,text=True,check=True).stdout
 (evidence/'read-imports.log').write_text(nm)
 for line in nm.splitlines():
  name=line.split()[-1]
  assert not name.startswith(('_Sec','_CSSM','_ax_cssm')),line
 (evidence/'read-import-check.log').write_text('PASS zero original Security/CSSM/policy function imports before test execution\n')
 run=subprocess.run([str(binary)],capture_output=True,text=True)
 (evidence/'read-green.log').write_text(run.stdout+run.stderr)
 receipt={'source':str(source.relative_to(root)),'original_sha256':hashlib.sha256(original).hexdigest(),'derived_sha256':hashlib.sha256(derived).hexdigest(),'replacement_count':1,'before_utf8':before.decode(),'after_utf8':after.decode(),'reversed_bytes_equal_original':derived.replace(after,before,1)==original,'production_source_unchanged':source.read_bytes()==original,'test_sha256':hashlib.sha256((native/'synthetic_supplier_read_mock_test.m').read_bytes()).hexdigest(),'build_argv':cmd,'executed_argv':[str(binary)],'task_added_environment':{},'security_function_imports':0,'test_exit':run.returncode,'boundary':'Only installation_context body changed in temporary derived supplier; actual read bodies byte-identical; all Security APIs inert mock; clock deterministic mock; no operational gate replacement or startup acceptance.'}
 (evidence/'read-transform-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
 assert run.returncode==0,'read mock assertion failed'
 print(run.stdout,end='')
