import os, re, shutil, subprocess, tempfile, sys
from pathlib import Path
os.umask(0o077)
repo=Path.cwd()
root=Path(tempfile.mkdtemp(prefix='axiom-execution-policy-pg-',dir='/private/tmp')).resolve()
socket=root/'socket';socket.mkdir(mode=0o700)
(root/'node_modules').symlink_to(repo/'node_modules',target_is_directory=True)
(root/'package.json').write_text('{}')
bins=Path('/opt/homebrew/opt/postgresql@17/bin')
env={k:os.environ[k] for k in ['PATH','HOME'] if k in os.environ}
env['PRISMA_GENERATE_SKIP_AUTOINSTALL']='true'
env.update(LANG='C',TZ='UTC',PGHOST=str(socket),PGUSER='policy_fixture',PGDATABASE='policy_fixture')
def run(args,**kw):
 r=subprocess.run([str(x) for x in args],env=env,cwd=repo,capture_output=True,text=True,timeout=90,**kw)
 if r.returncode: print(r.stdout+r.stderr);raise RuntimeError(str(args[0])+' failed')
 return r.stdout
started=False
try:
 run([bins/'initdb','-D',root/'data','-U','policy_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject'])
 run([bins/'pg_ctl','-D',root/'data','-l',root/'server.log','-o',"-k "+str(socket)+" -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start']);started=True
 run([bins/'createdb','-w','policy_fixture'])
 source=(repo/'prisma/schema.prisma').read_text()
 models=[]
 for name in ['DurableAgentWorkflow','DurableAgentWorkflowEvent','AgentConversation','AgentConversationTurn','AgentActionProposal','SecureAuditRecord','WorkspaceAgentIdentity','TenantBillingPlan','DeploymentExecution']:
  models.append(re.search(r'^model '+name+r' \{.*?^\}',source,re.S|re.M).group())
 header='''generator client {\n provider = "prisma-client-js"\n output = "./generated"\n}\ndatasource db {\n provider = "postgresql"\n url = env("DATABASE_URL")\n}\n'''
 models.append('''model OrgMembership {\n id String @unique @default(cuid())\n organizationId String\n userId String\n role String\n acceptedAt DateTime?\n @@id([organizationId,userId])\n}\nmodel DesktopSessionRecord {\n id String @id\n organizationId String\n userId String\n revokedAt DateTime?\n expiresAt DateTime\n}\n''')
 models.append('''model TauriDeploymentRequest {
 id String @id
 organizationId String
 requesterUserId String
 status String
 version Int
 intakeJson Json
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
 models.append("""model Environment {
 id String @id @default(cuid())
 organizationId String
 tier String
 slug String @default("")
 name String @default("")
 displayOrder Int @default(0)
 @@unique([organizationId,slug])
}
model DeploymentTarget {
 id String @id @default(cuid())
 environmentId String @unique
 organizationId String
 provider String @default("aws")
 updatedAt DateTime @updatedAt
 roleArn String
 region String
 ecsCluster String
 ecsService String
}
model Repository {
 id String @id
 organizationId String
 provider String
 remoteOwner String
 remoteName String
}
model BranchEnvironmentPolicy {
 id String @id
 organizationId String
 repositoryId String
 environmentId String
 enabled Boolean
 branchPattern String
 requireReleaseTag Boolean
 requireCodeowners Boolean
 requirePrLink Boolean
 requireChangeTicket Boolean
 requirePromotionFromEnvironmentId String?
 requireTestsPassing Boolean
 priority Int
}
model TenantIdentityProvider {
 id String @id @default(cuid())
 organizationId String
 protocol String
 status String @default("pending")
 issuerOrEntityId String
 metadataDocument String
 managedDomains String[] @default([])
 roleMappingJson Json
 requireMfaClaim Boolean @default(true)
 lastTestAssertionAt DateTime?
 configuredByUserId String
 revokedAt DateTime?
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
 @@unique([organizationId,protocol])
}
""")
 schema=root/'schema.prisma';schema.write_text(header+'\n'.join(models));print('Owned schema:',schema)
 env['DATABASE_URL']='postgresql://policy_fixture@localhost/policy_fixture?host='+str(socket).replace('/','%2F')
 run(['node','node_modules/prisma/build/index.js','generate','--schema',schema])
 run(['node','node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
 env['AXIOM_EXECUTION_POLICY_PG_SOCKET']=str(socket);env['AXIOM_EXECUTION_POLICY_PG_CLIENT']=str(root/'generated/index.js')
 args=['/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node','node_modules/vitest/vitest.mjs','run','lib/governance/intelligence/__tests__/mergeRequestAdmission.pg.test.ts']
 output=run(args)
 print(output)
finally:
 if started: print(run([bins/'pg_ctl','-D',root/'data','-m','fast','-w','stop']))
 print('Owned fixture:',root)
