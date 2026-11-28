package provider

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const sample = `{"ok":true,
 "environments":[{"slug":"prod","name":"Production","tier":"prod","tags":["region:us"],"changeWindow":{"weekdays":["Mon"]}},{"slug":"dev","name":"Dev","tier":"dev","tags":null,"changeWindow":null}],
 "variableSets":[],
 "variables":[{"key":"LOG_LEVEL","value":"info","version":2,"scope":"environment","environment":"prod"}],
 "checks":{"kind":"v19.checks","version":1,"checks":[{"key":"health","name":"Health","kind":"smoke_test","stage":"verify","mode":"blocking","enabled":true,"version":3,"spec":{"url":"https://x"}}]}}`

func TestReadConfigSendsTheKeyAndParses(t *testing.T) {
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		if r.URL.Path != "/api/v1/config" || r.Method != http.MethodGet {
			t.Fatalf("unexpected request %s %s", r.Method, r.URL.Path)
		}
		_, _ = w.Write([]byte(sample))
	}))
	defer srv.Close()
	cfg, err := (&Client{Endpoint: srv.URL, APIKey: "vxlk_test"}).ReadConfig(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if auth != "Bearer vxlk_test" {
		t.Fatalf("authorization header %q", auth)
	}
	m, diags := toModel(context.Background(), cfg)
	if diags.HasError() {
		t.Fatal(diags)
	}
	if len(m.Environments) != 2 || m.Environments[0].Slug.ValueString() != "prod" || m.Environments[1].ChangeWindowJSON.ValueString() != "" {
		t.Fatalf("environments %+v", m.Environments)
	}
	if !strings.Contains(m.Environments[0].ChangeWindowJSON.ValueString(), "Mon") {
		t.Fatal("change window not kept")
	}
	if m.Variables[0].Environment.ValueString() != "prod" || m.Variables[0].Set.ValueString() != "" {
		t.Fatalf("variables %+v", m.Variables)
	}
	if m.Checks[0].Version.ValueInt64() != 3 || !strings.Contains(m.Checks[0].SpecJSON.ValueString(), "https://x") {
		t.Fatalf("checks %+v", m.Checks)
	}
}

func TestReadConfigReportsRefusals(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"ok":false,"error":"insufficient_scope"}`))
	}))
	defer srv.Close()
	_, err := (&Client{Endpoint: srv.URL, APIKey: "k"}).ReadConfig(context.Background())
	if err == nil || !strings.Contains(err.Error(), "insufficient_scope") || !strings.Contains(err.Error(), "config:read") {
		t.Fatalf("got %v", err)
	}
}

func TestValidateEndpoint(t *testing.T) {
	for _, ok := range []string{"https://visionxixlabs.com", "https://v19.example.com/", "http://localhost:3000"} {
		if _, err := ValidateEndpoint(ok); err != nil {
			t.Fatalf("%s: %v", ok, err)
		}
	}
	for _, bad := range []string{"http://example.com", "https://user:pw@example.com", "ftp://x", "https://x?y=1", "not a url"} {
		if _, err := ValidateEndpoint(bad); err == nil {
			t.Fatalf("%s accepted", bad)
		}
	}
}
