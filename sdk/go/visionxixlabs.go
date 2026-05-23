// Package visionxixlabs — Phase 399.
//
// Drop-in Go client for the VisionXIXLabs v1 API.
// Zero external dependencies — uses only crypto/hmac, crypto/sha256,
// encoding/hex, encoding/json, net/http. Works on Go 1.21+.
//
// Usage:
//
//	client := visionxixlabs.New("vxlk_live_...")
//
//	// 1. 3-line integration test:
//	me, err := client.Whoami(ctx)
//	if err != nil { log.Fatal(err) }
//	log.Printf("Signed in as %s on %s\n", me.Organization.ID, me.Organization.PlanTier)
//
//	// 2. CI deploy gate:
//	gate, err := client.ReleaseGate(ctx)
//	if err != nil || gate.Gate == nil || !gate.Gate.Passed { os.Exit(1) }
//
//	// 3. Trigger a coding run:
//	run, err := client.StartCodingRun(ctx, visionxixlabs.StartCodingRunInput{
//	    Instruction: "Add a /healthz route",
//	    RepoRef:     "acme/example",
//	    BranchHint:  "main",
//	})
//
//	// 4. Verify a webhook (in your receiver):
//	ok := visionxixlabs.VerifyWebhookSignature(
//	    rawBody, sigHex, tsSec, endpointSecret, 300,
//	)
package visionxixlabs

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// ============================ client ============================

const defaultBaseURL = "https://visionxixlabs.com"

type Client struct {
	APIKey  string
	BaseURL string
	HTTP    *http.Client
}

