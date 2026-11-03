import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

MODULE = Path(__file__).parents[1] / "manifest.py"
spec = importlib.util.spec_from_file_location("issuer_manifest", MODULE)
manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manifest)

class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="axiom-issuer-unit-")
        self.root = Path(self.temp.name)
        for name, data in {
            ".next/BUILD_ID": b"fixture-build",
            ".next/required-server-files.json": b'{"files":[".next/BUILD_ID"]}',
            "node_modules/next/dist/bin/next": b"fixture compiled CLI",
            "__axiom_runtime__/node": b"fixture runtime bytes; NOT Node identity",
            "node_modules/external/index.js": b"module.exports=1",
            ".next/server/app/route.js.nft.json": b'{"version":1,"files":["../../../node_modules/external"]}',
        }.items():
            p = self.root / name
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        (self.root / "__axiom_runtime__/node").chmod(0o755)
        self.provenance = {"sourceRevision":"a"*40,"archiveSha256":"b"*64,"buildReceiptSha256":"c"*64,"materializationReceiptSha256":"d"*64}
    def tearDown(self):
        self.temp.cleanup()
    def save(self):
        return manifest.write_manifest(self.root, self.provenance, "v24.21.0")
    def test_full_file_set_is_observation_not_execution_authority(self):
        self.save()
        result = manifest.verify_package(self.root)
        self.assertEqual(result["qualification"], "package_file_set_verified")
        self.assertFalse(result["executionAuthorized"])
        self.assertEqual(result["executingIssuerIdentity"], "unavailable")
        self.assertNotIn("issuerArtifactDigest", result)
    def test_digest_deterministic_and_manifest_not_self_referential(self):
        a = self.save()
        b = self.save()
        self.assertEqual(a, b)
        self.assertEqual(a, manifest.verify_package(self.root)["packageDigest"])
    def test_tamper_missing_extra_mode_rejected(self):
        for kind in ["bytes", "missing", "extra", "mode"]:
            with self.subTest(kind=kind):
                self.save()
                target = self.root / "node_modules/external/index.js"
                original, mode = target.read_bytes(), target.stat().st_mode & 0o777
                if kind == "bytes": target.write_bytes(b"changed")
                if kind == "missing": target.unlink()
                if kind == "extra": (self.root / "unlisted.js").write_bytes(b"extra")
                if kind == "mode": target.chmod(0o755)
                with self.assertRaises(manifest.PackageUnavailable):
                    manifest.verify_package(self.root)
                if kind == "extra": (self.root / "unlisted.js").unlink()
                target.write_bytes(original)
                target.chmod(mode)
    def test_traversal_duplicate_case_alias_and_self_report_rejected(self):
        self.save()
        path = self.root / manifest.MANIFEST
        original = json.loads(path.read_text())
        for kind in ["traversal", "duplicate", "case", "identity", "complete"]:
            data = json.loads(json.dumps(original))
            if kind == "traversal": data["files"][0]["path"] = "../escape"
            if kind == "duplicate": data["files"].append(data["files"][0])
            if kind == "case":
                entry = dict(data["files"][0]); entry["path"] = entry["path"].upper(); data["files"].append(entry)
            if kind == "identity": data["issuerArtifactDigest"] = "f"*64
            if kind == "complete": data["runtimeQualified"] = True
            path.write_text(json.dumps(data))
            with self.subTest(kind=kind), self.assertRaises(manifest.PackageUnavailable):
                manifest.verify_package(self.root)
    def test_manifest_duplicate_json_key_rejected(self):
        self.save()
        p = self.root / manifest.MANIFEST
        p.write_text('{"format":"axiom.local-issuer-package/1","format":"spoof"}')
        with self.assertRaises(manifest.PackageUnavailable):
            manifest.verify_package(self.root)
    def test_internal_symlink_bound_but_outside_dangling_and_cycle_refuse(self):
        link = self.root / "node_modules/alias"
        link.symlink_to("external", target_is_directory=True)
        self.save()
        manifest.verify_package(self.root)
        link.unlink()
        for target in ["/private/tmp", "missing", "alias"]:
            link.symlink_to(target, target_is_directory=True)
            with self.subTest(target=target), self.assertRaises(manifest.PackageUnavailable):
                self.save()
            link.unlink()
    def test_retarget_bound_symlink_and_hardlink_alias_refuse(self):
        link = self.root / "node_modules/alias"
        link.symlink_to("external", target_is_directory=True)
        self.save()
        link.unlink(); link.symlink_to("next", target_is_directory=True)
        with self.assertRaises(manifest.PackageUnavailable):
            manifest.verify_package(self.root)
        link.unlink()
        os.link(self.root / "node_modules/external/index.js", self.root / "hardlink.js")
        with self.assertRaises(manifest.PackageUnavailable):
            self.save()
    def test_special_file_and_secret_environment_file_refuse(self):
        special = self.root / "pipe"
        os.mkfifo(special)
        with self.assertRaises(manifest.PackageUnavailable): self.save()
        special.unlink()
        (self.root / ".env.production").write_bytes(b"do-not-package")
        with self.assertRaises(manifest.PackageUnavailable): self.save()
    def test_directory_trace_missing_or_outside_refuses_partial_closure(self):
        trace = self.root / ".next/server/app/route.js.nft.json"
        for target in ["../../../node_modules/missing", "../../../../outside"]:
            trace.write_text(json.dumps({"version":1,"files":[target]}))
            with self.subTest(target=target), self.assertRaises(manifest.PackageUnavailable):
                self.save()
    def test_all_entry_kinds_are_bounded(self):
        for n in range(110):
            (self.root / ("empty-"+str(n))).mkdir()
        with patch.object(manifest,"MAX_FILES",100), self.assertRaises(manifest.PackageUnavailable):
            self.save()
    def test_full_stream_late_and_cross_chunk_private_key_patterns_refuse(self):
        target = self.root / "node_modules/external/index.js"
        key = b"-----BEGIN PRIVATE KEY-----" + bytes([10]) + b"A"*128 + bytes([10]) + b"-----END PRIVATE KEY-----"
        for offset in [131073,1024*1024-12]:
            target.write_bytes(b"x"*offset+key)
            with self.subTest(offset=offset), self.assertRaises(manifest.PackageUnavailable):
                self.save()
    def test_path_and_trace_aggregate_limits(self):
        with patch.object(manifest,"MAX_PATH_BYTES",1,create=True), self.assertRaises(manifest.PackageUnavailable):
            self.save()
        extra = self.root / ".next/server/extra.nft.json"
        extra.write_text('{"version":1,"files":[]}')
        with patch.object(manifest,"MAX_TRACES",1,create=True), self.assertRaises(manifest.PackageUnavailable):
            self.save()
        trace = self.root / ".next/server/app/route.js.nft.json"
        trace.write_text('{"version":1,"files":["../../../node_modules/external","../../../node_modules/external"]}')
        with patch.object(manifest,"MAX_TRACE_ENTRIES",1,create=True), self.assertRaises(manifest.PackageUnavailable):
            self.save()
    def test_stream_budget_refuses_before_read_and_during_growth(self):
        target=self.root/"node_modules/external/index.js"
        with patch.object(manifest,"MAX_BYTES",1),patch.object(manifest.os,"read") as read:
            with self.assertRaises(manifest.PackageUnavailable):manifest.hash_regular(target)
            read.assert_not_called()
        target.write_bytes(b"x")
        with patch.object(manifest,"MAX_BYTES",5),patch.object(manifest.os,"read",side_effect=[b"12345",b"6",AssertionError("read past budget")]):
            with self.assertRaises(manifest.PackageUnavailable):manifest.hash_regular(target)
    def test_private_header_with_whitespace_beyond_overlap_refuses(self):
        target=self.root/"node_modules/external/index.js"
        for body in [b" "* (1024*1024+8192)+b"A"*64]:
            target.write_bytes(b"x"*(1024*1024-40)+b"-----BEGIN PRIVATE KEY-----"+body)
            with self.subTest(length=len(body)),self.assertRaises(manifest.PackageUnavailable):self.save()
    def test_quoted_crypto_parser_header_is_not_key_material(self):
        target=self.root/"node_modules/external/index.js"
        target.write_bytes(b'x'*200000+b'module.exports="-----BEGIN PRIVATE KEY-----";')
        self.save()
        manifest.verify_package(self.root)
    def test_manifest_hardlink_never_overwrites_owned_external_file(self):
        with tempfile.TemporaryDirectory(prefix="axiom-outside-owned-")as tmp:
            outside=Path(tmp)/"receipt.txt";outside.write_bytes(b"owned outside unchanged")
            os.link(outside,self.root/manifest.MANIFEST)
            with self.assertRaises(manifest.PackageUnavailable):self.save()
            self.assertEqual(outside.read_bytes(),b"owned outside unchanged")
    def test_unsupported_unicode_path_refuses_instead_of_language_dependent_aliases(self):
        (self.root / "é.js").write_bytes(b"unsupported")
        with self.assertRaises(manifest.PackageUnavailable): self.save()
    def test_wrong_profile_and_missing_required_support_refuse(self):
        self.save()
        p = self.root / manifest.MANIFEST
        data = json.loads(p.read_text()); data["profile"] = "source-only"
        p.write_text(json.dumps(data))
        with self.assertRaises(manifest.PackageUnavailable): manifest.verify_package(self.root)
        (self.root / ".next/required-server-files.json").unlink()
        with self.assertRaises(manifest.PackageUnavailable): self.save()

if __name__ == "__main__":
    unittest.main()
