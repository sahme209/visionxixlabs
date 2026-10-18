/* eslint-disable @typescript-eslint/no-require-imports -- fixture-only exact source loader under preinstalled guard */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const diagnostic = globalThis[Symbol.for('axiom.owned.ecs.checked-input.diagnostics')];
function phase(stage, values = {}) { diagnostic?.update({ ...values, stage }); diagnostic?.write(); }
phase('source_graph_scan');
const root = path.resolve(__dirname, '../..'), guard = globalThis[Symbol.for('axiom.owned.ecs.checked-input.guard')];
assert.equal(process.env.AXIOM_OWNED_ECS_CHECKED_INPUTS, '1'); assert.ok(guard && process.send);
const target = new URL(process.env.DATABASE_URL);
assert.ok(target.protocol === 'postgresql:' && target.hostname === '127.0.0.1' && target.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(target.pathname) && !target.search && !target.hash && process.env.DIRECT_URL === target.href);
const ts = require('typescript'), digest = value => crypto.createHash('sha256').update(value).digest('hex');
const roots = ['lib/releaseops/ecsReleaseV2/admissionInputs/read.ts', 'lib/desktop/resolveRequestDesktopSession.ts', 'lib/desktop/desktopSession.ts', 'lib/desktop/desktopToken.ts', 'lib/security/credentialVault.ts', 'lib/db.ts'];
const allowed = new Set(), sourceHashes = {};
function collect(relative) {
  const file = path.resolve(root, relative); assert.ok(file.startsWith(root + '/lib/'));
  if (allowed.has(file)) return; allowed.add(file); const source = fs.readFileSync(file, 'utf8'); sourceHashes[path.relative(root, file)] = digest(source);
  if (!file.endsWith('.ts')) return;
  const imports = ts.preProcessFile(source, true, true).importedFiles;
  for (const item of imports) {
    if (!item.fileName.startsWith('.') && !item.fileName.startsWith('@/')) continue;
    const base = item.fileName.startsWith('@/') ? path.join(root, item.fileName.slice(2)) : path.resolve(path.dirname(file), item.fileName);
    const child = [base, base + '.ts', base + '.json', path.join(base, 'index.ts')].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    assert.ok(child && child.startsWith(root + '/lib/'), 'owned_ecs_exact_source_graph_required'); collect(path.relative(root, child));
  }
}
for (const entry of roots) collect(entry);
const priorLoader = require.extensions['.ts'];
require.extensions['.ts'] = (module, file) => {
  assert.ok(allowed.has(file), 'owned_ecs_unlisted_source_import'); const source = fs.readFileSync(file, 'utf8'); assert.equal(digest(source), sourceHashes[path.relative(root, file)]);
  const aliased = source.replace(/(["'])@\//g, (_match, quote) => `${quote}${root}/`);
  module._compile(ts.transpileModule(aliased, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true } }).outputText, file);
};
const pending = new Map(); let commandId = 0;
process.on('message', message => { if (message?.kind !== 'owned_ecs_control_reply') return; const item = pending.get(message.id); if (!item) return; pending.delete(message.id); clearTimeout(item.timer); if (message.ok) item.resolve(message.result); else item.reject(new Error('owned_ecs_control_rejected')); });
function control(command, details = {}) { return new Promise((resolve, reject) => { const id = ++commandId, timer = setTimeout(() => { pending.delete(id); reject(new Error('owned_ecs_control_timeout')); }, 7000); pending.set(id, { resolve, reject, timer }); process.send({ kind: 'owned_ecs_control', proof: process.env.AXIOM_OWNED_ECS_PROOF, id, command, ...details }); }); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let client, second, activeCase = 'bootstrap'; const groups = [], mutations = [];
async function group(name, action) { activeCase = name; phase('source_case', { caseIndex: groups.length + 1, completedGroups: groups.length }); await action(); groups.push(name); phase('source_case', { caseIndex: groups.length, completedGroups: groups.length }); }
(async () => {
  await guard.ready; phase('guarded_ready');
  phase('prisma_import');
  const { PrismaClient } = require('@prisma/client');
  client = require(path.join(root, 'lib/db.ts')).prisma;
  second = new PrismaClient({ datasources: { db: { url: target.href } } });
  phase('owned_db_identity');
  for (const database of [client, second]) { const [row] = await database.$queryRawUnsafe('SELECT current_database() AS name'); assert.equal(row.name, target.pathname.slice(1)); }
  phase('source_imports');
  const { createEcsCheckedInputReader } = require(path.join(root, roots[0]));
  const { resolveRequestDesktopSession } = require(path.join(root, roots[1]));
  const { createDesktopSession } = require(path.join(root, roots[2]));
  const { mintDesktopToken } = require(path.join(root, roots[3]));
  const { encryptScopedCredential } = require(path.join(root, roots[4]));
  const { NextRequest } = require('next/server');
  const suffix = crypto.randomBytes(6).toString('hex'), organizationId = 'ws_owned_ecs_' + suffix, userId = 'owned_ecs_user_' + suffix;
  const accountId = 'owned_ecs_account_' + suffix, environmentId = 'owned_ecs_env_' + suffix, repositoryId = 'owned_ecs_repo_' + suffix;
  const now = new Date(), sourceSha = 'cc78c9cd50c7bace6c3be36bbd22f2f1b5f8182b', subject = '06e6818324cb20e1ea6f22da7fb925323fb57251c98768c88b93872b50590f92';
  const fixtureDirectory = path.join(root, 'lib/releaseops/ecsReleaseV2/__tests__/fixtures');
  const bundle = fs.readFileSync(path.join(fixtureDirectory, 'direct-workflow-oci/bundle.sigstore.json')), trustedRootBytes = fs.readFileSync(path.join(fixtureDirectory, 'trusted_root.json')), trustedRoot = JSON.parse(trustedRootBytes);
  assert.equal(await client.user.count(), 0, 'owned_ecs_initially_empty_rows_required'); assert.equal(await client.platformGithubAppCredential.count(), 0);
  phase('synthetic_seed');
  await client.user.create({ data: { id: userId, email: `owned-ecs-${suffix}@example.test`, name: 'Synthetic ECS source fixture', emailVerifiedAt: now } });
  await client.orgMembership.create({ data: { userId, organizationId, role: 'admin', acceptedAt: now, providerScopes: [] } });
  const membership = { userId_organizationId: { userId, organizationId } };
  const policy = await client.axiomApprovalPolicy.create({ data: { organizationId, name: 'Synthetic selected policy', createdBy: userId, requiredApprovals: 2, requiredRoles: ['admin'] } });
  await client.environment.create({ data: { id: environmentId, organizationId, slug: 'stage', name: 'Owned stage', tier: 'stage', approvalPolicyId: policy.id } });
  await client.repository.create({ data: { id: repositoryId, organizationId, provider: 'github', remoteOwner: 'github', remoteName: 'artifact-attestations-workflows', remoteUrl: 'https://github.com/github/artifact-attestations-workflows.git' } });
  const installation = await client.gitHubInstallation.create({ data: { organizationId, githubInstallationId: '19', accountLogin: 'github', accountType: 'Organization', repositorySelection: 'selected', sourceFlow: 'manual' } });
  await client.cloudAccount.create({ data: { id: accountId, organizationId, provider: 'aws', externalAccountId: '123456789012', credentialRef: `cloud-v2:${accountId}`, regions: ['us-east-1'], enabled: false, autopilotMode: 'observe_only' } });
  const configuration = { roleArn: 'arn:aws:iam::123456789012:role/OwnedReadOnly', expectedAccountId: '123456789012', region: 'us-east-1', externalId: 'axiom-0123456789abcdef0123456789abcdef' };
  await client.cloudAccountCredential.create({ data: { id: accountId, organizationId, encryptedConfiguration: encryptScopedCredential(JSON.stringify(configuration), `cloud-account-credential-v1:${organizationId}:aws:${accountId}:1`), validatedAt: now, version: 1 } });
  const deploymentTarget = await client.deploymentTarget.create({ data: { organizationId, environmentId, provider: 'aws', roleArn: configuration.roleArn, region: 'us-east-1', ecsCluster: 'app', ecsService: 'web' } });
  let session, token;
  async function freshSession() { session = await createDesktopSession({ organizationId, userId, deviceFingerprint: 'owned-source-probe', deviceLabel: 'Synthetic source fixture', platform: 'unknown' }); token = mintDesktopToken(session.id); }
  await freshSession(); phase('principal_resolution');
  async function principal(overrideToken = token) {
    const request = new NextRequest('http://127.0.0.1/internal/owned-ecs-checked-inputs', { headers: { authorization: 'Bearer ' + overrideToken } });
    const resolved = await resolveRequestDesktopSession(request, { requiredScope: 'pipeline:trigger', route: 'owned_source_probe', allowApiKey: false, requireWorkspaceAdmin: true, requiredCapability: 'connections:manage', requireWorkspaceMembership: true });
    return resolved ? { organizationId: resolved.organizationId, userId: resolved.userId, sessionId: resolved.id } : undefined;
  }
  const profile = { kind: 'public_sigstore_direct_workflow_v1', trustedRoot, trustedRootDigest: 'sha256:' + digest(Buffer.from(JSON.stringify(trustedRoot))), reviewedAt: new Date(now.getTime() - 1000).toISOString(), reviewExpiresAt: new Date(now.getTime() + 900_000).toISOString(), signerWorkflow: `https://github.com/github/artifact-attestations-workflows/.github/workflows/ghcr-publish.yml@refs/heads/main`, signerWorkflowSha: sourceSha };
  const downloadPolicy = [{ origin: 'https://owned-ecs-bundle.invalid', pathPrefix: '/attestations/804468129/' }];
  const options = { client, profile, downloadPolicy }, reader = createEcsCheckedInputReader(options);
  const request = { repositoryRecordId: repositoryId, environmentId, cloudAccountId: accountId, baselineArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/app:1', proposedArn: 'arn:aws:ecs:us-east-1:123456789012:task-definition/app:2', build: { repositoryId: '804468129', repositoryFullName: 'github/artifact-attestations-workflows', sourceSha, workflowPath: '.github/workflows/ghcr-publish.yml', workflowSha: sourceSha, runId: '10782915115', runAttempt: 1, attestationDigest: 'sha256:' + digest(bundle), subjects: [{ name: 'ghcr.io/github/artifact-attestations-workflows', sha256: subject }] } };
  const emptyTables = ['TenantBillingPlan', 'DeploymentExecution', 'TerraformExecutionJob', 'TauriDeploymentRequest', 'EcsReleaseReviewPacket', 'EcsReleaseReviewCheckpoint', 'EcsReleaseReviewDecision', 'AxiomApprovalRequest', 'AxiomApprovalItem', 'AxiomApprovalChain', 'AxiomApprovalVote', 'UsageEvent', 'AIUsageReservation', 'TenantUsageCounter'];
  async function counts() { const values = {}; for (const name of emptyTables) { const [row] = await client.$queryRawUnsafe('SELECT to_regclass($1) IS NOT NULL AS present', `public."${name}"`); values[name] = row.present ? Number((await client.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "${name}"`))[0].count) : null; } return values; }
  const beforeCounts = await counts(); assert.equal(beforeCounts.TenantBillingPlan, 0);
  async function inspect(input = request, signal) { const actor = await principal(); assert.ok(actor, 'actual_current_principal_required'); return reader.inspect(actor, input, signal); }
  const unavailable = result => assert.equal(result.kind, 'unavailable');
  const mismatch = result => { assert.equal(result.kind, 'checked_provider_inputs_subject_mismatch'); assert.equal(result.usability, 'not_usable_for_admission'); assert.equal(result.sourceCoverage, 'mismatch'); assert.equal(result.evidence.aws.limits.executionAuthorized, false); const body = JSON.stringify(result); assert.ok(!body.includes(configuration.externalId) && !body.includes(process.env.CREDENTIAL_ENCRYPTION_KEY) && !body.includes('owned-ecs-installation-token') && !body.includes('encryptedConfiguration')); assert.ok(!Object.hasOwn(result, 'facts') && !Object.hasOwn(result, 'admissionReady')); };
  await group('actual_crypto_prisma_aead_native_sdk_checked_mismatch', async () => { const before = await control('summary'); mismatch(await inspect()); const after = await control('summary'); const calls = after.requests.slice(before.requests.length); assert.ok(calls.includes('GithubToken')); assert.deepEqual(calls.filter(name => ['AssumeRole', 'GetCallerIdentity', 'DescribeServices', 'DescribeServicesFinal', 'DescribeTaskDefinition', 'DescribeImages'].includes(name)), ['AssumeRole', 'GetCallerIdentity', 'DescribeServices', 'DescribeTaskDefinition', 'DescribeTaskDefinition', 'DescribeImages', 'DescribeServicesFinal']); });
  await group('actual_resolver_bad_token_and_role', async () => { assert.equal(await principal('malformed-owned-token'), undefined); await second.orgMembership.update({ where: membership, data: { role: 'read_only' } }); try { assert.equal(await principal(), undefined); } finally { await second.orgMembership.update({ where: membership, data: { role: 'admin' } }); } mutations.push('membership_role'); });
  for (const mode of ['provider_scope', 'prod', 'selected_policy_block', 'foreign_environment']) await group('before_io_' + mode, async () => {
    const before = await control('summary'), input = structuredClone(request);
    if (mode === 'provider_scope') await second.orgMembership.update({ where: membership, data: { providerScopes: ['gcp'] } });
    if (mode === 'prod') await second.environment.update({ where: { id: environmentId }, data: { tier: 'prod' } });
    if (mode === 'selected_policy_block') await second.axiomApprovalPolicy.update({ where: { id: policy.id }, data: { blockAction: true } });
    if (mode === 'foreign_environment') input.environmentId = 'foreign_owned_environment';
    try { unavailable(await inspect(input)); assert.deepEqual((await control('summary')).requests, before.requests); }
    finally { if (mode === 'provider_scope') await second.orgMembership.update({ where: membership, data: { providerScopes: [] } }); if (mode === 'prod') await second.environment.update({ where: { id: environmentId }, data: { tier: 'stage' } }); if (mode === 'selected_policy_block') await second.axiomApprovalPolicy.update({ where: { id: policy.id }, data: { blockAction: false } }); } mutations.push(mode);
  });
  await group('ecr_substitution_fails_genuine_crypto', async () => { const input = structuredClone(request), before = await control('summary'); input.build.subjects[0].name = '123456789012.dkr.ecr.us-east-1.amazonaws.com/app'; unavailable(await inspect(input)); assert.equal((await control('summary')).requests.slice(before.requests.length).includes('AssumeRole'), false); });
  async function heldRace(operation, action, input = request, signal) { await control('hold', { operation }); const pendingRead = inspect(input, signal); try { await control('wait_held'); await action(); } finally { await control('release'); } return pendingRead; }
  for (const mode of ['provider_scope', 'installation', 'policy', 'server_configuration']) await group('during_github_' + mode, async () => {
    const before = await control('summary'), oldExpiry = profile.reviewExpiresAt;
    try { unavailable(await heldRace('Bundle', async () => { if (mode === 'provider_scope') await second.orgMembership.update({ where: membership, data: { providerScopes: ['gcp'] } }); if (mode === 'installation') await second.gitHubInstallation.update({ where: { id: installation.id }, data: { repositorySelection: 'all' } }); if (mode === 'policy') await second.axiomApprovalPolicy.update({ where: { id: policy.id }, data: { requiredApprovals: 3 } }); if (mode === 'server_configuration') profile.reviewExpiresAt = new Date(Date.parse(oldExpiry) + 1000).toISOString(); })); assert.equal((await control('summary')).requests.slice(before.requests.length).includes('AssumeRole'), false); }
    finally { if (mode === 'provider_scope') await second.orgMembership.update({ where: membership, data: { providerScopes: [] } }); if (mode === 'installation') await second.gitHubInstallation.update({ where: { id: installation.id }, data: { repositorySelection: 'selected' } }); if (mode === 'policy') await second.axiomApprovalPolicy.update({ where: { id: policy.id }, data: { requiredApprovals: 2 } }); profile.reviewExpiresAt = oldExpiry; } mutations.push(mode);
  });
  await group('during_aws_target_recreation', async () => { const replacement = 'owned_replacement_' + suffix; try { unavailable(await heldRace('DescribeServicesFinal', () => second.deploymentTarget.update({ where: { id: deploymentTarget.id }, data: { id: replacement } }))); } finally { await second.deploymentTarget.update({ where: { id: replacement }, data: { id: deploymentTarget.id } }); } mutations.push('target_recreation'); });
  await group('heartbeat_does_not_change_context', async () => mismatch(await heldRace('Bundle', () => second.desktopSessionRecord.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }))));
  await group('actual_postgres_read_lock_wait', async () => {
    let unlocked, locked; const release = new Promise(resolve => { unlocked = resolve; }), ready = new Promise(resolve => { locked = resolve; });
    const lock = second.$transaction(async tx => { await tx.$executeRawUnsafe('LOCK TABLE "CloudAccount" IN ACCESS EXCLUSIVE MODE'); locked(); await release; }, { isolationLevel: 'Serializable', maxWait: 3000, timeout: 4000 });
    await ready; const pendingRead = inspect(); let observed = false;
    try { const deadline = Date.now() + 2000; while (Date.now() < deadline) { const [state] = await client.$queryRawUnsafe("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock') AS waiting"); if (state.waiting) { observed = true; break; } await pause(20); } assert.ok(observed, 'actual_read_lock_wait_required'); } finally { unlocked(); await lock; }
    mismatch(await pendingRead);
  });
  await group('session_expires_while_github_response_is_held', async () => { await second.desktopSessionRecord.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() + 700) } }); unavailable(await heldRace('Bundle', () => pause(900))); await freshSession(); mutations.push('session_expiry'); });
  await group('current_session_revocation_after_actual_aws_io', async () => { unavailable(await heldRace('DescribeServicesFinal', () => second.desktopSessionRecord.update({ where: { id: session.id }, data: { revokedAt: new Date() } }))); await freshSession(); mutations.push('session_revocation'); });
  await group('cancel_actual_native_response', async () => { const controller = new AbortController(); unavailable(await heldRace('DescribeServicesFinal', async () => { controller.abort(); await pause(25); }, request, controller.signal)); });
  for (const mode of ['denied', 'redirect', 'oversized', 'compressed']) await group('actual_aws_' + mode, async () => { await control('response', { operation: 'DescribeImages', mode }); unavailable(await inspect()); });
  await group('credential_revocation_after_actual_aws_io', async () => { unavailable(await heldRace('DescribeServicesFinal', () => second.cloudAccountCredential.update({ where: { id: accountId }, data: { version: 2, encryptedConfiguration: '', revokedAt: new Date() } }))); const before = await control('summary'); unavailable(await inspect()); assert.deepEqual((await control('summary')).requests, before.requests); mutations.push('credential_zeroized_and_version_incremented'); });
  phase('final_checks');
  assert.deepEqual(await counts(), beforeCounts); assert.equal(await client.platformGithubAppCredential.count(), 0);
  for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(digest(fs.readFileSync(path.join(root, file))), hash, 'owned_ecs_source_bytes_changed');
  assert.equal(guard.report().denied, 0, 'unexpected_guard_denial');
  const installedPackages = {}; for (const name of ['@prisma/client', '@aws-sdk/client-sts', '@aws-sdk/client-ecs', '@aws-sdk/client-ecr', '@sigstore/bundle', '@sigstore/verify', '@sigstore/protobuf-specs']) installedPackages[name] = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
  const receipt = { nodeVersion: process.versions.node, installedPackages, dependencyQualification: 'existing_dependency_overlay_clean_lockfile_CI_remains_authoritative', kind: 'owned_ecs_checked_inputs', sourceCommit: process.env.AXIOM_OWNED_ECS_SOURCE_COMMIT, groups, groupCount: groups.length, sourceHashes, rootsBytesSha256: digest(trustedRootBytes), bundleSha256: digest(bundle), workflowSha256: digest(fs.readFileSync(path.join(fixtureDirectory, 'direct-workflow-oci/workflow.yml'))), fixtureProfile: { kind: profile.kind, reviewedAt: profile.reviewedAt, reviewExpiresAt: profile.reviewExpiresAt, trustedRootDigest: profile.trustedRootDigest, bundleOrigin: downloadPolicy[0].origin, qualification: 'explicit_owned_fixture_only_not_production_trust' }, guard: guard.report(), deliberateOwnedDbMutations: mutations, unchangedOperationCounts: beforeCounts,
    sourceOutcome: 'checked_subject_mismatch_not_usable_for_admission', evidenceScope: 'actual_source_native_wire_owned_synthetic_upstream', authentication: 'actual_hmac_and_current_durable_resolver_synthetic_session_not_browser_pairing', githubApp: 'synthetic_env_app_key_real_RS256_and_scoped_mint', database: 'constructor_bound_owned_postgres_not_universal_node_sandbox', notVerified: ['real_aws_or_github', 'genuine_ecr_proof', 'matched_admission', 'public_route_or_browser_pairing', 'aws_enrollment_or_disconnect_service', 'runtime_executor_quota_oidc_voters_health_rollback', 'expiry_inside_final_context_transaction', 'os_or_arbitrary_native_code_sandbox'] };
  diagnostic?.update({ guardDenied: receipt.guard.denied, mappedRequests: receipt.guard.mappedRequests, completedGroups: groups.length }); diagnostic?.write();
  fs.writeSync(1, JSON.stringify(receipt));
})().catch(error => { diagnostic?.fail(error); try { const report = guard.report(); diagnostic?.update({ guardDenied: report.denied, mappedRequests: report.mappedRequests }); } catch { /* Observation cannot replace the source failure. */ } diagnostic?.write(); fs.writeSync(2, 'owned_ecs_source_probe_failed:' + activeCase + '\n'); process.exitCode = 1; }).finally(async () => {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('owned_ecs_probe_closed')); } pending.clear();
  phase('disconnect', { cleanupDatabase: 'pending' });
  try { if (second) await second.$disconnect(); if (client) await client.$disconnect(); phase('disconnect', { cleanupDatabase: 'verified' }); }
  catch (error) { diagnostic?.fail(error); phase('disconnect', { cleanupDatabase: 'unverified' }); throw error; }
  if (priorLoader) require.extensions['.ts'] = priorLoader; else delete require.extensions['.ts'];
  if (process.connected) process.disconnect();
  diagnostic?.update({ outcome: 'completed' }); diagnostic?.write();
});
