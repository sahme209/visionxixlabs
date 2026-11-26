//
//  VisionXIXLabs.swift — Phase 399.
//
//  Drop-in Swift client for the VisionXIXLabs v1 API. Single file, zero
//  external dependencies — copy this into your Xcode project and you're
//  integrating in under a minute.
//
//  Works on iOS 13+, macOS 10.15+, watchOS 6+, tvOS 13+, visionOS 1+.
//  Uses only Foundation + CryptoKit (both Apple-standard).
//
//  Usage:
//
//      let client = VisionXIXLabs(apiKey: "vxlk_live_…")
//
//      // 1. Verify the key works (3-line integration test):
//      let me = try await client.whoami()
//      print("Signed in as \(me.organization.id) on \(me.organization.planTier)")
//
//      // 2. Read the release-gate verdict:
//      let gate = try await client.releaseGate()
//      if gate.gate?.passed != true { /* refuse to deploy */ }
//
//      // 3. Trigger a coding-pipeline run:
//      let run = try await client.startCodingRun(
//          instruction: "Add a /healthz route",
//          repoRef: "acme/example",
//          branchHint: "main"
//      )
//      print("Run started: \(run.runId)")
//
//      // 4. Verify a webhook delivery (in your receiver):
//      let verified = VisionXIXLabs.verifyWebhookSignature(
//          rawBody: rawBody,
//          signatureHex: req.headers["X-VXL-Signature"]!,
//          timestampSec: Int(req.headers["X-VXL-Timestamp"]!)!,
//          secret: yourEndpointSecret
//      )
//

import Foundation
import CryptoKit

// MARK: - Public entry point

public struct VisionXIXLabs {

    /// Base URL of the VisionXIXLabs API. Override for staging / self-hosted.
    public var baseUrl: URL
    /// Bearer token minted from the admin panel.
    public let apiKey: String
    /// Optional URLSession override (use a custom session for testing).
    public var session: URLSession

    public init(
        apiKey: String,
        baseUrl: URL = URL(string: "https://visionxixlabs.com")!,
        session: URLSession = .shared
    ) {
        self.apiKey = apiKey
        self.baseUrl = baseUrl
        self.session = session
    }

    // MARK: - Endpoints

    /// GET /api/v1/whoami — confirms the key + reports workspace + quota.
    public func whoami() async throws -> WhoamiResponse {
        try await get("/api/v1/whoami")
    }

    /// GET /api/v1/release-gate — current release-gate verdict.
    public func releaseGate() async throws -> ReleaseGateResponse {
        try await get("/api/v1/release-gate")
    }

    /// GET /api/v1/environments/{slug}/variables — resolved configuration and fingerprint.
    /// Required scope: `pipeline:read`.
    /// GET /api/v1/config — environments, variable sets, variables and checks as code. Scope: config:read.
    public func workspaceConfig() async throws -> WorkspaceConfigResponse {
        try await get("/api/v1/config")
    }

    public func environmentVariables(slug: String) async throws -> EnvironmentVariablesResponse {
        try await get("/api/v1/environments/\(slug.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? slug)/variables")
    }

    /// POST /api/v1/environments/freeze — stop deployments now, e.g. from an incident workflow.
    /// Required scope: `freeze:start`. `scope` is "production" or "all"; `hours` is 1 to 24.
    public func freezeDeployments(scope: String, hours: Int, reason: String, idempotencyKey: String? = nil) async throws -> FreezeDeploymentsResponse {
        var body: [String: Any] = ["scope": scope, "hours": hours, "reason": reason]
        if let idempotencyKey { body["idempotencyKey"] = idempotencyKey }
        return try await post("/api/v1/environments/freeze", body: body)
    }

    /// POST /api/v1/checks/results — report one deployment check run from CI as evidence.
    /// Required scope: `checks:report`. Idempotent on `idempotencyKey`.
    public func reportCheckResult(checkKey: String, checkVersion: Int, stage: String, status: String, idempotencyKey: String, durationMs: Int? = nil, runUrl: String? = nil) async throws -> CheckResultResponse {
        var body: [String: Any] = ["checkKey": checkKey, "checkVersion": checkVersion, "stage": stage, "status": status, "idempotencyKey": idempotencyKey]
        if let durationMs { body["durationMs"] = durationMs }
        if let runUrl { body["runUrl"] = runUrl }
        return try await post("/api/v1/checks/results", body: body)
    }

