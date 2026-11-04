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
def observe_installed_sources(stage,lock,cache,locations):
 stage=private_dir(stage);files=total=0;observations=[];verified_roots=set()
 locations=tuple(locations)
 if len(locations)!=len(set(locations))or len(locations)>10000:fail('duplicate_or_large_source_package_set')
 for location in locations:
  rel(location)
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
  pruned={stage/child for child in locations if child.startswith(location+'/node_modules/')}
  for child in pruned:
   relative_child=child.relative_to(root).as_posix()
   if any(name==relative_child or name.startswith(relative_child+'/')for name in members):fail('overlapping_source_package_ownership')
   if child not in verified_roots:fail('nested_source_package_not_verified')
  observed=set()
  for directory,dirs,names in os.walk(root,followlinks=False):
   if any((Path(directory)/name).is_symlink()for name in dirs):fail('generation_directory_link')
   dirs[:]=[name for name in dirs if Path(directory)/name not in pruned]
   for name in names:
    observed.add((Path(directory)/name).relative_to(root).as_posix())
    if len(observed)>10000:fail('generation_tree_limit')
  if observed!=members:fail('generation_package_extra_or_missing_files')
  verified_roots.add(root)
  observations.append({'location':location,'version':entry.get('version'),'integrity':entry.get('integrity'),'verifiedRegularFiles':package_files})
 return {'format':'axiom.installed-generation-source-observation/1','status':'installed_source_bytes_observed',
         'packages':observations,'verifiedRegularFiles':files,'verifiedBytes':total,
         'nativeEngineBinding':'unavailable','generationStarted':False,'buildStarted':False,
         'executingIssuerIdentity':'unavailable','executionAuthorized':False}

def observe_generation_sources(stage,lock,cache):
 return observe_installed_sources(stage,lock,cache,GENERATION_PACKAGES)
BUILD_PACKAGES=('node_modules/next','node_modules/react','node_modules/react-dom','node_modules/typescript','node_modules/@next/swc-darwin-arm64')
def observe_build_sources(stage,lock,cache):
 locations=set(BUILD_PACKAGES)
 for name in lock.get('packages',{}):
  if any(name.startswith(parent+'/node_modules/')for parent in BUILD_PACKAGES):locations.add(rel(name))
 ordered=tuple(sorted(locations,key=lambda name:(-name.count('/'),name)))
 return {**observe_installed_sources(stage,lock,cache,ordered),'format':'axiom.installed-build-source-observation/1'}

def engine_plan(lock,cache):
 entry=lock["packages"].get("node_modules/@prisma/engines",{})
 version=lock["packages"].get("node_modules/@prisma/engines-version",{}).get("version","")
 match=re.fullmatch(r"5\.22\.0-\d+\.([a-f0-9]{40})",version)
 if entry.get("version")!="5.22.0"or not match:fail("unsupported_prisma_engine_version")
 commit=match.group(1);payloads=[];blob,expected=bound_blob(cache,entry["integrity"]);stream_blob(blob,expected)
 with tarfile.open(blob,"r:*")as archive:
  for member in archive:
   if member.isfile()and member.name in {"package/libquery_engine-darwin-arm64.dylib.node","package/schema-engine-darwin-arm64"}:payloads.append(member.name)
 return {"status":"unavailable","reason":"exact_local_engine_input_binding_required","requestedEngineCommit":commit,"upstreamAuthenticity":"unavailable","engineCommitAuthenticity":"unavailable","platform":"darwin-arm64","payloadsInPinnedTarball":payloads,"mutableSidecarQualified":False,
         "optionalVendorChecksumUrls":[f"https://binaries.prisma.sh/all_commits/{commit}/darwin-arm64/libquery_engine.dylib.node.sha256",f"https://binaries.prisma.sh/all_commits/{commit}/darwin-arm64/schema-engine.sha256"]}
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
def _engine_tool():
 import importlib.util
 spec=importlib.util.spec_from_file_location('local_engine_build_tool',Path(__file__).with_name('local_prisma_engine_inputs.py'))
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def _build_bytes(path,limit=MAX_ARCHIVE):
 path=Path(path);before=path.lstat()
 if not stat.S_ISREG(before.st_mode)or before.st_nlink!=1:fail('build_regular_stable_input_required')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd)
  fields=lambda st:(st.st_dev,st.st_ino,st.st_mode,st.st_nlink,st.st_size,st.st_mtime_ns,st.st_ctime_ns)
  if not stat.S_ISREG(opened.st_mode)or opened.st_nlink!=1 or fields(before)!=fields(opened)or not 0<=opened.st_size<=limit:fail('build_regular_stable_input_required')
  parts=[];total=0
  while True:
   chunk=os.read(fd,min(1024*1024,opened.st_size-total+1))
   if not chunk:break
   total+=len(chunk)
   if total>opened.st_size:fail('build_input_grew')
   parts.append(chunk)
  if total!=opened.st_size or fields(opened)!=fields(os.fstat(fd))or fields(opened)!=fields(path.lstat()):fail('build_input_changed')
  return b''.join(parts)
 finally:os.close(fd)

