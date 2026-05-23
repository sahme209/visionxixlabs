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
