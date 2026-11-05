"""Prepare source-bound guard artifacts AFTER successful build; never start servers.
The fixed new image-cache directory must be created/reviewed separately by root.
"""
from pathlib import Path
import hashlib
import json
import os
import stat

REPO = Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
ROOT = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Previews/source-0c9d0e40-5262')
OWNED = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds/axiom-current-quality-build-0c9d0e40-ya3nsqus')
STAGE = OWNED / 'stage'
REVISION = '0c9d0e4072056f56c28d95bf53925afc429ccaf2'
SOURCE = '0c9d0e40'
NODE = Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
OLD = REPO / 'docs/recovery/2026-11-04/website-1b23c208-build-preview/guard-v3'


def sha(path):
    if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode):
        raise RuntimeError('regular nonsymlink input required')
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if (ROOT / 'launch-binding.json').exists() or (ROOT / 'asset-manifest.json').exists():
        raise RuntimeError('fresh preparation outputs required')
    summary = json.loads((OWNED / 'terminal-summary.json').read_bytes())
    result = json.loads((OWNED / 'build-run/result.json').read_bytes())
    preparation = json.loads((OWNED / 'preparation.json').read_bytes())
    if summary['sourceRevision'] != REVISION or preparation['sourceRevision'] != REVISION or summary['status'] != 'build_outputs_observed_unqualified' or summary['buildOutputsVerified'] is not True or result['buildOutputsVerified'] is not True:
        raise RuntimeError('exact completed successful build required')
    if STAGE.resolve() != STAGE or not STAGE.is_dir():
        raise RuntimeError('fixed canonical build stage required')
    if any((STAGE / name).exists() for name in ['.env', '.env.local', '.env.production', '.env.production.local']):
        raise RuntimeError('runtime env files prohibited')
    cache = STAGE / '.next/cache/images'
    for path in [cache, *cache.parents]:
        if path.is_symlink() or not stat.S_ISDIR(path.lstat().st_mode):
            raise RuntimeError('root-reviewed real cache directory required')
    info = cache.stat()
    if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise RuntimeError('root-reviewed cache ownership/mode required')
    old = json.loads((OLD / 'asset-manifest.json').read_bytes())
    manifest = {'source': SOURCE, 'sourceRevision': REVISION, 'buildStage': str(STAGE),
                'buildIdSha256': sha(STAGE / '.next/BUILD_ID'),
                'publicPages': old['publicPages'], 'imageWidths': old['imageWidths'],
                'imageQualities': old['imageQualities']}
    for directory, key, prefix in [('public', 'publicAssets', ''), ('.next/static', 'nextStaticAssets', '/_next/static')]:
        values = {}
        for path in sorted((STAGE / directory).rglob('*')):
            if path.is_dir():
                if path.is_symlink():
                    raise RuntimeError('asset directory symlink prohibited')
                continue
            if path.resolve() != path.absolute() or not path.resolve().is_relative_to(STAGE):
                raise RuntimeError('asset escape or symlink prohibited')
            name = prefix + '/' + path.relative_to(STAGE / directory).as_posix()
            values[name] = {'relativePath': path.relative_to(STAGE).as_posix(), 'bytes': path.stat().st_size, 'sha256': sha(path)}
        manifest[key] = values
    manifest['publicImages'] = {name: manifest['publicAssets'][name] for name in old['publicImages'] if name in manifest['publicAssets']}
    manifest_path = ROOT / 'asset-manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    proxy = ROOT / 'preview_proxy.py'
    proxy.write_text(proxy.read_text().replace('PENDING_BUILD_MANIFEST_NOT_STARTABLE', sha(manifest_path)))
    inputs = [ROOT / name for name in ['preview_proxy.py', 'launch_preview.py', 'backend.sb', 'proxy.sb', 'asset-manifest.json']]
    inputs += [NODE, Path('/usr/bin/python3'), Path('/usr/bin/sandbox-exec'), STAGE / 'node_modules/next/dist/bin/next', STAGE / 'next.config.ts']
    for relative, record in result['outputs']['requiredMetadata'].items():
        path = STAGE / relative
        if sha(path) != record['sha256']:
            raise RuntimeError('build metadata changed')
        inputs.append(path)
    unique = dict.fromkeys(inputs)
    binding = {'status': 'prepared-not-started', 'source': SOURCE, 'sourceRevision': REVISION,
        'backend': '127.0.0.1:5263', 'proxy': '127.0.0.1:5262',
        'files': [{'path': str(path), 'bytes': path.stat().st_size, 'sha256': sha(path)} for path in unique],
        'cacheDirectory': {'path': str(cache), 'device': info.st_dev, 'inode': info.st_ino, 'uid': info.st_uid, 'mode': stat.S_IMODE(info.st_mode)},
        'runtimeDataAddition': 'Only the fixed reviewed .next/cache/images directory; not issuer custody or whole-stage immutability'}
    (ROOT / 'launch-binding.json').write_text(json.dumps(binding, indent=2) + '\n')
    print(json.dumps({'status': 'prepared-not-started', 'root': str(ROOT), 'sourceRevision': REVISION,
                      'publicAssets': len(manifest['publicAssets']), 'staticAssets': len(manifest['nextStaticAssets']),
                      'manifestSha256': sha(manifest_path)}, sort_keys=True))


if __name__ == '__main__':
    main()
