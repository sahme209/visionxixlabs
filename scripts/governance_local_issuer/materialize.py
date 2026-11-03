"""Materialize one successful Next build. No build, provider, launch or identity grant."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import stat
import subprocess
import sys
import importlib.util
if __package__ in (None, ""):
    sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from governance_local_issuer.manifest import (PackageUnavailable, canonical, digest, relative, sensitive,
                       strict_json, write_manifest, verify_package, refuse, hash_regular, MAX_FILES, MAX_PATH_BYTES, MAX_BYTES, MAX_FILE_BYTES, read_bytes_bounded, MAX_TRACES, MAX_TRACE_ENTRIES, MAX_TRACE_BYTES, PROFILE, ISOLATED_PROFILE, trace_entry_limit)

def receipt(path):
    raw = read_bytes_bounded(Path(path),1024*1024)
    value = strict_json(raw)
    if (not isinstance(value,dict) or type(value.get("exit")) is not int or value["exit"] != 0
            or not re.fullmatch("[a-f0-9]{40}",str(value.get("source")))
            or not re.fullmatch("[a-f0-9]{64}",str(value.get("archiveSha256")))
            or type(value.get("verifiedRegularFiles")) is not int or value["verifiedRegularFiles"] < 1
            or value.get("nodeVersion") != "v24.21.0" or not isinstance(value.get("stage"),str)):
        refuse("successful_build_receipt_required")
    stage = Path(value["stage"])
    if stage.is_symlink() or not stage.is_dir() or str(stage.resolve()) != str(stage):
        refuse("canonical_successful_stage_required")
    return value, digest(raw)

def collect_native_prerequisites(root):
    # Typed package-bound LOAD metadata; this never supplies runtime authority.
    from governance_local_issuer.native_linkage import collect_native_prerequisites as inspect
    return inspect(root)

def _source_builder():
    spec=importlib.util.spec_from_file_location('isolated_materializer_source_builder',Path(__file__).resolve().parents[1]/'build-local-issuer-package-source.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def _private_directory(value):
    path=Path(value)
    if path.is_symlink() or not path.is_dir() or path.stat().st_uid!=os.getuid() or stat.S_IMODE(path.stat().st_mode)&0o077:
        refuse('isolated_private_owned_directory_required')
    if path.resolve()!=path:refuse('isolated_canonical_directory_required')
    return path

def _evidence_bytes(path,limit=8*1024**2):
    path=Path(path);info=path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink!=1 or info.st_uid!=os.getuid():refuse('isolated_evidence_regular_singlelink_required')
    return read_bytes_bounded(path,limit)

def isolated_build_details(observation,build_run,stage,repo,cache,bound_dir,generation_run,node):
    stage=_private_directory(stage);build_run=_private_directory(build_run)
    generation_run=_private_directory(generation_run);bound_dir=_private_directory(bound_dir)
    deps=stage/'node_modules'
    if deps.is_symlink() or not deps.is_dir() or deps.resolve()!=deps or deps.stat().st_uid!=os.getuid():refuse('isolated_real_owned_dependencies_required')
    observation_bytes=_evidence_bytes(observation);observed=strict_json(observation_bytes)
    attempt_bytes=_evidence_bytes(build_run/'attempt.json');attempt=strict_json(attempt_bytes)
    original_bytes=_evidence_bytes(build_run/'result.json');original=strict_json(original_bytes)
    if not isinstance(observed,dict) or observed.get('format')!='axiom.local-completed-build-observation/1':refuse('isolated_completed_observation_required')
    revision=observed.get('sourceRevision')
    if not isinstance(revision,str) or not re.fullmatch('[a-f0-9]{40}',revision):refuse('isolated_source_revision_invalid')
    if not isinstance(original,dict) or original.get('format')!='axiom.local-next-build-result/1' or type(original.get('exit'))is not int or original['exit']!=0 or original.get('buildStarted')is not True or original.get('contractCheckStarted')is not True:
        refuse('isolated_original_compiler_exit_zero_required')
    if observed.get('originalResult')!=original or observed.get('originalResultSha256')!=digest(original_bytes):refuse('isolated_original_result_mismatch')
    if not isinstance(attempt,dict) or attempt.get('format')!='axiom.local-next-build-attempt/1' or attempt.get('status')!='reserved_before_launch':refuse('isolated_original_attempt_required')
    fixed={'status':'build_outputs_observed_unqualified','compilerExit':0,'compilerRerun':False,'generationRerun':False,
           'buildOutputsVerified':True,'buildCompatibilityVerified':False,'completeExecutableClosure':'unavailable',
           'descendantQuiescence':'unavailable','executingIssuerIdentity':'unavailable','activationQualification':'unavailable','executionAuthorized':False}
    if any(observed.get(key)!=value or type(observed.get(key))is not type(value)for key,value in fixed.items()):refuse('isolated_unqualified_observation_required')
    if original.get('executionAuthorized')is not False or original.get('executingIssuerIdentity')!='unavailable' or original.get('buildCompatibilityVerified')is not False or original.get('descendantQuiescence')!='unavailable':refuse('isolated_original_authority_assertion_refused')
    if not re.fullmatch('[a-f0-9]{64}',str(observed.get('observerSourceSha256'))):refuse('isolated_observer_provenance_invalid')
    if _evidence_bytes(build_run/'node-version.log',64)!=b'v24.21.0\n':refuse('isolated_node_version_observation_required')
    node=Path(node)
    if node.is_symlink() or not node.is_file():refuse('isolated_regular_node_required')
    node_stat,node_sha,_=hash_regular(node)
    if attempt.get('node')!={'sha256':node_sha,'size':node_stat.st_size}:refuse('isolated_node_bytes_changed')
    source_builder=_source_builder()
    try:
        current_inputs=source_builder.prepare_build_inputs(stage,Path(repo),revision,Path(cache),bound_dir,generation_run,node,phase='after_build')
        current_outputs=source_builder.verify_build_outputs(stage)
        current_types=source_builder.verify_framework_declaration(stage)
    except (RuntimeError,OSError,ValueError):refuse('isolated_current_build_recheck_unavailable')
    if current_inputs!=observed.get('inputs') or current_inputs!=attempt.get('inputs') or current_inputs.get('sourceRevision')!=revision:refuse('isolated_current_inputs_mismatch')
    if current_outputs!=observed.get('outputs'):refuse('isolated_current_outputs_mismatch')
    archive=current_inputs.get('sourceArchive')
    if not isinstance(archive,dict) or not re.fullmatch('[a-f0-9]{64}',str(archive.get('archiveSha256'))) or type(archive.get('verifiedRegularFiles'))is not int or archive['verifiedRegularFiles']<1:refuse('isolated_archive_provenance_invalid')
    evidence={'format':'axiom.isolated-build-materialization-inputs/1','originalBuildAttemptSha256':digest(attempt_bytes),
              'originalBuildResultSha256':digest(original_bytes),'completedBuildObservationSha256':digest(observation_bytes),
              'recordedObserverSourceSha256':observed['observerSourceSha256'],'currentInputsSha256':digest(canonical(current_inputs)),
              'currentOutputsSha256':digest(canonical(current_outputs)),'currentFrameworkDeclaration':current_types,
              'originalObserverStatus':original.get('status'),'compilerExit':0,'compilerRerun':False,'generationRerun':False,
              'executingIssuerIdentity':'unavailable','executionAuthorized':False}
    details={'source':revision,'archiveSha256':archive['archiveSha256'],'verifiedRegularFiles':archive['verifiedRegularFiles'],
             'exit':0,'nodeVersion':'v24.21.0','stage':str(stage),**({'nativeOverlay':archive['nativeOverlay']}if 'nativeOverlay'in archive else{})}
    return details,evidence

def materialize_isolated(observation,build_run,stage,repo,cache,bound_dir,generation_run,node,destination):
    details,evidence=isolated_build_details(observation,build_run,stage,repo,cache,bound_dir,generation_run,node)
    return _materialize(details,digest(canonical(evidence)),node,destination,profile=ISOLATED_PROFILE,isolated_evidence=evidence)

def materialize(build_receipt,node,destination):
    details,receipt_sha=receipt(build_receipt)
    return _materialize(details,receipt_sha,node,destination)

def _materialize(details,receipt_sha,node,destination,profile=PROFILE,isolated_evidence=None):
    stage, node, destination = Path(details["stage"]), Path(node), Path(destination)
    if node.is_symlink() or not node.is_file(): refuse("regular_runtime_binary_required")
    if destination.exists() or destination.is_symlink(): refuse("new_destination_required")
    deps_link = stage/"node_modules"
    if profile==PROFILE:
        if not deps_link.is_symlink():refuse("known_dependency_boundary_required")
    elif profile==ISOLATED_PROFILE:
        if deps_link.is_symlink() or not deps_link.is_dir() or deps_link.resolve()!=deps_link:refuse('isolated_real_owned_dependencies_required')
    else:refuse('unsupported_materialization_profile')
    deps = deps_link.resolve(strict=True)
    if not deps.is_dir() or not (deps/"next/dist/bin/next").is_file():
        refuse("dependencies_missing")
    parent=destination.parent
    if parent.is_symlink() or not parent.is_dir() or parent.stat().st_uid!=os.getuid() or stat.S_IMODE(parent.stat().st_mode)&0o077:
        refuse("private_owned_output_parent_required")
    audit_path=parent/"materialization.json"
    if audit_path.exists() or audit_path.is_symlink():refuse("new_materialization_receipt_required")
    native_overlay=details.get('nativeOverlay')
    runtime_root=None
    if native_overlay is not None:
        from governance_local_issuer.native_overlay import verify_overlay,PACKAGE_PATH,PACKAGE_FILES,GENERATED_STAGE
        if verify_overlay(stage,after_build=True)!=native_overlay:refuse('native_overlay_materialization_input_changed')
        runtime_root=stage/PACKAGE_PATH
        if runtime_root.is_symlink()or runtime_root.resolve()!=runtime_root:refuse('native_runtime_root_aliased')
    destination.mkdir(mode=0o700)
    destination = destination.resolve()
    selected, folds, links, transformations = {}, {}, [], []
    active_targets = set()
    total = 0
    path_bytes = 0

    def mapped(source):
        resolved = source.resolve(strict=True)
        if native_overlay is not None and resolved==stage/GENERATED_STAGE[1]:return '__axiom_runtime__/origin-bootstrap'
        try: return "node_modules" if resolved==deps else "node_modules/"+resolved.relative_to(deps).as_posix()
        except ValueError: pass
        try: return resolved.relative_to(stage).as_posix()
        except ValueError: refuse("required_input_outside_allowed_roots")

    def copy(source, target):
        nonlocal total, path_bytes
        target = relative(target)
        sensitive(target)
        if target in active_targets: refuse("recursive_materialization_alias")
        source = Path(source)
        info = source.lstat()
        if runtime_root is not None:
            try: runtime_relative=source.resolve(strict=True).relative_to(runtime_root).as_posix()
            except ValueError: runtime_relative=None
            if runtime_relative not in (None,'.') and runtime_relative not in PACKAGE_FILES and not (source==stage/GENERATED_STAGE[1]and target=='__axiom_runtime__/origin-bootstrap'):
                refuse('native_runtime_input_outside_explicit_distribution')
        identity = (str(source.absolute()),info.st_dev,info.st_ino)
        if target in selected:
            if selected[target] != identity: refuse("duplicate_destination_alias")
            return
        folded = target.casefold()
        if folded in folds: refuse("destination_case_collision")
        folds[folded] = target; selected[target] = identity
        path_bytes += len(target.encode("utf-8"))
        if len(selected)>MAX_FILES or path_bytes>MAX_PATH_BYTES: refuse("materialization_entry_limit")
        out = destination/target
        out.parent.mkdir(parents=True,exist_ok=True)
        if stat.S_ISLNK(info.st_mode):
            try: resolved = source.resolve(strict=True)
            except (OSError,RuntimeError): refuse("invalid_materialization_symlink")
            to = mapped(resolved)
            # Materialize the WHOLE allowed target, including archive-owned local
            # packages outside fixed runtime inputs. package.json `files` is not
            # an exclusion policy: required support and secrets must not vanish.
            copy(resolved,to)
            rewritten = os.path.relpath(destination/to,out.parent)
            out.symlink_to(rewritten,target_is_directory=resolved.is_dir())
            links.append({"path":target,"target":rewritten,"resolved":to})
        elif stat.S_ISDIR(info.st_mode):
            out.mkdir(exist_ok=True)
            active_targets.add(target)
            try:
                if runtime_root is not None and source.resolve()==runtime_root:
                    for name in PACKAGE_FILES:copy(runtime_root/name,target+'/'+name)
                else:
                    for child in sorted(source.iterdir(),key=lambda p:p.name):
                        copy(child,target+"/"+child.name)
            finally: active_targets.remove(target)
            out.chmod(stat.S_IMODE(info.st_mode))
        elif stat.S_ISREG(info.st_mode):
            if info.st_mode & 0o7000: refuse("special_source_mode")
            # Check source bounds and sensitive data BEFORE copying bytes.
            if source.resolve().is_relative_to(deps) or source.resolve().is_relative_to(stage) or source==node:
                try: _, source_sha, _ = hash_regular(source,MAX_BYTES-total)
                except PackageUnavailable as exc: refuse(str(exc)+":"+target)
            else: refuse("source_escape")
            total += info.st_size
            if total>MAX_BYTES or info.st_size>MAX_FILE_BYTES: refuse("materialization_byte_limit")
            # Read/copy no more than the reserved original size (+one growth
            # detection byte); no unbounded shutil copy of a growing source.
            fd=os.open(source,os.O_RDONLY|os.O_NOFOLLOW)
            copied=0;copy_hash=hashlib.sha256()
            try:
                with out.open("xb") as output:
                    while True:
                        chunk=os.read(fd,min(1024*1024,info.st_size-copied+1))
                        if not chunk:break
                        copied+=len(chunk)
                        if copied>info.st_size:refuse("source_grew_during_copy")
                        output.write(chunk);copy_hash.update(chunk)
                copied_info=os.fstat(fd)
            finally:os.close(fd)
            if copied!=info.st_size or copy_hash.hexdigest()!=source_sha:refuse("copy_mismatch")
            if any(getattr(info,k)!=getattr(copied_info,k) for k in ("st_dev","st_ino","st_size","st_mtime_ns","st_ctime_ns")):refuse("source_changed_during_copy")
            out.chmod(stat.S_IMODE(info.st_mode))
            after=source.lstat()
            if any(getattr(info,k)!=getattr(after,k) for k in ("st_dev","st_ino","st_size","st_mtime_ns","st_ctime_ns")):
                refuse("source_changed_during_copy")
            if source_sha != hash_regular(out)[1]:
                refuse("copy_mismatch")
        else: refuse("special_source_file")

    try:
        for name in [".next","public","package.json","next.config.ts","tsconfig.json"]:
            path=stage/name
            if path.exists(): copy(path,name)
            elif name not in ["public","tsconfig.json"]: refuse("required_stage_input_missing")
        copy(deps,"node_modules")
        copy(node,"__axiom_runtime__/node")
        if native_overlay is not None:copy(stage/GENERATED_STAGE[1],'__axiom_runtime__/origin-bootstrap')
        # Resolve ORIGINAL trace paths against the ORIGINAL build, map only the
        # two allowed stage/dependency roots, and retain source+packaged hashes.
        trace_count=trace_bytes=trace_entries=trace_path_bytes=0
        for trace in sorted((stage/".next").rglob("*.nft.json")):
            trace_count+=1;trace_bytes+=trace.lstat().st_size
            if trace_count>MAX_TRACES or trace_bytes>MAX_TRACE_BYTES:refuse("source_trace_limit")
            data=strict_json(read_bytes_bounded(trace,8*1024**2))
            if not isinstance(data,dict) or (type(data.get("version")) is not int or data["version"]!=1) or not isinstance(data.get("files"),list):
                refuse("invalid_source_trace")
            rel=trace.relative_to(stage).as_posix()
            trace_entries+=len(data["files"])
            if trace_entries>trace_entry_limit(profile):refuse("source_trace_entry_limit")
            targets=[]
            for raw in data["files"]:
                if not isinstance(raw,str) or "\0" in raw or os.path.isabs(raw): refuse("invalid_source_trace_path")
                trace_path_bytes+=len(raw.encode("utf-8"))
                if trace_path_bytes>MAX_PATH_BYTES:refuse("source_trace_path_limit")
                source=(trace.parent/raw).resolve(strict=True)
                target=mapped(source)
                copy(source,target)
                targets.append(os.path.relpath(destination/target,(destination/rel).parent))
            packaged={**data,"files":sorted(set(targets))}
            before=read_bytes_bounded(trace,8*1024**2);after=canonical(packaged)+b"\n"
            (destination/rel).write_bytes(after)
            transformations.append({"path":rel,"kind":"nft-root-relocation/1",
                                    "sourceSha256":digest(before),"packagedSha256":digest(after)})
        for link in links:
            if not (destination/link["resolved"]).exists(): refuse("unmaterialized_link_target")
        native=collect_native_prerequisites(destination)
        audit={"format":"axiom.local-issuer-materialization/2" if profile==ISOLATED_PROFILE else "axiom.local-issuer-materialization/1","source":details["source"],
               "buildReceiptSha256":receipt_sha,"copiedEntryCount":len(selected),
               "copiedFileBytes":total,"traceRelocations":transformations,"internalSymlinks":links,
               "included":"fixed Next runtime inputs, every traced support path, ALL dependency files, Node binary",
               "excluded":"source archive files outside fixed runtime inputs/traces; no required secret silently omitted",
               "nativePrerequisites":native,"executingIssuerIdentity":"unavailable",
               "privateBootstrapConsumer":"unavailable","executionAuthorized":False}
        if native_overlay is not None:
            audit['nativeOverlay']=native_overlay
            audit['runtimeDistributionAllowlist']=list(PACKAGE_FILES)
            audit['runtimeSourceFilesExcluded']=sorted(p.relative_to(runtime_root).as_posix()for p in runtime_root.rglob('*')if p.is_file()and p.relative_to(runtime_root).as_posix()not in PACKAGE_FILES)
            audit['included']='fixed Next inputs/traces and dependency closure; issuer runtime uses explicit reviewed distribution allowlist and bootstrap relocation'
        if isolated_evidence is not None:
            audit['isolatedBuildEvidence']=isolated_evidence
            audit['packageProfile']=profile
        audit_bytes=canonical(audit)+b"\n"
        if len(audit_bytes)>64*1024**2:refuse("materialization_receipt_limit")
        parent_fd=os.open(destination.parent,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
        try:
            fd=os.open("materialization.json",os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent_fd)
            with os.fdopen(fd,"wb") as output:output.write(audit_bytes)
        finally:os.close(parent_fd)
        if native["unresolved"]: refuse("native_dependency_resolution_unavailable")
        provenance={"sourceRevision":details["source"],"archiveSha256":details["archiveSha256"],
                    "buildReceiptSha256":receipt_sha,"materializationReceiptSha256":digest(audit_bytes)}
        write_manifest(destination,provenance,details["nodeVersion"],profile=profile)
        return {**verify_package(destination),"materializationReceipt":str(audit_path),
                "sourceRevision":details["source"]}
    except BaseException:
        shutil.rmtree(destination)
        raise

def main():
    parser=argparse.ArgumentParser()
    kind=parser.add_mutually_exclusive_group(required=True)
    kind.add_argument("--build-receipt")
    kind.add_argument("--completed-build-observation")
    for flag in ["build-run","stage","repo","cache-source","bound-engines","generation-run"]:parser.add_argument("--"+flag)
    parser.add_argument("--node",required=True)
    parser.add_argument("--destination",required=True)
    args=parser.parse_args()
    try:
        isolated=[args.build_run,args.stage,args.repo,args.cache_source,args.bound_engines,args.generation_run]
        if args.completed_build_observation:
            if not all(isolated):refuse('isolated_materialization_coordinates_required')
            result=materialize_isolated(args.completed_build_observation,args.build_run,args.stage,args.repo,args.cache_source,args.bound_engines,args.generation_run,args.node,args.destination)
        else:
            if any(isolated):refuse('isolated_arguments_require_observation')
            result=materialize(args.build_receipt,args.node,args.destination)
        print(json.dumps(result,sort_keys=True))
    except (PackageUnavailable,OSError,ValueError) as exc:
        print(json.dumps({"status":"unavailable","reason":str(exc),"executionAuthorized":False}))
        return 1
    return 0

if __name__=="__main__":raise SystemExit(main())
