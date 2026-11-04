import importlib.util,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).parent
OLD='--old' in sys.argv
path=Path('/private/tmp/axiom-interactive-preview-proxy-8f79e190.py') if OLD else ROOT/'preview_proxy.py'
spec=importlib.util.spec_from_file_location('audited_proxy',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
manifest=json.loads((ROOT/'asset-manifest.json').read_text())
def canonical(target):return (target if module.target_allowed(target) else None) if OLD else module.canonical_target(target)
def permitted(target):return canonical(target) is not None
def response_headers(headers):
 if not OLD:return module.filtered_response_headers(headers)
 handler=object.__new__(module.Proxy);handler.command='HEAD';seen=[]
 handler.send_response=lambda status:None;handler.send_header=lambda key,value:seen.append((key,value));handler.end_headers=lambda:None
 module.Proxy.output(handler,200,b'',headers=headers)
 return seen
def forwarded_target(target):
 seen=[]
 class Response:
  status=200
  def getheader(self,key):return 'text/html' if key.lower()=='content-type' else None
  def getheaders(self):return []
  def read(self,limit):return b'synthetic public HTML'
 class Connection:
  def request(self,method,target,headers):seen.append(target)
  def getresponse(self):return Response()
  def close(self):pass
 original=module.HTTPConnection;module.HTTPConnection=lambda *a,**k:Connection()
 try:
  handler=object.__new__(module.Proxy);handler.path=target;handler.headers={};handler.command='GET';handler.output=lambda *a,**k:None
  module.Proxy.do_GET(handler)
 finally:module.HTTPConnection=original
 return seen[0] if seen else None
class Regressions(unittest.TestCase):
 def test_optimizer_cannot_target_api(self):self.assertFalse(permitted('/_next/image?url=%2Fapi%2Fauth%2Fsession&w=640&q=75'))
 def test_nonasset_suffix_cannot_grant_route(self):self.assertFalse(permitted('/not-a-published-asset.png'))
 def test_response_navigation_headers_never_forward(self):
  blocked={'refresh','link','location','set-cookie'}
  self.assertFalse(any(k.lower() in blocked for k,v in response_headers([('Refresh','0;url=https://example.invalid'),('Link','<https://example.invalid>;rel=preload'),('Location','/api/auth/session'),('Set-Cookie','synthetic=1')])))
class ForwardingHardening(unittest.TestCase):
 def test_canonical_forwarding_contract(self):self.assertEqual(forwarded_target('/%64ocs/permissions-model'),'/docs/permissions-model')
if not OLD:
 class Compatibility(unittest.TestCase):
  def test_required_brand_images_and_static_are_functional(self):
   for target in ['/vision-xix-logo.png','/images/axiom-hero-landscape-v1.png','/brands/github.svg']:
    self.assertIn(target,manifest['publicImages']);self.assertEqual(module.canonical_target(target),target)
   self.assertEqual(module.canonical_target('/_next/image?url=%2Fvision-xix-logo.png&w=640&q=75'),'/_next/image?url=%2Fvision-xix-logo.png&w=640&q=75')
   for target in manifest['nextStaticAssets']:
    from urllib.parse import unquote
    self.assertEqual(unquote(module.canonical_target(target)),target)
  def test_public_docs_navigation_and_trailing_slash(self):
   for target in ['/','/product','/docs','/docs/','/docs/permissions-model','/demo/']:
    self.assertIsNotNone(module.canonical_target(target),target)
  def test_private_external_and_encoded_routes_are_denied(self):
   for target in ['/api/auth/session','/auth/signin','/account/help','/admin/a.png','https://example.invalid/','//example.invalid/a','/%61pi/auth/session','/%2561pi/auth/session','/docs/../api/auth/session','/docs/%2e%2e/api/auth/session','/docs/%252e%252e/api/auth/session','/docs/%5c..%5capi','/docs/%00','/docs/%0a','/docs/%7f','/docs/a\x00','/docs/a\n','/docs/a\\b','/docs//permissions-model','/docs/unknown','/_next/static/not-built.js']:
    self.assertIsNone(module.canonical_target(target),target)
  def test_optimizer_strict_query_and_inner_exact_asset(self):
   for target in ['/_next/image?url=https%3A%2F%2Fexample.invalid%2Fa.png&w=640&q=75','/_next/image?url=%2Fapi%2Fa.png&w=640&q=75','/_next/image?url=%2Fvision-xix-logo.png&url=%2Fapi%2Fa&w=640&q=75','/_next/image?url=%252Fvision-xix-logo.png&w=640&q=75','/_next/image?url=%2Fvision-xix-logo.png%3Fx%3D1&w=640&q=75','/_next/image?url=%2F%5Cexample.invalid%2Fa.png&w=640&q=75','/_next/image?url=%2Fvision-xix-logo.png&w=640&w=750&q=75','/_next/image?url=%2Fvision-xix-logo.png&w=639&q=75','/_next/image?url=%2Fvision-xix-logo.png&w=640&q=1','/_next/image?url=%2Fvision-xix-logo.png&w=640&q=75&extra=1','/_next/image?%75rl=%2Fvision-xix-logo.png&w=640&q=75','/_next/image?url=%2Fvision-xix-logo.png&w=640&q=75#frag','/docs?_rsc=private','/docs?next=/api/auth/session']:
    self.assertIsNone(module.canonical_target(target),target)
  def test_authority_and_router_headers_are_stripped(self):
   headers={'Cookie':'synthetic','Authorization':'synthetic','Next-Action':'synthetic','RSC':'1','Next-Url':'/api/auth/session','Next-Router-State-Tree':'synthetic','X-Nextjs-Data':'1','X-Forwarded-Host':'example.invalid','Accept':'text/html','Accept-Language':'en'}
   self.assertEqual(module.forward_headers(headers),{'Accept':'text/html','Accept-Language':'en'})
  def test_response_headers_explicit_allowlist(self):
   self.assertEqual(module.filtered_response_headers([('ETag','synthetic'),('Content-Encoding','gzip'),('Refresh','synthetic'),('Link','synthetic'),('Location','/docs'),('Set-Cookie','synthetic'),('X-Custom','synthetic')]),[('ETag','synthetic'),('Content-Encoding','gzip')])
  def test_unsupported_methods_cannot_open_backend(self):
   for method in ['POST','PUT','PATCH','DELETE','OPTIONS','TRACE','CONNECT']:
    self.assertIs(getattr(module.Proxy,'do_'+method),module.Proxy.deny_action)
  def test_fixed_backend_and_wrapper(self):
   self.assertEqual(module.BACKEND,('127.0.0.1',5225));self.assertEqual(module.LISTEN,('127.0.0.1',5224));self.assertIn("form-action 'none'",module.CSP)
  def test_prepared_launcher_binds_only_fixed_inputs_without_launch(self):
   spec=importlib.util.spec_from_file_location('prepared_launcher',ROOT/'launch_preview.py');launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)
   called=[];original=launcher.os.execve;launcher.os.execve=lambda *a:called.append(a)
   try:
    binding=launcher.verify_prepared_inputs()
    self.assertEqual(binding['status'],'prepared-not-started')
    self.assertEqual(str(launcher.STAGE),'/private/tmp/axiom-website-1b23c208-eh6g339f/stage')
    self.assertEqual(called,[])
   finally:launcher.os.execve=original
  def test_prepared_profiles_deny_outbound_backend_and_all_writes(self):
   backend=(ROOT/'backend.sb').read_text();proxy=(ROOT/'proxy.sb').read_text()
   self.assertIn('(deny network-outbound)',backend);self.assertNotIn('(allow network-outbound',backend)
   self.assertIn('(deny file-write*)',backend);self.assertIn('(deny file-write*)',proxy)
   self.assertIn('(remote ip "localhost:5225")',proxy)
   self.assertIn('(local ip "localhost:5224")',proxy)
if __name__=='__main__':unittest.main(argv=[sys.argv[0]],verbosity=2)
