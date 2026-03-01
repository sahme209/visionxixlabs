# AI Orchestrator

Multi-provider AI routing by task type (OpenAI, Anthropic, Gemini) with fallback, tracing, and cost attribution.

## How model routing works

1. **Task type** — Each call specifies a `TaskType` (e.g. `CHAT_FAST`, `PLAN_STRONG`, `CODE_STRONG`). The orchestrator picks a preferred provider and model for that task.
2. **Provider order** — Per task type, a fallback chain is defined (e.g. Anthropic → OpenAI → Gemini for `PLAN_STRONG`). Providers are tried in order until one succeeds.
3. **User plan** — `routeModel({ taskType, userPlan })` can limit models for lower tiers (e.g. `starter` → cheaper models).
4. **Env override** — `AI_PROVIDER=openai|anthropic|gemini` forces that provider first for all tasks.
5. **Timeout & retry** — Each attempt has a configurable timeout (`AI_ORCHESTRATOR_TIMEOUT_MS`, default 90s). On failure, the next provider in the chain is tried.

## How to switch models per task type

Set env vars for task-specific models:

| Task type        | OpenAI                | Anthropic              | Gemini               |
|------------------|------------------------|------------------------|----------------------|
| CHAT_FAST        | `AI_MODEL_CHAT`        | `AI_MODEL_CHAT_ANTHROPIC` | `AI_MODEL_CHAT_GEMINI` |
| PLAN_STRONG      | `AI_MODEL_CONTENT`     | `AI_MODEL_CONTENT_ANTHROPIC` | `AI_MODEL_CONTENT_GEMINI` |
| CODE_STRONG      | `AI_MODEL_CODE`        | `AI_MODEL_CODE_ANTHROPIC` | `AI_MODEL_CODE_GEMINI` |

Defaults (when not set):

- OpenAI: `OPENAI_MODEL` or `gpt-4o`
- Anthropic: `ANTHROPIC_MODEL` or `claude-sonnet-4-20250514`
- Gemini: `GEMINI_MODEL` or `gemini-2.0-flash`

## Usage

```ts
import { generate } from "@/lib/ai/orchestrator";

const res = await generate({
  taskType: "PLAN_STRONG",
  systemPrompt: "You are an expert planner.",
  userPrompt: "Plan a website for a SaaS startup.",
  maxTokens: 2048,
  responseFormat: "json",
  userId: session?.user?.id,
});

// res: { text, toolCalls?, usage?, provider, model, latencyMs, requestId }
```

**Server-side only** — Use in `app/api` routes or server actions. Never call from client components.
