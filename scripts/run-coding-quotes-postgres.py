#!/usr/bin/env python3
"""Reviewed owned-fixture runner; no production URL, shared fixture or recovery SQL.

Preparation: inspect this runner and codingRequestQuote.pg.test.ts; run --describe
for the exact source packet hash. Execution requires --execute-reviewed-hash HASH.
It initializes one new PG17 cluster/database on a private socket, copies the FULL
current schema with a private generated-client output, verifies the empty target,
then pushes ONLY to that fresh target and runs ONLY the named journey file.
Cleanup stops only this owned cluster, preserves logs, and never retries a test.
No network/provider/real credential calls; runtime transports/authority are mocked.
"""
import argparse, hashlib, json, os, re, signal, subprocess, tempfile
from pathlib import Path
from urllib.parse import quote

REPO=Path(__file__).resolve().parents[1]
TEST='lib/workforce/pipelines/__tests__/codingRequestQuote.pg.test.ts'
COMPOSED_TEST='lib/workforce/pipelines/__tests__/codingQuotedAdmission.pg.test.ts'
SOURCES=[Path(__file__).resolve(),REPO/TEST,REPO/'prisma/schema.prisma',REPO/'lib/ai/codingRequestQuote.ts',REPO/'lib/workforce/pipelines/codingRunReservation.ts',REPO/'lib/billing/aiCreditReservation.ts',REPO/'lib/billing/reconcileGatewayUsage.ts',REPO/COMPOSED_TEST,REPO/'lib/ai/AIProvider.ts',REPO/'lib/ai/AIProviderManager.ts',REPO/'lib/ai/providers/VercelGatewayProvider.ts',REPO/'lib/billing/governedExtractAdmission.ts',REPO/'lib/ai/inputByteBound.ts',REPO/'lib/security/redaction.ts',REPO/'lib/billing/recordAIUsageEvent.ts',REPO/'lib/billing/newTestSubscription/usageAllocationIO.ts',REPO/'package-lock.json',REPO/'node_modules/ai/dist/index.mjs',REPO/'node_modules/@ai-sdk/gateway/dist/index.mjs']
PG=Path('/opt/homebrew/opt/postgresql@17/bin')
NODE=Path('/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node')

