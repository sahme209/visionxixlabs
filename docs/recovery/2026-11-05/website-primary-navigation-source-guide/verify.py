"""Finite source-ledger verification, not runtime or customer acceptance."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
LEDGER = ROOT / 'docs/product/knowledge/website-primary-navigation-controls.sources.json'
GUIDE = LEDGER.with_name('website-primary-navigation-controls.md')

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
assert len({f['id'] for f in families}) == len(families) == 16
for family in families:
    assert guide.count('`' + family['id'] + '`') == 1, family['id']
    assert family['sourceKey'] in keys
    assert family['runtimeId'] is False
for field in ('customerEligible', 'publicationApproved', 'genuineEditorialApproval', 'mediaAccepted', 'browserNativeAssistiveTechnologyAccepted', 'retrievalEvaluationExecuted', 'runtimeMetadataChanged'):
    assert ledger[field] is False, field
evidence = Path(__file__).resolve().parent
extraction = json.loads((evidence / 'extraction.json').read_text())
assert ledger['literalCatalogues'] == extraction['linkArrays']
assert ledger['footerColumns'] == extraction['columns']
nodes = []
fixed = []
import re
for file in extraction['files']:
    assert digest((ROOT / file['path']).read_bytes()) == file['sha256']
    for node in file['declarations']:
        assert digest(node['sourceText'].encode()) == node['nodeSha256']
        nodes.append((file['path'], node['tag'], node['startLine'], node['endLine'], node['nodeSha256']))
        # Only the selected literal JSX attribute syntax; not general JSX evaluation.
        if node['tag'] == 'Link':
            fixed.extend(re.findall(r'\bhref="([^"\n]+)"', node['sourceText']))
assert len(nodes) == len(set(nodes)) == len(families) == 16
references = []
for family in families:
    node = family['sourceDeclarationRef']
    references.append((node['path'], node['tag'], node['startLine'], node['endLine'], node['nodeSha256']))
assert len(set(references)) == 16 and set(references) == set(nodes)
assert sorted(fixed) == sorted(link['href'] for link in ledger['fixedLinks'])
all_destinations = set(fixed)
for links in extraction['linkArrays'].values():
    all_destinations.update(link['href'] for link in links)
for column in extraction['columns']:
    all_destinations.update(link['href'] for link in column['links'])
assert len(all_destinations) == 16
assert {d['href'] for d in ledger['destinationSources']} == all_destinations
by_key = {source['key']: source for source in sources}
for destination in ledger['destinationSources']:
    assert destination['path'] == by_key[destination['sourceKey']]['path']
result = dict(sourceRevision=ledger['sourceRevision'], sourceKeys=len(keys), uniqueFiles=len({s['path'] for s in sources}), inclusiveRanges=range_count, documentationFamilies=len(families), directDeclarations=len(nodes), uniqueSourceDestinations=len(all_destinations), catalogueAndFixedHrefsMatch=True, currentAndPinnedBytesMatch=True, productOrProviderActionsExecuted=False, customerAcceptance=False)
print(json.dumps(result, indent=2))
