"""Preparation artifact only. Running main starts one explicitly chosen server.
No import, test or preparation automatically executes either server.
"""
from pathlib import Path
import hashlib
import json
import os
import stat
import sys

ROOT = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Previews/source-b8b0314c-5290')
STAGE = Path('/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Previews/source-b8b0314c-5290/stage')
CACHE = STAGE / '.next/cache/images'
NODE = Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
PYTHON = Path('/usr/bin/python3')
SANDBOX = Path('/usr/bin/sandbox-exec')


def checked_file(path, expected):
    if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode):
        raise RuntimeError('nonregular launch input')
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise RuntimeError('launch input identity mismatch')


def verify_prepared_inputs():
    binding = json.loads((ROOT / 'launch-binding.json').read_bytes())
    for item in binding['files']:
        checked_file(Path(item['path']), item['sha256'])
    manifest = json.loads((ROOT / 'asset-manifest.json').read_bytes())
    if manifest['buildStage'] != str(STAGE):
        raise RuntimeError('different stage')
    for group in ['publicAssets', 'nextStaticAssets']:
        for item in manifest[group].values():
            path = STAGE / item['relativePath']
            if not path.resolve().is_relative_to(STAGE.resolve()) or path.resolve() != path.absolute():
                raise RuntimeError('asset symlink or path escape')
            checked_file(path, item['sha256'])
    if any((STAGE / name).exists() for name in ['.env', '.env.local', '.env.production', '.env.production.local']):
        raise RuntimeError('unexpected runtime environment file')
    verify_cache_directory(binding['cacheDirectory'])
    return binding


def verify_cache_directory(expected_cache):
    # The only writable runtime data path is fixed, canonical and owned.
    for ancestor in [CACHE, *CACHE.parents]:
        info = ancestor.lstat()
        if ancestor.is_symlink() or not stat.S_ISDIR(info.st_mode):
            raise RuntimeError('cache ancestor is not a real directory')
    info = CACHE.lstat()
    observed_cache = {'path': str(CACHE), 'device': info.st_dev, 'inode': info.st_ino,
                      'uid': info.st_uid, 'mode': stat.S_IMODE(info.st_mode)}
    if str(CACHE.resolve()) != str(CACHE) or observed_cache != expected_cache or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise RuntimeError('runtime cache identity or ownership changed')



def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {'backend', 'proxy'}:
        raise SystemExit('Choose exactly backend or proxy; startup requires separate approval')
    verify_prepared_inputs()
    # All inherited credentials, provider configuration and issuer settings omitted.
    env = {'PATH': '/usr/bin:/bin', 'HOME': str(ROOT / 'home'), 'TMPDIR': str(ROOT / 'tmp'),
           'NODE_ENV': 'production', 'NEXT_TELEMETRY_DISABLED': '1', 'NODE_DISABLE_COMPILE_CACHE': '1',
           'PYTHONDONTWRITEBYTECODE': '1'}
    if sys.argv[1] == 'backend':
        env.update({'DATABASE_URL': 'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic',
                    'NEXTAUTH_URL': 'http://127.0.0.1:5291',
                    'NEXTAUTH_SECRET': 'synthetic-local-preview-not-a-real-secret',
                    'AWS_EC2_METADATA_DISABLED': 'true'})
        os.chdir(STAGE)
        args = [str(SANDBOX), '-f', str(ROOT / 'backend.sb'), str(NODE),
                str(STAGE / 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', '5291']
    else:
        os.chdir(ROOT)
        args = [str(SANDBOX), '-f', str(ROOT / 'proxy.sb'), str(PYTHON), str(ROOT / 'preview_proxy.py')]
    os.execve(SANDBOX, args, env)


if __name__ == '__main__':
    main()
