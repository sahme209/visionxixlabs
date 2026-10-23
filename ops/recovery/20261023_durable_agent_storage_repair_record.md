# Durable Agent storage recovery — 2026-10-23

Applied only `20261023_durable_agent_storage_only.sql`, SHA-256 `37211102f418cddc77631a1eac3555cf5a80bf5d940a57be4879b2ae612a7e27`, to production Neon project `odd-union-57413470`, main branch `br-holy-voice-ai303o8m`, endpoint `ep-small-mountain-ailw0kvt`, database `neondb` (PostgreSQL 17).

## Recovery evidence

A fresh private read-only actual-production logical backup was retained alongside the earlier identity backup. SHA-256 `156b9415b5e3c366f4ea33efb83132178bfa50637d6a252139899a916375e50b`, 1,147,563 bytes. Backup files remain private with owner-only permissions; no credentials or backup bytes belong in this repository.

The backup was restored to an owned Unix-socket-only local PostgreSQL 17 instance. Restore omitted ownership, ACLs, publications and subscriptions; this is logical data/schema recovery evidence, not full infrastructure or PITR recovery proof. The exact repair passed with all 134 preexisting public-table full-row fingerprints unchanged. New tables were empty with expected defaults and FK. Repeated application refused. A separate connection holding the installed Prisma migration advisory key caused the exact repair to refuse without creating storage. The owned local instance was stopped and removed.

Independent review found no remaining execution blocker. Fresh production read-only guards verified intended ownership matching User and WorkspaceAgentIdentity, no applicable custom table default ACLs, no enabled DDL event triggers, no active DDL and no old idle transaction. Execution used one Neon transaction with explicit project, branch, endpoint and database binding, the installed Prisma advisory key and a migration-ledger SHARE lock. The reviewed statements were sent intact; no unsafe historical migration was executed.

## Production postconditions

- Both DurableAgentWorkflow and DurableAgentWorkflowEvent exist; both had zero rows at the postcheck.
- Both owners match the existing User table owner.
- Workflow default is queued, attemptCount default is zero; event-to-workflow foreign key exists.
- No application task, permission, billing, identity or migration-history rows were written by this schema-only script.
- Historical failed identity migration remains unresolved with its original checksum; no durable migration ledger row was fabricated.

The application can write these tables after commit. This repairs missing storage, not proof of a real Agent task, worker execution, external automation or full migration-history convergence. Native acceptance remains blocked pending Mac unlock. No provider inference or spending was performed by this recovery.
