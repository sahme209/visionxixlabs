"""Finite documentation/source verification only; does not import application code."""
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[4]
BASE=ROOT/'docs/product/knowledge/releases-execution-intake-controls'
manifest=json.loads(BASE.with_suffix('.sources.json').read_text())
markdown=BASE.with_suffix('.md').read_text()
sha=lambda raw:hashlib.sha256(raw).hexdigest()
assert manifest['customerEligible'] is False and manifest['publicationApproved'] is False
assert manifest['genuineEditorialApproval'] is False and manifest['mediaAccepted'] is False
assert manifest['retrievalEvaluationExecuted'] is False and manifest['runtimeMetadataChanged'] is False
assert manifest['documentationIdsAreRuntimeIds'] is False
assert manifest['lastSourceVerifiedDate']=='2026-11-05' and manifest['owner']
assert manifest['humanEditorialOwnerAssigned'] is False and manifest['supportedReleaseAccepted'] is False
keys=set();paths=set();ranges=0
for source in manifest['sources']:
    assert source['key'] not in keys;keys.add(source['key'])
    path=source['path'];paths.add(path)
    raw=(ROOT/path).read_bytes()
    pinned=subprocess.check_output(['git','show',manifest['sourceRevision']+':'+path],cwd=ROOT)
    assert raw==pinned and sha(raw)==source['sha256']
    lines=raw.splitlines(keepends=True)
    assert len(lines)==source['lineCount']
    for interval in source['ranges']:
        assert 1<=interval['start']<=interval['end']<=len(lines)
        assert sha(b''.join(lines[interval['start']-1:interval['end']]))==interval['sha256']
        ranges+=1
inventory=json.loads((Path(__file__).parent/'declarations.json').read_text())
def identity(path,node):return(path,node['tag'],node['startLine'],node['endLine'],node['nodeSha256'])
actual={identity(file['path'],node) for file in inventory['files'] for node in file['declarations']}
assert len(actual)==inventory['total']==19
for file in inventory['files']:assert sha((ROOT/file['path']).read_bytes())==file['sha256']
ids=set();covered=set()
for control in manifest['controlFamilies']:
    assert control['id'] not in ids;ids.add(control['id'])
    assert markdown.count('`'+control['id']+'`')==1
    assert control['sourceKey'] in keys and control['runtimeId'] is False
    node=control['sourceDeclarationRef'];value=identity(node['path'],node)
    assert value in actual;covered.add(value)
assert covered==actual and len(ids)==22
report={'sourceRevision':manifest['sourceRevision'],'sourceKeys':len(keys),'uniqueSourceFiles':len(paths),'inclusiveRangesChecked':ranges,'allSourceBytesMatchPinnedGit':True,'interactiveSourceDeclarations':len(actual),'documentationFamilies':len(ids),'allSelectedDeclarationsCovered':True,'markdownSha256':sha(BASE.with_suffix('.md').read_bytes()),'ledgerSha256':sha(BASE.with_suffix('.sources.json').read_bytes()),'coverageLimit':'four fixed component declaration families only; no unique runtime instance or future-syntax guarantee','applicationCodeExecuted':False,'productTestsRun':False,'externalReads':False,'customerEligible':False}
print(json.dumps(report,indent=2))
