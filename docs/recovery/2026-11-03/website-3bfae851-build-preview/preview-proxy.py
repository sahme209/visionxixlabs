from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit,unquote,parse_qs
from http.client import HTTPConnection
import json,unittest
PUBLIC=('/', '/product','/integrations','/security','/download','/plans','/axiom','/contact','/privacy','/terms','/trust','/status','/support','/team','/team-of-one','/cloud-solutions/azure','/cloud-solutions/gcp')
PREFIX=('/docs/','/demo/','/_next/static/')
HEADERS={'accept','accept-language','rsc','next-router-state-tree','next-router-prefetch','next-url','purpose','x-nextjs-data'}
def target_allowed(value):
 if len(value)>16384:return False
 u=urlsplit(value);p=unquote(u.path)
 if u.netloc or u.scheme or not p.startswith('/')or '%'in p or '\\'in p or '\0'in p or any(x in {'.','..'}for x in p.split('/')):return False
 if p.startswith(('/api','/auth','/account','/operator','/dashboard','/admin','/billing','/desktop','/workspace-handoff')):return False
 if p=='/_next/image':
  image=parse_qs(u.query).get('url',[''])[0]
  return image.startswith('/')and not image.startswith('//')and '..'not in unquote(image).split('/')
 return p in PUBLIC or p in ('/docs','/demo')or p.startswith(PREFIX)or p.rsplit('.',1)[-1].lower()in {'png','jpg','jpeg','svg','ico','woff2','webp','gif'}
def forward_headers(headers):return {k:v for k,v in headers.items()if k.lower()in HEADERS and len(v)<=8192}
CSP="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'none'; object-src 'none'; base-uri 'none'; frame-src 'self'; frame-ancestors 'self'"
WRAPPER=b'''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Axiom local preview \xc2\xb7 3bfae851</title></head><body style="margin:0;background:#101010"><div role="status" style="height:40px;box-sizing:border-box;padding:11px 18px;background:#ecebe5;color:#242424;font:12px system-ui">Local interactive website preview \xc2\xb7 source 3bfae851 \xc2\xb7 accounts, forms and backend actions disabled</div><iframe title="Axiom local website" src="/" sandbox="allow-scripts allow-same-origin" style="width:100%;height:calc(100dvh - 40px);border:0;display:block"></iframe></body></html>'''
class Proxy(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def output(self,status,data,kind='text/html; charset=utf-8',headers=()):
  self.send_response(status);self.send_header('Content-Type',kind);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store');self.send_header('Content-Security-Policy',CSP);self.send_header('X-Content-Type-Options','nosniff');self.send_header('X-Axiom-Preview-Source','3bfae851')
  for k,v in headers:
   if k.lower()not in {'set-cookie','content-length','content-type','transfer-encoding','connection','cache-control','content-security-policy','x-frame-options','location'}:self.send_header(k,v)
  self.end_headers()
  if self.command!='HEAD':self.wfile.write(data)
 def do_POST(self):self.output(403,b'{"error":"Preview actions disabled"}','application/json')
 do_PUT=do_POST;do_PATCH=do_POST;do_DELETE=do_POST;do_OPTIONS=do_POST
 def do_HEAD(self):self.do_GET()
 def do_GET(self):
  if urlsplit(self.path).path=='/__axiom_preview':return self.output(200,WRAPPER)
  if not target_allowed(self.path):return self.output(403,b'<h1>Local preview only</h1><p>Accounts, backend actions and non-public routes are disabled.</p>')
  conn=HTTPConnection('127.0.0.1',5203,timeout=20)
  try:
   conn.request('GET',self.path,headers=forward_headers(self.headers));r=conn.getresponse();data=r.read(32*1024*1024+1)
   if len(data)>32*1024*1024:return self.output(502,b'Preview response bound exceeded')
   location=r.getheader('Location')
   if location:
    if not target_allowed(location):return self.output(403,b'Preview redirect disabled')
    return self.output(403,b'Preview redirect requires an explicit public page')
   self.output(r.status,data,r.getheader('Content-Type')or'application/octet-stream',r.getheaders())
  except (OSError,TimeoutError):self.output(502,b'Local preview backend unavailable')
  finally:conn.close()
class Boundaries(unittest.TestCase):
 def test_public_browsing_and_rsc_allowed(self):
  for x in ['/','/docs/permissions-model','/cloud-solutions/azure','/integrations?_rsc=abc','/_next/static/chunks/abc.js','/_next/image?url=%2Fbrand%2Flogo.png&w=640&q=75']:self.assertTrue(target_allowed(x),x)
 def test_private_encoded_external_and_traversal_refused(self):
  for x in ['/api/auth/session','/auth/signin','/account/help','/operator/x','/%61pi/actions','/%2561pi/actions','/docs/../api/x','https://example.com/','/_next/image?url=https%3A%2F%2Fexample.com%2Fa.png']:self.assertFalse(target_allowed(x),x)
 def test_cookies_and_authority_headers_never_forward(self):
  h=forward_headers({'Cookie':'DO_NOT_FORWARD','Authorization':'Bearer DO_NOT_FORWARD','X-Forwarded-Host':'example.com','RSC':'1','Accept':'text/x-component','Next-Action':'DO_NOT_FORWARD'})
  self.assertEqual(h,{'RSC':'1','Accept':'text/x-component'})
if __name__=='__main__':
 import sys
 if '--test'in sys.argv:unittest.main(argv=[sys.argv[0]])
 else:
  print('SAFE_INTERACTIVE_PREVIEW http://127.0.0.1:5202/__axiom_preview source3bfae851',flush=True);ThreadingHTTPServer(('127.0.0.1',5202),Proxy).serve_forever()