    /// GET /api/v1/pipelines/runs/{id} — poll a pipeline run's status.
    public func pipelineRun(id: String) async throws -> PipelineRunResponse {
        try await get("/api/v1/pipelines/runs/\(id)")
    }

    /// POST /api/v1/pipelines/runs/{id}/decide — vote on a paused stage.
    ///
    /// Pipeline gates default to `requiredApprovers=2`. A single call
    /// records ONE vote; `isTerminal` is true only when this call tipped
    /// the projected quorum and the run advanced.
    ///
    /// Required scope: `pipeline:trigger`.
    public func decideApproval(
        runId: String,
        decision: ApprovalDecision,
        reason: String? = nil,
        approverUserId: String? = nil
    ) async throws -> DecideApprovalResponse {
        var body: [String: Any] = ["decision": decision.rawValue]
        if let reason { body["reason"] = reason }
        if let approverUserId { body["approverUserId"] = approverUserId }
        return try await post("/api/v1/pipelines/runs/\(runId)/decide", body: body, extraHeaders: [:])
    }

    /// POST /api/v1/pipelines/runs — trigger a coding pipeline run.
    ///
    /// Pass `idempotencyKey` (UUID or any 8-255 char ASCII id) to make
    /// the call safely retryable: a duplicate call with the same key
    /// and body returns the cached response instead of firing twice.
    public func startCodingRun(
        instruction: String,
        repoRef: String,
        branchHint: String? = nil,
        metadata: [String: String] = [:],
        idempotencyKey: String? = nil
    ) async throws -> StartRunResponse {
        var body: [String: Any] = [
            "pipelineId": "ai_coding",
            "instruction": instruction,
            "repoRef": repoRef,
        ]
        if let branchHint { body["branchHint"] = branchHint }
        if !metadata.isEmpty { body["metadata"] = metadata }
        var extra: [String: String] = [:]
        if let idempotencyKey { extra["Idempotency-Key"] = idempotencyKey }
        return try await post("/api/v1/pipelines/runs", body: body, extraHeaders: extra)
    }

    // MARK: - Agent governance gateway (A10)

    /// POST /api/v1/governance/check — may an agent do this? Stores nothing. Scope: governance:read.
    public func checkAgentAction(actionKind: String, target: String, summary: String, environment: String = "unknown", agentName: String? = nil, changedFiles: [String] = []) async throws -> AgentPolicyResponse {
        try await post("/api/v1/governance/check", body: Self.agentAction(actionKind, target, summary, environment, agentName, changedFiles))
    }

    /// POST /api/v1/governance/requests — request approval for one exact action. Scope: governance:request.
    /// `model` and `tools` are optional change-passport facts; they never change what is approved.
    public func requestAgentApproval(actionKind: String, target: String, summary: String, environment: String = "unknown", agentName: String? = nil, changedFiles: [String] = [], model: String? = nil, tools: [String] = []) async throws -> AgentRequestResponse {
        var body = Self.agentAction(actionKind, target, summary, environment, agentName, changedFiles)
        if let model { body["model"] = model }
        if !tools.isEmpty { body["tools"] = tools }
        return try await post("/api/v1/governance/requests", body: body)
    }

    /// GET /api/v1/governance/requests/{id} — proceed only when `request.mayProceed` is true. Scope: governance:read.
    public func getAgentApproval(id: String) async throws -> AgentRequestResponse {
        try await get("/api/v1/governance/requests/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)")
    }

    /// POST /api/v1/governance/requests/{id}/outcome — outcome: succeeded | failed | abandoned. Scope: governance:request.
    public func recordAgentOutcome(id: String, outcome: String, detail: String? = nil) async throws -> AgentRequestResponse {
        var body: [String: Any] = ["outcome": outcome]
        if let detail { body["detail"] = detail }
        return try await post("/api/v1/governance/requests/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)/outcome", body: body)
    }

    private static func agentAction(_ kind: String, _ target: String, _ summary: String, _ env: String, _ agentName: String?, _ changedFiles: [String]) -> [String: Any] {
        var body: [String: Any] = ["actionKind": kind, "target": target, "summary": summary, "environment": env]
        if let agentName { body["agentName"] = agentName }
        if !changedFiles.isEmpty { body["changedFiles"] = changedFiles }
        return body
    }