NEXT_TYPES_CONFIG_SHA256='491566295d50eddd8dae881ae9c143648c2a2af0ccbf7a050da62a8db4a2bd9f'
NEXT_APP_DECLARATION=(
 '/// <reference types="next" />\n'
 '/// <reference types="next/image-types/global" />\n'
 'import "./.next/types/routes.d.ts";\n'
 'import "./.next/types/root-params.d.ts";\n'
 '\n'
 '// NOTE: This file should not be edited\n'
 '// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.\n'
).encode()
def framework_type_profile(stage):
 stage=Path(stage);config=_build_bytes(stage/'next.config.ts',1024*1024)
 if sha(config)!=NEXT_TYPES_CONFIG_SHA256:fail('unsupported_framework_type_configuration')
 package=json_data(_build_bytes(stage/'node_modules/next/package.json',1024*1024))
 if not isinstance(package,dict)or package.get('version')!='16.4.2':fail('unsupported_framework_type_version')
 if not(stage/'app').is_dir()or(stage/'app').is_symlink()or(stage/'app').resolve()!=stage/'app':fail('unsupported_framework_app_profile')
 if any(path.exists()or path.is_symlink()for path in [stage/'pages',stage/'src/pages']):fail('unsupported_framework_pages_profile')
 writer=_build_bytes(stage/'node_modules/next/dist/lib/typescript/writeAppTypeDeclarations.js',1024*1024)
 return {'profile':'next-16.4.2-darwin-app-default-types/1','file':'next-env.d.ts','mode':0o644,
         'expectedSha256':sha(NEXT_APP_DECLARATION),'configSha256':sha(config),'writerSha256':sha(writer)}
def verify_framework_declaration(stage):
 stage=Path(stage);profile=framework_type_profile(stage);path=stage/'next-env.d.ts';before=path.lstat()
 if not stat.S_ISREG(before.st_mode)or before.st_nlink!=1 or stat.S_IMODE(before.st_mode)!=profile['mode']:fail('framework_type_file_mode_or_link')
 body=_build_bytes(path,65536)
 after=path.lstat()
 fields=lambda st:(st.st_dev,st.st_ino,st.st_mode,st.st_nlink,st.st_size,st.st_mtime_ns,st.st_ctime_ns)
 if fields(before)!=fields(after):fail('framework_type_file_changed')
 if body!=NEXT_APP_DECLARATION:fail('framework_type_file_bytes_changed')
 return {**profile,'sha256':sha(body),'size':len(body),'qualification':'derived_type_bytes_observed_only'}

def native_overlay_inputs(stage,phase):
 import sys,importlib
 directory=str(Path(__file__).resolve().parent)
 if directory not in sys.path:sys.path.insert(0,directory)
 from governance_local_issuer.native_overlay import verify_overlay
 try:return verify_overlay(stage,after_build=phase=='after_build')
 except (RuntimeError,OSError,ValueError,subprocess.SubprocessError):fail('native_overlay_input_verification_failed')

