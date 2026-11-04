"""Pure new-source binding checks: imports do not start a server or apply profiles."""
from pathlib import Path
import hashlib
import importlib.util
import json
import unittest
from unittest.mock import patch

ROOT = Path('/private/tmp/axiom-website-accessibility-preview-d9b201be-8ipayv49')
STAGE = Path('/private/tmp/axiom-product-hierarchy-build-d9b201be-gaddqu17/stage')
REVISION = 'd9b201be135966412033d6a5c2d92181ebd5a5f7'


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


proxy = load('product_preview_proxy', ROOT / 'preview_proxy.py')
launcher = load('product_preview_launcher', ROOT / 'launch_preview.py')
manifest = json.loads((ROOT / 'asset-manifest.json').read_bytes())


class PreparedSourceBindings(unittest.TestCase):
    def test_actual_new_build_manifest_and_source_identity(self):
        self.assertEqual(manifest['sourceRevision'], REVISION)
        self.assertEqual(manifest['buildStage'], str(STAGE))
        self.assertEqual(proxy.MANIFEST_SHA256, hashlib.sha256((ROOT / 'asset-manifest.json').read_bytes()).hexdigest())
        self.assertEqual(manifest['buildIdSha256'], hashlib.sha256((STAGE / '.next/BUILD_ID').read_bytes()).hexdigest())
        self.assertIn('/product', manifest['publicPages'])

    def test_actual_launcher_pins_assets_runtime_metadata_and_cache_without_exec(self):
        with patch.object(launcher.os, 'execve') as execute:
            binding = launcher.verify_prepared_inputs()
            execute.assert_not_called()
        self.assertEqual(binding['sourceRevision'], REVISION)
        self.assertEqual(binding['backend'], '127.0.0.1:5241')
        self.assertEqual(binding['proxy'], '127.0.0.1:5240')
        self.assertEqual(binding['cacheDirectory']['path'], str(STAGE / '.next/cache/images'))

    def test_new_manifest_targets_do_not_open_private_or_unknown_paths(self):
        self.assertEqual(proxy.canonical_target('/product'), '/product')
        self.assertEqual(proxy.canonical_target('/%64ocs/permissions-model'), '/docs/permissions-model')
        for path in ['/api/auth/session', '/auth/signin', '/account/help', '/%2561pi/auth/session', '/not-a-published-asset.png', '/docs?_rsc=private']:
            self.assertIsNone(proxy.canonical_target(path))
        self.assertIsNotNone(proxy.canonical_target(next(iter(manifest['nextStaticAssets']))))

    def test_fixed_ports_and_only_existing_exact_cache_permission(self):
        self.assertEqual(proxy.BACKEND, ('127.0.0.1', 5241))
        self.assertEqual(proxy.LISTEN, ('127.0.0.1', 5240))
        backend = (ROOT / 'backend.sb').read_text()
        proxy_profile = (ROOT / 'proxy.sb').read_text()
        self.assertIn('(deny network-outbound)', backend)
        self.assertNotIn('(allow network-outbound', backend)
        self.assertEqual([line for line in backend.splitlines() if line.startswith('(allow file-write')], ['(allow file-write* (subpath "' + str(STAGE / '.next/cache/images') + '"))'])
        self.assertIn('(deny file-write*)', proxy_profile)
        self.assertNotIn('(allow file-write', proxy_profile)

    def test_authority_headers_and_methods_still_cannot_reach_backend(self):
        self.assertEqual(proxy.forward_headers({'Cookie': 'synthetic', 'Authorization': 'synthetic', 'RSC': '1', 'Accept': 'text/html'}), {'Accept': 'text/html'})
        for method in ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'TRACE', 'CONNECT']:
            self.assertIs(getattr(proxy.Proxy, 'do_' + method), proxy.Proxy.deny_action)
        self.assertEqual(proxy.filtered_response_headers([('Set-Cookie', 'synthetic'), ('Location', '/api/auth/session'), ('Refresh', '0'), ('ETag', 'synthetic')]), [('ETag', 'synthetic')])


if __name__ == '__main__':
    unittest.main(verbosity=2)
