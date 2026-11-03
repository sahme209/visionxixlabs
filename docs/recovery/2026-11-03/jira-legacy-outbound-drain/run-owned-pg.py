"""Owned-only actual PostgreSQL journey; external authority/provider ports simulated.
Run only after isolated source freeze. Never reads ambient DB URLs or .env files.
"""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path
os.umask(0o077)
if len(sys.argv) not in (2,3) or len(sys.argv)==3 and sys.argv[2] not in ('--associated-smoke','--targeted-correction'): raise SystemExit('exact frozen source worktree and optional fixed failing-test selector required')
targeted=len(sys.argv)==3 and sys.argv[2]=='--associated-smoke'
corrected=len(sys.argv)==3 and sys.argv[2]=='--targeted-correction'
logprefix='jira-associated-smoke' if targeted else 'jira-legacy-corrected' if corrected else 'jira-legacy'
repo=Path(sys.argv[1]).resolve()
if not str(repo).startswith('/private/tmp/axiom-jira-legacy-outbound-') or not (repo/'.git').is_file(): raise SystemExit('owned source worktree required')
logdir=Path(__file__).resolve().parent
root=Path(tempfile.mkdtemp(prefix='axiom-ticket-governance-pg-' if targeted else 'axiom-jira-legacy-pg-',dir='/private/tmp')).resolve()
evidence=Path(tempfile.mkdtemp(prefix='axiom-provider-approval-pg-evidence-' if targeted else 'axiom-jira-legacy-pg-evidence-',dir='/private/tmp')).resolve()
socket=root/'socket';socket.mkdir(mode=0o700)
(evidence/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
(evidence/'package.json').write_text('{}')
bins=Path('/opt/homebrew/opt/postgresql@17/bin')
env={'PATH':'/Users/samirahmed/.nvm/versions/node/v24.21.0/bin:/usr/bin:/bin:/usr/sbin:/sbin','HOME':os.environ['HOME'],'LANG':'C','TZ':'UTC','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'1','PGHOST':str(socket),'PGUSER':'recovery_fixture','PGDATABASE':'neondb'}
def run(args,label,timeout=90):
    result=subprocess.run([str(x) for x in args],env=env,cwd=repo,capture_output=True,text=True,timeout=timeout)
    label=label.replace('slack',logprefix,1)
    (logdir/(label+'.log')).write_text(result.stdout+result.stderr)
    if result.returncode: raise RuntimeError(label+' failed; inspect '+str(logdir/(label+'.log')))
    return result.stdout
started=False
try:
    run([bins/'initdb','-D',root/'data','-U','recovery_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'],'slack-initdb')
    run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],'slack-start');started=True
    run([bins/'createdb','-w','neondb'],'slack-createdb')
    source=(repo/'prisma/schema.prisma').read_text(); models=[]
    for name in ['DurableAgentWorkflow','DurableAgentWorkflowEvent','TenantIntegrationConnection']:
        match=re.search(r'^model '+name+r' \{.*?^\}',source,re.S|re.M)
        if not match: raise RuntimeError('missing owned schema model '+name)
        models.append(match.group())
    models.append('''model OrgMembership {
 id String @id @default(cuid())
 organizationId String
 userId String
 role String
 acceptedAt DateTime?
 @@unique([organizationId,userId])
}
model TauriDeploymentRequest {
 id String @id
 organizationId String
 requesterUserId String
 status String
 version Int
 intakeJson Json
}
''')
    schema=evidence/'schema.prisma'
    schema.write_text('generator client {\n provider = "prisma-client-js"\n output = "./generated"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n'+'\n'.join(models))
    env['DATABASE_URL']='postgresql://recovery_fixture@localhost/neondb?host='+str(socket).replace('/','%2F')
    run(['node','node_modules/prisma/build/index.js','generate','--schema',schema],'slack-generate')
    run(['node','node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'],'slack-owned-schema')
    env['AXIOM_TICKET_GOVERNANCE_PG_SOCKET' if targeted else 'AXIOM_JIRA_LEGACY_PG_SOCKET']=str(socket);env['AXIOM_TICKET_GOVERNANCE_PG_CLIENT' if targeted else 'AXIOM_JIRA_LEGACY_PG_CLIENT']=str(evidence/'generated/index.js')
    args=['node','node_modules/vitest/vitest.mjs','run','lib/desktop/__tests__/jiraAssociatedOutbound.pg.test.ts' if targeted else 'lib/desktop/__tests__/jiraLegacyOutbound.pg.test.ts']
    if targeted: args+=['-t','actual mounted exact write reserves']
    if corrected: args+=['-t','canonical unavailable preserves approval|current approver demotion']
    output=run(args,'slack-actual-pg',180)
    print(output)
finally:
    if started:
        print(run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop'],'slack-stop'))
    result={'source':str(repo),'fixture':str(root),'clientFixture':str(evidence),'started':started,'stopped':(logdir/(logprefix+'-stop.log')).exists(),'providerAndAuthority':'simulated; actual owned durable storage and HTTP composition'}
    (logdir/(logprefix+'-fixture.json')).write_text(json.dumps(result,indent=2)+'\n')
    print('Owned fixture:',root)
