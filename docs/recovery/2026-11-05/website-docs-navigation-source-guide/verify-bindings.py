"""Verify only the fixed source-described Docs navigation scope, without app imports."""
from pathlib import Path
import json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).parent
base=ROOT/'docs/product/knowledge/website-docs-navigation-controls'
j=json.loads(base.with_suffix('.sources.json').read_text());text=base.with_suffix('.md').read_text();x=json.loads((HERE/'controls.json').read_text())
sha=lambda raw:hashlib.sha256(raw).hexdigest()
keys=set();paths=set();ranges=0
for source in j['sources']:
 assert source['key'] not in keys;keys.add(source['key']);paths.add(source['path'])
 raw=(ROOT/source['path']).read_bytes();assert raw==subprocess.check_output(['git','show',j['sourceRevision']+':'+source['path']],cwd=ROOT);assert sha(raw)==source['sha256']
 lines=raw.splitlines(keepends=True);assert len(lines)==source['lineCount']
 for interval in source['ranges']:
  assert 1<=interval['start']<=interval['end']<=len(lines);assert sha(b''.join(lines[interval['start']-1:interval['end']]))==interval['sha256'];ranges+=1
for flag in ['customerEligible','publicationApproved','genuineEditorialApproval','mediaAccepted','browserNativeAssistiveTechnologyAccepted','retrievalEvaluationExecuted','runtimeMetadataChanged','documentationIdsAreRuntimeIds','supportedReleaseAccepted']:assert j[flag] is False
assert j['owner'] and j['genuineHumanEditorialOwner'] is None and j['sourceReviewDate']=='2026-11-05'
def node_id(path,n):return(path,n['tag'],n['startLine'],n['endLine'],n['nodeSha256'])
actual={node_id(f['path'],n) for f in x['declarations'] for n in f['nodes']};assert len(actual)==8
for f in x['declarations']:assert sha((ROOT/f['path']).read_bytes())==f['sha256']
covered=set();ids=set()
for control in j['controlFamilies']:
 assert control['id'] not in ids;ids.add(control['id']);assert text.count('`'+control['id']+'`')==1;assert control['sourceKey'] in keys and control['runtimeId'] is False
 ref=control['sourceDeclarationRef'];identity=node_id(ref['path'],ref);assert identity in actual;covered.add(identity)
assert covered==actual and len(ids)==8
assert [(v['section'],v['href'],v['label'],v['line']) for v in j['sidebarEntries']]==[(v['section'],v['href'],v['label'],v['startLine']) for v in x['catalogue']]
assert [(v['group'],v['href'],v['label'],v['description'],v['line']) for v in j['landingEntries']]==[(v['group'],v['href'],v['label'],v['description'],v['startLine']) for v in x['landingLinks']]
for key in ['sharedPaginationCalls','sharedFeedbackCalls']:
 for v in j[key]:assert v['sourceKey'] in keys
assert [{k:v for k,v in p.items() if k!='sourceKey'} for p in j['sharedPaginationCalls']]==x['pagination']
assert [(v['path'],v['line']) for v in j['sharedFeedbackCalls']]==[(v['path'],v['startLine']) for v in x['feedback']]
assert sorted(v['href'] for v in j['nonCatalogueDocsRoutes'])==sorted(x['uncataloguedRoutes'])
for v in x['pageSources']:assert sha((ROOT/v['path']).read_bytes())==v['sha256']
assert x['adjacencyCalls']==0 and x['headingIndex']['allRecordedSourceHashesMatch'] is True
out={'sourceRevision':j['sourceRevision'],'sourceKeys':len(keys),'uniqueFiles':len(paths),'inclusiveRangesChecked':ranges,'allCurrentAndPinnedBytesMatch':True,'sharedControlDeclarations':len(actual),'documentationFamilies':len(ids),'sidebarEntries':len(j['sidebarEntries']),'landingEntries':len(j['landingEntries']),'paginationCallsites':len(j['sharedPaginationCalls']),'feedbackCallsites':len(j['sharedFeedbackCalls']),'docsPageSourceFiles':len(x['pageSources']),'nonCatalogueRoutes':len(x['uncataloguedRoutes']),'getDocAdjacentCallsInDocsPages':x['adjacencyCalls'],'markdownSha256':sha(base.with_suffix('.md').read_bytes()),'ledgerSha256':sha(base.with_suffix('.sources.json').read_bytes()),'scope':'fixed source sets only; no runtime instances, body control inventory, HTTP/browser or content/editorial acceptance','applicationCodeExecuted':False,'productTestsRun':False,'customerEligible':False}
print(json.dumps(out,indent=2))
