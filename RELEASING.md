# Release Policy — Yukbozor Mobile App

This document defines when to publish an OTA update versus when to submit a full native build, and what to do when versions get out of sync. The 1.0.4/1.0.5 mismatch happened because these rules were not written down.

---

## Core Rule: runtimeVersion is a contract

`runtimeVersion` in `mobile/app.json` is a **handshake** between the JS bundle and the native binary. Expo will only deliver an OTA update to a device if the update's runtimeVersion exactly matches the runtimeVersion baked into the native binary installed on that device.

- It must be an **explicit string** (e.g. `"1.0.6"`). Never use a policy value like `"exposdk:50.0.0"`.
- It must be bumped in `mobile/app.json` **and** a new native build must be submitted to the stores **together**, as a single atomic action.
- If you bump runtimeVersion without a new native build, existing users will never receive any future OTA updates until they install the new native binary from the store.
- If you publish an OTA update whose runtimeVersion does not match the installed binary, Expo silently ignores that update on the device.

---

## Decision Tree: OTA or Full Native Build?

```
Did you change any of the following?
  - app.json (plugins, permissions, splash, icons, runtimeVersion, version, versionCode/buildNumber)
  - AndroidManifest.xml or Info.plist
  - Any native module (added, removed, or upgraded a package with native code)
  - Expo SDK version
  - google-services.json or any signing/credential file
         │
         YES ──► Full Native Build  (see checklist below)
         │
         NO  ──► OTA Update is safe  (see checklist below)
```

**When in doubt, do a full native build.** A store release is slower but always safe. A wrong OTA update cannot be un-rung on devices that already downloaded it.

---

## Checklist A — OTA-Only Update (JS/TS changes only)

Use this path when only JS/TypeScript source files changed and the native binary does not need to change.

1. Confirm `runtimeVersion` in `mobile/app.json` **has not changed** since the last store release.
2. Confirm you have not added, removed, or upgraded any package that contains native code.
3. Run the update script:
   ```bash
   bash mobile-ota-update.sh "Short description of what changed"
   ```
4. The script publishes to the `production` branch on expo.dev and appends a record to `ota-releases.md`.
5. Open the EAS dashboard and confirm the update group shows the correct runtime version:
   `https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates`
6. Test on a physical device: open the app, wait for the "Restart now?" prompt, and verify the change.

---

## Checklist B — Full Native Build + Store Release

Use this path whenever the native binary must change (see decision tree above).

### 1. Bump versions in `mobile/app.json`

| Field | Rule |
|---|---|
| `version` | Increment (e.g. `1.0.6` → `1.0.7`) |
| `runtimeVersion` | Set to the same value as `version` |
| `android.versionCode` | Increment by 1 |
| `ios.buildNumber` | Increment by 1 |

### 2. Build native binaries

```bash
cd mobile

# Android AAB for Play Store
npx eas build --platform android --profile production

# iOS archive for App Store
npx eas build --platform ios --profile production
```

Wait for both builds to complete in the EAS dashboard before continuing.

### 3. Submit to stores

```bash
# Android
npx eas submit --platform android --latest

# iOS
npx eas submit --platform ios --latest
```

### 4. Wait for store approval

- Google Play: typically a few hours.
- Apple App Store: typically 1–3 days.

### 5. After store approval — publish an OTA update (optional but recommended)

Once the new binary is live in both stores, you may immediately publish an OTA update to deliver any JS-only fixes that accumulated during store review:

```bash
bash mobile-ota-update.sh "Post-release JS patch"
```

This OTA update will target the new `runtimeVersion` and will only reach users who have already installed the new binary.

### 6. Update `ota-releases.md`

Add a manual entry noting the store release version and date so the log stays consistent.

---

## What Goes Wrong When Rules Are Broken

| Mistake | Consequence |
|---|---|
| OTA update published after native code changed | Update is ignored by all devices (runtimeVersion mismatch). Users stay on old code silently. |
| `runtimeVersion` bumped without a new store build | All future OTA updates are invisible to users until they manually update from the store. |
| `runtimeVersion` not bumped after a store build | New native binary and old OTA updates share the same version string — Expo may serve a stale JS bundle to new installs. |
| `version` bumped but `runtimeVersion` left behind | Causes the 1.0.4/1.0.5-style mismatch. Always keep them in sync. |

---

## Quick Reference

```
JS/TS only changed?
  → bash mobile-ota-update.sh "message"

Native code / app.json changed?
  → bump version + runtimeVersion + versionCode/buildNumber
  → eas build (both platforms)
  → eas submit (both platforms)
  → wait for store approval
  → (optionally) bash mobile-ota-update.sh for any accumulated JS fixes
```

---

## Relevant Files

- `mobile/app.json` — single source of truth for all version numbers
- `mobile-ota-update.sh` — publishes JS bundle to expo.dev production branch
- `ota-releases.md` — log of every OTA update published
- EAS dashboard: `https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates`
