#!/usr/bin/env python3
"""Offline exact-source preparation. Build/issuer identity remain separately gated."""
from __future__ import annotations
import argparse,base64,hashlib,io,json,os,platform,re,shutil,stat,subprocess,tarfile,tempfile,resource
from pathlib import Path,PurePosixPath
from urllib.parse import urlparse

MAX_ARCHIVE=512*1024**2
MAX_BLOB=512*1024**2
MAX_CACHE=8*1024**3
class Unavailable(RuntimeError):pass
def fail(reason):raise Unavailable(reason)
def sha(data):return hashlib.sha256(data).hexdigest()
def json_data(data):
 def pairs(items):
  result={}
  for k,v in items:
   if k in result:fail("duplicate_json_key")
   result[k]=v
  return result
 try:return json.loads(data,object_pairs_hook=pairs)
 except (ValueError,TypeError,RecursionError):fail("invalid_json")
def rel(value):
 if not isinstance(value,str)or not value or not value.isascii()or len(value)>4096 or "\\"in value or "\0"in value or any(ord(c)<32 for c in value):fail("invalid_relative_path")
 p=PurePosixPath(value)
 if p.is_absolute()or value!=p.as_posix()or any(c in ("",".","..")for c in value.split("/")):fail("unsafe_relative_path")
 return value
def private_dir(path):
 path=Path(path)
 if path.is_symlink()or not path.is_dir()or path.stat().st_uid!=os.getuid()or stat.S_IMODE(path.stat().st_mode)&0o077:fail("private_owned_directory_required")
 return path.resolve()
def write_new(path,data):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,"wb")as out:out.write(data)
def cache_path(cache,integrity):
 if not isinstance(integrity,str)or not integrity.startswith("sha512-")or " "in integrity:fail("sha512_lock_integrity_required")
 try:expected=base64.b64decode(integrity[7:],validate=True)
 except ValueError:fail("invalid_integrity")
 if len(expected)!=64:fail("invalid_sha512")
 h=expected.hex()
 return Path(cache)/"content-v2/sha512"/h[:2]/h[2:4]/h[4:],expected
def platform_matches(values,value):
 if values is None:return True
 if not isinstance(values,list)or any(not isinstance(x,str)for x in values):fail("invalid_platform_constraint")
 positive=[v for v in values if not v.startswith("!")]
 return "!"+value not in values and(not positive or value in positive or "any"in positive)
def lock_plan(package,lock,os_name="darwin",cpu="arm64"):
 packages=lock.get("packages")
 if lock.get("lockfileVersion")!=3 or not isinstance(packages,dict)or len(packages)>10000:fail("bounded_lock_v3_required")
 root=packages.get("")
 if not isinstance(root,dict)or any(root.get(k,{})!=package.get(k,{})for k in ["dependencies","devDependencies","optionalDependencies"]):fail("manifest_lock_mismatch")
 tarballs=[];links=[];excluded=[]
 for location,e in sorted(packages.items()):
  if not location:continue
  rel(location)
  if not isinstance(e,dict):fail("invalid_lock_entry")
  if not location.startswith("node_modules/"):
   if location.startswith("packages/"):continue
   fail("unsupported_lock_location")
  if not(platform_matches(e.get("os"),os_name)and platform_matches(e.get("cpu"),cpu)):
   if e.get("optional")is not True:fail("required_package_platform_mismatch")
   excluded.append(location);continue
  if e.get("link")is True:
   target=rel(e.get("resolved"))
   if not target.startswith("packages/")or not isinstance(packages.get(target),dict):fail("archive_local_dependency_required")
   links.append({"location":location,"target":target,"version":packages[target].get("version")});continue
  url=e.get("resolved");parsed=urlparse(url if isinstance(url,str)else "")
  if parsed.scheme!="https"or parsed.netloc!="registry.npmjs.org"or parsed.query or parsed.fragment or not parsed.path.endswith(".tgz"):fail("unsupported_offline_tarball_source")
  cache_path(".",e.get("integrity"))
  if not isinstance(e.get("version"),str)or not e["version"]:fail("exact_version_required")
  tarballs.append({"location":location,"version":e["version"],"resolved":url,"integrity":e["integrity"],"hasInstallScript":e.get("hasInstallScript")is True,"optional":e.get("optional")is True})
 return {"format":"axiom.offline-lock-plan/1","tarballs":tarballs,"localLinks":links,"platformOptionalExcluded":excluded}
