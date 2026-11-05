"""Prepared ordinary offline build only; no native launch or preview startup.
Invoke only after the root reviews and commits the exact source revision.
"""
import argparse
import importlib.util
import json
import re
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
REPO = Path('/Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion')
SOURCE_REVISION = '0c9d0e4072056f56c28d95bf53925afc429ccaf2'
NODE = Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
sys.path.insert(0, str(REPO / 'scripts'))


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, REPO / 'scripts' / file)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-revision', required=True)
    args = parser.parse_args()
    revision = args.source_revision
    if not re.fullmatch('[a-f0-9]{40}', revision) or revision != SOURCE_REVISION:
        raise SystemExit('Exact reviewed commit required; no HEAD fallback')
    builder = load('product_hierarchy_source_builder', 'build-local-issuer-package-source.py')
    engines = load('product_hierarchy_local_engines', 'local_prisma_engine_inputs.py')
    cache = Path.home() / '.npm/_cacache'
    owned = Path(tempfile.mkdtemp(prefix='axiom-current-quality-build-' + revision[:8] + '-', dir='/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds'))
    coordinates = {'owned': str(owned), 'sourceRevision': revision, 'previewStarted': False,
                   'executingIssuerIdentity': 'unavailable', 'executionAuthorized': False}
    (owned / 'coordinates.json').write_text(json.dumps(coordinates, sort_keys=True) + '\n')
    print('OWNED', owned, flush=True)
    phase = 'preparation'
    try:
        prep = builder.prepare_optional_probe(REPO, revision, cache, NODE,
            NODE.parent.parent / 'lib/node_modules/npm/bin/npm-cli.js', owned)
        (owned / 'preparation.json').write_text(json.dumps(prep, sort_keys=True) + '\n')
        print('PREPARATION_PASS', flush=True)
        phase = 'binding'
        binding = engines.bind_local_engines(Path.home() / '.cache/prisma/master' / engines.REQUESTED_COMMIT / 'darwin-arm64', owned)
        (owned / 'binding.json').write_text(json.dumps(binding, sort_keys=True) + '\n')
        phase = 'generation'
        generation = owned / 'generation-run'; generation.mkdir(mode=0o700)
        engines.execute_generation(owned / 'stage', owned / 'engine-inputs', REPO, revision, cache, NODE, generation)
        print('GENERATION_PASS', flush=True)
        phase = 'build'
        build = owned / 'build-run'; build.mkdir(mode=0o700)
        result = builder.execute_build(owned / 'stage', REPO, revision, cache,
            owned / 'engine-inputs', generation, NODE, build)
        summary = {**coordinates, 'phase': phase, 'status': result['status'],
                   'buildOutputsVerified': result['buildOutputsVerified']}
        (owned / 'terminal-summary.json').write_text(json.dumps(summary, sort_keys=True) + '\n')
        print('BUILD_RESULT', json.dumps(summary, sort_keys=True), flush=True)
    except BaseException as exc:
        (owned / 'terminal-summary.json').write_text(json.dumps({**coordinates, 'phase': phase,
            'status': 'failed', 'errorType': type(exc).__name__, 'error': str(exc)}, sort_keys=True) + '\n')
        raise


if __name__ == '__main__':
    main()
