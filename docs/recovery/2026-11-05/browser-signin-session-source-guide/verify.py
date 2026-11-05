"""Finite source-ledger verification, not runtime or customer acceptance."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LEDGER = ROOT / 'docs/product/knowledge/browser-signin-and-session-controls.sources.json'
GUIDE = LEDGER.with_name('browser-signin-and-session-controls.md')

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
assert len({f['id'] for f in families}) == len(families) == 20
for family in families:
    assert guide.count('`' + family['id'] + '`') == 1, family['id']
    assert family['sourceKey'] in keys
    assert family['runtimeId'] is False
for field in ('customerEligible', 'publicationApproved', 'genuineEditorialApproval', 'mediaAccepted', 'browserNativeAssistiveTechnologyAccepted', 'retrievalEvaluationExecuted', 'runtimeMetadataChanged'):
    assert ledger[field] is False, field
result = dict(sourceRevision=ledger['sourceRevision'], sourceKeys=len(keys), uniqueFiles=len({s['path'] for s in sources}), inclusiveRanges=range_count, documentationFamilies=len(families), currentAndPinnedBytesMatch=True, productOrProviderActionsExecuted=False, customerAcceptance=False)
print(json.dumps(result, indent=2))
