"""Fixed one desktop-only continuation; no website/archive regeneration.
Import/prepare_packet are inert file reads. execute requires fresh owner approval.
"""
import hashlib,importlib.util,json,os,signal,stat
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=HERE.parent
STAGE=Path('/private/tmp/axiom-calm-frozen-build-fo_6hvj5')
OLD_PACKET_SHA='c57d84b7c1f5dbebecbff00838346d5b94f4b41f09e58245d03b59450826b6c3'
OLD_EXECUTOR_SHA='0ed844cb6ce7c0b3cdac381a1ef273c02df38f72785c411eb04252c177df0024'
HELPER_SHA='1fb1c14b20bffdcb2b5dddf5b27a73d8388de5ffac8a3012e70eaa9691a10c81'
FILES=(HERE/'desktop_only.py',HERE/'test_desktop_only.py',HERE/'namespace_correction.py',HERE/'test_namespace_correction.py',BASE/'executor.py',BASE/'INPUT-PACKET-FINAL.json',BASE/'ACTUAL-SUMMARY.json',BASE/'WEBSITE-OUTPUT-MANIFEST.json',BASE/'ATTEMPT-CONSUMED.json',STAGE/'RESULT.json',STAGE/'website.log',STAGE/'desktop.log',STAGE/'sandbox.sb',STAGE/'input-packet.json')
class Refusal(Exception):pass
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
 return h.hexdigest()
def refuse(reason):raise Refusal(reason)
def load_fixed(path,expected,name):
 if sha(path)!=expected:refuse('import_changed')
 spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def check_prior_receipt(receipt):
 if receipt.get('accepted') is not False or receipt.get('finalInputsMatched') is not True or receipt.get('stage')!=str(STAGE) or receipt.get('packetSha256')!=OLD_PACKET_SHA:refuse('original_receipt')
 for name,code in (('website',0),('desktop',1)):
  phase=receipt['phases'][name]
  if phase['exitCode']!=code or phase['cleanupConfirmed'] is not True:refuse('original_phase')

def tree_hashes(root):
 result={}
 if not root.is_dir() or root.is_symlink():refuse('output_root')
 for p in sorted(root.rglob('*')):
  if p.is_symlink() or not(p.is_file() or p.is_dir()):refuse('output_nonregular')
  if p.is_file():result[str(p.relative_to(root))]=sha(p)
 if not result:refuse('output_empty')
 return result

def check_tree(root,expected):
 if tree_hashes(root)!=expected:refuse('output_changed')

def identities():
 result={}
 for p in (STAGE,STAGE/'source',STAGE/'source/desktop',STAGE/'source/desktop/node_modules'):
  s=p.lstat()
  if not stat.S_ISDIR(s.st_mode) or p.resolve(strict=True)!=p or s.st_uid!=os.getuid():refuse('stage_identity')
  result[str(p)]={'device':s.st_dev,'inode':s.st_ino,'uid':s.st_uid,'mode':stat.S_IMODE(s.st_mode)}
 return result

def check_namespace(packet,repaired):
 p=STAGE/'source/desktop/node_modules/.vite-temp'
 if repaired:
  s=p.lstat()
  if not stat.S_ISDIR(s.st_mode) or s.st_uid!=os.getuid() or stat.S_IMODE(s.st_mode)!=0o700:refuse('repaired_namespace')
 elif not p.is_symlink() or os.readlink(p)!=packet['viteTempTarget']:refuse('original_temp_alias')

def exact_source_map(actual,immutable):
 if actual!=immutable:refuse('source_map_changed')

def check_extra_source(source,immutable):
 for area in ('app','components','desktop','lib','packages','scripts'):
  for directory,dirs,files in os.walk(source/area,followlinks=False):
   relative=Path(directory).relative_to(source)
   dirs[:]=[d for d in dirs if d not in ('node_modules','.next','dist','__pycache__') and str(relative/d)!='lib/generated/prisma']
   for name in files:
    p=relative/name
    if (Path(name).suffix in ('.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.py','.rs','.c','.h','.sh','.node','.wasm') or name.startswith('.env')) and str(p) not in immutable:refuse('unexpected_staged_runtime_source')
 for directory in (source,source/'desktop'):
  for p in directory.glob('.env*'):
   if str(p.relative_to(source)) not in immutable:refuse('unexpected_stage_environment')

def require_alias(path,target):
 if not path.is_symlink() or os.readlink(path)!=str(target):refuse('stage_alias_changed')

