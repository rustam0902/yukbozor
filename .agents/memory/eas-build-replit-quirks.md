---
name: EAS build from Replit quirks
description: Known pitfalls and fixes when triggering EAS cloud builds from within the Replit environment
---

## Three pitfalls when running `eas build` from Replit

### 1. Plugin resolution stub needed for packages not in node_modules
If a new Expo plugin (e.g., expo-av) is in `package.json` but not installed in `mobile/node_modules`, `npx expo config` and the EAS CLI fallback both fail with "Failed to resolve plugin for module."

**Fix**: Create a minimal stub at `mobile/node_modules/<pkg>/`:
- `package.json` — name + version, NO `exports` field (the exports field blocks `<pkg>/app.plugin.js` resolution)
- `app.plugin.js` — `module.exports = function(config) { return config; };`

The EAS cloud build installs the real package; the stub is only for local config resolution.

**Why**: `@expo/config-plugins` uses `resolveFrom` + `fileExists` to find `pkg/app.plugin.js`. The package.json `exports` map blocks direct `.js` file access — omit it.

### 2. Package-lock.json must include new dependencies
EAS cloud uses `npm ci` when `package-lock.json` is present. If a package is in `package.json` but not in `package-lock.json` (e.g., added manually without running `npm install`), EAS will fail on "Install dependencies" in ~16-30 seconds.

**Fix**: Manually add the package entry to `mobile/package-lock.json` under `packages`:
```json
"node_modules/expo-av": {
  "version": "15.1.7",
  "resolved": "https://registry.npmjs.org/expo-av/-/expo-av-15.1.7.tgz",
  "integrity": "sha512-...",
  "license": "MIT",
  "peerDependencies": { "expo": "*", "react": "*", "react-native": "*" }
}
```
Fetch exact metadata from `https://registry.npmjs.org/<pkg>/<version>`.

### 3. Use a Replit workflow to bypass the 2-minute bash timeout
The EAS build upload step takes 1-2+ minutes (file compression + network). Replit's bash tool has a hard 120-second timeout, so `eas build` always times out during compression.

**Fix**: Use `configureWorkflow({ name: "EAS Build", command: "cd mobile && eas build ...", outputType: "console" })` to run EAS build as a background workflow. Check progress with `getWorkflowStatus`. Remove the workflow with `removeWorkflow` when done.

**Why**: Replit workflows have no timeout — they run until the process exits naturally.

### 4. Root .easignore needed for monorepo-like layout
EAS archives from the git root (`/home/runner/workspace`), not just the `mobile/` subdirectory. Without a root-level `.easignore`, the archive includes root `node_modules` (502MB) and grows to 1.4GB+.

**Fix**: Create `.easignore` at workspace root:
```
node_modules
.git
client
server
uploads
dist
coverage
*.log
.env*
```
This reduces the archive from 1.4GB to ~644MB.

### 5. Manually-added lockfile entries must match npm's ideal tree
`npm ci` fails if a nested dep version doesn't satisfy the parent's semver range (e.g., ajv 8.9.0 doesn't satisfy ^8.11.0 — npm then wants the latest matching version and reports "Missing: ajv@8.20.0 from lock file"). Fetch exact dep versions + integrity from the registry and use the latest version matching the declared range.

### 6. Native module versions must match the Expo SDK
A native package pinned to a previous SDK's version (e.g., expo-av 15.x on SDK 54) builds fine but crashes at runtime — Play Console's 16KB-page pre-launch test surfaces this as a "16 KB page size" failure. Fix by bumping to the SDK-matched version (expo-av 16.0.x for SDK 54) in package.json + lockfile + local stub.

### 7. iOS Distribution Certificate (pre-existing blocker)
iOS builds have never completed for this project. The EAS iOS credentials require interactive validation with Apple credentials. There is no non-interactive bypass available. iOS builds must be triggered from a local machine using `eas build --platform ios --profile production` (interactive).