def stream_blob(path,expected,output=None,remaining=MAX_CACHE):
 path=Path(path);before=path.lstat();limit=min(MAX_BLOB,remaining)
 if path.is_symlink()or not stat.S_ISREG(before.st_mode)or before.st_size>limit:fail("cache_blob_type_or_limit")
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);total=0;h=hashlib.sha512()
 try:
  while True:
   chunk=os.read(fd,min(1024*1024,limit-total+1))
   if not chunk:break
   total+=len(chunk)
   if total>limit:fail("growing_cache_blob_limit")
   h.update(chunk)
   if output is not None:output.write(chunk)
 finally:os.close(fd)
 if h.digest()!=expected:fail("cache_integrity_mismatch")
 return total
def bound_blob(cache,integrity):
 cache=Path(cache).resolve();path,expected=cache_path(cache,integrity)
 try:path.resolve(strict=True).relative_to(cache)
 except(ValueError,OSError,RuntimeError):fail("pinned_tarball_cache_miss")
 if path.is_symlink():fail("cache_blob_symlink")
 return path,expected
def inspect_cache(plan,cache):
 available=total=0;missing=[]
 for item in plan["tarballs"]:
  try:
   path,expected=bound_blob(cache,item["integrity"]);total+=stream_blob(path,expected,remaining=MAX_CACHE-total);available+=1
  except(Unavailable,OSError)as exc:missing.append({"location":item["location"],"reason":str(exc)if isinstance(exc,Unavailable)else "pinned_tarball_cache_miss"})
 return {"status":"offline_tarballs_available"if not missing else "unavailable","selectedCount":len(plan["tarballs"]),"verifiedCount":available,"verifiedBytes":total,"missing":missing,"platformOptionalExcludedCount":len(plan["platformOptionalExcluded"])}
