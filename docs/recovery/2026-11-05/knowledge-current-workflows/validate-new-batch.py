"""Schema/hash/customer-refusal checks only, not retrieval evaluation or ingestion."""
from pathlib import Path
import subprocess,json,base64,tempfile,time
ROOT=Path(__file__).resolve().parents[4]
EVIDENCE=Path(__file__).parent
VERSION='local-source-preview:91520aba56b721c973e23a750fcaab4ee6ddc469'
NAMES=['repository-operations-controls','browser-signin-session-controls','website-navigation-docs-discovery']
owned=Path(tempfile.mkdtemp(prefix='knowledge-workflow-integrity-',dir='/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Verification'))
for name in ('home','tmp'): (owned/name).mkdir(mode=0o700)
policy=owned/'check.sb';policy.write_text('(version 1)(allow default)(deny network*)(deny file-write*)(allow file-write* (subpath '+json.dumps(str(owned))+'))\n')
(EVIDENCE/'validation-coordinates.json').write_text(json.dumps({'owned':str(owned),'version':VERSION,'kind':'existing-schema-source-integrity-and-customer-refusal-only'},indent=2)+'\n')
results=[];deadline=time.monotonic()+45
for name in NAMES:
    for customer in (False,True):
        cmd=['/usr/bin/sandbox-exec','-f',str(policy),'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node',str(ROOT/'docs/product/documentation-coverage/validate-support-knowledge.cjs'),'--root',str(ROOT),'--article','docs/product/documentation-coverage/articles/'+name+'.r1.json','--evaluation','docs/product/documentation-coverage/'+name+'-evaluation.r1.json','--version',VERSION]
        if customer:cmd.append('--customer')
        left=deadline-time.monotonic()
        if left<=0:raise RuntimeError('batch_deadline')
        child=subprocess.run(cmd,cwd=ROOT,env={'HOME':str(owned/'home'),'TMPDIR':str(owned/'tmp'),'PATH':'/usr/bin:/bin','NODE_ENV':'test','CI':'1'},capture_output=True,timeout=min(10,left))
        result={'name':name,'customer':customer,'command':cmd,'exitCode':child.returncode,'stdoutBase64':base64.b64encode(child.stdout).decode(),'stderrBase64':base64.b64encode(child.stderr).decode()}
        results.append(result)
        (EVIDENCE/'validation-results.json').write_text(json.dumps({'kind':'integrity-not-retrieval','retrievalEvaluationExecuted':False,'results':results},indent=2)+'\n')
        if customer:
            assert child.returncode==1
            assert 'customer retrieval ineligible: article_not_approved, article_not_public, local_preview_not_shipped' in child.stderr.decode()
        else:
            assert child.returncode==0,child.stderr.decode()
            body=json.loads(child.stdout)
            assert body['customerEligible'] is False and body['evaluationStatus']=='proposed-not-executed'
        print(name,'customer-refused' if customer else 'integrity-pass',flush=True)
