package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Client reads a workspace's configuration from GET /api/v1/config. It never writes.
type Client struct {
	Endpoint string
	APIKey   string
	HTTP     *http.Client
}

type Environment struct {
	Slug         string          `json:"slug"`
	Name         string          `json:"name"`
	Tier         string          `json:"tier"`
	Tags         []string        `json:"tags"`
	ChangeWindow json.RawMessage `json:"changeWindow"`
}

type Variable struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Version     int64  `json:"version"`
	Scope       string `json:"scope"`
	Environment string `json:"environment,omitempty"`
	Set         string `json:"set,omitempty"`
}

type Check struct {
	Key     string          `json:"key"`
	Name    string          `json:"name"`
	Kind    string          `json:"kind"`
	Stage   string          `json:"stage"`
	Mode    string          `json:"mode"`
	Enabled bool            `json:"enabled"`
	Version int64           `json:"version"`
	Spec    json.RawMessage `json:"spec"`
}

type Config struct {
	OK           bool          `json:"ok"`
	Error        string        `json:"error"`
	Environments []Environment `json:"environments"`
	Variables    []Variable    `json:"variables"`
	Checks       struct {
		Checks []Check `json:"checks"`
	} `json:"checks"`
}

// ValidateEndpoint accepts only https addresses (or http on localhost, for a self-hosted test setup).
func ValidateEndpoint(raw string) (string, error) {
	u, err := url.Parse(strings.TrimRight(raw, "/"))
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "", fmt.Errorf("endpoint must be a plain https URL such as https://visionxixlabs.com")
	}
	local := u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1"
	if u.Scheme != "https" && !(u.Scheme == "http" && local) {
		return "", fmt.Errorf("endpoint must use https (http is allowed only for localhost)")
	}
	return u.String(), nil
}

func (c *Client) ReadConfig(ctx context.Context) (*Config, error) {
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 30 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.Endpoint+"/api/v1/config", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Accept", "application/json")
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("V19 could not be reached: %w", err)
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(body, &cfg); err != nil {
		return nil, fmt.Errorf("V19 returned an unreadable response (HTTP %d)", res.StatusCode)
	}
	if res.StatusCode != http.StatusOK || !cfg.OK {
		reason := cfg.Error
		if reason == "" {
			reason = http.StatusText(res.StatusCode)
		}
		return nil, fmt.Errorf("V19 refused the request (HTTP %d: %s). The API key needs the config:read scope", res.StatusCode, reason)
	}
	return &cfg, nil
}