def packet():
    return hashlib.sha256(json.dumps({str(p.relative_to(REPO)):hashlib.sha256(p.read_bytes()).hexdigest() for p in SOURCES},sort_keys=True).encode()).hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--describe',action='store_true')
    parser.add_argument('--execute-reviewed-hash')
    parser.add_argument('--cases',choices=['initial','follow-on','settlement-correction','allocations','composed'],default='initial')
    args=parser.parse_args()
    selected_test=COMPOSED_TEST if args.cases=='composed' else TEST
    source_hash=packet()
    if args.describe:
        print(json.dumps({'packetSha256':source_hash,'test':selected_test,'execute':False,'cases':args.cases}));return
    if args.execute_reviewed_hash!=source_hash:
        raise RuntimeError('exact_reviewed_packet_hash_required_no_execution')
    os.umask(0o077)
    root=Path(tempfile.mkdtemp(prefix='axiom-cq-pg-',dir='/private/tmp')).resolve()
    home=root/'home';home.mkdir(mode=0o700)
    cache=root/'cache';cache.mkdir(mode=0o700)
    socket=root/'socket';socket.mkdir(mode=0o700)
    data=root/'data';logs=root/'logs';logs.mkdir(mode=0o700)
    query=(REPO/'node_modules/@prisma/engines/libquery_engine-darwin-arm64.dylib.node').resolve()
    engine=(REPO/'node_modules/@prisma/engines/schema-engine-darwin-arm64').resolve()
    for path in [NODE,query,engine,PG/'postgres',PG/'initdb',PG/'pg_ctl',PG/'createdb',PG/'psql']:
        if not path.is_file():raise RuntimeError('installed_tool_required')
    env={'PATH':str(NODE.parent)+':/usr/bin:/bin:/usr/sbin:/sbin','HOME':str(home),'XDG_CACHE_HOME':str(cache),'TMPDIR':str(root),'LANG':'C','TZ':'UTC','PGHOST':str(socket),'PGPORT':'55491','PGUSER':'coding_quote_fixture','PGDATABASE':'axiom_coding_quote_fixture','PRISMA_GENERATE_SKIP_AUTOINSTALL':'true','PRISMA_SCHEMA_ENGINE_BINARY':str(engine),'PRISMA_QUERY_ENGINE_LIBRARY':str(query),'CHECKPOINT_DISABLE':'1','PRISMA_HIDE_UPDATE_MESSAGE':'true','NODE_ENV':'test'}
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
        run('initdb',[PG/'initdb','-D',data,'-U','coding_quote_fixture','--locale=C','--encoding=UTF8','--auth-local=trust','--auth-host=reject','--no-instructions'])
        start_requested=True
        run('start',[PG/'pg_ctl','-D',data,'-l',root/'server.log','-o',f"-k {socket} -p 55491 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'])
        run('createdb',[PG/'createdb','-w','axiom_coding_quote_fixture'])
        binding=run('binding',[PG/'psql','-X','-A','-t','-w','-v','ON_ERROR_STOP=1','-c',"SELECT json_build_object('db',current_database(),'role',current_user,'listen',current_setting('listen_addresses'),'data',current_setting('data_directory'),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))"])
        if json.loads(binding)!= {'db':'axiom_coding_quote_fixture','role':'coding_quote_fixture','listen':'','data':str(data),'tables':0}:raise RuntimeError('fresh_empty_owned_target_required')
        env['DATABASE_URL']='postgresql://coding_quote_fixture@localhost:55491/axiom_coding_quote_fixture?host='+quote(str(socket),safe='')
        source=(REPO/'prisma/schema.prisma').read_text()
        if len(re.findall(r'^generator client \{',source,re.M))!=1:raise RuntimeError('one_generator_required')
        source=source.replace('generator client {','generator client {\n  output = "'+str(root/'generated')+'"',1)
        schema=root/'schema.prisma';schema.write_text(source)
        run('generate',[NODE,REPO/'node_modules/prisma/build/index.js','generate','--schema',schema])
        run('owned-empty-schema',[NODE,REPO/'node_modules/prisma/build/index.js','db','push','--schema',schema,'--skip-generate'])
        env.update(AXIOM_CODING_QUOTE_PG_ROOT=str(root),AXIOM_CODING_QUOTE_PG_SOCKET=str(socket),AXIOM_CODING_QUOTE_PG_CLIENT=str(root/'generated/index.js'))
        corrected_title='follow-on: quoted settlement rolls back atomically then updates late stage cost without losing history'
        selected_pattern='composed:' if args.cases=='composed' else 'allocation:' if args.cases=='allocations' else corrected_title if args.cases=='settlement-correction' else 'follow-on:' if args.cases=='follow-on' else '^(?!.*(?:follow-on:|allocation:))'
        expected=4 if args.cases=='composed' else 8 if args.cases=='allocations' else 1 if args.cases=='settlement-correction' else 6 if args.cases=='follow-on' else 5
        run('journey',[NODE,REPO/'node_modules/vitest/vitest.mjs','run','--root',REPO,'--config',REPO/'vitest.config.ts',selected_test,'-t',selected_pattern,'--reporter=json','--outputFile='+str(logs/'results.json')])
        results=json.loads((logs/'results.json').read_text())
        assertions=[a for suite in results['testResults'] for a in suite.get('assertionResults',[])]
        def chosen(title):
            if args.cases=='composed':return title.startswith('composed:')
            if args.cases=='allocations':return title.startswith('allocation:')
            if args.cases=='settlement-correction':return title==corrected_title
            if args.cases=='follow-on':return title.startswith('follow-on:')
            return not (title.startswith('follow-on:') or title.startswith('allocation:'))
        selected=[a for a in assertions if chosen(a['title'])]
        if results['numFailedTests'] or len(selected)!=expected or any(a['status']!='passed' for a in selected) or results['numPassedTests']!=expected:raise RuntimeError('all_selected_non_skipped_journeys_required')
        if packet()!=source_hash:raise RuntimeError('reviewed_direct_sources_changed_during_owned_run')
        (root/'receipt.json').write_text(json.dumps({'packetSha256':source_hash,'tests':expected,'selection':args.cases,'excludedCases':len(assertions)-len(selected),'provider':'simulated','root':str(root),'schemaSha256':hashlib.sha256(schema.read_bytes()).hexdigest(),'engineSha256':{str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in [query,engine]},'productionChanged':False,'directSourceHashAfter':packet(),'sourceBindingScope':str(len(SOURCES))+' direct reviewed application/test/SDK files only, not complete transitive attestation'},indent=2))
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
