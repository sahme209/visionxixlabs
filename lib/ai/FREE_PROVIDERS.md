# Free AI provider system (GitHub Models primary)

Sibling to the legacy paid orchestrator (`orchestrator.ts`) — this
subsystem uses **only free / free-to-start providers** by default.

**Hard rules:**
- No paid OpenAI API usage from this module.
- No paid Anthropic API usage from this module.
- No credit card required.
- API keys never appear in logs or response payloads.

## Provider priority (fallback chain)

1. **GitHub Models** — primary. One token, many models (OpenAI/Llama/
   Mistral/Phi/DeepSeek). OpenAI-compatible API.
2. **Ollama** — local fallback. No key. Defaults to
   `http://localhost:11434`.
3. **LM Studio** — second local fallback. No key. Defaults to
   `http://localhost:1234`.
4. **Groq** — fast free tier (Llama, Mixtral, Gemma).
5. **Hugging Face Inference API** — free tier.
6. **OpenRouter** — free model routing.
7. **Gemini** — Google AI Studio free tier (Flash family).
8. **Cloudflare Workers AI** — free tier (Llama, Mistral, Qwen, Gemma).
9. **Mock** — deterministic local stub. Always succeeds. Last resort.

When a provider fails (invalid key, rate limit, model not found,
network hiccup, timeout) the manager records the failure and slides to
the next provider. The Mock provider is always last so calling code
never sees a hard failure just because keys are missing.

## Environment variables

All are optional. Set only the ones you have.

| Var                     | Used by                  | Default                              |
| ----------------------- | ------------------------ | ------------------------------------ |
| `GITHUB_TOKEN`          | GitHub Models            | required                             |
| `GITHUB_MODEL_NAME`     | GitHub Models            | `openai/gpt-4o-mini`                 |
| `GROQ_API_KEY`          | Groq                     | required                             |
| `HUGGINGFACE_API_KEY`   | Hugging Face             | required                             |
| `OPENROUTER_API_KEY`    | OpenRouter               | required                             |
| `GEMINI_API_KEY`        | Gemini                   | required                             |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI    | required                             |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare Workers AI    | required                             |
| `OLLAMA_BASE_URL`       | Ollama                   | `http://localhost:11434`             |
| `LM_STUDIO_BASE_URL`    | LM Studio                | `http://localhost:1234`              |
| `AI_USAGE_VERBOSE`      | usage logger             | `0` (set to `1` for JSON stdout)     |

## Usage from feature code

```ts
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";

const ai = getAIProviderManager();

const result = await ai.generateText("Summarize today's incidents.", {
  maxTokens: 256,
  temperature: 0.4,
});
// result.provider === "github_models" | "groq" | ... | "mock"
// result.model    === the actual model id that answered
// result.usage    === { promptTokens, completionTokens, totalTokens } | null
```

Other surface:
- `ai.summarize(text, opts)`
- `ai.classify(text, labels, opts)`
- `ai.extractStructuredData(text, schemaHint, opts)`
- `for await (const chunk of ai.streamText(prompt, opts)) { ... }`
- `ai.healthCheckAll()`

## Settings UI

`/dashboard/ai-settings` shows:
- which providers are configured (env booleans only),
- the default model per provider + the full recommended-model list,
- a health-check button that pings every provider,
- a `Try it` affordance that shows which provider answered.

## API surface

- `GET  /api/ai/status`  — provider table + active provider/model
- `POST /api/ai/health`  — per-provider healthCheck
- `POST /api/ai/generate` — generic text generation

## Logging guarantees

The usage logger NEVER records:
- API keys, tokens, secrets
- user prompts
- response bodies

It DOES record:
- provider name, model id, task kind, latency, status, error kind,
  correlation id.

Buffer is bounded at 500 events.

## Adding a future paid provider

By choice, paid providers are NOT in this subsystem. If/when you enable
them, add a new file under `lib/ai/providers/`, register it in
`AIProviderManager`, and re-order `PROVIDER_PRIORITY` in
`AIModelRegistry.ts`. Free providers should remain ahead of paid by
default.