def verify_build_archive(stage,repo,revision,phase='before_build'):
 if phase not in {'before_build','after_build'}:fail('invalid_build_source_phase')
 stage=private_dir(stage);native_overlay=native_overlay_inputs(stage,phase)
 if native_overlay is not None and native_overlay['sourceRevision']!=revision:fail('native_overlay_source_revision_mismatch')
 raw=git_bytes(repo,['archive','--format=tar',revision]);seen=set();folded=set();observed=[];total=paths=0;regular=links=0
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:')as archive:
  for member in archive:
   name=rel(member.name.rstrip('/'));paths+=len(name)
   if name in {'_axiom_native_overlay.json','packages/verified-issuer-runtime/native/origin_guard.node','packages/verified-issuer-runtime/native/origin-bootstrap'}:fail('native_overlay_outputs_must_be_generated_prebuild')
   if name in seen or name.casefold()in folded or len(seen)>=50000 or paths>32*1024*1024:fail('build_archive_duplicate_or_limit')
   if name.split('/')[0]in {'node_modules','.next'}:fail('reserved_build_archive_root')
   seen.add(name);folded.add(name.casefold());path=stage/name
   try:path.resolve(strict=True).relative_to(stage)
   except(ValueError,OSError,RuntimeError):fail('build_source_escape_or_missing')
   if member.isdir():
    if path.is_symlink()or not path.is_dir():fail('build_source_directory_changed')
    continue
   st=path.lstat()
   if member.isfile()and stat.S_IMODE(st.st_mode)!=(member.mode&0o777):fail('build_source_mode_changed')
   if member.issym():
    if not path.is_symlink()or os.readlink(path)!=member.linkname:fail('build_source_link_changed')
    observed.append([name,'symlink',member.linkname]);links+=1
   elif member.isfile():
    total+=member.size
    if total>MAX_ARCHIVE:fail('build_source_total_limit')
    expected=archive.extractfile(member).read(member.size+1)
    if len(expected)!=member.size or _build_bytes(path)!=expected:fail('build_source_bytes_changed')
    observed.append([name,'regular',member.mode&0o777,member.size,sha(expected)]);regular+=1
   else:fail('unsupported_build_archive_entry')
 # Close the archive source tree; only explicit installed/output roots are separate.
 count=path_bytes=0
 for directory,dirs,names in os.walk(stage,followlinks=False):
  kept=[]
  for name in dirs+names:
   path=Path(directory)/name;relative=path.relative_to(stage).as_posix();count+=1;path_bytes+=len(relative)
   if count>100000 or path_bytes>32*1024*1024:fail('build_source_tree_limit')
   if relative=='node_modules'or(relative=='.next'and phase=='after_build'):
    if path.is_symlink()or not path.is_dir()or path.resolve()!=path:fail('build_separate_root_aliased')
    continue
   if relative=='next-env.d.ts'and relative not in seen and phase=='after_build':
    verify_framework_declaration(stage);continue
   if native_overlay and relative in {'_axiom_native_overlay.json',*native_overlay['stageArtifacts']}:continue
   if relative not in seen:fail('extra_build_source_entry')
   if name in dirs and not path.is_symlink():kept.append(name)
  dirs[:]=kept
 return {'archiveSha256':sha(raw),'verifiedRegularFiles':regular,'verifiedSymlinks':links,'sourceBytes':total,
         'sourceObservationSha256':sha(json.dumps(sorted(observed),sort_keys=True,separators=(',',':')).encode()),
         **({'nativeOverlay':native_overlay}if native_overlay is not None else{})}

