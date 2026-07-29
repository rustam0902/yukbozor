---
name: Production deploy quirks
description: Hard-won lessons about deploying to 198.163.207.109 via pm2 + ecosystem.config.cjs
---

## Rule: Always source .env before pm2 start/delete

`pm2 restart` reuses cached env. `pm2 delete` wipes it. After any `pm2 delete`, you MUST do:

```bash
set -a && source ~/yukbozor/.env && set +a
pm2 delete yukbozor 2>/dev/null || true
pm2 start ~/yukbozor/ecosystem.config.cjs
pm2 save
```

**Why:** pm2's `env_file` in ecosystem.config.cjs may not be supported by the server's pm2 version. Sourcing manually is reliable. Without it, DATABASE_URL (and all other secrets) are missing and the app crashes on startup.

## Rule: npm install must use public registry

The server cannot reach `package-firewall.replit.local` (Replit's internal npm proxy). Always use:

```bash
npm install --omit=dev --registry https://registry.npmjs.org
```

**Why:** Packages installed inside Replit reference the internal firewall registry in package-lock.json. External servers get `EAI_AGAIN` trying to reach it.

## Rule: Never include livekit-server-sdk in package.json for prod

`livekit-server-sdk` was installed in Replit and referenced Replit's internal registry. It must be kept out of `package.json` for production deploys.

## Rule: AI_MODEL_NAME env var on prod server overrides code

The prod server `.env` had `AI_MODEL_NAME=deepseek-chat` which overrode the code default. Fixed by:
1. Removing the env var: `sed -i '/^AI_MODEL_NAME=/d' ~/yukbozor/.env`
2. Hardcoding model in code: `activeProvider === 'DeepSeek' ? 'deepseek-v4-flash' : (process.env.AI_MODEL_NAME || 'gpt-4o-mini')`

## deploy-server.sh already handles this correctly

The script does `set -a && source $APP_DIR/.env && set +a` before pm2. Using `bash ~/yukbozor/deploy-server.sh` is the right way to deploy — don't run pm2 commands manually.
