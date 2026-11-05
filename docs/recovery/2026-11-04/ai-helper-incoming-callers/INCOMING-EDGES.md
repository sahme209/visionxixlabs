# Selected helper immediate incoming edges

This source-only query resolves16direct sites for12of33target functions. All returned caller and declaration bytes also match the current checkout. The full program was still the disclosed201stage, not a current whole-program build; two presentation/comment differences are recorded. No argument/prompt values were emitted.

| Caller | Enclosing function | Helper declaration |
| --- | --- | --- |
| `app/admin/growth/content/page.tsx:31` | `ContentPlannerPage` | `lib/growth/contentPlanner.ts::planContent` |
| `app/admin/growth/content/page.tsx:32` | `ContentPlannerPage` | `lib/growth/contentPlanner.ts::planContent` |
| `app/api/admin/growth/drafts/route.ts:42` | `POST` | `lib/growth/contentPlanner.ts::planContent` |
| `app/api/agents/run/route.ts:84` | `POST` | `lib/agents/contactResolutionAgent.ts::runContactResolutionAgent` |
| `app/api/cloud-operator/chat/route.ts:123` | `POST` | `lib/agents/axiomAssistantAgent.ts::runAxiomAssistantAgent` |
| `app/api/cloud-operator/strategic-brief/route.ts:58` | `GET` | `lib/axiom/strategicBrief.ts::generateStrategicBrief` |
| `app/api/cloud-studio/trigger/route.ts:176` | `generate` | `lib/cloudStudio/generate.ts::generateCloudStudioOutput` |
| `app/api/cron/linkedin-daily-drafts/route.ts:68` | `handle` | `lib/growth/contentPlanner.ts::planContent` |
| `app/api/cron/linkedin-daily-drafts/route.ts:72` | `<anonymous-arrow>` | `lib/growth/hallucinationCheck.ts::checkHallucination` |
| `lib/cloudOperator/triggerCore.ts:98` | `generate` | `lib/cloudOperator/generate.ts::generateOperatorEngineOutput` |
| `lib/cloudOperator/updateEnvironmentAfterDiscovery.ts:70` | `updateEnvironmentAfterDiscovery` | `lib/axiom/environmentSummaryGenerator.ts::generateEnvironmentSummary` |
| `lib/cloudOperator/updateEnvironmentAfterDiscovery.ts:177` | `updateEnvironmentAfterIamScan` | `lib/axiom/environmentSummaryGenerator.ts::generateEnvironmentSummary` |
| `lib/multicloud/architectureAnalyzer.ts:386` | `analyzeArchitecture` | `lib/multicloud/architectureAnalyzer.ts::generateAIRecommendation` |
| `lib/websiteStarter/engine.ts:47` | `generateWebsiteStarter` | `lib/aiWebsiteStarter.ts::generateAIStarterPackage` |
| `lib/websiteStarter/engine.ts:49` | `generateWebsiteStarter` | `lib/leads/aiWebsiteStarter.ts::generateWebsiteStarterPackage` |
| `lib/websiteStarter/engine.ts:60` | `generateWebsiteStarterWithChanges` | `lib/aiWebsiteStarter.ts::generateAIStarterPackageWithChanges` |

## No selected direct edge

These21functions have no resolved immediate caller in this selected source universe. This is not a dead-code, safe or unreachable finding: dynamic callbacks, imported/exported aliases, other root families and runtime wiring still need investigation.

- `lib/ai/aiExplainer.ts::explainSubject`
- `lib/ai/directProviderCall.ts::callProvider`
- `lib/ai/provider.ts::generateCompletion`
- `lib/approvals/aiApprovalPacketNarrator.ts::narrateApprovalPacket`
- `lib/automation/playbooks/costIdleResources.ts::planCostIdleResources`
- `lib/autonomy/aiRationaleNarrator.ts::narrateRationale`
- `lib/cicd/aiCodeReviewPrioritizer.ts::prioritizeReviewFindings`
- `lib/cicd/aiPrDescriptionWriter.ts::writePrDescription`
- `lib/cloud/aiResourceTagger.ts::suggestResourceTags`
- `lib/flags/aiFeatureFlagAnalyst.ts::analyzeFeatureFlags`
- `lib/help/aiComplianceQa.ts::answerComplianceQuestion`
- `lib/help/aiHelpReranker.ts::rerankHelpCandidates`
- `lib/incidents/aiPostmortemDrafter.ts::draftPostmortem`
- `lib/incidents/aiRootCauseSuggester.ts::suggestRootCauses`
- `lib/insights/aiNextBestActionAdvisor.ts::adviseNextActions`
- `lib/notifications/aiIncidentSummarizer.ts::summarizeIncident`
- `lib/releaseops/aiReleaseNoteGenerator.ts::generateReleaseNotes`
- `lib/releaseops/aiRollbackNarrator.ts::narrateRollbackDecision`
- `lib/runbooks/aiRunbookRecommender.ts::recommendRunbook`
- `lib/securityScanner/aiPlaybookGenerator.ts::generateSecurityPlaybook`
- `lib/securityScanner/aiRiskClassifier.ts::classifyRisk`