def prepare_build_inputs(stage,repo,revision,cache,bound_dir,generation_run,node,phase='before_build'):
 stage=private_dir(stage);generation_run=private_dir(generation_run)
 if(stage/'node_modules').is_symlink()or not(stage/'node_modules').is_dir():fail('owned_installed_dependencies_required')
 package,lock,source=source_inputs(repo,revision)
 archive=verify_build_archive(stage,repo,revision,phase);validate_local_links(stage,lock_plan(package,lock))
 compilers=observe_build_sources(stage,lock,cache);types=framework_type_profile(stage);tool=_engine_tool()
 preparation=tool.prepare_generation(stage,bound_dir,repo,revision,cache,node)
 attempt_raw=_build_bytes(generation_run/'attempt.json',4*1024*1024);result_raw=_build_bytes(generation_run/'result.json',4*1024*1024)
 attempt=json_data(attempt_raw);result=json_data(result_raw)
 if not isinstance(attempt,dict)or attempt.get('format')!='axiom.local-generation-attempt/1'or attempt.get('sourceRevision')!=revision or attempt.get('preparation')!=preparation or attempt.get('node')!=tool.stable_file_hash(node):fail('generation_input_provenance_mismatch')
 if not isinstance(result,dict)or result.get('format')!='axiom.local-generation-result/1'or result.get('status')!='generated_outputs_observed_unqualified'or result.get('generationCompatibilityVerified')is not False or result.get('executionAuthorized')is not False or result.get('executingIssuerIdentity')!='unavailable'or result.get('descendantQuiescence')!='unavailable':fail('generation_observation_not_unqualified')
 current=tool.verify_generated_outputs(stage,preparation)
 if current!=result.get('outputs'):fail('current_generated_inputs_changed')
 comparison=result.get('schemaComparison')
 if not isinstance(comparison,dict)or comparison.get('kind')!='canonical_formatted_scratch_bytes'or comparison.get('semanticAttestation')!='unavailable'or comparison.get('rawArchiveSha256')!=preparation['schemaSha256']or comparison.get('rawGeneratedSha256')!=current['schema.prisma']['sha256']:fail('generation_schema_provenance_mismatch')
 archive_canonical=_build_bytes(generation_run/'tmp/archive-schema.prisma',16*1024*1024);emitted_canonical=_build_bytes(generation_run/'tmp/emitted-schema.prisma',16*1024*1024)
 if archive_canonical!=emitted_canonical or sha(archive_canonical)!=comparison.get('canonicalArchiveSha256')or sha(emitted_canonical)!=comparison.get('canonicalGeneratedSha256'):fail('generation_canonical_observation_changed')
 return {**source,'sourceArchive':archive,'compilerSources':compilers,'frameworkTypeProfile':types,'generationInputSources':preparation['sources'],
         'boundInputs':preparation['engines'],'generationEvidence':{'attemptSha256':sha(attempt_raw),'resultSha256':sha(result_raw),'currentRequiredOutputs':current,'schemaComparison':comparison},
         'upstreamAuthenticity':'unavailable','executingIssuerIdentity':'unavailable','executionAuthorized':False}

