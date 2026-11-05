from pathlib import Path
from http.client import HTTPConnection
import json,hashlib,time,signal
ROOT=Path(__file__).parent
m=json.loads((ROOT/'asset-manifest.json').read_text());selected=json.loads((ROOT/'changed-chunk-selection.json').read_text())['chunks'];rows=[];started=time.monotonic();failure=None
class Deadline(Exception):pass
def expired(_signal,_frame):raise Deadline('overall_deadline')
signal.signal(signal.SIGALRM,expired);signal.alarm(45)
def get(path,method='GET',headers=None):
 left=45-(time.monotonic()-started)
 if left<=0:raise Deadline('overall_deadline')
 c=HTTPConnection('127.0.0.1',5266,timeout=min(5,left))
 try:
  c.request(method,path,headers=headers or {});response=c.getresponse();body=response.read(32*1024*1024+1)
  if len(body)>32*1024*1024:raise RuntimeError('body_cap')
  assert response.getheader('X-Axiom-Preview-Source')=='95905542'
  assert response.getheader('Cache-Control')=='no-store'
  assert "form-action 'none'" in response.getheader('Content-Security-Policy','')
  return response.status,body
 finally:c.close()
try:
 for path in ['/docs','/docs/getting-started','/product','/__axiom_preview']:
  status,body=get(path);assert status==200
  if path.startswith('/docs'):assert b'Documentation contents' in body and b'<main' in body
  if path=='/__axiom_preview':assert b'source 95905542' in body and b'accounts, forms and backend actions disabled' in body
  rows.append({'path':path,'status':status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
 for item in selected:
  status,body=get(item['url']);assert status==200 and hashlib.sha256(body).hexdigest()==item['sha256']
  assert all(marker in body for marker in [b'Documentation contents',b'querySelector',b'input[type="search"]',b'addListener',b'removeListener',b'1024px'])
  rows.append({'asset':item['url'],'status':status,'sha256':item['sha256'],'markers':'focus-recovery code present; not browser-executed'})
 for method,path in [('GET','/api/auth/session'),('GET','/auth/signin'),('POST','/api/contact'),('GET','/docs?_rsc=synthetic'),('GET','/docs?unexpected=synthetic')]:
  status,body=get(path,method,{'authorization':'Bearer synthetic-not-a-credential','cookie':'synthetic=1'});assert status==403
  rows.append({'method':method,'path':path,'status':status,'scope':'guard refusal; no backend operation'})
except Exception as error:failure=type(error).__name__+':'+str(error)
finally:signal.alarm(0)
report={'sourceRevision':m['sourceRevision'],'manifestSha256':hashlib.sha256((ROOT/'asset-manifest.json').read_bytes()).hexdigest(),'checksCompleted':len(rows),'rows':rows,'elapsedSeconds':round(time.monotonic()-started,3),'failure':failure,'limits':'fixed-loopback HTTP delivery/current compiled markers and guard refusals; no browser/layout/keyboard/AT/runtime-custody/production acceptance'}
(ROOT/'http-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['checksCompleted','elapsedSeconds','failure']}))
if failure:raise SystemExit(1)
