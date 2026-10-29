from pathlib import Path
import json,hashlib,os,sys
root=Path(__file__).resolve().parents[3]
m=json.loads((Path(__file__).parent/'source-files.json').read_text())
errors=[]
for item in m['files']:
 p=root/item['path']
 try:
  b=os.readlink(p).encode() if p.is_symlink() else p.read_bytes()
  if len(b)!=item['bytes'] or hashlib.sha256(b).hexdigest()!=item['sha256']:errors.append(item['path'])
 except OSError:errors.append(item['path'])
if errors:
 print('Source verification FAILED: '+str(len(errors))+' files differ or are missing.')
 for name in errors:print(name)
 sys.exit(1)
print('Source verification PASS: '+str(len(m['files']))+' files match the recovery snapshot.')
