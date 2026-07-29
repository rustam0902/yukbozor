---
name: EAS OTA publish commands
description: Exact shell commands and workflow setup for publishing OTA updates to the production channel
---

## Setup before running

1. Ensure `mobile/app.json` has `"platforms": ["android", "ios"]` (to exclude web — `react-native-web` is not installed)
2. Ensure expo-av stub exists at `mobile/node_modules/expo-av/` with REAL build files:
   - `package.json`: `{ "name": "expo-av", "version": "16.0.8", "main": "build/index.js" }` (no `exports` field)
   - `app.plugin.js`: `module.exports = function(config) { return config; };`
   - `build/` directory: copy real JS files from the tarball `https://registry.npmjs.org/expo-av/-/expo-av-16.0.8.tgz`
   - The stub MUST include the build/ directory or `Audio` will be null at runtime (try-catch swallows the module-not-found error)
   - Do NOT put the stub without build/ — the binary HAS native ExponentAV compiled in (app.json has expo-av plugin), but the JS bridge code must be present in the bundle for it to work

## Publish command (via Replit workflow)

Configure a console workflow (because upload takes >2 min, bash times out):
```javascript
await configureWorkflow({
  name: "EAS OTA Update",
  command: "cd mobile && CI=1 eas update --channel production --message 'your message here' --platform all",
  outputType: "console",
  autoStart: true
});
```

Then poll with `getWorkflowStatus({ name: "EAS OTA Update", maxScrollbackLines: 150 })`.

Remove workflow when done: `await removeWorkflow({ name: "EAS OTA Update" })`.

## Last successful publish
- Date: 2026-07-24
- runtimeVersion: 1.0.7
- Channel: production
- Update group: 75496696-02b8-43d4-b605-90c54e8ecc25
- Message: "Fix camera photo upload: use asset.mimeType, accept WebP/HEIC on server"
- Android update ID: 019f935e-bc47-79d8-a9f9-3a023452507b
- iOS update ID: 019f935e-bc47-72a5-8cd5-c0e06e3a2130
