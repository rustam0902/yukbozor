---
name: OTA update strategy
description: How to publish Expo OTA updates for the Yukbozor mobile app without re-submitting to stores
---

## Strategy
OTA updates deliver JS bundle changes to existing users without a new store submission. They work only within the same `runtimeVersion` — native code changes still require a store build.

## Constraints
- Publish separately per `runtimeVersion` — each runtimeVersion has its own update channel slot
- Use silent background download only (already configured via `checkAutomatically: ON_LOAD` in app.json)
- `"platforms": ["android", "ios"]` must be set in `mobile/app.json` — without it, expo defaults to all platforms including web, and `expo export` fails because `react-native-web` is not installed
- OTA cannot change the native version number shown to users (Constants.expoConfig.version always reflects the binary)

## Key config (mobile/app.json)
```json
"updates": {
  "url": "https://u.expo.dev/7451932c-660d-4552-94ef-3810191bfc45",
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0
},
"runtimeVersion": "1.0.7",
"platforms": ["android", "ios"]
```

## Publishing to a single runtime version
```
cd mobile && CI=1 eas update --channel production --message 'your message' --platform all
```
Run via a Replit workflow (not bash — bash times out at 2 min during upload).

## Publishing to MULTIPLE runtime versions (1.0.5, 1.0.6, 1.0.7)
There is no `--runtime-version` flag. Temporarily swap app.json and publish three times:
```
cd mobile && \
  node -e "const f='app.json',j=JSON.parse(require('fs').readFileSync(f));j.expo.runtimeVersion='1.0.5';require('fs').writeFileSync(f,JSON.stringify(j,null,2))" && \
  CI=1 eas update --channel production --message 'msg (v1.0.5)' --platform all --non-interactive && \
  node -e "..." (1.0.6) && CI=1 eas update ... && \
  node -e "..." (1.0.7) && CI=1 eas update ...
```

## reloadAsync() reliability issues
**Problem**: On some Android devices, `Updates.reloadAsync()` silently fails — the call succeeds but nothing happens visually, leaving users stuck in a dialog loop with old embedded JS code.

**Fix in useOtaUpdates.ts**: Call `reloadAsync()` immediately after `fetchUpdateAsync()` with a 2-second delay (not waiting for background/inactive AppState transition). Two-pronged approach:
1. Immediate reload attempt (2s after download) — works on most devices
2. If that fails, expo-updates still stages the update for the next true cold start

**For devices where reloadAsync() always fails**: Only a true cold start applies the update. Tell users to go to Settings → Apps → Yukbozor → Force Stop, then reopen. Simple swipe-from-recents does NOT kill the JS process on most Android devices.

## Dialog loop root cause
If old code has an OTA dialog (Alert) and reloadAsync() fails, users see the dialog every time they open the app forever. Fix: remove all dialogs from the OTA hook — make it 100% silent. Users should never need to "tap" to apply an update.
