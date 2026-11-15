"""Read-only compiled-route regression, exact synthetic navigation cookie only."""
import http.client,json,sys
from pathlib import Path
from urllib.parse import urlparse,parse_qs
port=int(sys.argv[1]);assert 1024<=port<=65535

def get(path,headers=None):
 c=http.client.HTTPConnection('127.0.0.1',port,timeout=15);c.request('GET',path,headers=headers or {});r=c.getresponse();body=r.read();out=(r.status,{k.lower():v for k,v in r.getheaders()},body);c.close();return out
s,h,_=get('/fixture/auth-error-pairing');assert s==303
cookie=h['set-cookie'].split(';',1)[0]
s,h,_=get(h['location'],{'Cookie':cookie});assert s==307
q=parse_qs(urlparse(h['location']).query);assert urlparse(h['location']).path=='/auth/signin';assert q=={'error':['SignInFailed'],'callbackUrl':['/desktop/connect?challenge=synthetic-pair&intent=sign_in']}
recovery=h['location'];assert 'no-store' in h.get('cache-control','')
s,_,body=get(recovery);assert s==200 and b'Welcome to Axiom' in body
s,h,_=get('/auth/error?error=untrusted-payload&code=synthetic-drop&state=synthetic-drop');assert s==307 and h['location']=='/auth/signin?error=SignInFailed'
s,h,_=get('/auth/error?error=AccessDenied',{'Host':f'localhost:{port}','Cookie':cookie,'X-Forwarded-Host':'evil.test'});assert s==307 and h['location']==f'http://127.0.0.1:{port}/auth/error'
result={'compiledRequestTimeRecovery':'pass','originalSyntheticPairingReturnPreserved':True,'genericFailureOnly':True,'incomingOAuthCodeStateDiscarded':True,'missingCookieNormalFallback':True,'aliasUsesConfiguredHost':True,'forwardedHostIgnored':True,'signInHtmlStatus':200,'errorResponseNoStore':True,'authProviderOrVerificationSubmission':False,'fixture':'only exact synthetic callback cookie forwarded; no real session/provider cookies'}
Path(__file__).with_name('COMPILED-HTTP-RESULT.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