def verify_build_outputs(stage):
 stage=Path(stage);root=stage/'.next'
 if root.is_symlink()or not root.is_dir()or root.resolve()!=root:fail('next_output_missing_or_aliased')
 metadata={}
 required=['.next/BUILD_ID','.next/required-server-files.json','.next/server/app-paths-manifest.json']
 for name in required:
  body=_build_bytes(stage/name,8*1024*1024);metadata[name]={'sha256':sha(body),'size':len(body)}
 build_id=_build_bytes(stage/'.next/BUILD_ID',256)
 if not re.fullmatch(rb'[A-Za-z0-9_-]{1,256}',build_id):fail('next_build_id_invalid')
 records=json_data(_build_bytes(stage/'.next/required-server-files.json',8*1024*1024))
 if not isinstance(records,dict)or not isinstance(records.get('files'),list)or len(records['files'])>10000:fail('next_required_metadata_invalid')
 def contained(path):
  if path.is_symlink():fail('next_output_alias')
  try:path.resolve(strict=True).relative_to(stage)
  except(ValueError,OSError,RuntimeError):fail('next_output_reference_escape')
  return path
 for name in records['files']:
  path=contained(stage/rel(name))
  if not path.is_file():fail('next_required_file_missing')
 routes=json_data(_build_bytes(stage/'.next/server/app-paths-manifest.json',8*1024*1024))
 if not isinstance(routes,dict)or not 0<len(routes)<=10000:fail('next_route_metadata_invalid')
 for route,name in routes.items():
  if not isinstance(route,str)or len(route)>4096 or not contained(stage/'.next/server'/rel(name)).is_file():fail('next_route_output_missing')
 traces=entries=trace_bytes=paths=tree_entries=0
 for directory,dirs,names in os.walk(root,followlinks=False):
  tree_entries+=len(dirs)+len(names)
  if tree_entries>250000:fail('next_tree_limit')
  if any((Path(directory)/name).is_symlink()for name in dirs+names):fail('next_output_tree_alias')
  for name in names:
   if not name.endswith('.nft.json'):continue
   trace=Path(directory)/name;body=_build_bytes(trace,8*1024*1024);traces+=1;trace_bytes+=len(body)
   if traces>4096 or trace_bytes>64*1024*1024:fail('next_trace_metadata_limit')
   value=json_data(body)
   if not isinstance(value,dict)or value.get('version')!=1 or not isinstance(value.get('files'),list):fail('next_trace_metadata_invalid')
   entries+=len(value['files'])
   if entries>512000:fail('next_trace_entry_limit')
   for reference in value['files']:
    if not isinstance(reference,str)or not reference or len(reference)>4096 or not reference.isascii()or '\\'in reference or '\0'in reference or Path(reference).is_absolute():fail('next_trace_reference_invalid')
    paths+=len(reference)
    if paths>32*1024*1024:fail('next_trace_path_limit')
    target=trace.parent/reference
    try:target.resolve(strict=True).relative_to(stage)
    except(ValueError,OSError,RuntimeError):fail('next_trace_reference_escape')
    if not target.is_file()and not target.is_dir():fail('next_trace_target_missing')
   metadata[trace.relative_to(stage).as_posix()]={'sha256':sha(body),'size':len(body)}
 if not traces:fail('next_trace_metadata_missing')
 bootstrap=_build_bytes(stage/'.next/server/__axiom_private__/release-merge-bootstrap.cjs',32*1024*1024)
 metadata['.next/server/__axiom_private__/release-merge-bootstrap.cjs']={'sha256':sha(bootstrap),'size':len(bootstrap)}
 return {'requiredMetadata':metadata,'routeCount':len(routes),'traceCount':traces,'traceEntryCount':entries,
         'completeExecutableClosure':'unavailable','loadedCodeIdentity':'unavailable'}

