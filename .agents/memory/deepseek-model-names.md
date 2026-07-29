---
name: DeepSeek model name change
description: DeepSeek renamed their models in mid-2026; the old "deepseek-chat" name is no longer valid.
---

## Rule

Do NOT use `deepseek-chat` as the model name with the DeepSeek API — it returns HTTP 400.

**Why:** DeepSeek renamed their models. `deepseek-chat` was deprecated in mid-2026.

**How to apply:** Whenever setting a DeepSeek model name (in routes, services, or env var defaults), use one of:
- `deepseek-v4-flash` — faster, cheaper (recommended default)
- `deepseek-v4-pro` — more capable, slower

The correct endpoint is still `https://api.deepseek.com/v1`.

In this project: two files hardcode the model name:
- `server/routes.ts` — AI voice assistant route (getAIClientAndModel helper)
- `server/services/cargo-parser-service.ts` — cargo parser model fallback