def check_stage_namespace(old,original,repaired):
 source=STAGE/'source'
 if {p.name for p in (STAGE/'bin').iterdir()}!={'node'}:refuse('stage_bin_changed')
 require_alias(STAGE/'bin/node',old.NODE)
 for name in ('empty.npmrc','empty-global.npmrc'):
  p=STAGE/name
  if p.is_symlink() or p.read_bytes()!=b'':refuse('stage_npm_config_changed')
 for cache,ns,physical in ((Path(original['tools']['rootCache']),source/'node_modules',True),(Path(original['tools']['desktopCache']),source/'desktop/node_modules',False)):
  members={p.name:p for p in cache.iterdir() if p.name not in ('.bin','@axiom','.cache','.prisma')}
  expected=set(members)|{'.bin','@axiom'}
  if ns==source/'node_modules':
   generated_cache=ns/'.cache'
   if generated_cache.is_symlink() or not generated_cache.is_dir():refuse('generated_stage_cache')
   expected.add('.cache')
  if {p.name for p in ns.iterdir()}!=expected:refuse('stage_namespace_changed')
  for name,item in members.items():
   if ns==source/'desktop/node_modules' and name=='.vite-temp' and repaired:continue
   if name=='zod' and physical:check_tree(ns/name,tree_hashes(item.resolve(strict=True)))
   else:require_alias(ns/name,item.resolve(strict=True))
  bins=ns/'.bin'
  if bins.is_symlink() or {p.name for p in bins.iterdir()}!={p.name for p in (cache/'.bin').iterdir()}:refuse('stage_bins_changed')
  for item in (cache/'.bin').iterdir():require_alias(bins/item.name,item.resolve(strict=True))
  axiom=ns/'@axiom'
  if axiom.is_symlink() or {p.name for p in axiom.iterdir()}!={'verified-issuer-runtime'}:refuse('stage_file_dependency_changed')
  require_alias(axiom/'verified-issuer-runtime',source/'packages/verified-issuer-runtime')

def verify(packet,old,repaired=False):
 if packet.get('purpose')!='calm_desktop_only_once' or packet.get('limits')!={'activeSeconds':600,'cleanupSeconds':5,'logBytes':33554432} or set(packet.get('files',{}))!={str(p) for p in FILES}:refuse('packet_contract')
 for p,h in packet['files'].items():
  if sha(p)!=h:refuse('frozen_input_changed')
 if identities()!=packet['stageIdentities']:refuse('stage_changed')
 check_prior_receipt(json.loads((STAGE/'RESULT.json').read_text()))
 old_packet=json.loads((BASE/'INPUT-PACKET-FINAL.json').read_text())
 old.verify_packet(old_packet) # exact original source80, archive/tools/full caches.
 if sha(BASE/'INPUT-PACKET-FINAL.json')!=OLD_PACKET_SHA:refuse('original_packet')
 if json.loads((STAGE/'input-packet.json').read_text())!=old_packet:refuse('staged_packet')
 for name,code in (('website',0),('desktop',1)):
  phase=json.loads((STAGE/'RESULT.json').read_text())['phases'][name]
  if sha(STAGE/(name+'.log'))!=phase['logSha256']:refuse('original_log')
 immutable=json.loads(old.MANIFEST.read_text())['files']
 exact_source_map(packet['stagedSource'],immutable)
 check_extra_source(STAGE/'source',immutable)
 check_stage_namespace(old,old_packet,repaired)
 for name,h in packet['stagedSource'].items():
  p=STAGE/'source'/name
  if p.is_symlink() or sha(p)!=h:refuse('staged_source_changed')
 summary=json.loads((BASE/'ACTUAL-SUMMARY.json').read_text());web=json.loads((BASE/'WEBSITE-OUTPUT-MANIFEST.json').read_text())
 if summary['resultSha256']!=sha(STAGE/'RESULT.json') or summary['websiteOutputManifestSha256']!=sha(BASE/'WEBSITE-OUTPUT-MANIFEST.json') or web['root']!=str(STAGE/'source/.next'):refuse('website_receipt')
 check_tree(STAGE/'source/.next',web['files'])
 for name,files in packet['generatedTrees'].items():check_tree(STAGE/'source'/name,files)
 check_namespace(packet,repaired)
 if (STAGE/'sandbox.sb').read_text()!=old.sandbox_profile(STAGE):refuse('sandbox_changed')
 return old_packet

