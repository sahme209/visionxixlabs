"""Fail-closed local launch preflight. Current packages have NO private consumer."""
from __future__ import annotations
import argparse
import errno
import json
import os
from pathlib import Path
import platform
import sys
if __package__ in (None,""):
    sys.path.insert(0,str(Path(__file__).resolve().parent.parent))
from governance_local_issuer.manifest import PackageUnavailable,verify_package,MANIFEST
from governance_local_issuer.launch_preparation import forbidden_environment_present

def readonly_filesystem(root):
    flags=os.statvfs(root).f_flag
    error=None
    try:
        fd=os.open(Path(root)/MANIFEST,os.O_WRONLY|os.O_NOFOLLOW)
    except OSError as exc:
        error=exc.errno
    else:
        os.close(fd)
    return {"statvfsFlags":flags,"writeOpenErrno":error,
            "kernelReadonly":bool(flags & os.ST_RDONLY) and error==errno.EROFS}

def preflight_launch(root):
    result={"status":"unavailable","executingIssuerIdentity":"unavailable",
            "fleetQualification":"unavailable","legacyQualification":"unavailable",
            "runtimeQualification":"unavailable","executionAuthorized":False}
    if forbidden_environment_present(os.environ):
        return {**result,"reasons":["loader_or_self_report_override"]}
    try:
        observation=verify_package(root)
        if platform.system()!="Darwin" or platform.machine()!="arm64":
            return {**result,"reasons":["unsupported_host_profile"]}
        filesystem=readonly_filesystem(root)
        reasons=["compiled_private_consumer_and_bootstrap_missing","controlled_process_sandbox_unqualified"]
        if not filesystem["kernelReadonly"]:reasons.append("executable_root_not_kernel_readonly")
        return {**result,"packageObservation":observation,"filesystem":filesystem,"reasons":reasons}
    except (PackageUnavailable,OSError,ValueError):
        return {**result,"reasons":["package_or_runtime_prerequisite_unavailable"]}

def launch_verified_next(root):
    # No subprocess/import is attempted. Hashes on disk, even on a readonly
    # filesystem, cannot retrofit a private consumer into already compiled code.
    preflight_launch(root)
    raise PackageUnavailable("verified_preimport_launch_unavailable")

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--package",required=True)
    args=parser.parse_args()
    print(json.dumps(preflight_launch(args.package),sort_keys=True))
    return 1

if __name__=="__main__":raise SystemExit(main())
