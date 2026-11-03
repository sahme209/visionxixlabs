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
if __package__ in (None, ""):
    sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from governance_local_issuer.manifest import (PackageUnavailable, canonical, digest, relative, sensitive,
                       strict_json, write_manifest, verify_package, refuse, hash_regular, MAX_FILES, MAX_PATH_BYTES, MAX_BYTES, MAX_FILE_BYTES, read_bytes_bounded, MAX_TRACES, MAX_TRACE_ENTRIES, MAX_TRACE_BYTES)

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
    """Audit actual Mach-O references; OS shared-cache libraries are HOST TRUST."""
    candidates = []
    magic = {b"\xcf\xfa\xed\xfe",b"\xfe\xed\xfa\xcf",b"\xca\xfe\xba\xbe",b"\xbe\xba\xfe\xca"}
    for base, _, names in os.walk(root):
        for name in names:
            path = Path(base) / name
            if path.is_symlink() or not path.is_file(): continue
            with path.open("rb") as f:
                if f.read(4) in magic: candidates.append(path)
    system, bound, unresolved = set(), [], []
    for path in sorted(candidates):
        proc = subprocess.run(["/usr/bin/otool","-L",str(path)],capture_output=True,text=True,timeout=15)
        if proc.returncode: refuse("native_linkage_unreadable")
        dependencies = []
        for line in proc.stdout.splitlines():
            if " (compatibility version" not in line: continue
            name = line.strip().split(" (compatibility version",1)[0]
            dependencies.append(name)
            if name.startswith(("/usr/lib/","/System/Library/")):
                system.add(name); continue
            if name.startswith("@loader_path/"):
                target = path.parent / name[len("@loader_path/"):]
            elif name.startswith("@executable_path/"):
                target = Path(root)/"__axiom_runtime__"/name[len("@executable_path/"):]
            else:
                # Inherited @rpath search/dlopen is NOT guessed from filenames.
                unresolved.append({"file":path.relative_to(root).as_posix(),"installName":name})
                continue
            try:
                target = target.resolve(strict=True); target.relative_to(Path(root).resolve())
            except (ValueError,OSError,RuntimeError):
                unresolved.append({"file":path.relative_to(root).as_posix(),"installName":name})
        bound.append({"path":path.relative_to(root).as_posix(),"installNames":dependencies})
    os_build = subprocess.check_output(["/usr/bin/sw_vers","-buildVersion"],text=True).strip()
    snapshot_info = subprocess.check_output(["/usr/sbin/diskutil","info","-plist","/"])
    import plistlib
    info = plistlib.loads(snapshot_info)
    return {"kind":"trusted_macos_host_prerequisites_not_attestation","osBuild":os_build,
            "architecture":platform.machine(),"apfsSnapshot":info.get("APFSSnapshot") is True,
            "systemInstallNames":sorted(system),"machOFiles":bound,"unresolved":unresolved,
            "runtimeQualification":"unavailable"}

def materialize(build_receipt, node, destination):
    details, receipt_sha = receipt(build_receipt)
    stage, node, destination = Path(details["stage"]), Path(node), Path(destination)
    if node.is_symlink() or not node.is_file(): refuse("regular_runtime_binary_required")
    if destination.exists() or destination.is_symlink(): refuse("new_destination_required")
    deps_link = stage/"node_modules"
    if not deps_link.is_symlink(): refuse("known_dependency_boundary_required")
    deps = deps_link.resolve(strict=True)
    if not deps.is_dir() or not (deps/"next/dist/bin/next").is_file():
        refuse("dependencies_missing")
    parent=destination.parent
    if parent.is_symlink() or not parent.is_dir() or parent.stat().st_uid!=os.getuid() or stat.S_IMODE(parent.stat().st_mode)&0o077:
        refuse("private_owned_output_parent_required")
    audit_path=parent/"materialization.json"
    if audit_path.exists() or audit_path.is_symlink():refuse("new_materialization_receipt_required")
    destination.mkdir(mode=0o700)
    destination = destination.resolve()
    selected, folds, links, transformations = {}, {}, [], []
    active_targets = set()
    total = 0
    path_bytes = 0

    def mapped(source):
        resolved = source.resolve(strict=True)
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
            if trace_entries>MAX_TRACE_ENTRIES:refuse("source_trace_entry_limit")
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
        audit={"format":"axiom.local-issuer-materialization/1","source":details["source"],
               "buildReceiptSha256":receipt_sha,"copiedEntryCount":len(selected),
               "copiedFileBytes":total,"traceRelocations":transformations,"internalSymlinks":links,
               "included":"fixed Next runtime inputs, every traced support path, ALL dependency files, Node binary",
               "excluded":"source archive files outside fixed runtime inputs/traces; no required secret silently omitted",
               "nativePrerequisites":native,"executingIssuerIdentity":"unavailable",
               "privateBootstrapConsumer":"unavailable","executionAuthorized":False}
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
        write_manifest(destination,provenance,details["nodeVersion"])
        return {**verify_package(destination),"materializationReceipt":str(audit_path),
                "sourceRevision":details["source"]}
    except BaseException:
        shutil.rmtree(destination)
        raise

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--build-receipt",required=True)
    parser.add_argument("--node",required=True)
    parser.add_argument("--destination",required=True)
    args=parser.parse_args()
    try:
        print(json.dumps(materialize(args.build_receipt,args.node,args.destination),sort_keys=True))
    except (PackageUnavailable,OSError,ValueError) as exc:
        print(json.dumps({"status":"unavailable","reason":str(exc),"executionAuthorized":False}))
        return 1
    return 0

if __name__=="__main__":
    raise SystemExit(main())
