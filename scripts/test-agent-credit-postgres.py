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
parser.add_argument('--airflow-fixture', help='Optional existing owned loopback Airflow fixture file for combined engine acceptance')
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
    http_route = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/axiom/agentRuntime/__tests__/desktopAgentRoute.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'http-route-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'http-route-tests.log').write_text(http_route.stdout + '\n' + http_route.stderr)
    http_results = json.loads((output / 'http-route-results.json').read_text())
    if http_route.returncode or http_results['numPassedTests'] != 9 or http_results['numFailedTests'] or http_results['numPendingTests']:
        raise RuntimeError('desktop_agent_http_route_tests_failed_see_private_log')
    session_authority = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/desktop/__tests__/desktopSessionAuthority.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'session-authority-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'session-authority-tests.log').write_text(session_authority.stdout + '\n' + session_authority.stderr)
    session_results = json.loads((output / 'session-authority-results.json').read_text())
    if session_authority.returncode or session_results['numPassedTests'] != 10 or session_results['numFailedTests'] or session_results['numPendingTests']:
        raise RuntimeError('desktop_session_authority_tests_failed_see_private_log')
    coding = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/workforce/pipelines/__tests__/codeProposeAdmission.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'coding-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'coding-tests.log').write_text(coding.stdout + '\n' + coding.stderr)
    coding_results = json.loads((output / 'coding-results.json').read_text())
    if coding.returncode or coding_results['numPassedTests'] != 8 or coding_results['numFailedTests'] or coding_results['numPendingTests']:
        raise RuntimeError('coding_admission_chain_tests_failed_see_private_log')
    guards = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/workforce/__tests__/approvalWriterGuards.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'guard-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'guard-tests.log').write_text(guards.stdout + '\n' + guards.stderr)
    guard_results = json.loads((output / 'guard-results.json').read_text())
    if guards.returncode or guard_results['numPassedTests'] != 10 or guard_results['numFailedTests'] or guard_results['numPendingTests']:
        raise RuntimeError('approval_database_guard_tests_failed_see_private_log')
    migration_gate = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/__tests__/migrationDeployPreflight.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'migration-gate-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'migration-gate-tests.log').write_text(migration_gate.stdout + '\n' + migration_gate.stderr)
    migration_results = json.loads((output / 'migration-gate-results.json').read_text())
    if migration_gate.returncode or migration_results['numPassedTests'] != 8 or migration_results['numFailedTests'] or migration_results['numPendingTests']:
        raise RuntimeError('migration_refusal_gate_tests_failed_see_private_log')
    airflow_gate = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/integrations/airflow/__tests__/scheduledDispatchFreshness.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'airflow-gate-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'airflow-gate-tests.log').write_text(airflow_gate.stdout + '\n' + airflow_gate.stderr)
    airflow_results = json.loads((output / 'airflow-gate-results.json').read_text())
    if airflow_gate.returncode or airflow_results['numPassedTests'] != 5 or airflow_results['numFailedTests'] or airflow_results['numPendingTests']:
        raise RuntimeError('airflow_scheduled_freshness_tests_failed_see_private_log')
    budget_gate = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/workforce/pipelines/__tests__/pipelineBudgetAuthority.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'budget-gate-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'budget-gate-tests.log').write_text(budget_gate.stdout + '\n' + budget_gate.stderr)
    budget_results = json.loads((output / 'budget-gate-results.json').read_text())
    if budget_gate.returncode or budget_results['numPassedTests'] != 10 or budget_results['numFailedTests'] or budget_results['numPendingTests']:
        raise RuntimeError('pipeline_budget_authority_tests_failed_see_private_log')
    artifact_test = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/workforce/pipelines/__tests__/codingArtifact.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'coding-artifact-results.json')], cwd=repo, env=test_env, capture_output=True, text=True, timeout=120)
    (output / 'coding-artifact-tests.log').write_text(artifact_test.stdout + '\n' + artifact_test.stderr)
    artifact_results = json.loads((output / 'coding-artifact-results.json').read_text())
    if artifact_test.returncode or artifact_results['numPassedTests'] != 7 or artifact_results['numFailedTests'] or artifact_results['numPendingTests']:
        raise RuntimeError('coding_artifact_approval_tests_failed_see_private_log')
    combined_results = None
    if args.airflow_fixture:
        fixture_file = Path(args.airflow_fixture).resolve()
        if fixture_file != Path(args.airflow_fixture) or fixture_file.name != 'fixture.json' or not fixture_file.parent.name.startswith('axiom-airflow-engine-') or fixture_file.parent.parent != Path(private_tmp) or fixture_file.stat().st_mode & 0o077 or fixture_file.stat().st_uid != os.getuid():
            raise RuntimeError('owned_airflow_fixture_required')
        combined_env = dict(test_env, AXIOM_OWNED_AIRFLOW_FIXTURE=str(fixture_file))
        combined = subprocess.run([node, 'node_modules/vitest/vitest.mjs', 'run', 'lib/integrations/airflow/__tests__/scheduledAutomation.engine.postgres.test.ts', '--reporter=json', '--outputFile=' + str(output / 'combined-airflow-results.json')], cwd=repo, env=combined_env, capture_output=True, text=True, timeout=180)
        (output / 'combined-airflow-tests.log').write_text(combined.stdout + '\n' + combined.stderr)
        combined_results = json.loads((output / 'combined-airflow-results.json').read_text())
        if combined.returncode or combined_results['numPassedTests'] != 1 or combined_results['numFailedTests'] or combined_results['numPendingTests']:
            raise RuntimeError('combined_scheduler_engine_acceptance_failed_see_private_log')
    report = {'testsPassed': results['numPassedTests'], 'testsFailed': results['numFailedTests'], 'migrationRefusalGateTestsPassed': migration_results['numPassedTests'], 'airflowScheduleFreshnessTestsPassed': airflow_results['numPassedTests'], 'verifiedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'actualPrismaPostgres': True, 'codingArtifactApprovalTestsPassed': artifact_results['numPassedTests'],
              'actualDecisionAdmissionManagerSdkChain': True, 'actualApprovalVoteTransactions': True, 'actualCodingProposalAdmissionChain': True, 'desktopHttpRouteTestsPassed': http_results['numPassedTests'], 'desktopAuthentication': 'HTTP inference cases use a synthetic boundary; separate real HMAC/session/membership/billing cases use an isolated signing key', 'desktopSessionAuthorityTestsPassed': session_results['numPassedTests'], 'codingAdmissionTestsPassed': coding_results['numPassedTests'], 'approvalDatabaseGuardTestsPassed': guard_results['numPassedTests'], 'pipelineBudgetAuthorityTestsPassed': budget_results['numPassedTests'], 'providerTransport': 'fixed synthetic .invalid transport',
              'providerInference': False, 'combinedRealAirflowSchedulerTestsPassed': combined_results['numPassedTests'] if combined_results else 0, 'realCustomerAuthentication': False, 'productionWrites': False,
              'privateProductionBackupUsed': False, 'syntheticGenerationCostReceipts': True}
finally:
    # If normal shutdown fails, retain owned files for recovery; do not delete a
    # possibly running server's directory or target any process by a broad name.
    if started or (data / 'postmaster.pid').exists():
        run_pg('pg_ctl', ['-D', str(data), '-w', 'stop', '-m', 'fast'])
    shutil.rmtree(owned)
    (output / 'cleanup.json').write_text(json.dumps({'localClusterRemoved': True, 'localSocketAbsent': not socket.exists(), 'productionWrites': False}) + '\n')
if 'report' in locals():
    report['localClusterRemoved'] = True
    (output / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
