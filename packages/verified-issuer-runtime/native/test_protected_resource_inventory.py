"""Ordinary native fixtures only: no restriction, mount, service or identity."""
from pathlib import Path
import json,subprocess,tempfile
source=Path(__file__).resolve().parent
root=Path(tempfile.mkdtemp(prefix='axiom-protected-resource-ordinary-',dir='/private/tmp'));root.chmod(0o700)
results=[]
for name in ('protected_resource_inventory_test','protected_resource_inventory_fixture'):
    binary=root/name
    compile_result=subprocess.run(['/usr/bin/xcrun','clang','-std=c11','-Wall','-Wextra','-Werror','-I'+str(source),str(source/(name+'.c')),str(source/'protected_resource_inventory.c'),'-o',str(binary)],capture_output=True,text=True,timeout=30)
    item={'name':name,'compileExit':compile_result.returncode,'compileError':compile_result.stderr[-4096:]}
    if compile_result.returncode==0:
        run=subprocess.run([str(binary)],capture_output=True,text=True,timeout=15)
        item.update(exit=run.returncode,stdout=run.stdout[-4096:],stderr=run.stderr[-4096:])
    results.append(item)
report={'scope':'ordinary owned fixtures; existing readonly OS root=/ is NOT actual package qualification','unattributedLineage':'UNPROVEN','profileMountServiceIdentityExecuted':False,'results':results}
(root/'result.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'root':str(root),**report},indent=2))
if any(item.get('exit')!=0 for item in results):raise SystemExit(1)
