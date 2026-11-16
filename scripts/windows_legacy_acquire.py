"""Fixed public historical fixture acquisition; no credentials or native execution."""
import hashlib,json,sys
from pathlib import Path
import urllib.request,urllib.parse
from windows_upgrade_acceptance import LEGACY_ASSETS
class FixedRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  url=urllib.parse.urlsplit(newurl)
  if url.scheme!='https' or url.username or url.password or url.hostname not in ('github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'):raise RuntimeError('legacy_redirect_refused')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def main():
 root=Path(sys.argv[1]);root.mkdir(exist_ok=False)
 opener=urllib.request.build_opener(FixedRedirect())
 proof={}
 for kind,item in LEGACY_ASSETS.items():
  partial=root/(kind+'.part');final=root/item['name'];size=0;digest=hashlib.sha256()
  try:
   url='https://github.com/sahme209/axiom-releases/releases/download/desktop-v0.1.21/'+item['name']
   with opener.open(url,timeout=30) as response,partial.open('xb') as output:
    while True:
     block=response.read(65536)
     if not block:break
     size+=len(block)
     if size>item['bytes']:raise RuntimeError('legacy_asset_oversized')
     digest.update(block);output.write(block)
   if size!=item['bytes'] or digest.hexdigest()!=item['sha256']:raise RuntimeError('legacy_asset_bytes_mismatch')
   partial.rename(final);proof[kind]={'bytes':size,'sha256':digest.hexdigest()}
  finally:
   if partial.is_file() and not partial.is_symlink():partial.unlink()
 print(json.dumps(proof,sort_keys=True))
if __name__=='__main__':
 try:main()
 except Exception:raise SystemExit('legacy_fixture_acquisition_refused') from None
