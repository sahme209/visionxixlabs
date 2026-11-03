"""Closed local file-set observations. Never constructs executing issuer authority."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import unicodedata

MANIFEST = "_axiom_local_issuer_manifest.json"
FORMAT = "axiom.local-issuer-package/1"
PROFILE = "next-start-darwin-arm64/1"
ISOLATED_PROFILE = "next-start-darwin-arm64/2"
ISOLATED_MAX_TRACE_ENTRIES = 512000
MAX_FILES = 250000
MAX_BYTES = 8 * 1024 ** 3
MAX_FILE_BYTES = 2 * 1024 ** 3
MAX_PATH_BYTES = 32 * 1024 ** 2
MAX_TRACES = 4096
MAX_TRACE_ENTRIES = 250000
MAX_TRACE_BYTES = 64 * 1024 ** 2
REQUIRED = (".next/BUILD_ID", ".next/required-server-files.json",
            "node_modules/next/dist/bin/next", "__axiom_runtime__/node")

class PackageUnavailable(RuntimeError):
    pass

def refuse(reason):
    raise PackageUnavailable(reason)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def digest(data):
    return hashlib.sha256(data).hexdigest()

def strict_json(data):
    def pairs(items):
        obj = {}
        for k, v in items:
            if k in obj:
                refuse("duplicate_json_key")
            obj[k] = v
        return obj
    try:
        return json.loads(data, object_pairs_hook=pairs, parse_constant=lambda _: refuse("nonfinite_json"))
    except (ValueError, UnicodeError, TypeError, RecursionError):
        refuse("invalid_json")

def relative(raw):
    if (not isinstance(raw, str) or not raw or not raw.isascii() or len(raw) > 4096
            or "\\" in raw or "\0" in raw or any(ord(c) < 32 or ord(c) == 127 for c in raw)
            or not raw.isascii() or unicodedata.normalize("NFC", raw) != raw):
        refuse("invalid_path")
    p = PurePosixPath(raw)
    if p.is_absolute() or raw != p.as_posix() or any(part in ("", ".", "..") for part in raw.split("/")):
        refuse("noncanonical_path")
    return raw

class PrivateKeyScanner:
    """Bounded state, all chunks: recognized PEM header + whitespace + 64
    base64 bytes. Public quoted parser constants are not key material. This is
    NOT a generic secret detector or a guarantee about encoded credentials."""
    header=re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----")
    whitespace=re.compile(bytes([92])+b"s*")
    body=re.compile(b"[A-Za-z0-9+/="+bytes([13,10])+b"]*")
    def __init__(self):
        self.tail=b"";self.state="search";self.spaced=False;self.count=0
    def feed(self,chunk):
        data=self.tail+chunk if self.state=="search" else chunk
        self.tail=b"";position=0
        while position<len(data):
            if self.state=="search":
                match=self.header.search(data,position)
                if not match:
                    self.tail=data[max(position,len(data)-63):]
                    return
                position=match.end();self.state="gap";self.spaced=False;self.count=0
            elif self.state=="gap":
                end=self.whitespace.match(data,position).end()
                self.spaced=self.spaced or end>position;position=end
                if position==len(data):return
                if self.spaced and data[position:position+1] in b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=":
                    self.state="body"
                else:self.state="search"
            else:
                end=self.body.match(data,position).end()
                part=data[position:end]
                self.count+=len(part)-part.count(bytes([13]))-part.count(bytes([10]))
                if self.count>=64:refuse("recognized_private_key_material")
                position=end
                if position==len(data):return
                self.state="search"

def sensitive(path, prefix=b""):
    parts = PurePosixPath(path).parts
    name = parts[-1].lower()
    if (name in {".npmrc", ".netrc", ".pypirc", ".git-credentials", "id_rsa", "id_ecdsa", "id_ed25519"}
            or name == ".env" or name.startswith(".env.")
            or name.endswith((".keychain", ".keychain-db"))
            or ".ssh" in parts or ".aws" in parts or ".git" in parts):
        refuse("sensitive_file")
    if prefix:PrivateKeyScanner().feed(prefix)

def bound_target(root, link):
    raw = os.readlink(link)
    if os.path.isabs(raw) or "\\" in raw or "\0" in raw:
        refuse("outside_or_absolute_symlink")
    try:
        target = link.resolve(strict=True)
        target.relative_to(root)
    except (ValueError, OSError, RuntimeError):
        refuse("outside_dangling_or_cyclic_symlink")
    if target == root or target in link.parents:
        refuse("recursive_directory_alias")
    return raw, target.relative_to(root).as_posix()

def read_bytes_bounded(path, limit):
    before=path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_nlink!=1 or before.st_size>limit:refuse("metadata_read_limit")
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW);chunks=[];count=0
    try:
        while True:
            chunk=os.read(fd,min(1024*1024,limit-count+1))
            if not chunk:break
            count+=len(chunk)
            if count>limit:refuse("growing_metadata_read_limit")
            chunks.append(chunk)
        after=os.fstat(fd)
    finally:os.close(fd)
    latest=path.lstat()
    fields=("st_dev","st_ino","st_size","st_mode","st_mtime_ns","st_ctime_ns")
    if any(getattr(before,k)!=getattr(after,k) or getattr(before,k)!=getattr(latest,k) for k in fields):refuse("metadata_changed_during_read")
    return b"".join(chunks)

def hash_regular(path, remaining_bytes=None):
    before = path.lstat()
    if remaining_bytes is not None and (type(remaining_bytes) is not int or remaining_bytes<0): refuse("invalid_stream_budget")
    limit=min(MAX_BYTES,MAX_FILE_BYTES,remaining_bytes if remaining_bytes is not None else MAX_BYTES)
    if before.st_size>limit: refuse("file_byte_limit")
    if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_mode & 0o7000:
        refuse("nonregular_or_hardlink")
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    h = hashlib.sha256()
    prefix = b""
    scanner=PrivateKeyScanner()
    streamed = 0
    try:
        opened = os.fstat(fd)
        if (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino):
            refuse("file_replaced_during_verification")
        while True:
            chunk = os.read(fd, min(1024 * 1024,limit-streamed+1))
            streamed += len(chunk)
            if streamed>limit: refuse("growing_file_byte_limit")
            if not chunk:
                break
            if len(prefix) < 131072:
                prefix += chunk[:131072-len(prefix)]
            scanner.feed(chunk)
            h.update(chunk)
        after = os.fstat(fd)
    finally:
        os.close(fd)
    latest = path.lstat()
    fields = ("st_dev", "st_ino", "st_size", "st_mode", "st_mtime_ns", "st_ctime_ns")
    if any(getattr(before, k) != getattr(after, k) or getattr(before, k) != getattr(latest, k) for k in fields):
        changed=lambda a,b: ",".join(k for k in fields if getattr(a,k)!=getattr(b,k)) or "none"
        refuse("file_changed_during_verification[preopen_to_open="+changed(before,opened)+";open_to_end="+changed(opened,after)+";end_to_path="+changed(after,latest)+"]")
    return before, h.hexdigest(), prefix

def trace_entry_limit(profile):
    if profile == PROFILE: return MAX_TRACE_ENTRIES
    if profile == ISOLATED_PROFILE: return ISOLATED_MAX_TRACE_ENTRIES
    refuse("unsupported_manifest_profile")

def snapshot(root, profile=PROFILE):
    trace_limit = trace_entry_limit(profile)
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        refuse("invalid_package_root")
    root = root.resolve()
    files, directories, links, names, inodes = [], [], [], {}, set()
    total = 0
    entry_count = 0
    path_bytes = 0
    for directory, dirs, leaves in os.walk(root, followlinks=False):
        dirs.sort(); leaves.sort()
        for name in dirs + leaves:
            path = Path(directory) / name
            rel = relative(path.relative_to(root).as_posix())
            if rel == MANIFEST:
                if path.is_symlink() or not path.is_file():
                    refuse("manifest_not_regular")
                continue
            entry_count += 1
            path_bytes += len(rel.encode("utf-8"))
            if entry_count > MAX_FILES or path_bytes > MAX_PATH_BYTES: refuse("package_entry_or_path_limit")
            folded = unicodedata.normalize("NFC", rel).casefold()
            if folded in names:
                refuse("case_or_unicode_path_collision")
            names[folded] = rel
            sensitive(rel)
            info = path.lstat()
            if stat.S_ISLNK(info.st_mode):
                target, resolved = bound_target(root, path)
                path_bytes += len(target.encode("utf-8")) + len(resolved.encode("utf-8"))
                if path_bytes > MAX_PATH_BYTES: refuse("package_path_limit")
                links.append({"path":rel, "target":target, "resolved":resolved})
            elif stat.S_ISDIR(info.st_mode):
                if info.st_mode & 0o7000: refuse("special_directory_mode")
                directories.append({"path":rel, "mode":stat.S_IMODE(info.st_mode)})
            elif stat.S_ISREG(info.st_mode):
                if total + info.st_size > MAX_BYTES: refuse("package_byte_limit")
                info, sha, prefix = hash_regular(path,MAX_BYTES-total)
                sensitive(rel, prefix)
                inode = (info.st_dev, info.st_ino)
                if inode in inodes: refuse("duplicate_inode_alias")
                inodes.add(inode); total += info.st_size
                if total > MAX_BYTES or len(files) >= MAX_FILES: refuse("package_limit_exceeded")
                files.append({"path":rel,"size":info.st_size,"sha256":sha,"mode":stat.S_IMODE(info.st_mode)})
            else:
                refuse("special_file")
    all_paths = {x["path"] for x in files + directories + links}
    for link in links:
        if link["resolved"] not in all_paths:
            refuse("symlink_target_not_declared")
    for required in REQUIRED:
        p = root / required
        if required not in all_paths or not p.is_file() or p.is_symlink():
            refuse("required_support_missing")
    if not (root / "__axiom_runtime__/node").stat().st_mode & 0o111:
        refuse("runtime_not_executable")
    validate_traces(root, files, profile=profile)
    return {"files":sorted(files,key=lambda x:x["path"]),
            "directories":sorted(directories,key=lambda x:x["path"]),
            "symlinks":sorted(links,key=lambda x:x["path"])}

def validate_traces(root, files, profile=PROFILE):
    trace_limit = trace_entry_limit(profile)
    names = {x["path"] for x in files}
    trace_count = trace_entries = trace_bytes = trace_path_bytes = 0
    for item in files:
        if not item["path"].endswith(".nft.json"):
            continue
        trace_count += 1
        trace_bytes += item["size"]
        if trace_count > MAX_TRACES or item["size"] > 8*1024**2 or trace_bytes > MAX_TRACE_BYTES: refuse("trace_limit_exceeded")
        data = strict_json(read_bytes_bounded(root / item["path"],8*1024**2))
        if not isinstance(data, dict) or (type(data.get("version")) is not int or data["version"] != 1) or not isinstance(data.get("files"), list):
            refuse("invalid_trace")
        trace_entries += len(data["files"])
        if trace_entries > trace_limit: refuse("trace_limit_exceeded")
        for raw in data["files"]:
            if not isinstance(raw, str) or os.path.isabs(raw) or "\\" in raw or "\0" in raw:
                refuse("invalid_trace_target")
            trace_path_bytes += len(raw.encode("utf-8"))
            if trace_path_bytes > MAX_PATH_BYTES: refuse("trace_path_limit")
            try:
                target = ((root / item["path"]).parent / raw).resolve(strict=True)
                rel = target.relative_to(root).as_posix()
            except (ValueError, OSError, RuntimeError):
                refuse("trace_missing_or_outside_package")
            if target.is_file() and rel not in names:
                refuse("trace_file_not_declared")
            if not target.is_file() and not target.is_dir():
                refuse("trace_special_target")
    required = strict_json(read_bytes_bounded(root / ".next/required-server-files.json",8*1024**2))
    if not isinstance(required, dict) or not isinstance(required.get("files"), list):
        refuse("invalid_required_server_files")
    for raw in required["files"]:
        rel = relative(raw)
        if rel not in names:
            refuse("required_server_file_missing")

def validate_manifest(data):
    expected = {"format","profile","provenance","runtime","closure","files","directories","symlinks"}
    if not isinstance(data, dict) or set(data) != expected or data["format"] != FORMAT or data["profile"] not in {PROFILE, ISOLATED_PROFILE}:
        refuse("unsupported_manifest")
    p = data["provenance"]
    if (not isinstance(p, dict) or set(p) != {"sourceRevision","archiveSha256","buildReceiptSha256","materializationReceiptSha256"}
            or not re.fullmatch("[a-f0-9]{40}", str(p["sourceRevision"]))
            or any(not re.fullmatch("[a-f0-9]{64}", str(p[k])) for k in ["archiveSha256","buildReceiptSha256","materializationReceiptSha256"])):
        refuse("invalid_provenance")
    if data["runtime"] != {"platform":"darwin","architecture":"arm64","nodeVersion":"v24.21.0","entrypoint":"__axiom_runtime__/node"}:
        refuse("unsupported_runtime")
    if data["closure"] != {"strategy":"next-traces-plus-materialized-dependencies/1",
                            "executingIssuerIdentity":"unavailable",
                            "nativePrerequisite":"trusted-macos-host-not-attested",
                            "privateBootstrapConsumer":"unavailable"}:
        refuse("unsupported_qualification_assertion")
    seen = set()
    path_bytes = 0
    file_bytes = 0
    schemas = {"files":{"path","size","sha256","mode"},"directories":{"path","mode"},"symlinks":{"path","target","resolved"}}
    for kind, fields in schemas.items():
        entries = data[kind]
        if not isinstance(entries, list) or len(entries) > MAX_FILES: refuse("manifest_limit")
        if any(not isinstance(e,dict) or not isinstance(e.get("path"),str) for e in entries): refuse("invalid_manifest_entry")
        if [e["path"] for e in entries] != sorted(e["path"] for e in entries):
            refuse("manifest_not_sorted")
        for e in entries:
            if not isinstance(e, dict) or set(e) != fields: refuse("invalid_manifest_entry")
            path = relative(e["path"])
            key = path.casefold()
            if key in seen or path == MANIFEST: refuse("duplicate_or_self_manifest_entry")
            seen.add(key)
            path_bytes += len(path.encode("utf-8"))
            if len(seen) > MAX_FILES or path_bytes > MAX_PATH_BYTES: refuse("manifest_total_limit")
            if "mode" in e and (type(e["mode"]) is not int or not 0 <= e["mode"] <= 0o777): refuse("invalid_mode")
            if kind == "files" and (type(e["size"]) is not int or e["size"] < 0 or e["size"]>MAX_FILE_BYTES or not re.fullmatch("[a-f0-9]{64}",str(e["sha256"]))):
                refuse("invalid_file_identity")
            if kind=="files":
                file_bytes+=e["size"]
                if file_bytes>MAX_BYTES:refuse("manifest_byte_limit")
            if kind == "symlinks" and (not isinstance(e["target"],str) or not isinstance(e["resolved"],str)):
                refuse("invalid_symlink_entry")
            if kind=="symlinks":
                path_bytes+=len(e["target"].encode("utf-8"))+len(e["resolved"].encode("utf-8"))
                if path_bytes>MAX_PATH_BYTES:refuse("manifest_path_limit")
    return data

def write_manifest(root, provenance, node_version, profile=PROFILE):
    data = {"format":FORMAT,"profile":profile,"provenance":provenance,
            "runtime":{"platform":"darwin","architecture":"arm64","nodeVersion":node_version,"entrypoint":"__axiom_runtime__/node"},
            "closure":{"strategy":"next-traces-plus-materialized-dependencies/1","executingIssuerIdentity":"unavailable",
                       "nativePrerequisite":"trusted-macos-host-not-attested","privateBootstrapConsumer":"unavailable"},
            **snapshot(root, profile=profile)}
    validate_manifest(data)
    path = Path(root) / MANIFEST
    encoded=canonical(data)+b"\n"
    if path.exists() or path.is_symlink():
        if path.is_symlink() or not path.is_file() or path.lstat().st_nlink!=1:
            refuse("manifest_alias_or_hardlink")
        if read_bytes_bounded(path,64*1024**2)!=encoded:refuse("existing_manifest_not_identical")
        return digest(canonical(data))
    root_fd=os.open(Path(root),os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:
        try:fd=os.open(MANIFEST,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=root_fd)
        except OSError:refuse("exclusive_manifest_creation_unavailable")
        with os.fdopen(fd,"wb")as output:output.write(encoded)
    finally:os.close(root_fd)
    return digest(canonical(data))

def verify_package(root):
    root = Path(root)
    path = root / MANIFEST
    if path.is_symlink() or not path.is_file() or path.stat().st_size > 64 * 1024**2:
        refuse("manifest_unavailable")
    data = validate_manifest(strict_json(read_bytes_bounded(path,64*1024**2)))
    actual = snapshot(root, profile=data["profile"])
    if any(actual[k] != data[k] for k in ["files","directories","symlinks"]):
        refuse("package_changed_or_partial")
    return {"qualification":"package_file_set_verified","packageDigest":digest(canonical(data)),
            "fileCount":len(data["files"]),"symlinkCount":len(data["symlinks"]),
            "executingIssuerIdentity":"unavailable","fleetQualification":"unavailable",
            "legacyQualification":"unavailable","runtimeQualification":"unavailable","executionAuthorized":False}
