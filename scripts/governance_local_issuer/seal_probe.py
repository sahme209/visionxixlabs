"""Owned data-only filesystem/sandbox probes; NOT production issuer identity."""
from __future__ import annotations
import errno
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import tempfile

def probe():
    root=Path(tempfile.mkdtemp(prefix="axiom-issuer-seal-",dir="/private/tmp")).resolve()
    root.chmod(0o700)
    if not re.fullmatch(r"/private/tmp/axiom-issuer-seal-[A-Za-z0-9_-]+",str(root)) or root.stat().st_uid!=os.getuid():
        raise RuntimeError("owned_fixture_required")
    source=root/"source";source.mkdir(mode=0o700);(source/"fixture.txt").write_bytes(b"DATA-ONLY; no issuer or executable capability\n")
    mount=root/"mount";mount.mkdir(mode=0o700);image=root/"fixture.dmg"
    result={"profile":"owned-readonly-data-fixture/1","root":str(root),"status":"unavailable",
            "host":{"system":platform.system(),"architecture":platform.machine()},
            "executingIssuerIdentity":"unavailable","runtimeQualification":"unavailable",
            "legacyQualification":"unavailable","fleetQualification":"unavailable","executionAuthorized":False}
    env={"PATH":"/usr/bin:/bin:/usr/sbin:/sbin","LANG":"C"}
    attached=False
    def run(args):
        return subprocess.run(args,env=env,capture_output=True,text=True,timeout=60)
    try:
        result["host"]["osBuild"]=run(["/usr/bin/sw_vers","-buildVersion"]).stdout.strip()
        created=run(["/usr/bin/hdiutil","create","-srcfolder",str(source),"-volname","axiom-local-fixture","-format","UDRO","-fs","HFS+",str(image)])
        result["createExit"]=created.returncode
        if created.returncode:
            result["failure"]="readonly_image_create_unavailable";result["diagnostic"]=created.stderr[-2048:];return result
        mounted=run(["/usr/bin/hdiutil","attach","-readonly","-nobrowse","-noautoopen","-mountpoint",str(mount),str(image)])
        attached=os.path.ismount(mount)
        result["attachExit"]=mounted.returncode
        if mounted.returncode or not attached:
            result["failure"]="readonly_image_attach_unavailable";result["diagnostic"]=mounted.stderr[-2048:];return result
        result["statvfsFlags"]=os.statvfs(mount).f_flag
        try:
            fd=os.open(mount/"forbidden-probe",os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        except OSError as exc:
            result["writeErrno"]=exc.errno
        else:
            os.close(fd);(mount/"forbidden-probe").unlink();result["writeErrno"]=None
        result["kernelReadonly"]=bool(result["statvfsFlags"]&os.ST_RDONLY) and result["writeErrno"]==errno.EROFS
        if result["kernelReadonly"]:result["status"]="data_fixture_kernel_readonly"
    finally:
        if attached or os.path.ismount(mount):
            detached=run(["/usr/bin/hdiutil","detach",str(mount)])
            result["detachExit"]=detached.returncode
            if detached.returncode:
                forced=run(["/usr/bin/hdiutil","detach","-force",str(mount)])
                result["forceDetachExit"]=forced.returncode
        result["mountStillAttached"]=os.path.ismount(mount)
        if result["mountStillAttached"]:result["status"]="unavailable"
        if image.exists():
            result["fixtureImageSha256"]=hashlib.sha256(image.read_bytes()).hexdigest()
        (root/"probe.json").write_text(json.dumps(result,indent=2)+"\n")
    # Test only an OWNED child process's backing-file write denial. This does not
    # establish a complete Next process/native/loader sandbox profile.
    profile='(version 1)(allow default)(deny network*)(deny file-write* (subpath "'+str(root)+'"))'
    child="import errno,json,os,sys\ntry:\n f=os.open(sys.argv[1],os.O_WRONLY);os.close(f);print(json.dumps({'denied':False}));sys.exit(2)\nexcept OSError as e:\n print(json.dumps({'denied':e.errno in (errno.EPERM,errno.EACCES),'errno':e.errno}))\n"
    sandbox=run(["/usr/bin/sandbox-exec","-p",profile,"/usr/bin/python3","-c",child,str(image)])
    result["ownedChildSandbox"]={"exit":sandbox.returncode,"stdout":sandbox.stdout.strip(),"stderr":sandbox.stderr[-2048:],
                                  "qualification":"control_probe_only_not_complete_process_profile"}
    (root/"probe.json").write_text(json.dumps(result,indent=2)+"\n")
    return result

if __name__=="__main__":
    print(json.dumps(probe(),sort_keys=True))