    // MARK: - Webhook signature verification

    /// Verify an inbound webhook delivery's HMAC-SHA256 signature.
    ///
    /// Canonical signed payload is `"<timestampSec>.<rawBody>"`, matching
    /// the platform's `signWebhookPayload` helper. Returns `true` only
    /// when both the signature matches AND the timestamp is within the
    /// tolerance window (default ±5 minutes — guards against replay).
    public static func verifyWebhookSignature(
        rawBody: String,
        signatureHex: String,
        timestampSec: Int,
        secret: String,
        toleranceSec: Int = 300,
        now: Date = Date()
    ) -> Bool {
        let nowSec = Int(now.timeIntervalSince1970)
        let skew = abs(nowSec - timestampSec)
        guard skew <= toleranceSec else { return false }

        let payload = "\(timestampSec).\(rawBody)"
        guard
            let payloadData = payload.data(using: .utf8),
            let secretData = secret.data(using: .utf8),
            let expectedBytes = hmacSha256Hex(key: secretData, message: payloadData) as String?
        else { return false }

        return constantTimeEqual(expectedBytes, signatureHex)
    }

    // MARK: - Internal HTTP

    private func get<T: Decodable>(_ path: String) async throws -> T {
        var req = URLRequest(url: baseUrl.appendingPathComponent(path))
        req.httpMethod = "GET"
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("VisionXIXLabs-Swift/1.0", forHTTPHeaderField: "User-Agent")
        return try await execute(req)
    }

    private func post<T: Decodable>(
        _ path: String,
        body: [String: Any],
        extraHeaders: [String: String] = [:]
    ) async throws -> T {
        var req = URLRequest(url: baseUrl.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("VisionXIXLabs-Swift/1.0", forHTTPHeaderField: "User-Agent")
        for (k, v) in extraHeaders { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        return try await execute(req)
    }

    private func execute<T: Decodable>(_ req: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw VXLError.invalidResponse
        }

        if http.statusCode == 429 {
            let retry = http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init)
            throw VXLError.rateLimited(retryAfterSeconds: retry)
        }
        guard (200...299).contains(http.statusCode) else {
            // Try to extract the closed-union error code.
            if let envelope = try? JSONDecoder().decode(ErrorEnvelope.self, from: data) {
                throw VXLError.apiError(
                    status: http.statusCode,
                    code: envelope.error,
                    message: envelope.message
                )
            }
            throw VXLError.httpError(status: http.statusCode)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }

    // MARK: - HMAC helpers

    private static func hmacSha256Hex(key: Data, message: Data) -> String {
        let mac = HMAC<SHA256>.authenticationCode(for: message, using: SymmetricKey(data: key))
        return mac.map { String(format: "%02x", $0) }.joined()
    }

    /// Length-safe + constant-time hex string compare.
    private static func constantTimeEqual(_ a: String, _ b: String) -> Bool {
        let aLower = a.lowercased()
        let bLower = b.lowercased()
        guard aLower.utf8.count == bLower.utf8.count else { return false }
        var diff: UInt8 = 0
        for (x, y) in zip(aLower.utf8, bLower.utf8) {
            diff |= x ^ y
        }
        return diff == 0
    }
}

// MARK: - Response types (closed-union match for the platform)

public struct WhoamiResponse: Decodable {
    public let ok: Bool
    public let apiKey: ApiKeyInfo
    public let organization: OrganizationInfo
    public let quota: QuotaInfo
    public let serverTimeSec: Int

