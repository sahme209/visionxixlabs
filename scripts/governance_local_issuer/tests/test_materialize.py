from pathlib import Path
import tempfile
import json
import os
import unittest
from unittest.mock import patch
import sys
sys.path.insert(0,str(Path(__file__).parents[2]))
from governance_local_issuer.materialize import materialize
from governance_local_issuer.manifest import PackageUnavailable, verify_package

class MaterializeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="axiom-materialize-unit-")
        self.base=Path(self.temp.name).resolve()
        self.stage=self.base/"successful-stage"; self.stage.mkdir()
        self.deps=self.base/"dependencies"; self.deps.mkdir()
        (self.stage/"node_modules").symlink_to(self.deps,target_is_directory=True)
        for name,data in {
            ".next/BUILD_ID":b"fixture",
            ".next/required-server-files.json":b'{"files":[".next/BUILD_ID"]}',
            "package.json":b'{"name":"fixture"}',
            "next.config.ts":b"module.exports={}",
        }.items():
            p=self.stage/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        for name,data in {"next/dist/bin/next":b"fixture CLI","external/index.js":b"module.exports=1"}.items():
            p=self.deps/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
        trace=self.stage/".next/server/app/route.js.nft.json";trace.parent.mkdir(parents=True)
        trace.write_text(json.dumps({"version":1,"files":[os.path.relpath(self.deps/"external",trace.parent)]}))
        (self.deps/".bin").mkdir();(self.deps/".bin/next").symlink_to("../next/dist/bin/next")
        self.node=self.base/"fixture-node";self.node.write_bytes(b"NOT real runtime identity");self.node.chmod(0o755)
        self.receipt=self.base/"receipt.json"
        self.receipt.write_text(json.dumps({"source":"a"*40,"archiveSha256":"b"*64,"verifiedRegularFiles":4,"exit":0,"nodeVersion":"v24.21.0","stage":str(self.stage)}))
        self.target=self.base/"package"
    def tearDown(self):self.temp.cleanup()
    def build(self):
        # File-set-only fixture. No real native/runtime qualification is asserted.
        with patch("governance_local_issuer.materialize.collect_native_prerequisites",
                   return_value={"unresolved":[],"runtimeQualification":"unavailable"}):
            return materialize(self.receipt,self.node,self.target)
    def test_materializes_dependency_directory_and_relocates_only_trace_metadata(self):
        result=self.build()
        self.assertFalse((self.target/"node_modules").is_symlink())
        self.assertEqual((self.target/"node_modules/external/index.js").read_bytes(),b"module.exports=1")
        self.assertTrue((self.target/"node_modules/.bin/next").is_symlink())
        self.assertEqual((self.target/"node_modules/.bin/next").resolve(),self.target/"node_modules/next/dist/bin/next")
        self.assertEqual(result["executingIssuerIdentity"],"unavailable")
        self.assertFalse(result["executionAuthorized"])
        audit=json.loads((self.base/"materialization.json").read_text())
        self.assertEqual(len(audit["traceRelocations"]),1)
        self.assertNotEqual(audit["traceRelocations"][0]["sourceSha256"],audit["traceRelocations"][0]["packagedSha256"])
        verify_package(self.target)
    def archive_package(self):
        package=self.stage/"packages/verified-issuer-runtime"
        package.mkdir(parents=True)
        for name,data in {"package.json":b'{"files":["index.cjs"]}',"index.cjs":b"module.exports={}","internal/support.cjs":b"fixture support","README.md":b"fixture distribution metadata"}.items():
            path=package/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        (package/"index.cjs").chmod(0o755)
        link=self.deps/"@axiom/verified-issuer-runtime";link.parent.mkdir()
        link.symlink_to(package,target_is_directory=True)
        return package
    def test_internal_archive_package_symlink_materializes_entire_target(self):
        package=self.archive_package()
        result=self.build()
        link=self.target/"node_modules/@axiom/verified-issuer-runtime"
        self.assertEqual(link.resolve(),self.target/"packages/verified-issuer-runtime")
        for source in package.rglob("*"):
            if source.is_file():self.assertEqual((link/source.relative_to(package)).read_bytes(),source.read_bytes())
        self.assertEqual((link/"index.cjs").stat().st_mode&0o777,0o755)
        audit=json.loads((self.base/"materialization.json").read_text())
        self.assertTrue(any(x["resolved"]=="packages/verified-issuer-runtime" for x in audit["internalSymlinks"]))
        self.assertFalse(result["executionAuthorized"])
    def test_internal_archive_package_sensitive_target_is_not_omitted(self):
        (self.archive_package()/".env").write_bytes(b"fixture forbidden")
        with self.assertRaises(PackageUnavailable):self.build()
        self.assertFalse(self.target.exists())
    def test_internal_archive_package_cycle_refuses(self):
        package=self.archive_package()
        (package/"self").symlink_to(package,target_is_directory=True)
        with self.assertRaises(PackageUnavailable):self.build()
        self.assertFalse(self.target.exists())
    def test_archive_package_link_cannot_adopt_external_workspace_package(self):
        self.archive_package()
        outside=self.base/"workspace-package";outside.mkdir();(outside/"index.cjs").write_bytes(b"outside archive")
        link=self.deps/"@axiom/verified-issuer-runtime";link.unlink();link.symlink_to(outside,target_is_directory=True)
        with self.assertRaisesRegex(PackageUnavailable,"required_input_outside_allowed_roots"):self.build()
        self.assertFalse(self.target.exists())
    def test_archive_package_entry_budget_refuses(self):
        self.archive_package()
        with patch("governance_local_issuer.materialize.MAX_FILES",8),self.assertRaisesRegex(PackageUnavailable,"materialization_entry_limit"):
            self.build()
        self.assertFalse(self.target.exists())
    def test_failed_receipt_and_external_symlink_refuse(self):
        data=json.loads(self.receipt.read_text());data["exit"]=1;self.receipt.write_text(json.dumps(data))
        with self.assertRaises(PackageUnavailable):self.build()
        self.assertFalse(self.target.exists())
        data["exit"]=0;self.receipt.write_text(json.dumps(data))
        (self.deps/"unbound").symlink_to(self.base,target_is_directory=True)
        with self.assertRaises(PackageUnavailable):self.build()
        self.assertFalse(self.target.exists())
    def test_required_sensitive_files_refuse_not_silent_omit(self):
        (self.deps/".npmrc").write_bytes(b"fixture forbidden config")
        with self.assertRaises(PackageUnavailable):self.build()
        self.assertFalse(self.target.exists())
    def test_private_key_after_prefix_is_rejected_before_copy(self):
        p=self.deps/"private.bin"
        p.write_bytes(b"x"*200000+b"-----BEGIN PRIVATE KEY-----\n"+b"A"*128+b"\n-----END PRIVATE KEY-----")
        import governance_local_issuer.materialize as module
        original=Path.open
        written=[]
        def capture(path,*args,**kw):
            if args and args[0]=="xb":written.append(str(path))
            return original(path,*args,**kw)
        with patch.object(Path,"open",new=capture),self.assertRaises(PackageUnavailable):
            self.build()
        self.assertNotIn(str(self.target/"node_modules/private.bin"),written)
        self.assertFalse(self.target.exists())
    def test_dangling_receipt_symlink_never_writes_outside_owned_output(self):
        outside=self.base/"outside.json"
        (self.base/"materialization.json").symlink_to(outside)
        with self.assertRaises(PackageUnavailable):self.build()
        self.assertFalse(outside.exists())
        self.assertFalse(self.target.exists())
    def test_unresolved_native_reference_retains_unavailable_and_no_manifest(self):
        with patch("governance_local_issuer.materialize.collect_native_prerequisites",
                   return_value={"unresolved":[{"file":"fixture.node","installName":"@rpath/unbound"}],"runtimeQualification":"unavailable"}):
            with self.assertRaises(PackageUnavailable):materialize(self.receipt,self.node,self.target)
        self.assertFalse(self.target.exists())
        self.assertTrue((self.base/"materialization.json").is_file())

if __name__=="__main__":unittest.main()
