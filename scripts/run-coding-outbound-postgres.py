"""Owned socket-only fixture; no application DB/env or provider access."""
import os,re,subprocess,tempfile,sys
from pathlib import Path
os.umask(0o077)
repo=Path(__file__).resolve().parents[1];root=Path(tempfile.mkdtemp(prefix='axiom-coding-outbound-pg-',dir='/private/tmp')).resolve();socket=root/'socket';socket.mkdir(mode=0o700)
(root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True);(root/'package.json').write_text('{}')
bins=Path('/opt/homebrew/opt/postgresql@17/bin');node=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')
env={'PATH':str(node.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(Path.home()),'LANG':'C','TZ':'UTC','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','PGHOST':str(socket),'PGUSER':'coding_fixture','PGDATABASE':'coding_fixture'}
def run(args):
 r=subprocess.run([str(a)for a in args],env=env,cwd=repo,capture_output=True,text=True,timeout=120)
 if r.returncode:print(r.stdout+r.stderr);raise RuntimeError(str(args[0])+' failed')
 return r.stdout
started=False
try:
 run([bins/'initdb','-D',root/'data','-U','coding_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject']);run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start']);started=True;run([bins/'createdb','-w','coding_fixture'])
 source=(repo/'prisma/schema.prisma').read_text();models=[]
 for name in ['PipelineRun','PipelineStageRun','CodingTask','EngineerApprovalSnapshot','EngineerApprovalDecision','DurableAgentWorkflow','DurableAgentWorkflowEvent','ApiKey']:
  models.append(re.search(r'^model '+name+r' \{.*?^\}',source,re.S|re.M).group())
 models.append('''model OrgMembership {
 id String @unique @default(cuid())
 organizationId String
 userId String
 role String
 acceptedAt DateTime?
 @@id([organizationId,userId])
 @@unique([userId,organizationId])
}
model GitHubInstallation {
 id String @id
 organizationId String
 githubInstallationId String
 accountLogin String
 installedAt DateTime @default(now())
 status String
 updatedAt DateTime
 revokedAt DateTime?
 suspendedAt DateTime?
}
''')
 header='generator client {\n provider = "prisma-client-js"\n output = "./generated"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n'
 schema=root/'schema.prisma';schema.write_text(header+'\n'.join(models));env['DATABASE_URL']='postgresql://coding_fixture@localhost/coding_fixture?host='+str(socket).replace('/','%2F')
 run([node,'node_modules/prisma/build/index.js','generate','--schema',schema]);run([node,'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
 env['AXIOM_CODING_OUTBOUND_SOCKET']=str(socket);env['AXIOM_CODING_OUTBOUND_CLIENT']=str(root/'generated/index.js')
 args=[node,'node_modules/vitest/vitest.mjs','run','lib/workforce/pipelines/__tests__/codingOutbound.pg.test.ts']
 if len(sys.argv)>1:args+=['-t',sys.argv[1]]
 print(run(args))
finally:
 if started:print(run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop']))
 print('Owned fixture:',root)
