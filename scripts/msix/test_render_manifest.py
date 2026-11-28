import os
import sys
import unittest
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.dirname(__file__))
from render_manifest import msix_version, render  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TEMPLATE = open(os.path.join(ROOT, "desktop", "msix", "AppxManifest.template.xml"), encoding="utf-8").read()
NS = {"m": "http://schemas.microsoft.com/appx/manifest/foundation/windows10", "uap": "http://schemas.microsoft.com/appx/manifest/uap/windows10"}


class RenderManifestTest(unittest.TestCase):
    def test_version_has_four_parts_ending_in_zero(self):
        self.assertEqual(msix_version("0.1.27"), "0.1.27.0")
        self.assertEqual(msix_version("v1.2.3"), "1.2.3.0")
        for bad in ["1.2", "1.2.3.4", "1.2.x", "70000.0.0"]:
            with self.assertRaises(ValueError):
                msix_version(bad)

    def test_placeholder_identity_is_flagged(self):
        text, placeholder = render(TEMPLATE, "0.1.27")
        self.assertTrue(placeholder)
        ident = ET.fromstring(text).find("m:Identity", NS)
        self.assertEqual(ident.get("Name"), "VisionXIXLabs.V19.Placeholder")
        self.assertEqual(ident.get("Version"), "0.1.27.0")

    def test_reserved_store_identity_renders(self):
        text, placeholder = render(TEMPLATE, "0.1.27", "15640VisionXIXLabs.V19Studio", "CN=D5866528-F43C-4DB9-BF7A-06E79642AD6E", "VisionXIXLabs", "V19 Studio")
        self.assertFalse(placeholder)
        root = ET.fromstring(text)
        self.assertEqual(root.find("m:Identity", NS).get("Name"), "15640VisionXIXLabs.V19Studio")
        self.assertEqual(root.find("m:Properties/m:DisplayName", NS).text, "V19 Studio")
        self.assertEqual(root.find(".//uap:VisualElements", NS).get("DisplayName"), "V19 Studio")

    def test_partner_center_identity_is_used_and_escaped(self):
        text, placeholder = render(TEMPLATE, "0.1.27", "12345Samir.V19", "CN=1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D", "Samir & Co")
        self.assertFalse(placeholder)
        root = ET.fromstring(text)
        self.assertEqual(root.find("m:Identity", NS).get("Publisher"), "CN=1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D")
        self.assertEqual(root.find("m:Properties/m:PublisherDisplayName", NS).text, "Samir & Co")

    def test_launches_the_tauri_exe_and_handles_the_sign_in_link(self):
        root = ET.fromstring(render(TEMPLATE, "0.1.27")[0])
        app = root.find("m:Applications/m:Application", NS)
        self.assertEqual(app.get("Executable"), "axiom-desktop.exe")
        self.assertEqual(app.get("EntryPoint"), "Windows.FullTrustApplication")
        self.assertEqual(root.find(".//uap:Protocol", NS).get("Name"), "axiom-agent")
        for asset in ["StoreLogo.png", "Square150x150Logo.png", "Square44x44Logo.png", "Wide310x150Logo.png"]:
            self.assertTrue(os.path.isfile(os.path.join(ROOT, "desktop", "msix", "Assets", asset)), asset)

    def test_rejects_markup_and_bad_names(self):
        for args in [("bad name!", "CN=x", "d"), ("Good.Name", "O=x", "d"), ("Good.Name", 'CN=x"/><x', "d"), ("Good.Name", "CN=x", "two\nlines")]:
            with self.assertRaises(ValueError):
                render(TEMPLATE, "0.1.27", *args)


if __name__ == "__main__":
    unittest.main()
