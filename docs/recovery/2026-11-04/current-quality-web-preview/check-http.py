from pathlib import Path
from http.client import HTTPConnection
import json,hashlib,re,html,time
ROOT=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-04/current-quality-web-preview')
m=json.loads((ROOT/'asset-manifest.json').read_text());rows=[];started=time.monotonic();assets=set()
def get(path,method='GET',headers=None):
    left=45-(time.monotonic()-started)
    if left<=0:raise RuntimeError('overall_http_deadline')
    c=HTTPConnection('127.0.0.1',5262,timeout=min(5,left))
    try:
        c.request(method,path,headers=headers or {});res=c.getresponse();body=res.read(32*1024*1024+1)
        if len(body)>32*1024*1024:raise RuntimeError('body_cap')
        assert res.getheader('X-Axiom-Preview-Source')=='0c9d0e40'
        assert res.getheader('Cache-Control')=='no-store'
        assert "form-action 'none'" in res.getheader('Content-Security-Policy','')
        return res.status,body
    finally:c.close()
for path in ['/product','/integrations','/demo','/docs','/__axiom_preview']:
    status,body=get(path);assert status==200
    if path=='/docs':assert b'Find a guide' in body and b'Documentation contents' in body
    if path=='/__axiom_preview':assert b'source 0c9d0e40' in body and b'accounts, forms and backend actions disabled' in body
    assets.update(html.unescape(x) for x in re.findall(r'(?:src|href)="([^"]+)"',body.decode()) if html.unescape(x) in m['nextStaticAssets'])
    rows.append({'path':path,'status':status,'bytes':len(body)})
docs_chunks=[]
for path,item in m['nextStaticAssets'].items():
    if path.endswith('.js'):
        content=(Path(m['buildStage'])/item['relativePath']).read_bytes()
        if b'docs-contents-panel' in content:
            assert b'isComposing' in content and b'229' in content
            docs_chunks.append(path)
assert docs_chunks
selected=list(dict.fromkeys(docs_chunks+sorted(assets)))[:20];assert len(selected)==20
for path in selected:
    status,body=get(path);expected=m['nextStaticAssets'][path];assert status==200 and hashlib.sha256(body).hexdigest()==expected['sha256']
    rows.append({'asset':path,'status':status,'sha256':expected['sha256'],'docsContentsChunk':path in docs_chunks})
for method,path in [('GET','/api/auth/session'),('GET','/auth/signin'),('POST','/product'),('GET','/docs?_rsc=synthetic'),('GET','/docs?unexpected=synthetic')]:
    status,body=get(path,method,{'authorization':'Bearer synthetic-not-a-credential','cookie':'synthetic=1'});assert status==403
    rows.append({'path':path,'method':method,'status':status})
report={'sourceRevision':m['sourceRevision'],'checks':len(rows),'rows':rows,'docsChunks':docs_chunks,'elapsedSeconds':round(time.monotonic()-started,3),'limits':'localHTTPdelivery/sourceasset/refusal only, not actualbrowser/IME/AT/performance/Gov acceptance'}
(ROOT/'http-checks.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'checks':len(rows),'docsChunks':len(docs_chunks),'elapsedSeconds':report['elapsedSeconds']}))