    public struct ApiKeyInfo: Decodable {
        public let id: String
        public let env: String
        public let scopes: [String]
    }
    public struct OrganizationInfo: Decodable {
        public let id: String
        public let planTier: String
    }
    public struct QuotaInfo: Decodable {
        public let monthlyLimit: Int?
        public let currentCalls: Int
        public let remaining: Int?
        public let ratio: Double?
        public let nearLimit: Bool
    }
}

public struct WorkspaceConfigResponse: Decodable {
    public struct Environment: Decodable { public let slug: String; public let name: String; public let tier: String; public let tags: [String] }
    public struct VariableSet: Decodable { public let slug: String; public let name: String; public let selector: String; public let version: Int }
    public struct Variable: Decodable { public let key: String; public let value: String; public let version: Int; public let scope: String; public let set: String?; public let environment: String? }
    public let ok: Bool
    public let environments: [Environment]
    public let variableSets: [VariableSet]
    public let variables: [Variable]
}

public struct EnvironmentVariablesResponse: Decodable {
    public struct Environment: Decodable { public let slug: String; public let name: String }
    public let ok: Bool
    public let environment: Environment
    /// Resolved plain configuration. Never secrets.
    public let variables: [String: String]
    /// "workspace", "set" or "environment" per key.
    public let sources: [String: String]
    /// SHA-256 fingerprint of the resolved set.
    public let digest: String
    public let count: Int
    public struct Conflict: Decodable { public let key: String; public let sets: [String] }
    /// Keys that matching variable sets define differently; nil when none.
    public let conflicts: [Conflict]?
    public struct SecretRef: Decodable { public let provider: String; public let path: String; public let field: String? }
    /// Variables whose value is a secret reference; V19 never resolves them.
    public let secretRefs: [String: SecretRef]?
}

public struct FreezeDeploymentsResponse: Decodable {
    public let ok: Bool
    public let environments: [String]?
    public let skipped: [String]?
    public let endsAt: String?
    public let duplicate: Bool?
}

public struct CheckResultResponse: Decodable {
    public let ok: Bool
    public let recorded: Bool
    public let duplicate: Bool?
    public let currentVersion: Int?
    public let stale: Bool?
}

public struct ReleaseGateResponse: Decodable {
    public let ok: Bool
    public let hasRun: Bool
    public let gate: Gate?
    public let regressionCount: Int?
    public let improvementCount: Int?

    public struct Gate: Decodable {
        public let passed: Bool
        public let passRate: Double
        public let averageScore: Double
        public let summary: String
    }
}

public struct StartRunResponse: Decodable {
    public let ok: Bool
    public let runId: String
    public let correlationId: String
    public let status: String
    public let pollUrl: String
}

public struct PipelineRunResponse: Decodable {
    public let ok: Bool
    public let run: Run

    public struct Run: Decodable {
        public let id: String
        public let pipelineId: String
        public let status: String
        public let triggeredBy: String
        public let correlationId: String
        public let startedAt: String
        public let completedAt: String?
        public let errorSummary: String?
        public let stages: [Stage]
    }
    public struct Stage: Decodable {
        public let id: String
        public let stageId: String
        public let stageKind: String
        public let ordering: Int
        public let status: String
        public let completedAt: String?
        public let errorMessage: String?
    }
}

public enum ApprovalDecision: String {
    case approved
    case rejected
}

public struct DecideApprovalResponse: Decodable {
    public let ok: Bool
    public let runId: String
    public let approvalId: String
    public let vote: String
    public let snapshotStatus: String
    public let approvedCount: Int
    public let rejectedCount: Int
    public let requiredApprovers: Int
    /// True only when this call's vote tipped the projected quorum to terminal.
    public let isTerminal: Bool
    public let decidedAt: String?
    public let stageTransitioned: Bool
}

private struct ErrorEnvelope: Decodable {
    let error: String
    let message: String?
}

// MARK: - Errors

public enum VXLError: Error, CustomStringConvertible {
    case invalidResponse
    case httpError(status: Int)
    case rateLimited(retryAfterSeconds: Int?)
    case apiError(status: Int, code: String, message: String?)

    public var description: String {
        switch self {
        case .invalidResponse:
            return "VisionXIXLabs: invalid HTTP response."
        case .httpError(let status):
            return "VisionXIXLabs: HTTP \(status)."
        case .rateLimited(let retry):
            return "VisionXIXLabs: rate-limited (retry after \(retry ?? -1)s)."
        case .apiError(let status, let code, let message):
            return "VisionXIXLabs: HTTP \(status) · \(code) · \(message ?? "")"
        }
    }
}


// MARK: - Agent governance gateway types

public struct AgentPolicy: Decodable { public let decision: String; public let riskLevel: String; public let reasons: [String] }
public struct AgentPolicyResponse: Decodable { public let ok: Bool; public let policy: AgentPolicy?; public let error: String? }
public struct AgentRequest: Decodable {
    public let id: String; public let status: String; public let mayProceed: Bool; public let reason: String
    public let policyDecision: String; public let riskLevel: String; public let actionDigest: String; public let expiresAt: String; public let outcome: String?
}
public struct AgentRequestResponse: Decodable { public let ok: Bool; public let request: AgentRequest?; public let error: String? }
