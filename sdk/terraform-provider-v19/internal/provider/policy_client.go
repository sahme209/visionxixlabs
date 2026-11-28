package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"sort"
	"time"
)

// PolicyRequest is a proposed policy change waiting for, or decided by, a workspace admin.
type PolicyRequest struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Loosens bool   `json:"loosens"`
}

type policyGetResponse struct {
	OK       bool            `json:"ok"`
	Error    string          `json:"error"`
	Document json.RawMessage `json:"document"`
	Digest   string          `json:"digest"`
}

type policyProposeResponse struct {
	OK        bool          `json:"ok"`
	Error     string        `json:"error"`
	Unchanged bool          `json:"unchanged"`
	Request   PolicyRequest `json:"request"`
	Issues    []string      `json:"issues"`
}

type policyRequestResponse struct {
	OK      bool          `json:"ok"`
	Error   string        `json:"error"`
	Request PolicyRequest `json:"request"`
}

func (c *Client) do(ctx context.Context, method, path string, body []byte, out any) (int, error) {
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.Endpoint+path, reader)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return 0, fmt.Errorf("V19 could not be reached: %w", err)
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return res.StatusCode, err
	}
	if err := json.Unmarshal(raw, out); err != nil {
		return res.StatusCode, fmt.Errorf("V19 returned an unreadable response (HTTP %d)", res.StatusCode)
	}
	return res.StatusCode, nil
}

// GetPolicy returns the workspace's current policy document.
func (c *Client) GetPolicy(ctx context.Context) (json.RawMessage, error) {
	var out policyGetResponse
	status, err := c.do(ctx, http.MethodGet, "/api/v1/policy", nil, &out)
	if err != nil {
		return nil, err
	}
	if status != http.StatusOK || !out.OK {
		return nil, fmt.Errorf("V19 refused the request (HTTP %d: %s). The API key needs the policy:propose scope", status, out.Error)
	}
	return out.Document, nil
}

// ProposePolicy submits a document. unchanged is true when it already matches the workspace's policy.
func (c *Client) ProposePolicy(ctx context.Context, document json.RawMessage) (req PolicyRequest, unchanged bool, err error) {
	body, err := json.Marshal(map[string]json.RawMessage{"document": document})
	if err != nil {
		return PolicyRequest{}, false, err
	}
	var out policyProposeResponse
	status, err := c.do(ctx, http.MethodPost, "/api/v1/policy/requests", body, &out)
	if err != nil {
		return PolicyRequest{}, false, err
	}
	if !out.OK {
		detail := out.Error
		if len(out.Issues) > 0 {
			detail = fmt.Sprintf("%s: %v", out.Error, out.Issues)
		}
		return PolicyRequest{}, false, fmt.Errorf("V19 refused the policy (HTTP %d: %s)", status, detail)
	}
	return out.Request, out.Unchanged, nil
}

// GetPolicyRequest reads a proposal's current status.
func (c *Client) GetPolicyRequest(ctx context.Context, id string) (PolicyRequest, error) {
	var out policyRequestResponse
	status, err := c.do(ctx, http.MethodGet, "/api/v1/policy/requests/"+url.PathEscape(id), nil, &out)
	if err != nil {
		return PolicyRequest{}, err
	}
	if status != http.StatusOK || !out.OK {
		return PolicyRequest{}, fmt.Errorf("V19 could not read policy request %s (HTTP %d: %s)", id, status, out.Error)
	}
	return out.Request, nil
}

// SamePolicy compares two documents semantically: key order and rule order do not matter.
func SamePolicy(a, b json.RawMessage) bool {
	na, errA := normalizePolicy(a)
	nb, errB := normalizePolicy(b)
	return errA == nil && errB == nil && reflect.DeepEqual(na, nb)
}

func normalizePolicy(raw json.RawMessage) (map[string]any, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	if rules, ok := doc["rules"].([]any); ok {
		sort.SliceStable(rules, func(i, j int) bool {
			ki, _ := rules[i].(map[string]any)["key"].(string)
			kj, _ := rules[j].(map[string]any)["key"].(string)
			return ki < kj
		})
	}
	return doc, nil
}
