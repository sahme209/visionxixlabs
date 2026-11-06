"""Public-only adaptation of existing output verifier. No private emitter requirement.
Common checks retained; no issuer/native/System acceptance inferred.
"""
from pathlib import Path
import importlib.util, os, re
REPO=Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
spec=importlib.util.spec_from_file_location('assembly_output_helpers',REPO/'scripts/build-local-issuer-package-source.py')
helpers=importlib.util.module_from_spec(spec);spec.loader.exec_module(helpers)
_build_bytes,sha,json_data,rel,fail=helpers._build_bytes,helpers.sha,helpers.json_data,helpers.rel,helpers.fail
def verify_public_outputs(stage):
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
 return {'requiredMetadata':metadata,'routeCount':len(routes),'traceCount':traces,'traceEntryCount':entries,
         'scope':'public website output structure only; private/bootstrap/native closure intentionally unqualified'}
