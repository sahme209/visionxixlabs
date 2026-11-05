#!/usr/bin/env python3
"""Reviewed owned-fixture runner; no production URL, shared fixture or recovery SQL.

Preparation: inspect this runner and codingPolicy.pg.test.ts; run --describe
for the exact source packet hash. Execution requires --execute-reviewed-hash HASH.
It initializes one new PG17 cluster/database on a private socket, copies the FULL
current schema with a private generated-client output, verifies the empty target,
then pushes ONLY to that fresh target and runs ONLY the named journey file.
Cleanup stops only this owned cluster, preserves logs, and never retries a test.
Socket-only owned database; no real provider or credential calls; only external session identity and final SDK fetch are synthetic; financial primitives/policy/storage remain real.
"""
import argparse, hashlib, json, os, re, signal, subprocess, tempfile
from pathlib import Path
from urllib.parse import quote

REPO=Path(__file__).resolve().parents[1]
TEST='lib/workforce/pipelines/__tests__/codingPolicy.pg.test.ts'
SOURCES=[Path(__file__).resolve()]+[REPO/p for p in ['app/api/ai/generate/route.ts', 'lib/ai/AIProviderManager.ts', 'lib/ai/workspaceProviderPolicy.ts', 'lib/ai/textAdmissionPolicy.ts', 'lib/workforce/pipelines/codingRunReservation.ts', 'lib/workforce/pipelines/codeProposeRealExecutor.ts', 'lib/ai/providers/VercelGatewayProvider.ts', 'lib/billing/governedExtractAdmission.ts', 'lib/billing/recordAIUsageEvent.ts', 'node_modules/ai/dist/index.js', 'node_modules/@ai-sdk/gateway/dist/index.js', 'lib/workforce/pipelines/__tests__/codingPolicy.pg.test.ts', 'prisma/schema.prisma', 'lib/billing/checkWorkspaceAICredits.ts', 'lib/billing/aiCreditReservation.ts', 'lib/billing/requestReservationCents.ts', 'lib/billing/tenantBillingStore.ts', 'lib/billing/planRegistry.ts', 'lib/billing/effectiveEntitlements.ts', 'lib/billing/applyAddOnsToEntitlements.ts', 'package-lock.json']]
PG=Path('/opt/homebrew/opt/postgresql@17/bin')
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')

