# terraform-provider-v19 (preview)

Reads a V19 workspace's configuration into Terraform: environments (tier, tags, change window),
plain configuration variables and deployment checks, from `GET /api/v1/config`. It is read-only:
changes go through the V19 cockpit, where they are versioned and reviewed.

```hcl
provider "v19" {
  # endpoint = "https://visionxixlabs.com" # or your self-hosted address (V19_ENDPOINT)
  # api_key  = ...                        # a key with the config:read scope (V19_API_KEY)
}
data "v19_config" "workspace" {}
```

See `examples/main.tf`. Build with `go build`; CI runs `go vet` and `go test`.
Secret variables are references and are never resolved by this provider.
