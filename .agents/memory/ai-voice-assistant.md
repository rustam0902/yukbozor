---
name: AI Voice Assistant — Announcements
description: Durable decisions and constraints for the AI voice dispatcher feature.
---

# AI Voice Assistant — Durable Decisions

## Backend contract
- Both AI routes are **intentionally unauthenticated** (public) + IP rate-limited (5/15 req/min in-memory). Do not add `authenticate` middleware.
- `ready=true` requires: `originRegion`, `destinationRegion`, `transportType`, `vehicleCount > 0`, `contactPhone` on every announcement. Other fields (weightTons, loadDate, loadingTime, paymentTypes) are optional — defaults applied at creation time.
- Region/transport values in the system prompt come from `AI_REGION_VALUES` / `AI_TRANSPORT_VALUES` constants defined just above the route — keep in sync with `announcementSchema` enums and mobile constants.

**Why:** Separating canonical enum lists into named constants prevents prompt/schema drift when new regions or transport types are added.

## Creation payload shape
- `/api/announcements` requires `originRegions: string[]`, `destinationRegions: string[]` (arrays, not singular).
- Mobile modal wraps the AI-extracted single region into an array: `originRegions: [a.originRegion]`.
- Defaults applied at creation: `weightTons → 1`, `loadDate → today`, `loadingTime → all_day`, `paymentTypes → ['cash']`.

**Why:** The server announcementSchema uses `.min(1)` arrays, not singular string fields.

## Voice recording (expo-av)
- expo-av is a native module — cannot be added via OTA. Requires a new EAS native Build with the plugin in app.json.
- Mobile uses dynamic `require('expo-av')` with try/catch — graceful fallback to text-only input if not in binary.
- Hold-to-record UX: `onPressIn → startRecording`, `onPressOut → stopRecording`; recordings < 0.5s are silently discarded.

**Why:** OTA can only ship JS/assets; native modules must be compiled into the binary.

## Post-creation feedback
- Modal calls `onCreated(count: number)` after batch creation completes (ok > 0).
- Parent screen (AnnouncementsScreen) shows a floating banner "Создано N объявл." for 4 seconds and calls `refetch()`.