def packet():
    return hashlib.sha256(json.dumps({str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCES},sort_keys=True).encode()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--describe',action='store_true')
    parser.add_argument('--execute-reviewed-hash')
    args=parser.parse_args()
    selected_test=TEST
    source_hash=packet()
    if args.describe:
        print(json.dumps({'packetSha256':source_hash,'test':selected_test,'execute':False,'cases':'coding-fixed-policy'}));return
    if args.execute_reviewed_hash!=source_hash:
        raise RuntimeError('exact_reviewed_packet_hash_required_no_execution')
    os.umask(0o077)
    root=Path(tempfile.mkdtemp(prefix='axiom-generic-ai-policy-pg-',dir='/private/tmp')).resolve()
    home=root/'home';home.mkdir(mode=0o700)
    cache=root/'cache';cache.mkdir(mode=0o700)
    socket=root/'socket';socket.mkdir(mode=0o700)
    data=root/'data';logs=root/'logs';logs.mkdir(mode=0o700)
    query=(REPO/'node_modules/@prisma/engines/libquery_engine-darwin-arm64.dylib.node').resolve()
    engine=(REPO/'node_modules/@prisma/engines/schema-engine-darwin-arm64').resolve()
    for path in [NODE,query,engine,PG/'postgres',PG/'initdb',PG/'pg_ctl',PG/'createdb',PG/'psql']:
        if not path.is_file():raise RuntimeError('installed_tool_required')
    env={'PATH':str(NODE.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(home),'XDG_CACHE_HOME':str(cache),'TMPDIR':str(root),'LANG':'C','TZ':'UTC','PGHOST':str(socket),'PGPORT':'55494','PGUSER':'generic_ai_policy_fixture','PGDATABASE':'axiom_generic_ai_policy_fixture','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','PRISMA_SCHEMA_ENGINE_BINARY':str(engine),'PRISMA_QUERY_ENGINE_LIBRARY':str(query),'CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'true','NODE_ENV':'test'}
    (root/'node_modules').symlink_to(REPO/'node_modules',target_is_directory=True)
    (root/'package.json').write_text('{}\n')
    def owned_process(args,timeout):
        command=[str(a) for a in args]
        process=subprocess.Popen(command,cwd=root,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,start_new_session=True)
        try:
            stdout,stderr=process.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            # This process created its own group; never signal another process group.
            try:os.killpg(process.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            stdout,stderr=process.communicate()
            stderr+='\nOwned process-group timeout: killed/reaped, no retry.'
            return subprocess.CompletedProcess(command,-signal.SIGKILL,stdout,stderr)
        return subprocess.CompletedProcess(command,process.returncode,stdout,stderr)
    def run(name,args,timeout=120):
        r=owned_process(args,timeout)

        (logs/(name+'.log')).write_text(r.stdout+'\n'+r.stderr)
        if r.returncode:raise RuntimeError(name+'_failed_see_owned_log')
        return r.stdout
    start_requested=False;failure=None
    try:
        if 'PostgreSQL) 17.' not in run('pg-version',[PG/'postgres','--version']):raise RuntimeError('pg17_required')
        if not re.match(r'^v24\.',run('node-version',[NODE,'--version']).strip()):raise RuntimeError('node24_required')
        run('initdb',[PG/'initdb','-D',data,'-U','generic_ai_policy_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject','--no-instructions'])
        start_requested=True
        run('start',[PG/'pg_ctl','-D',data,'-l',root/'server.log','-o',f"-k {socket} -p 55494 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'])
        run('createdb',[PG/'createdb','-w','axiom_generic_ai_policy_fixture'])
        binding=run('binding',[PG/'psql','-X','-A','-t','-w','-v','ON_ERROR_STOP=1','-c',"SELECT json_build_object('db',current_database(),'role',current_user,'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))"])
        if json.loads(binding)!= {'db':'axiom_generic_ai_policy_fixture','role':'generic_ai_policy_fixture','listen':'','data':str(data),'tables':0}:raise RuntimeError('fresh_empty_owned_target_required')
        env['DATABASE_URL']='postgresql://generic_ai_policy_fixture@localhost:55494/axiom_generic_ai_policy_fixture?host='+quote(str(socket),safe='')
        source=(REPO/'prisma/schema.prisma').read_text()
        if len(re.findall(r'^generator client \{',source,re.M))!=1:raise RuntimeError('one_generator_required')
        source=source.replace('generator client {','generator client {\n  output = "'+str(root/'generated')+'"',1)
        schema=root/'schema.prisma';schema.write_text(source)
        run('generate',[NODE,REPO/'node_modules/prisma/build/index.js','generate','--schema',schema])
        run('owned-empty-schema',[NODE,REPO/'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
        env.update(AXIOM_GENERIC_AI_PG_ROOT=str(root),AXIOM_GENERIC_AI_PG_SOCKET=str(socket),AXIOM_GENERIC_AI_PG_CLIENT=str(root/'generated/index.js'))
        empty=root/'empty-env';empty.mkdir(mode=0o700)
        config={'root':str(REPO),'envDir':str(empty),'cacheDir':str(cache),
            'resolve':{'alias':[{'find':'server-only','replacement':str(REPO/'test/serverOnlyStub.ts')},{'find':'@prisma/client','replacement':str(root/'generated/index.js')},{'find':'@','replacement':str(REPO)}]},
            'test':{'environment':'node','include':[selected_test],'maxWorkers':1,'fileParallelism':False,'pool':'threads'}}
        config_path=root/'vitest.config.mjs';config_path.write_text('export default '+json.dumps(config)+';\n')
        run('journey',[NODE,REPO/'node_modules/vitest/vitest.mjs','run','--config',config_path,'--configLoader','native','--reporter=json','--outputFile='+str(logs/'results.json')],120)
        results=json.loads((logs/'results.json').read_text())
        assertions=[a for suite in results['testResults'] for a in suite.get('assertionResults',[])]
        expected=3
        if results['numFailedTests'] or len(assertions)!=expected or any(a['status']!='passed' for a in assertions) or results['numPassedTests']!=expected:raise RuntimeError('three_non_skipped_coding_policy_journeys_required')
        if packet()!=source_hash:raise RuntimeError('reviewed_direct_sources_changed_during_owned_run')
        (root/'receipt.json').write_text(json.dumps({'packetSha256':source_hash,'tests':expected,'selection':'coding-fixed-policy','excludedCases':0,'provider':'simulated','root':str(root),'schemaSha256':hashlib.sha256(schema.read_bytes()).hexdigest(),'engineSha256':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [query,engine]},'productionChanged':False,'directSourceHashAfter':packet(),'sourceBindingScope':str(len(SOURCES))+' direct reviewed application/test/SDK files only, not complete transitive attestation'},indent=2))
    except BaseException as error:
        failure=error
    finally:
        if start_requested:
            try:
                status=owned_process([PG/'pg_ctl','-D',data,'status'],15)
                (logs/'cleanup-status.log').write_text(status.stdout+'\n'+status.stderr)
                if status.returncode==0:
                    run('stop',[PG/'pg_ctl','-D',data,'-m','fast','-w','stop'])
                    stopped=owned_process([PG/'pg_ctl','-D',data,'status'],15)
                    (logs/'cleanup-stopped.log').write_text(stopped.stdout+'\n'+stopped.stderr)
                    if stopped.returncode!=3:raise RuntimeError('owned_server_stop_not_verified')
                elif status.returncode!=3:raise RuntimeError('owned_server_cleanup_uncertain')
            except BaseException as error:
                failure=failure or error
        print('Owned fixture logs: '+str(root))
    if failure:raise failure
if __name__=='__main__':main()
