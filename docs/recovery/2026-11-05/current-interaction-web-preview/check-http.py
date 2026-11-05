from pathlib import Path
from http.client import HTTPConnection
import json,hashlib,time
ROOT=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/current-interaction-web-preview')
m=json.loads((ROOT/'asset-manifest.json').read_text());selection=json.loads((ROOT/'changed-chunk-selection.json').read_text())['chunks'];rows=[];started=time.monotonic();failure=None

def get(path,method='GET',headers=None):
 left=45-(time.monotonic()-started)
 if left<=0:raise RuntimeError('overall_deadline')
 c=HTTPConnection('127.0.0.1',5264,timeout=min(5,left))
 try:
  c.request(method,path,headers=headers or {});r=c.getresponse();b=r.read(32*1024*1024+1)
  if len(b)>32*1024*1024:raise RuntimeError('body_cap')
  assert r.getheader('X-Axiom-Preview-Source')=='266b3987'
  assert r.getheader('Cache-Control')=='no-store'
  assert "form-action 'none'" in r.getheader('Content-Security-Policy','')
  return r.status,b
 finally:c.close()
try:
 for path in ['/','/contact','/product','/docs','/__axiom_preview']:
  status,b=get(path);assert status==200
  if path=='/contact':assert b'What went wrong?' in b and b'Work email' in b
  if path=='/product':assert b'id="workflow-overview"' in b
  if path=='/__axiom_preview':assert b'source 266b3987' in b and b'accounts, forms and backend actions disabled' in b
  rows.append({'path':path,'status':status,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 for family,paths in selection.items():
  for path in paths:
   status,b=get(path);expected=m['nextStaticAssets'][path];assert status==200 and hashlib.sha256(b).hexdigest()==expected['sha256']
   if family=='contact':assert b'We could not confirm that your message was recorded.' in b
   if family=='command':assert b'workflow-overview' in b and b'isComposing' in b and b'229' in b
   rows.append({'asset':path,'family':family,'status':status,'sha256':expected['sha256'],'markerCheck':'present, not executed'})
 for method,path in [('GET','/api/auth/session'),('GET','/auth/signin'),('POST','/api/contact'),('GET','/docs?_rsc=synthetic'),('GET','/docs?unexpected=synthetic')]:
  status,b=get(path,method,{'authorization':'Bearer synthetic-not-a-credential','cookie':'synthetic=1'});assert status==403
  rows.append({'path':path,'method':method,'status':status,'qualification':'guard refused; not backend action acceptance'})
except Exception as e:failure=type(e).__name__+':'+str(e)
report={'sourceRevision':m['sourceRevision'],'manifestSha256':hashlib.sha256((ROOT/'asset-manifest.json').read_bytes()).hexdigest(),'checksCompleted':len(rows),'rows':rows,'elapsedSeconds':round(time.monotonic()-started,3),'failure':failure,'limits':'fixedloopback guardedHTTP delivery/compiledmarkers/refusal only; not browser/IME/AT/performance/Governance/customer acceptance'}
(ROOT/'http-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['checksCompleted','elapsedSeconds','failure']}))
if failure:raise SystemExit(1)
