"""One bounded owned-loopback acceptance sequence, never follows redirects/retries."""
from pathlib import Path
from http.client import HTTPConnection
import hashlib,json,re,html,sys
ROOT=Path('/private/tmp/axiom-preview-harness-1b23c208-v3-20261104')
OUT=ROOT/'http-evidence';OUT.mkdir(exist_ok=False)
manifest=json.loads((ROOT/'asset-manifest.json').read_bytes());records=[]

def request(label,target,status=200,method='GET',expected_hash=None,contains=None,image=False):
    connection=HTTPConnection('127.0.0.1',5224,timeout=20)
    record={'label':label,'target':target,'method':method,'expectedStatus':status}
    records.append(record)
    try:
        connection.request(method,target,body=b'' if method not in {'GET','HEAD'} else None)
        response=connection.getresponse();body=response.read(32*1024*1024+1);headers=response.getheaders()
        record.update(status=response.status,bytes=len(body),sha256=hashlib.sha256(body).hexdigest(),headers=headers)
        (OUT/(label+'.body')).write_bytes(body)
        assert len(body)<=32*1024*1024,'response bound'
        assert response.status==status,f'expected{status} received{response.status}'
        lower={key.lower():value for key,value in headers}
        assert lower.get('x-axiom-preview-source')=='1b23c208','source header'
        assert "form-action 'none'" in lower.get('content-security-policy',''),'CSP form guard'
        assert not any(key.lower() in {'set-cookie','location','refresh','link'} for key,value in headers),'forbidden response header'
        if expected_hash:assert record['sha256']==expected_hash,'exact asset hash'
        if contains:
            text=body.decode('utf-8')
            for value in contains:assert value in text,'SSR text '+value
        if image:assert lower.get('content-type','').startswith('image/'),'image response type'
        record['passed']=True
        return body
    except Exception as error:
        record['passed']=False;record['failure']=str(error);raise
    finally:
        connection.close()
        (OUT/'results.json').write_text(json.dumps({'simulationOnly':True,'customerEligible':False,'records':records},indent=2)+'\n')

try:
    request('wrapper','/__axiom_preview',contains=['Local HTML/static preview','source 1b23c208'])
    docs=request('docs','/docs',contains=['Find a guide','Filters guide titles and section names'])
    request('one-doc','/docs/permissions-model',contains=['Find a guide'])
    for label,target in [('product','/product'),('security','/security'),('demo','/demo')]:request(label,target)
    css=[]
    for value in re.findall(r'href="([^"]+)"',docs.decode('utf-8')):
        value=html.unescape(value)
        if value.endswith('.css') and value in manifest['nextStaticAssets'] and value not in css:css.append(value)
    if len(css)<2:
        for value in manifest['nextStaticAssets']:
            if value.endswith('.css') and value not in css:css.append(value)
    assert len(css)>=2,'two built stylesheets available'
    for index,target in enumerate(css[:2]):request('css-'+str(index+1),target,expected_hash=manifest['nextStaticAssets'][target]['sha256'])
    font=next(target for target in manifest['publicAssets'] if target.endswith('.woff2'))
    request('font',font,expected_hash=manifest['publicAssets'][font]['sha256'])
    for label,target in [('favicon','/axiom-favicon-1b77e225c532.png'),('logo','/vision-xix-logo.png')]:request(label,target,expected_hash=manifest['publicImages'][target]['sha256'],image=True)
    # Exactly one permitted image optimizer request. No retries/cache workarounds.
    request('one-optimizer','/_next/image?url=%2Fvision-xix-logo.png&w=640&q=75',image=True)
    negatives=[('api','/api/auth/session'),('auth','/auth/signin'),('account','/account/help'),('traversal','/docs/%2e%2e/api/auth/session'),('double-encoding','/%2561pi/auth/session'),('optimizer-private','/_next/image?url=%2Fapi%2Fauth%2Fsession&w=640&q=75'),('optimizer-remote','/_next/image?url=https%3A%2F%2Fexample.invalid%2Fa.png&w=640&q=75'),('optimizer-duplicate','/_next/image?url=%2Fvision-xix-logo.png&url=%2Fapi%2Fa&w=640&q=75'),('fake-asset','/not-a-published-asset.png')]
    for label,target in negatives:request('deny-'+label,target,status=403)
    request('deny-post-contact','/api/contact',status=403,method='POST')
    request('deny-put-public','/product',status=403,method='PUT')
    print(json.dumps({'status':'http_checks_passed','requests':len(records),'optimizerRequests':1,'redirectsFollowed':0,'retries':0}))
except Exception as error:
    print(json.dumps({'status':'stopped_on_first_failure','requestsAttempted':len(records),'failure':str(error),'retries':0}));sys.exit(1)
