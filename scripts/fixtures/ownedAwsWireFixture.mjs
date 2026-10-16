import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

// Owned AWS Query/XML protocol fixture; no SDK constructor or product override.
export async function startOwnedAwsWireFixture() {
  const proof = randomBytes(16).toString("hex");
  const accountId = "123456789012";
  const roleArn = `arn:aws:iam::${accountId}:role/FixtureReadOnly`;
  const brokerKey = "AKIDFIXTUREONLY123456";
  const secret = "synthetic-only-never-valid-cloud-credential";
  const sessions = new Map();
  const ready = new Set();
  const sequences = new Map();
  const calls = [];
  let externalId;
  let violation = false;
  const server = createServer(async (request, response) => {
    try {
      assert.equal(request.method, "POST");
      assert.equal(request.headers["x-axiom-fixture-guard"], proof, "builtin_guard_stamp_required");
      let body = "";
      for await (const chunk of request) { body += chunk; assert.ok(body.length < 16_384); }
      if (request.url === "/__fixture_guard_ready") {
        const notice = JSON.parse(body);
        assert.equal(notice.kind, "builtin_http_guard_ready"); assert.ok(Number.isSafeInteger(notice.pid));
        ready.add(String(notice.pid)); response.writeHead(200).end("ok"); return;
      }
      assert.equal(request.url, "/");
      const pid = request.headers["x-axiom-fixture-process"];
      const sequence = Number(request.headers["x-axiom-fixture-sequence"]);
      assert.ok(ready.has(pid), "guard_ready_before_cloud_io_required");
      assert.equal(sequence, (sequences.get(pid) ?? 0) + 1, "every_sdk_request_must_match_guard_counter");
      sequences.set(pid, sequence);
      const params = new URLSearchParams(body);
      const action = params.get("Action");
      assert.ok(["AssumeRole", "GetCallerIdentity", "DescribeInstances"].includes(action), "provider_writes_forbidden");
      calls.push(action);
      const key = request.headers.authorization?.match(/Credential=([^/]+)\//)?.[1];
      let result;
      if (action === "AssumeRole") {
        assert.equal(key, brokerKey); assert.equal(params.get("RoleArn"), roleArn);
        assert.ok(externalId); assert.equal(params.get("ExternalId"), externalId);
        const name = params.get("RoleSessionName");
        assert.match(name, /^[A-Za-z0-9_.-]{1,64}$/);
        const assumedArn = `arn:aws:sts::${accountId}:assumed-role/FixtureReadOnly/${name}`;
        const temporaryKey = `ASIAFIXTURE${String(sessions.size + 1).padStart(9, "0")}`;
        const temporaryToken = `synthetic-session-${sessions.size + 1}`;
        sessions.set(temporaryKey, { arn: assumedArn, token: temporaryToken });
        result = `<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleResult><Credentials><AccessKeyId>${temporaryKey}</AccessKeyId><SecretAccessKey>${secret}</SecretAccessKey><SessionToken>${temporaryToken}</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials><AssumedRoleUser><AssumedRoleId>FIXTURE:${name}</AssumedRoleId><Arn>${assumedArn}</Arn></AssumedRoleUser></AssumeRoleResult><ResponseMetadata><RequestId>fixture-assume</RequestId></ResponseMetadata></AssumeRoleResponse>`;
      } else {
        const assumed = sessions.get(key);
        assert.ok(assumed); assert.equal(request.headers["x-amz-security-token"], assumed.token);
        if (action === "GetCallerIdentity") {
          result = `<GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><GetCallerIdentityResult><Arn>${assumed.arn}</Arn><Account>${accountId}</Account><UserId>FIXTURE</UserId></GetCallerIdentityResult><ResponseMetadata><RequestId>fixture-identity</RequestId></ResponseMetadata></GetCallerIdentityResponse>`;
        } else {
          assert.equal(params.get("MaxResults"), "5");
          result = `<DescribeInstancesResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/"><requestId>fixture-inventory</requestId><reservationSet><item><reservationId>r-fixture</reservationId><instancesSet><item><instanceId>i-fixture</instanceId><instanceType>t3.micro</instanceType><instanceState><code>16</code><name>running</name></instanceState><placement><availabilityZone>us-east-1a</availabilityZone></placement></item></instancesSet></item></reservationSet><nextToken>fixture-next-page</nextToken></DescribeInstancesResponse>`;
        }
      }
      response.writeHead(200, { "content-type": "text/xml" }).end(result);
    } catch { violation = true; response.writeHead(400).end("fixture_protocol_rejected"); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { origin, proof, accountId, roleArn, brokerKey, secret, encryptionSecret: randomBytes(32).toString("hex"),
    allowEnrollment(value) { assert.ok(typeof value === "string" && value.length >= 16 && !externalId); externalId = value; },
    assertReady() { assert.ok(ready.size > 0, "preloaded_http_guard_not_ready"); assert.equal(violation, false, "wire_fixture_protocol_violation"); },
    async waitUntilReady() {
      const deadline = Date.now() + 3000;
      while (ready.size === 0 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
      this.assertReady();
    },
    report() { assert.equal(violation, false, "wire_fixture_protocol_violation"); assert.equal([...sequences.values()].reduce((sum, value) => sum + value, 0), calls.length); return { requests: [...calls], guardedRequests: calls.length, guardedProcesses: sequences.size, realAwsAccount: false, universalNetworkIsolation: false }; },
    async close() {
      await new Promise((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error("owned_aws_fixture_close_timeout")), 2000);
        server.close(error => { clearTimeout(deadline); if (error && error.code !== "ERR_SERVER_NOT_RUNNING") reject(error); else resolve(); });
        server.closeIdleConnections();
        server.closeAllConnections();
      });
    },
  };
}