def execute_build(stage=None,repo=None,revision=None,cache=None,bound_dir=None,generation_run=None,node=None,owned=None,timeout=600):
 import math,time
 if any(value is None for value in [stage,repo,revision,cache,bound_dir,generation_run,node,owned])or not isinstance(stage,(str,Path)):fail('exact_owned_build_coordinates_required')
 if type(timeout)not in (int,float)or not math.isfinite(timeout)or not 0<timeout<=600:fail('build_deadline_invalid')
 if platform.system()!='Darwin'or platform.machine()!='arm64':fail('unsupported_build_host')
 deadline=time.monotonic()+timeout;tool=_engine_tool();stage=private_dir(stage);owned=private_dir(owned);bound_dir=private_dir(bound_dir);generation_run=private_dir(generation_run)
 repo=Path(repo).resolve();cache=Path(cache).resolve();node=Path(node)
 if node!=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')or node.is_symlink()or node.resolve()!=node:fail('pinned_build_node_required')
 protected=[repo,cache,Path.home()/'.cache/prisma',bound_dir,generation_run]
 for target in [*protected,owned]:
  target=target.resolve()
  if target==stage or stage in target.parents or target in stage.parents:fail('build_stage_boundary_overlap')
 if any(owned==p.resolve()or p.resolve()in owned.parents for p in protected):fail('build_output_boundary_overlap')
 if(stage/'.next').exists()or(stage/'.next').is_symlink():fail('fresh_next_output_required')
 node_identity=tool.stable_file_hash(node);inputs=prepare_build_inputs(stage,repo,revision,cache,bound_dir,generation_run,node)
 overlay=inputs.get('sourceArchive',{}).get('nativeOverlay')
 if overlay is not None and overlay['plannedBuildRun']!=str(owned):fail('native_overlay_build_run_mismatch')
 names=['attempt.json','result.json','node-version.log','contract.log','next-build.log','private-bootstrap-emission.log','tmp']
 if any((owned/name).exists()or(owned/name).is_symlink()for name in names):fail('fresh_build_logs_required')
 handles={}
 try:
  for name in names[:-1]:handles[name]=os.fdopen(os.open(owned/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb')
  tmp=owned/'tmp';tmp.mkdir(mode=0o700)
  attempt={'format':'axiom.local-next-build-attempt/1','status':'reserved_before_launch','inputs':inputs,'node':node_identity,'processBounds':'original_process_group_only','descendantQuiescence':'unavailable','executionAuthorized':False}
  handles['attempt.json'].write((json.dumps(attempt,sort_keys=True)+'\n').encode());handles['attempt.json'].flush();os.fsync(handles['attempt.json'].fileno())
  env={'PATH':str(node.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','LANG':'C','TZ':'UTC','TMPDIR':str(tmp),'XDG_CACHE_HOME':str(tmp),'NEXT_TELEMETRY_DISABLED':'1','NODE_ENV':'production',
       'DATABASE_URL':'postgresql://local_build:local_build@127.0.0.1:1/local_build','AUTH_SECRET':'isolated-local-build-not-a-live-credential-20261102','NEXTAUTH_SECRET':'isolated-local-build-not-a-live-credential-20261102',
       'CHECKPOINT_DISABLE':'1','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true'}
  profile=tool._generation_profile(stage,tmp,[owned/name for name in ['node-version.log','contract.log','next-build.log','private-bootstrap-emission.log']],protected,read_protected=[repo,cache,Path.home()/'.cache/prisma'])
  prefix=['/usr/bin/sandbox-exec','-p',profile,str(node)]
  result={'format':'axiom.local-next-build-result/1','status':'unavailable','contractCheckStarted':False,'buildStarted':False,'buildOutputsVerified':False,'buildCompatibilityVerified':False,
          'processBounds':'original_process_group_only','descendantQuiescence':'unavailable','runtimeQualification':'unavailable','completeExecutableClosure':'unavailable','executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False}
  def remaining(cap=None):
   left=deadline-time.monotonic()
   if left<=0:fail('build_parent_wall_timeout')
   return min(left,cap)if cap is not None else left
  def run(arguments,log,cap=None):
   code,error=tool._run_generation_child([*prefix,*arguments],stage,env,handles[log],remaining(cap),file_size_limit=2*1024**3,creation_mask=0o022)
   if error:fail(error.replace('generation_','build_',1))
   if code!=0:fail('fixed_build_command_failed')
   return code
  try:
   run(['--version'],'node-version.log',5);handles['node-version.log'].flush()
   if _build_bytes(owned/'node-version.log',64)!=b'v24.21.0\n':fail('pinned_build_node_version_unavailable')
   if prepare_build_inputs(stage,repo,revision,cache,bound_dir,generation_run,node)!=inputs or tool.stable_file_hash(node)!=node_identity:fail('build_inputs_changed_before_contract')
   result['contractCheckStarted']=True;run(['scripts/check-vercel-build.mjs'],'contract.log')
   if prepare_build_inputs(stage,repo,revision,cache,bound_dir,generation_run,node)!=inputs or tool.stable_file_hash(node)!=node_identity:fail('build_inputs_changed_before_compiler')
   result['buildStarted']=True;result['exit']=run(['node_modules/next/dist/bin/next','build','--webpack'],'next-build.log')
   run(['scripts/emit-private-release-bootstrap.cjs'],'private-bootstrap-emission.log')
   outputs=verify_build_outputs(stage)
   outputs['frameworkGeneratedDeclaration']=verify_framework_declaration(stage)
   if prepare_build_inputs(stage,repo,revision,cache,bound_dir,generation_run,node,phase='after_build')!=inputs or tool.stable_file_hash(node)!=node_identity:fail('build_inputs_changed_after_compiler')
   result.update(status='build_outputs_observed_unqualified',buildOutputsVerified=True,outputs=outputs)
  except(RuntimeError,OSError,ValueError,tarfile.TarError)as exc:result['reason']=str(exc)if type(exc)is Unavailable else 'build_input_or_output_unavailable'
  handles['result.json'].write((json.dumps(result,sort_keys=True)+'\n').encode());handles['result.json'].flush();os.fsync(handles['result.json'].fileno())
  if not result['buildOutputsVerified']:fail(result['reason'])
  return result
 finally:
  for handle in handles.values():handle.close()

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