def snapshot_cache(plan,source,owned_cache):
 destination=Path(owned_cache)
 if destination.exists()or destination.is_symlink():fail("new_owned_cache_required")
 private_dir(destination.parent);destination.mkdir(mode=0o700);total=0
 try:
  for item in plan["tarballs"]:
   src,expected=bound_blob(source,item["integrity"]);out,_=cache_path(destination/"_cacache",item["integrity"])
   if out.exists():continue
   out.parent.mkdir(parents=True,exist_ok=True)
   fd=os.open(out,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
   with os.fdopen(fd,"wb")as target:total+=stream_blob(src,expected,target,MAX_CACHE-total)
  return destination
 except BaseException:shutil.rmtree(destination);raise
def probe_cache_plan(plan,source):
 observation=inspect_cache(plan,source);by_location={item['location']:item for item in plan['tarballs']}
 for missing in observation['missing']:
  if by_location[missing['location']]['optional']is not True:fail('probe_required_cache_missing')
  if missing['reason']!='pinned_tarball_cache_miss':fail('probe_invalid_optional_cache')
 missing_locations={item['location']for item in observation['missing']}
 available={**plan,'tarballs':[item for item in plan['tarballs']if item['location']not in missing_locations]}
 return available,observation

def observe_optional_probe(stage,plan,source,owned_cache,node,npm_cli,protected_repo):
 available,observation=probe_cache_plan(plan,source)
 copied=snapshot_cache(available,source,owned_cache)
 outcome='succeeded'
 try:install_offline(stage,plan,copied,node,npm_cli,source,protected_repo)
 except Unavailable as exc:
  if str(exc)!='offline_ci_unavailable_no_network_fallback':raise
  outcome='failed_offline_no_fallback'
 missing=[{**item,'presentAfterInstall':(Path(stage)/item['location']).exists()or(Path(stage)/item['location']).is_symlink()}for item in observation['missing']]
 return {'format':'axiom.offline-optional-probe/1','status':'offline_install_observed_unqualified',
         'npmOutcome':outcome,'missingOptional':missing,'cacheObservation':observation,
         'network':'kernel_denied','lifecycleScriptsExecuted':False,'buildStarted':False,
         'runtimeQualification':'unavailable','legacyQualification':'unavailable',
         'executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False}

def validate_local_links(stage,plan):
 stage=Path(stage).resolve()
 for item in plan["localLinks"]:
  target=stage/item["target"];p=target/"package.json"
  if target.is_symlink()or not target.is_dir()or p.is_symlink()or not p.is_file():fail("archive_local_package_missing")
  try:target.resolve(strict=True).relative_to(stage)
  except(OSError,ValueError,RuntimeError):fail("local_package_parent_escape")
  data=json_data(p.read_bytes())
  if data.get("name")!=item["location"].split("node_modules/")[-1]or data.get("version")!=item["version"]:fail("archive_local_manifest_mismatch")
  installed=stage/item["location"]
  if(installed.exists()or installed.is_symlink())and installed.resolve()!=target:fail("local_dependency_workspace_escape")
def extract_archive(data,stage):
 if len(data)>MAX_ARCHIVE:fail("archive_size_limit")
 stage=Path(stage)
 if stage.exists()or stage.is_symlink():fail("new_archive_stage_required")
 private_dir(stage.parent);stage.mkdir(mode=0o700);seen=set();folded=set();links=[];count=total=0
 try:
  with tarfile.open(fileobj=io.BytesIO(data),mode="r:")as archive:
   for member in archive:
    name=rel(member.name.rstrip("/"))
    if name in seen or name.casefold()in folded or len(seen)>=50000:fail("duplicate_or_large_archive")
    seen.add(name);folded.add(name.casefold());p=stage/name;p.parent.mkdir(parents=True,exist_ok=True)
    if member.isdir():p.mkdir(exist_ok=True)
    elif member.isfile():
     if member.mode&0o7000:fail("special_archive_mode")
     total+=member.size
     if total>MAX_ARCHIVE:fail("archive_contents_limit")
     body=archive.extractfile(member).read(member.size+1)
     if len(body)!=member.size:fail("partial_archive_member")
     write_new(p,body);p.chmod(member.mode&0o777)
     if p.read_bytes()!=body:fail("archive_byte_mismatch")
     count+=1
    elif member.issym():links.append((p,member.linkname))
    else:fail("special_archive_member")
   for p,target in links:
    if os.path.isabs(target)or "\\"in target or "\0"in target:fail("outside_archive_link")
    p.symlink_to(target)
   for p,_ in links:
    try:p.resolve(strict=True).relative_to(stage.resolve())
    except(OSError,ValueError,RuntimeError):fail("archive_link_escape_or_missing")
  return {"archiveSha256":sha(data),"verifiedRegularFiles":count,"archiveBytes":len(data)}
 except BaseException:shutil.rmtree(stage);raise
def git_bytes(repo,args):
 # No promisor/lazy fetch or unbounded pipe buffering from a partial repository.
 def limits():resource.setrlimit(resource.RLIMIT_FSIZE,(MAX_ARCHIVE,MAX_ARCHIVE))
 with tempfile.TemporaryFile(dir="/private/tmp")as output:
  r=subprocess.run(["/usr/bin/sandbox-exec","-p","(version 1)(allow default)(deny network*)","/usr/bin/git","-C",str(repo),*args],env={"PATH":"/usr/bin:/bin","GIT_NO_LAZY_FETCH":"1"},stdout=output,stderr=subprocess.DEVNULL,timeout=60,preexec_fn=limits)
  if r.returncode:fail("exact_git_read_failed")
  output.seek(0);data=output.read(MAX_ARCHIVE+1)
  if len(data)>MAX_ARCHIVE:fail("git_output_limit")
  return data
def source_inputs(repo,revision):
 if not re.fullmatch("[a-f0-9]{40}",revision):fail("exact_commit_required")
 if git_bytes(repo,["rev-parse",revision+"^{commit}"]).decode().strip()!=revision:fail("commit_mismatch")
 p=git_bytes(repo,["show",revision+":package.json"]);l=git_bytes(repo,["show",revision+":package-lock.json"])
 return json_data(p),json_data(l),{"sourceRevision":revision,"packageSha256":sha(p),"lockSha256":sha(l)}
GENERATION_PACKAGES=('node_modules/prisma','node_modules/@prisma/client','node_modules/@prisma/engines','node_modules/@prisma/engines-version','node_modules/@prisma/fetch-engine','node_modules/@prisma/get-platform')
def observe_generation_sources(stage,lock,cache):
 stage=private_dir(stage);files=total=0;observations=[]
 for location in GENERATION_PACKAGES:
  entry=lock.get('packages',{}).get(location)
  if not isinstance(entry,dict):fail('generation_package_lock_missing')
  source,expected=bound_blob(cache,entry.get('integrity'));verified=io.BytesIO()
  stream_blob(source,expected,verified);verified.seek(0)
  root=stage/location
  if root.is_symlink()or not root.is_dir():fail('generation_package_missing')
  try:root.resolve(strict=True).relative_to(stage)
  except(ValueError,OSError,RuntimeError):fail('generation_package_escape')
  members=set();package_files=0
  with tarfile.open(fileobj=verified,mode='r:*')as archive:
   for member in archive:
    if member.isdir():continue
    if not member.isfile()or not member.name.startswith('package/'):fail('unsupported_generation_tar_member')
    name=rel(member.name[len('package/'):])
    if name in members or len(members)>=10000:fail('duplicate_or_large_generation_package')
    members.add(name)
    if member.size>MAX_BLOB or total+member.size>MAX_CACHE:fail('generation_package_limit')
    body=archive.extractfile(member).read(member.size+1)
    if len(body)!=member.size:fail('partial_generation_tar_member')
    target=root/name
    try:target.resolve(strict=True).relative_to(root)
    except(ValueError,OSError,RuntimeError):fail('generation_file_escape_or_missing')
    if target.is_symlink()or target.lstat().st_nlink!=1:fail('generation_file_link')
    total+=stream_blob(target,hashlib.sha512(body).digest(),remaining=MAX_CACHE-total)
    files+=1;package_files+=1
  observed=set()
  for directory,dirs,names in os.walk(root,followlinks=False):
   if any((Path(directory)/name).is_symlink()for name in dirs):fail('generation_directory_link')
   for name in names:
    observed.add((Path(directory)/name).relative_to(root).as_posix())
    if len(observed)>10000:fail('generation_tree_limit')
  if observed!=members:fail('generation_package_extra_or_missing_files')
  observations.append({'location':location,'version':entry.get('version'),'integrity':entry.get('integrity'),'verifiedRegularFiles':package_files})
 return {'format':'axiom.installed-generation-source-observation/1','status':'installed_source_bytes_observed',
         'packages':observations,'verifiedRegularFiles':files,'verifiedBytes':total,
         'nativeEngineBinding':'unavailable','generationStarted':False,'buildStarted':False,
         'executingIssuerIdentity':'unavailable','executionAuthorized':False}

def engine_plan(lock,cache):
 entry=lock["packages"].get("node_modules/@prisma/engines",{})
 version=lock["packages"].get("node_modules/@prisma/engines-version",{}).get("version","")
 match=re.fullmatch(r"5\.22\.0-\d+\.([a-f0-9]{40})",version)
 if entry.get("version")!="5.22.0"or not match:fail("unsupported_prisma_engine_version")
 commit=match.group(1);payloads=[];blob,expected=bound_blob(cache,entry["integrity"]);stream_blob(blob,expected)
 with tarfile.open(blob,"r:*")as archive:
  for member in archive:
   if member.isfile()and member.name in {"package/libquery_engine-darwin-arm64.dylib.node","package/schema-engine-darwin-arm64"}:payloads.append(member.name)
 return {"status":"unavailable","reason":"native_engine_requires_independent_vendor_binding","engineCommit":commit,"platform":"darwin-arm64","payloadsInPinnedTarball":payloads,"mutableSidecarQualified":False,
         "officialUncompressedChecksums":[f"https://binaries.prisma.sh/all_commits/{commit}/darwin-arm64/libquery_engine.dylib.node.sha256",f"https://binaries.prisma.sh/all_commits/{commit}/darwin-arm64/schema-engine.sha256"]}
def clean_environment(node,owned):
 owned=private_dir(owned);tmp=owned/"tmp";tmp.mkdir(mode=0o700,exist_ok=True)
 return {"PATH":str(Path(node).parent)+":/usr/bin:/bin:/usr/sbin:/sbin","LANG":"C","TZ":"UTC","TMPDIR":str(tmp),"PRISMA_GENERATE_SKIP_AUTOINSTALL":"true","NEXT_TELEMETRY_DISABLED":"1"}
def install_offline(stage,plan,owned_cache,node,npm_cli,source_cache,protected_repo):
 stage=private_dir(stage);cache=private_dir(owned_cache);validate_local_links(stage,plan)
 if(stage/"node_modules").exists()or(stage/"node_modules").is_symlink():fail("fresh_dependency_tree_required")
 config=stage/".npmrc"
 if config.exists()and config.read_text().strip()!="legacy-peer-deps=false":fail("unreviewed_project_npm_config")
 lock_before=sha((stage/"package-lock.json").read_bytes());env=clean_environment(node,stage.parent)
 user_config=stage.parent/"npm-user-config";global_config=stage.parent/"npm-global-config"
 write_new(user_config,b"");write_new(global_config,b"")
 args=["ci","--offline","--ignore-scripts","--audit=false","--fund=false","--update-notifier=false","--fetch-retries=0","--include=dev","--legacy-peer-deps=false","--userconfig="+str(user_config),"--globalconfig="+str(global_config),"--cache="+str(cache)]
 profile='(version 1)(allow default)(deny network*)(deny file-write* (subpath '+json.dumps(str(Path(source_cache).resolve()))+') (subpath '+json.dumps(str(Path(protected_repo).resolve()))+'))'
 prefix=["/usr/bin/sandbox-exec","-p",profile,str(node)]
 if subprocess.check_output([*prefix,"--version"],env=env,text=True).strip()!="v24.21.0":fail("pinned_node_required")
 if subprocess.check_output([*prefix,str(npm_cli),"--version",*args[1:]],env=env,text=True).strip()!="11.19.0":fail("pinned_npm_required")
 log=stage.parent/"offline-ci.log"
 with log.open("x")as output:
  r=subprocess.run([*prefix,str(npm_cli),*args],cwd=stage,env=env,stdout=output,stderr=subprocess.STDOUT,timeout=60)
 if sha((stage/"package-lock.json").read_bytes())!=lock_before:fail("npm_changed_lock")
 if r.returncode:fail("offline_ci_unavailable_no_network_fallback")
 validate_local_links(stage,plan)
 return {"status":"offline_dependencies_installed","exit":0,"log":str(log),"lifecycleScriptsExecuted":False,"network":"kernel_denied","sourceCache":"read_only","executingIssuerIdentity":"unavailable"}
def execute_build(*_args,**_kwargs):fail("native_engine_binding_and_generation_review_required")
def prepare_offline(repo,revision,cache,node,npm_cli,owned):
 owned=private_dir(owned);package,lock,source=source_inputs(repo,revision);plan=lock_plan(package,lock)
 available=inspect_cache(plan,cache)
 if available["status"]!="offline_tarballs_available":fail("offline_cache_incomplete")
 archive=git_bytes(repo,["archive","--format=tar",revision]);stage=owned/"stage";provenance=extract_archive(archive,stage)
 if sha((stage/"package-lock.json").read_bytes())!=source["lockSha256"]:fail("archive_lock_mismatch")
 validate_local_links(stage,plan);copied=snapshot_cache(plan,cache,owned/"npm-cache")
 return {**source,**provenance,"dependencies":install_offline(stage,plan,copied,node,npm_cli,cache,repo),"engines":engine_plan(lock,cache),"buildStarted":False,"executingIssuerIdentity":"unavailable"}
def prepare_optional_probe(repo,revision,cache,node,npm_cli,owned):
 owned=private_dir(owned);package,lock,source=source_inputs(repo,revision);plan=lock_plan(package,lock)
 probe_cache_plan(plan,cache) # Refuse required misses or invalid blobs before extracting.
 archive=git_bytes(repo,['archive','--format=tar',revision]);stage=owned/'stage';provenance=extract_archive(archive,stage)
 if sha((stage/'package-lock.json').read_bytes())!=source['lockSha256']:fail('archive_lock_mismatch')
 validate_local_links(stage,plan)
 return {**source,**provenance,**observe_optional_probe(stage,plan,cache,owned/'npm-cache',node,npm_cli,repo)}

def preflight(repo,revision,cache):
 package,lock,source=source_inputs(repo,revision);plan=lock_plan(package,lock)
 for item in plan["localLinks"]:
  data=json_data(git_bytes(repo,["show",revision+":"+item["target"]+"/package.json"]))
  if data.get("name")!=item["location"].split("node_modules/")[-1]or data.get("version")!=item["version"]:fail("archive_local_dependency_mismatch")
 dependencies=inspect_cache(plan,cache);engines=engine_plan(lock,cache)
 return {"format":"axiom.offline-source-preflight/1","status":"unavailable",**source,"dependencies":dependencies,"engines":engines,"generationPlan":{"status":"not_authorized_or_started","commands":["node scripts/check-vercel-build.mjs","node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma","node node_modules/next/dist/bin/next build --webpack"],"network":"must_remain_kernel_denied","engineOverrides":"only independently verified owned copies; none accepted yet"},"buildStarted":False,"executingIssuerIdentity":"unavailable","executionAuthorized":False}
def main():
 parser=argparse.ArgumentParser();parser.add_argument("--repo",default=".");parser.add_argument("--revision",required=True);parser.add_argument("--cache-source",required=True);parser.add_argument("--probe-optional-cache",action="store_true");parser.add_argument("--owned-root");a=parser.parse_args()
 try:
  if a.probe_optional_cache:
   if not a.owned_root:fail('probe_owned_root_required')
   node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
   result=prepare_optional_probe(Path(a.repo).resolve(),a.revision,Path(a.cache_source).resolve(),node,node.parent.parent/'lib/node_modules/npm/bin/npm-cli.js',Path(a.owned_root))
  else:
   if a.owned_root:fail('owned_root_requires_explicit_probe')
   result=preflight(Path(a.repo).resolve(),a.revision,Path(a.cache_source).resolve())
  print(json.dumps(result,sort_keys=True))
 except(Unavailable,OSError,ValueError,tarfile.TarError)as exc:
  print(json.dumps({"status":"unavailable","reason":str(exc),"buildStarted":False,"executionAuthorized":False}));return 1
 return 2 if result["status"]=="unavailable" else 0
if __name__=="__main__":raise SystemExit(main())
