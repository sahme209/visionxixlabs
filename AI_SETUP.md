# Vision XIX Labs AI — Setup

The Vision XIX Labs AI is our own branded AI chatbot for VisaNova, built and owned by Vision XIX Labs.

## Overview

- **Product name:** Vision XIX Labs AI
- **Locations:** Floating widget on all pages · Full page at `/help/ai-assistant`
- **Features:**
  - RAG-style knowledge base (FAQs, VisaNova content, immigration basics)
  - Floating chat widget on every page
  - Quick prompts for common questions
  - Copy response button
  - Escalate to human ("Talk to support")

## Requirements

- OpenAI API key (we use `gpt-4o-mini` for cost-effective responses)

## Setup

### 1. Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Navigate to **API Keys**
4. Create a new secret key

### 2. Add Environment Variable

Add to `.env.local`:

```bash
OPENAI_API_KEY=sk-your-key-here
```

**For Vercel:**
1. Project → Settings → Environment Variables
2. Add `OPENAI_API_KEY` (secret)
3. Redeploy

## Without API Key

If `OPENAI_API_KEY` is not set, the AI assistant page still loads but chat requests return a 503 with a clear message. Users can browse the page and see the UI.
