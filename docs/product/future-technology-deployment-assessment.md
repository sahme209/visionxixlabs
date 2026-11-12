# Future technology assessment — scheduling clarification

**Status: first source-backed owner-review draft produced; no adoption authorized.** See [results](../research/2026-11-11/future-technology-assessment.md) and source bindings. All eight areas and named technology groups are addressed with explicit source/operational limits; customer demand, version/live/security qualification remain open. On November 11, 2026, the owner explicitly clarified: **“During gaps, without delaying current priorities.”** This supersedes only the attached brief's timing requirement to wait for completion of the entire master plan. All other assessment requirements and execution boundaries below remain intact. Adding this brief was explicitly authorized; it does not authorize implementing its recommendations or creating implementation tickets.

Use genuine gaps while the current sequence awaits an external result or owner decision. Do not delay authorized implementation, verification or PR completion. First reconcile each topic with the actual implementation and existing integration roadmap. Distinguish verified support, partial support, planned work and unsupported capabilities. Record evidence and uncertainties; no security, customer or future-readiness claims without proof.

No new paid research, infrastructure, installation, provider changes, credentials, production actions or implementation are authorized. Any action outside existing permissions still requires its own approval. Deliver the assessment for owner review before any follow-up work. This remains a research starting point, not a mandatory feature backlog or a completed master-plan parent.

The original user-supplied brief is preserved verbatim below; its original deferred timing is superseded only by the clarification above.

---

# Axiom — Future Technology & Deployment Assessment

**Execute this assessment only after the existing Axiom Master Action Plan has been fully completed and verified.**

Do not interrupt, reprioritize, or expand any ongoing work to accommodate this request.

Once the master plan is complete, thoroughly examine Axiom's actual codebase, architecture, integrations, documentation, and implemented capabilities.

I want to understand how future-ready Axiom is and whether we should expand its capabilities to support emerging infrastructure, deployment, and enterprise technologies.

### Technologies to evaluate

**1. Containers and orchestration**
- Kubernetes, Docker, containerd
- Amazon EKS, ECS, Azure AKS, Google GKE
- Helm, Kustomize, K3s
- Multi-cluster orchestration

**2. Infrastructure automation**
- Terraform, OpenTofu, Pulumi
- Crossplane
- Infrastructure as Code
- Configuration management, including Ansible
- Infrastructure drift detection and reconciliation

**3. CI/CD and GitOps**
- GitHub Actions, GitLab CI/CD, Jenkins
- Azure DevOps, AWS CodePipeline
- Argo CD, Flux, Spinnaker, Harness
- Progressive delivery, canary releases, blue-green deployments, and rollback

**4. Modern application deployment**
- Serverless and Functions as a Service
- AWS Lambda, Azure Functions, Google Cloud Run
- Virtual machines and traditional application servers
- Hybrid cloud, private cloud, and on-premises infrastructure
- Edge computing and distributed deployments
- WebAssembly and lightweight application runtimes

**5. Platform engineering**
- Internal developer platforms
- Backstage and self-service developer portals
- Golden paths and reusable deployment templates
- Multi-cloud deployment management
- Environment provisioning and lifecycle management

**6. AI-native infrastructure**
- AI model deployment and inference serving
- KServe, KubeRay, and GPU orchestration
- AI agent deployment and lifecycle management
- Model versioning, monitoring, and rollback
- Intelligent deployment planning and troubleshooting
- Predictive failure detection and automated remediation

**7. Security, networking, and observability**
- Zero-trust architecture and least-privilege execution
- Policy as Code, OPA, and Kyverno
- Software supply-chain security, SBOMs, and artifact signing
- Secrets management and workload identity
- eBPF, Cilium, and modern cloud networking
- OpenTelemetry, Prometheus, and Grafana
- Automated compliance evidence and audit trails
- Disaster recovery and deployment resilience

**8. Emerging technologies and future trends**
- Event-driven architecture and autoscaling
- KEDA and workload-based scaling
- Multi-cloud and hybrid-cloud orchestration
- AI-assisted platform operations
- Autonomous deployment with human approval gates
- Emerging deployment technologies that may become important over the next 3–5 years

This list is a research starting point, not a mandatory feature backlog. Identify other relevant technologies where justified by evidence.

### Assessment requirements

For each technology or capability:

1. Determine whether Axiom already supports it, partially supports it, has it planned, or does not support it.
2. Verify findings against actual implementation evidence.
3. Explain whether supporting it would provide meaningful value to Axiom's target customers.
4. Determine whether integration, extension of existing functionality, or new development would be appropriate.
5. Identify architectural dependencies, security implications, maintenance burden, operating costs, and implementation complexity.
6. Evaluate whether it fits Axiom's existing product direction and nontechnical-user experience.
7. Recommend whether to adopt now, consider later, monitor, or avoid.

### Expected deliverable

Provide a concise but comprehensive assessment containing:

- Verified existing capabilities
- Genuine gaps and opportunities
- Technologies already covered by the master plan
- Recommended integrations and architectural approach
- Prioritized future roadmap suggestions
- Emerging technologies worth monitoring
- Risks, trade-offs, and unnecessary complexity to avoid

Distinguish verified facts from assumptions and future predictions. Support important recommendations with current technical documentation and credible industry research.

### Strict execution boundaries

- **Do not begin this review until the current master plan is complete.**
- Do not modify completed functionality.
- Do not introduce unnecessary features or duplicate existing capabilities.
- Do not modify the master plan or create implementation tickets without approval.
- Do not start implementation based on this assessment.
- Preserve Axiom's existing governance, security, usability, and architecture principles.
- Present recommendations for review before taking further action.

**Primary objective:** Determine how Axiom can remain competitive, scalable, secure, and technologically relevant over the next 3–5 years, while building on what we have already developed rather than starting over.