func New(apiKey string) *Client {
	return &Client{
		APIKey:  apiKey,
		BaseURL: defaultBaseURL,
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

// ============================ response types ============================

type WhoamiResponse struct {
	OK           bool         `json:"ok"`
	APIKey       APIKeyInfo   `json:"apiKey"`
	Organization OrgInfo      `json:"organization"`
	Quota        QuotaInfo    `json:"quota"`
	ServerTimeSec int64       `json:"serverTimeSec"`
}

type APIKeyInfo struct {
	ID     string   `json:"id"`
	Env    string   `json:"env"`
	Scopes []string `json:"scopes"`
}

type OrgInfo struct {
	ID       string `json:"id"`
	PlanTier string `json:"planTier"`
}

type QuotaInfo struct {
	MonthlyLimit *int     `json:"monthlyLimit"`
	CurrentCalls int      `json:"currentCalls"`
	Remaining    *int     `json:"remaining"`
	Ratio        *float64 `json:"ratio"`
	NearLimit    bool     `json:"nearLimit"`
}

type ReleaseGateResponse struct {
	OK               bool        `json:"ok"`
	HasRun           bool        `json:"hasRun"`
	Gate             *Gate       `json:"gate"`
	RegressionCount  *int        `json:"regressionCount"`
	ImprovementCount *int        `json:"improvementCount"`
}

type Gate struct {
	Passed       bool       `json:"passed"`
	PassRate     float64    `json:"passRate"`
	AverageScore float64    `json:"averageScore"`
	Summary      string     `json:"summary"`
	Blockers     []Blocker  `json:"blockers"`
}

type Blocker struct {
	Kind    string `json:"kind"`
	Message string `json:"message"`
}

type StartRunResponse struct {
	OK            bool   `json:"ok"`
	RunID         string `json:"runId"`
	CorrelationID string `json:"correlationId"`
	Status        string `json:"status"`
	PollURL       string `json:"pollUrl"`
}

type StartCodingRunInput struct {
	Instruction string
	RepoRef     string
	BranchHint  string
	Metadata    map[string]string
}

type PipelineRunResponse struct {
	OK  bool        `json:"ok"`
	Run PipelineRun `json:"run"`
}

type PipelineRun struct {
	ID            string  `json:"id"`
	PipelineID    string  `json:"pipelineId"`
	Status        string  `json:"status"`
	TriggeredBy   string  `json:"triggeredBy"`
	CorrelationID string  `json:"correlationId"`
	StartedAt     string  `json:"startedAt"`
	CompletedAt   *string `json:"completedAt"`
	ErrorSummary  *string `json:"errorSummary"`
	Stages        []Stage `json:"stages"`
}

type DecideApprovalInput struct {
	Decision        string // "approved" | "rejected"
	Reason          string
	ApproverUserID  string // optional override; defaults to api_key:<id>
}

type DecideApprovalResponse struct {
	OK                bool    `json:"ok"`
	RunID             string  `json:"runId"`
	ApprovalID        string  `json:"approvalId"`
	Vote              string  `json:"vote"`
	SnapshotStatus    string  `json:"snapshotStatus"`
	ApprovedCount     int     `json:"approvedCount"`
	RejectedCount     int     `json:"rejectedCount"`
	RequiredApprovers int     `json:"requiredApprovers"`
	IsTerminal        bool    `json:"isTerminal"`
	DecidedAt         *string `json:"decidedAt"`
	StageTransitioned bool    `json:"stageTransitioned"`
}

type Stage struct {
	ID           string  `json:"id"`
	StageID      string  `json:"stageId"`
	StageKind    string  `json:"stageKind"`
	Ordering     int     `json:"ordering"`
	Status       string  `json:"status"`
	CompletedAt  *string `json:"completedAt"`
	ErrorMessage *string `json:"errorMessage"`
}

// ============================ errors ============================

type APIError struct {
	Status            int
	Code              string
	Message           string
	RetryAfterSeconds int // 0 when not present
}

func (e *APIError) Error() string {
	return fmt.Sprintf("visionxixlabs: HTTP %d · %s · %s", e.Status, e.Code, e.Message)
}

// ============================ endpoints ============================

func (c *Client) Whoami(ctx context.Context) (*WhoamiResponse, error) {
	var out WhoamiResponse
	if err := c.do(ctx, "GET", "/api/v1/whoami", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) ReleaseGate(ctx context.Context) (*ReleaseGateResponse, error) {
	var out ReleaseGateResponse
	if err := c.do(ctx, "GET", "/api/v1/release-gate", nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) PipelineRun(ctx context.Context, runID string) (*PipelineRunResponse, error) {
	var out PipelineRunResponse
	path := "/api/v1/pipelines/runs/" + runID
	if err := c.do(ctx, "GET", path, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// DecideApproval votes on a pipeline run currently paused at an
// awaiting_approval stage. Pipeline gates default to
// requiredApprovers=2 — a single call records ONE vote. The response's
// IsTerminal is true only when this call tipped the projected quorum.
//
// Required scope: pipeline:trigger.
func (c *Client) DecideApproval(ctx context.Context, runID string, in DecideApprovalInput) (*DecideApprovalResponse, error) {
	body := map[string]any{"decision": in.Decision}
	if in.Reason != "" {
		body["reason"] = in.Reason
	}
	if in.ApproverUserID != "" {
		body["approverUserId"] = in.ApproverUserID
	}
	var out DecideApprovalResponse
	path := "/api/v1/pipelines/runs/" + runID + "/decide"
	if err := c.do(ctx, "POST", path, body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *Client) StartCodingRun(ctx context.Context, in StartCodingRunInput) (*StartRunResponse, error) {
	body := map[string]any{
		"pipelineId":  "ai_coding",
		"instruction": in.Instruction,
		"repoRef":     in.RepoRef,
	}
	if in.BranchHint != "" {
		body["branchHint"] = in.BranchHint
	}
	if len(in.Metadata) > 0 {
		body["metadata"] = in.Metadata
	}
	var out StartRunResponse
	if err := c.do(ctx, "POST", "/api/v1/pipelines/runs", body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ============================ internal HTTP ============================

func (c *Client) do(ctx context.Context, method, path string, body any, out any) error {
	url := strings.TrimSuffix(c.BaseURL, "/") + path
	var reqBody io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(buf)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("User-Agent", "VisionXIXLabs-Go/1.0")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		apiErr := &APIError{
			Status:  resp.StatusCode,
			Code:    "http_error",
			Message: string(respBody),
		}
		// Try to parse the closed-union error envelope.
		var envelope struct {
			Error   string `json:"error"`
			Message string `json:"message"`
		}
		if json.Unmarshal(respBody, &envelope) == nil {
			if envelope.Error != "" {
				apiErr.Code = envelope.Error
			}
			if envelope.Message != "" {
				apiErr.Message = envelope.Message
			}
		}
		if retry := resp.Header.Get("Retry-After"); retry != "" {
			if secs, err := strconv.Atoi(retry); err == nil {
				apiErr.RetryAfterSeconds = secs
			}
		}
		return apiErr
	}

	if out == nil {
		return nil
	}
	return json.Unmarshal(respBody, out)
}

// ============================ webhook signature ============================

// VerifyWebhookSignature checks the HMAC-SHA256 signature on an inbound
// webhook delivery. Returns true only when both the signature matches AND
// the timestamp is within toleranceSec of "now" (use 0 for "now is now()").
func VerifyWebhookSignature(
	rawBody string,
	signatureHex string,
	timestampSec int64,
	secret string,
	toleranceSec int64,
) bool {
	return VerifyWebhookSignatureAt(rawBody, signatureHex, timestampSec, secret, toleranceSec, time.Now())
}

// VerifyWebhookSignatureAt is the testable variant that takes an explicit
// "now". Use VerifyWebhookSignature in production.
func VerifyWebhookSignatureAt(
	rawBody string,
	signatureHex string,
	timestampSec int64,
	secret string,
	toleranceSec int64,
	now time.Time,
) bool {
	if toleranceSec <= 0 {
		toleranceSec = 300
	}
	nowSec := now.Unix()
	skew := nowSec - timestampSec
	if skew < 0 {
		skew = -skew
	}
	if skew > toleranceSec {
		return false
	}

	payload := fmt.Sprintf("%d.%s", timestampSec, rawBody)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expected := hex.EncodeToString(mac.Sum(nil))

	provided := strings.ToLower(signatureHex)
	if len(expected) != len(provided) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(expected), []byte(provided)) == 1
}
