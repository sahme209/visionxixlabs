terraform {
  required_providers {
    v19 = {
      source = "visionxixlabs/v19"
    }
  }
}

# Reads V19_API_KEY (a key with the config:read scope) from the environment.
provider "v19" {}

data "v19_config" "workspace" {}

output "production_environments" {
  value = [for e in data.v19_config.workspace.environments : e.slug if e.tier == "prod"]
}

output "blocking_checks" {
  value = [for c in data.v19_config.workspace.checks : c.key if c.mode == "blocking" && c.enabled]
}

# Proposes the policy file. It applies only after a different owner or admin approves it in
# Governance → Policy as code; until then status is "pending". The key needs policy:propose.
resource "v19_policy" "workspace" {
  document = file("${path.module}/v19-policy.json")
}

output "policy_status" {
  value = v19_policy.workspace.status
}
