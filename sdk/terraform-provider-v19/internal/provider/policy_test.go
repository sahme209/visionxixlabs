package provider

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/hashicorp/terraform-plugin-framework/types"
)

const current = `{"kind":"v19.policy","version":1,"rules":[{"key":"a","label":"A"},{"key":"b","label":"B"}]}`

func TestSamePolicyIgnoresKeyAndRuleOrder(t *testing.T) {
	reordered := `{"rules":[{"label":"B","key":"b"},{"key":"a","label":"A"}],"version":1,"kind":"v19.policy"}`
	if !SamePolicy(json.RawMessage(current), json.RawMessage(reordered)) {
		t.Fatal("expected equal")
	}
	if SamePolicy(json.RawMessage(current), json.RawMessage(`{"kind":"v19.policy","version":1,"rules":[]}`)) {
		t.Fatal("expected different")
	}
}

func TestReadStateAppliedPendingAndRejected(t *testing.T) {
	proposed := `{"kind":"v19.policy","version":1,"rules":[{"key":"a","label":"A"}]}`
	state := policyModel{Document: types.StringValue(proposed), RequestID: types.StringValue("req1"), Status: types.StringValue("pending")}
	pending := policyReadState(state, json.RawMessage(current), func(string) (PolicyRequest, error) { return PolicyRequest{ID: "req1", Status: "pending"}, nil })
	if pending.Status.ValueString() != "pending" || pending.Document.ValueString() != proposed {
		t.Fatalf("pending: %+v", pending)
	}
	rejected := policyReadState(state, json.RawMessage(current), func(string) (PolicyRequest, error) { return PolicyRequest{ID: "req1", Status: "rejected"}, nil })
	if rejected.Status.ValueString() != "rejected" || rejected.Document.ValueString() != current {
		t.Fatalf("rejected should show the policy in force as drift: %+v", rejected)
	}
	unreadable := policyReadState(state, json.RawMessage(current), func(string) (PolicyRequest, error) { return PolicyRequest{}, errors.New("x") })
	if unreadable.Document.ValueString() != current {
		t.Fatal("an unreadable request must not hide drift")
	}
	applied := policyReadState(policyModel{Document: types.StringValue(current), RequestID: types.StringValue("req1")}, json.RawMessage(current), nil)
	if applied.Status.ValueString() != "applied" || applied.RequestID.ValueString() != "" {
		t.Fatalf("applied: %+v", applied)
	}
}

func TestProposePolicyPostsTheDocument(t *testing.T) {
	var got map[string]json.RawMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/v1/policy/requests" || r.Header.Get("Authorization") != "Bearer k" {
			t.Fatalf("unexpected %s %s", r.Method, r.URL.Path)
		}
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, &got)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"ok":true,"request":{"id":"req9","status":"pending","loosens":true}}`))
	}))
	defer srv.Close()
	req, unchanged, err := (&Client{Endpoint: srv.URL, APIKey: "k"}).ProposePolicy(context.Background(), json.RawMessage(current))
	if err != nil || unchanged || req.ID != "req9" || req.Status != "pending" || !req.Loosens {
		t.Fatalf("got %+v %v %v", req, unchanged, err)
	}
	if !strings.Contains(string(got["document"]), `"key":"a"`) {
		t.Fatalf("document not sent: %s", got["document"])
	}
}

func TestProposePolicyReportsIssues(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnprocessableEntity)
		_, _ = w.Write([]byte(`{"ok":false,"error":"policy_document_invalid","issues":["autopilot.deploy.environments.0: Invalid enum value"]}`))
	}))
	defer srv.Close()
	_, _, err := (&Client{Endpoint: srv.URL, APIKey: "k"}).ProposePolicy(context.Background(), json.RawMessage(`{}`))
	if err == nil || !strings.Contains(err.Error(), "Invalid enum value") {
		t.Fatalf("got %v", err)
	}
}
