"""Inspect actual Next compiler output; never import or execute app/native artifacts."""
from pathlib import Path
import hashlib,json,sys
receipt=Path(sys.argv[1]);build=json.loads(receipt.read_text());assert build['accepted'] is True
root=Path(build['stage'])/'source/.next';manifest=root/'prerender-manifest.json';routes=json.loads(manifest.read_text())['routes'];app=json.loads((root/'server/app-paths-manifest.json').read_text())
result={'routeCompiled':'/auth/error/page' in app,'staticallyCached':'/auth/error' in routes,'prerenderManifestSha256':hashlib.sha256(manifest.read_bytes()).hexdigest(),'buildReceiptSha256':hashlib.sha256(receipt.read_bytes()).hexdigest()}
print(json.dumps(result))
raise SystemExit(0 if result['routeCompiled'] and not result['staticallyCached'] else 1)
