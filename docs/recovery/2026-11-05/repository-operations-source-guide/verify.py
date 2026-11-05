"""Finite source-ledger verification, not runtime or customer acceptance."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LEDGER = ROOT / 'docs/product/knowledge/repository-operations-controls.sources.json'
GUIDE = LEDGER.with_name('repository-operations-controls.md')

def digest(data):
    return hashlib.sha256(data).hexdigest()

ledger = json.loads(LEDGER.read_text())
guide = GUIDE.read_text()
sources = ledger['sources']
keys = {s['key'] for s in sources}
assert len(keys) == len(sources)
range_count = 0
for source in sources:
    data = (ROOT / source['path']).read_bytes()
    pinned = subprocess.check_output(['git', 'show', ledger['sourceRevision'] + ':' + source['path']], cwd=ROOT)
    assert data == pinned, source['path']
    assert digest(data) == source['sha256'], source['path']
    lines = data.splitlines(keepends=True)
    assert len(lines) == source['lineCount']
    for selection in source['ranges']:
        assert 1 <= selection['start'] <= selection['end'] <= len(lines)
        assert digest(b''.join(lines[selection['start']-1:selection['end']])) == selection['sha256']
        range_count += 1
families = ledger['controlFamilies']
assert len({f['id'] for f in families}) == len(families) == 28
for family in families:
    assert guide.count('`' + family['id'] + '`') == 1, family['id']
    assert set(family['sourceKeys']) <= keys
    assert family['runtimeId'] is False
for field in ('customerEligible', 'publicationApproved', 'genuineEditorialApproval', 'mediaAccepted', 'nativeBrowserAssistiveTechnologyAccepted', 'retrievalEvaluationExecuted', 'runtimeMetadataChanged'):
    assert ledger[field] is False, field
evidence = Path(__file__).resolve().parent
extraction = json.loads((evidence / 'declarations.json').read_text())
mapping = json.loads((evidence / 'declaration-family-map.json').read_text())['mappings']
nodes = []
for file in extraction['files']:
    assert digest((ROOT / file['path']).read_bytes()) == file['sha256']
    for node in file['declarations']:
        assert digest(node['sourceText'].encode()) == node['nodeSha256']
        if node['kind'] != 'structural-disclosure-container':
            nodes.append((file['path'], node['nodeSha256']))
assert len(nodes) == len(set(nodes)) == len(mapping) == 28
assert {m['documentationId'] for m in mapping} == {f['id'] for f in families}
assert {(m['path'], m['nodeSha256']) for m in mapping} == set(nodes)
result = dict(sourceRevision=ledger['sourceRevision'], sourceKeys=len(keys), uniqueFiles=len({s['path'] for s in sources}), inclusiveRanges=range_count, documentationFamilies=len(families), currentAndPinnedBytesMatch=True, productOrProviderActionsExecuted=False, customerAcceptance=False)
print(json.dumps(result, indent=2))
