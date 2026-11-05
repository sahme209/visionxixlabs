from pathlib import Path
from http.client import HTTPConnection
from html.parser import HTMLParser
from urllib.parse import urlsplit,urljoin,unquote
import json,hashlib,time,collections
OUT=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-05/current-public-link-audit')
MANIFEST=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-04/current-quality-web-preview/asset-manifest.json')
m=json.loads(MANIFEST.read_text());previous={'/product','/integrations','/demo','/docs'};targets=[p for p in m['publicPages'] if p not in previous];assert len(targets)==43
class Page(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.ids=set()
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get('id'):self.ids.add(a['id'])
        if tag=='a' and a.get('href'):self.links.append(a['href'])
started=time.monotonic();pages=[];links=[];ids={};reason=None
try:
    for path in targets:
        remaining=45-(time.monotonic()-started)
        if remaining<=0:raise RuntimeError('overall_deadline')
        c=HTTPConnection('127.0.0.1',5262,timeout=min(5,remaining))
        try:
            c.request('GET',path);res=c.getresponse();body=res.read(32*1024*1024+1)
            if len(body)>32*1024*1024:raise RuntimeError('body_cap')
            assert res.getheader('X-Axiom-Preview-Source')=='0c9d0e40'
            assert res.getheader('Cache-Control')=='no-store'
            assert "form-action 'none'" in res.getheader('Content-Security-Policy','')
            page={'path':path,'status':res.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()}
            if res.status==200:
                parser=Page();parser.feed(body.decode('utf-8'));page['anchorCount']=len(parser.links);ids[path]=sorted(parser.ids)
                for href in parser.links:links.append({'source':path,'href':href})
            else:page['observation']='not successful HTML; may be preview redirect refusal, actualsource diagnosis required'
            pages.append(page)
        finally:c.close()
except Exception as error:reason=type(error).__name__+':'+str(error)
for row in links:
    u=urlsplit(urljoin('http://127.0.0.1:5262'+row['source'],row['href']))
    if u.scheme not in {'http','https'}:kind='non-http-reference-not-requested'
    elif u.netloc!='127.0.0.1:5262':kind='external-not-requested'
    elif u.query:kind='local-query-unverified'
    elif u.path.startswith(('/api','/auth','/account','/operator','/dashboard','/admin','/billing','/desktop','/workspace-handoff','/control')):kind='private-or-action-preview-blocked-not-requested'
    elif u.path in m['publicPages']:
        kind='curated-public-target'
        if u.fragment:row['fragmentObserved']=None if u.path not in ids else unquote(u.fragment) in ids[u.path]
    elif u.path in m['publicAssets'] or u.path in m['nextStaticAssets']:kind='manifest-asset-not-requested'
    else:kind='outside-curated-manifest-unverified'
    row['classification']=kind
counts=dict(collections.Counter(p['status'] for p in pages));classes=dict(collections.Counter(x['classification'] for x in links))
report={'sourceRevision':m['sourceRevision'],'manifestSha256':hashlib.sha256(MANIFEST.read_bytes()).hexdigest(),'newPageTargets':43,'completedPageRequests':len(pages),'previousFourPublicPagesNotRepeated':sorted(previous),'statusCounts':counts,'linkCount':len(links),'linkClassifications':classes,'pages':pages,'links':links,'idsBySuccessfulPage':ids,'stopReason':reason,'elapsedSeconds':round(time.monotonic()-started,3),'limits':'fixedlocalGETdelivery/anchorinventory only; external/private/query/assettargets notfollowed, no browser/AT/fullsite/production acceptance'}
(OUT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['completedPageRequests','statusCounts','linkCount','linkClassifications','stopReason','elapsedSeconds']}))
if reason:raise SystemExit(1)