def prepare_packet():
 old=load_fixed(BASE/'executor.py',OLD_EXECUTOR_SHA,'calm_original')
 old_packet=json.loads((BASE/'INPUT-PACKET-FINAL.json').read_text())
 snapshot=json.loads(old.MANIFEST.read_text());target=Path(old_packet['tools']['desktopCache'])/'.vite-temp'
 p={'purpose':'calm_desktop_only_once','freshOwnerApprovalRequired':True,'priorCombinedAccepted':False,'limits':{'activeSeconds':600,'cleanupSeconds':5,'logBytes':33554432},'files':{str(x):sha(x) for x in FILES},'stageIdentities':identities(),'viteTempTarget':str(target),'stagedSource':snapshot['files'],'generatedTrees':{name:tree_hashes(STAGE/'source'/name) for name in ('.prisma/client-source','lib/generated/prisma','node_modules/.cache')}}
 verify(p,old)
 return p

def run_desktop(old,owner,env,profile,receipt,postcheck):
 outcome=owner.run([str(old.SANDBOX),'-p',profile,str(old.NODE),str(old.NPM),'run','build'],STAGE/'source/desktop',env,STAGE/'desktop-continuation.log',600)
 receipt['desktop']=outcome # retain these facts before any late refusal.
 postcheck()
 receipt['accepted']=outcome['exitCode']==0 and outcome['cleanupConfirmed'] is True
 return outcome

def execute(packet_path,expected_sha,approved=False):
 if approved is not True:refuse('fresh_owner_approval_required')
 if sha(packet_path)!=expected_sha:refuse('packet_sha')
 packet=json.loads(Path(packet_path).read_text())
 old=load_fixed(BASE/'executor.py',OLD_EXECUTOR_SHA,'calm_original')
 helper=load_fixed(HERE/'namespace_correction.py',HELPER_SHA,'calm_namespace')
 original=verify(packet,old)
 old.consume_attempt(HERE/'ATTEMPT-CONSUMED.json',expected_sha)
 receipt={'accepted':False,'priorCombinedAccepted':False,'packetSha256':expected_sha,'scope':'one desktop frontend build only; website not repeated','websiteRebuilt':False,'networkDenied':True,'outsideStageWritesDenied':True,'retryAllowed':False,'originalTempTarget':packet['viteTempTarget']}
 owner=old.ProcessOwner();handlers={};repaired=False
 try:
  for sig in (signal.SIGINT,signal.SIGTERM,signal.SIGHUP):handlers[sig]=signal.signal(sig,owner.signal)
  if owner.cancelled:refuse('cancelled')
  receipt['repair']=helper.repair_owned_vite_temp(STAGE/'source/desktop/node_modules',Path(packet['viteTempTarget']));repaired=True
  verify(packet,old,True)
  env=old.child_environment(STAGE,old.NODE,Path(original['tools']['tools']['schemaEngine']['realpath']))
  run_desktop(old,owner,env,(STAGE/'sandbox.sb').read_text(),receipt,lambda:verify(packet,old,True))
  if owner.cancelled:refuse('cancelled')
  if receipt['accepted']:receipt['desktopOutputs']=tree_hashes(STAGE/'source/desktop/dist')
 except BaseException as error:
  receipt['accepted']=False;receipt['failure']=str(error) if isinstance(error,Refusal) else type(error).__name__
 finally:
  try:verify(packet,old,repaired);receipt['finalInputsMatched']=True
  except BaseException:receipt['accepted']=False;receipt['finalInputsMatched']=False
  for sig,handler in handlers.items():signal.signal(sig,handler)
  old.write_json(STAGE/'DESKTOP-CONTINUATION-RESULT.json',receipt)
  print(json.dumps({'accepted':receipt['accepted'],'receipt':str(STAGE/'DESKTOP-CONTINUATION-RESULT.json'),'receiptSha256':sha(STAGE/'DESKTOP-CONTINUATION-RESULT.json')}),flush=True)
 return receipt

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--approved-desktop-once',action='store_true',required=True);parser.add_argument('--packet',required=True);parser.add_argument('--packet-sha256',required=True);args=parser.parse_args()
 try:result=execute(args.packet,args.packet_sha256,args.approved_desktop_once)
 except BaseException as error:
  print(json.dumps({'accepted':False,'failure':type(error).__name__}));raise SystemExit(1)
 raise SystemExit(0 if result['accepted'] else 1)
