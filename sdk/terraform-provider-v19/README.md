# terraform-provider-v19 (preview)

Reads a V19 workspace's configuration into Terraform (environments, plain configuration variables and
deployment checks, from `GET /api/v1/config`), and manages the policy file through V19's review:
`v19_policy` proposes the file and it takes effect only after a different owner or admin approves it in
Governance → Policy as code. Until then the resource's `status` is `pending`; a rejected or stale
proposal shows as drift on the next plan. The person who created the API key counts as the proposer and
cannot approve their own change. Removing the resource leaves the policy in place.

```hcl
provider "v19" {
  # endpoint = "https://visionxixlabs.com" # or your self-hosted address (V19_ENDPOINT)
  # api_key  = ...                        # config:read, plus policy:propose for v19_policy (V19_API_KEY)
}
data "v19_config" "workspace" {}

resource "v19_policy" "workspace" {
  document = file("v19-policy.json") # download it from Governance → Policy as code
}
```

See `examples/main.tf`. Build with `go build`; CI runs `go vet` and `go test`.
Secret variables are references and are never resolved by this provider.
