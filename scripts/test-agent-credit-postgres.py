#!/usr/bin/env python3
"""Run the Agent credit-chain acceptance against a new owned local PG17 server.

No live connection URL, production backup, provider credential or network model
transport is accepted. Requires local PostgreSQL17, Node24 and installed packages.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import quote

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', required=True, help='Private directory for test logs and safe receipt')
parser.add_argument('--pg-bin-dir', required=True, help='Directory containing local PG17 tools')
parser.add_argument('--pg-control-bin-dir', help='Optional separately signed initdb/pg_ctl directory')
parser.add_argument('--node', default=shutil.which('node'), help='Node24 executable')
args = parser.parse_args()
os.umask(0o077)
repo = Path(__file__).resolve().parents[1]
output = Path(args.output_dir).expanduser().resolve()
output.mkdir(mode=0o700, parents=True, exist_ok=False)
if output.stat().st_mode & 0o077:
    raise RuntimeError('test_output_requires_owner_only_permissions')
binaries = Path(args.pg_bin_dir).resolve()
control = Path(args.pg_control_bin_dir or args.pg_bin_dir).resolve()
if not args.node:
    raise RuntimeError('node24_required')
node = str(Path(args.node).resolve())
# Retain only ordinary local process configuration, never inherited cloud/DB keys.
env = {key: os.environ[key] for key in ['PATH', 'HOME', 'SystemRoot'] if key in os.environ}
version = subprocess.run([str(binaries / 'postgres'), '--version'], env=env, capture_output=True, text=True, check=True)
if 'PostgreSQL) 17.' not in version.stdout:
    raise RuntimeError('postgres17_required')
node_version = subprocess.run([node, '--version'], env=env, capture_output=True, text=True, check=True)
if int(node_version.stdout.strip().lstrip('v').split('.')[0]) < 24:
    raise RuntimeError('node24_or_later_required')
# Canonical private root is also checked independently by the application tests.
private_tmp = '/private/tmp' if Path('/private/tmp').is_dir() else '/tmp'
owned = Path(tempfile.mkdtemp(prefix='axiom-agent-chain-', dir=private_tmp)).resolve()
socket = owned / 'socket'
socket.mkdir(mode=0o700)
data = owned / 'data'
env.update(TMPDIR=private_tmp, LANG='C', TZ='UTC', PGHOST=str(socket), PGUSER='agent_fixture', PGDATABASE='axiom_agent_fixture')

def run_pg(name, arguments, timeout=90):
    command = str((control if name in ['initdb', 'pg_ctl'] else binaries) / name)
    result = subprocess.run([command] + arguments, env=env, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        (output / (name + '-failure.log')).write_text(result.stderr)
        raise RuntimeError('owned_fixture_' + name + '_failed')
    return result.stdout

started = False
try:
    run_pg('initdb', ['-D', str(data), '-U', 'agent_fixture', '--locale=C', '--encoding=UTF8', '--auth-local=trust', '--auth-host=reject', '--no-instructions'])
    run_pg('pg_ctl', ['-D', str(data), '-l', str(owned / 'server.log'), '-o', '-k ' + str(socket) + " -c listen_addresses='' -c unix_socket_permissions=0700", '-w', 'start'])
    started = True
    run_pg('createdb', ['-w', 'axiom_agent_fixture'])
    binding = run_pg('psql', ['-X', '-A', '-t', '-w', '-c', "SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' "]).strip()
    if binding != 't':
        raise RuntimeError('owned_fixture_binding_required')
    # Synchronization is permitted only on this newly initialized empty fixture.
    own_env = dict(env, DATABASE_URL='postgresql://agent_fixture@localhost/axiom_agent_fixture?host=' + quote(str(socket), safe=''))
    schema = subprocess.run([node, 'node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/schema.prisma', '--skip-generate'], cwd=repo, env=own_env, capture_output=True, text=True, timeout=120)
    (output / 'schema.log').write_text(schema.stdout + '\n' + schema.stderr)
    if schema.returncode:
        raise RuntimeError('owned_fixture_empty_schema_setup_failed')
    run_pg('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '--file', str(repo / 'ops/recovery/20261022_public_billing_v1.sql')])
    test_env = dict(env, AXIOM_OWNED_AGENT_PG_SOCKET=str(socket), NODE_OPTIONS='--max-old-space-size=8192')
    tests = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/axiom/agentRuntime/__tests__/governedAgent.postgres.test.ts', 'lib/workforce/__tests__/approvalVote.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'tests.log').write_text(tests.stdout + '\n' + tests.stderr)
    if tests.returncode:
        raise RuntimeError('agent_credit_chain_tests_failed_see_private_log')
    results = json.loads((output / 'results.json').read_text())
    if results['numPassedTests'] < 13 or results['numFailedTests'] or results['numPendingTests']:
        raise RuntimeError('complete_non_skipped_acceptance_required')
    report = {'testsPassed': results['numPassedTests'], 'testsFailed': results['numFailedTests'], 'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'actualPrismaPostgres': True,
              'actualDecisionAdmissionManagerSdkChain': True, 'actualApprovalVoteTransactions': True, 'providerTransport': 'fixed synthetic .invalid transport',
              'providerInference': False, 'realCustomerAuthentication': False, 'productionWrites': False,
              'privateProductionBackupUsed': False, 'syntheticGenerationCostReceipts': True}
finally:
    # If normal shutdown fails, retain owned files for recovery; do not delete a
    # possibly running server's directory or target any process by a broad name.
    if started or (data / 'postmaster.pid').exists():
        run_pg('pg_ctl', ['-D', str(data), '-w', 'stop', '-m', 'fast'])
    shutil.rmtree(owned)
if 'report' in locals():
    report['localClusterRemoved'] = True
    (output / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
