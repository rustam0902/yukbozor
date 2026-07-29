# Yukbozor Mobile — Release History

## v1.0.7 (versionCode 24 / buildNumber 8) — 2026-07-17

**Status**: Build complete — awaiting store submission

### What's new

- **Voice recording** (`expo-av`): hold-to-record microphone input for creating announcements via voice. This required a native rebuild — OTA delivery was not possible.
- Microphone permission string added (Russian) for Android and iOS.
- Users on binaries older than v1.0.7 will see a full-screen update prompt directing them to the store (force-update gate activated for `MIN_REQUIRED_VERSION = 1.0.7`).

### Store listing release notes

Paste the text below into **Google Play Console → Release notes** (and the equivalent App Store Connect field) when submitting v1.0.7:

#### Russian (RU)

```
Новое в версии 1.0.7:

• Голосовое создание объявлений — удерживайте кнопку микрофона, надиктуйте параметры груза, и заявка заполнится автоматически.
• Исправления ошибок и улучшения стабильности.
```

#### Uzbek (UZ)

```
1.0.7 versiyasidagi yangiliklar:

• Ovozli e'lon yaratish — mikrofon tugmasini bosib turing, yuk parametrlarini aytib bering va ariza avtomatik to'ldiriladi.
• Xatoliklar tuzatildi va barqarorlik yaxshilandi.
```

### Prerequisites before submitting

#### Android
1. Download your Google Play service account JSON key from [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) (project linked to Play Console).
2. Place it at `mobile/google-play-service-account.json` (gitignored — do not commit).
3. Grant the service account **Release Manager** role in Google Play Console → Setup → API access.

#### iOS
- Ensure your Apple ID (`developer@yukbozor.uz`) has App Manager or higher role in App Store Connect for app `6744022888`.
- An App-Specific Password or API key may be required depending on your EAS account setup (`npx eas credentials`).

### Submission commands (run from `mobile/` directory)

```bash
# 1. Confirm you are logged in
npx eas whoami

# 2. Submit Android AAB (latest successful production build)
npx eas submit --platform android --profile production --latest

# 3. Submit iOS IPA (latest successful production build)
npx eas submit --platform ios --profile production --latest
```

If you prefer to submit **both platforms in one command**:

```bash
npx eas submit --platform all --profile production --latest
```

### Manual fallback (without EAS Submit)

**Android** — upload the `.aab` manually:
1. Go to [Google Play Console](https://play.google.com/console) → Yukbozor → Production → Create new release.
2. Download the AAB from the [EAS dashboard](https://expo.dev/accounts/rustamuzb/projects/yukbozor/builds) (filter: platform=Android, profile=production).
3. Upload the AAB and publish.

**iOS** — upload the `.ipa` manually via Transporter or Xcode:
1. Download the IPA from the [EAS dashboard](https://expo.dev/accounts/rustamuzb/projects/yukbozor/builds) (filter: platform=iOS, profile=production).
2. Open **Transporter** (free on Mac App Store), sign in as `developer@yukbozor.uz`, drag the IPA, and click Deliver.
3. In App Store Connect → TestFlight / App Store, select build `8` and submit for review.

### Configuration

| Field | Value |
|---|---|
| version | 1.0.7 |
| versionCode (Android) | 24 |
| buildNumber (iOS) | 8 |
| runtimeVersion | 1.0.7 |
| EAS project | 7451932c-660d-4552-94ef-3810191bfc45 |
| EAS channel | production |
| Android build type | app-bundle (.aab) |
| iOS distribution | store (.ipa) |
| Android submit track | production |
| iOS App Store Connect App ID | 6744022888 |
| Apple ID | developer@yukbozor.uz |

---

## v1.0.7 — OTA patch #1 (2026-07-17)

**Status**: OTA published to production channel (targets users on binary v1.0.7)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.7** |
| Platforms | android + ios |
| Update group ID | 16a50688-46b3-4e0d-985e-f96c2e1d99d1 |
| Android update ID | 019f6ec5-cef7-7d10-b093-2e497456e9ac |
| iOS update ID | 019f6ec5-cef7-7bb3-addd-a78dbc3b6447 |
| Message | Push notification filter fix: new settings screen |
| EAS Dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/16a50688-46b3-4e0d-985e-f96c2e1d99d1 |

### Changes in this OTA

- **PushNotificationSettingsScreen**: new dedicated screen in Profile menu for managing push notification preferences (origin/destination region, transport type filter)
- **ProfileScreen**: added "Push Notification Settings" menu entry navigating to the new screen
- **AppNavigator**: registered `PushNotificationSettings` screen in the navigation stack

### Notes

- `mobile/app.json` now has `"platforms": ["android", "ios"]` to prevent `expo export` from attempting a web build (which fails — `react-native-web` is not installed)

---

## v1.0.5 — OTA patch #2 (2026-05-15)

**Status**: OTA published to production branch (targets users on binary v1.0.5)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.5** |
| Android update group | (same group as iOS below) |
| iOS update group | e9759def-57e9-4d14-bb5e-95458a86da1a |
| iOS update ID | 019e2ccb-80e8-75e6-b85e-65b3c5b993fd |
| Message | PushNotificationSettings экран, PushFilterIndicator на CargoListScreen, гостевой режим push-индикатор |
| EAS Dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/e9759def-57e9-4d14-bb5e-95458a86da1a |

### Changes in this OTA

- **PushNotificationSettingsScreen** (#115): отдельный экран настройки push-фильтров в Профиле
- **PushFilterIndicator** (#116): индикатор активных push-фильтров на экране списка грузов
- **Sync button** (#119): кнопка синхронизации push-фильтров с сервером
- **Guest mode push indicator** (#120): для гостей push-индикатор ведёт на экран входа

---

## v1.0.5 — OTA patch #1 (2026-05-15)

**Status**: OTA published to production branch (targets users on binary v1.0.5)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.5** |
| Android update ID | 019e2c7c-3dc4-7721-b58b-ad353d3a23ee |
| Android update group | 8b4d9e8a-0489-4fa7-a97d-e15edc8e67b3 |
| iOS update ID | 019e2c7d-7142-785f-b405-3b08aa8a7892 |
| iOS update group | 0cd7258c-d85d-4309-9e96-aa798bd6ea93 |
| Message | Fix push filter bug: separate @pushFilters key + server-side isNull conditions for empty announcement fields |
| EAS Dashboard (Android) | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/8b4d9e8a-0489-4fa7-a97d-e15edc8e67b3 |
| EAS Dashboard (iOS) | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/0cd7258c-d85d-4309-9e96-aa798bd6ea93 |

### Fixes in this OTA

- **push filter bug (root cause)**: серверная логика `notifyNewAnnouncement` теперь корректно добавляет условие `isNull(token.field)` когда объявление не имеет данных по полю (origin/dest/transport) — ранее условие вовсе не добавлялось, и токены с фильтром получали ВСЕ объявления
- **push/cargo filter decoupling**: push-фильтры теперь хранятся в отдельном ключе `@pushFilters` вместо `@cargoListFilters`. Сброс фильтра списка грузов больше не обнуляет push-настройки на сервере. Cold-start и foreground-перерегистрация читают из `@pushFilters`.

---

## v1.0.4 — OTA patch #4 (2026-05-15)

**Status**: OTA published to production branch (targets users on binary v1.0.4)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.4** |
| iOS update group | 1bf6a6cb-a138-4b96-83d2-1d49b9bc2126 |
| iOS update ID | 019e2ce7-7618-76ad-9298-65c6b505bbd7 |
| Message | Fix: savePushFilters при включении уведомлений + readSavedPushFilters читает @cargoListFilters первым |
| EAS Dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/1bf6a6cb-a138-4b96-83d2-1d49b9bc2126 |

### Changes in this OTA

- **Fix regression**: при включении уведомлений в PushNotificationSettingsScreen теперь также вызывается `savePushFilters(cargoFilters)` — без этого `usePushNotifications` мог перезаписать фильтры старым значением из `@pushFilters`
- **Fix source of truth**: `readSavedPushFilters` теперь читает `@cargoListFilters` первым (единый источник истины), `@pushFilters` — только как fallback для обратной совместимости

---

## v1.0.4 — OTA patch #3 (2026-05-15)

**Status**: OTA published to production branch (targets users on binary v1.0.4)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.4** |
| iOS update group | 00eb67f3-2dc4-4fa5-a6ca-1605c43575fd |
| iOS update ID | 019e2ce2-920e-75c4-a4a6-1c35cc68b8e8 |
| Message | Упрощение UX push-фильтров: авто-синхрон при изменении фильтра грузов, исправление бага индикатора |
| EAS Dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/00eb67f3-2dc4-4fa5-a6ca-1605c43575fd |

### Changes in this OTA

- **Авто-синхрон push-фильтров**: при изменении фильтра в списке грузов push-уведомления автоматически перерегистрируются с теми же фильтрами — больше не нужно настраивать в двух местах
- **Исправлен баг "не включены"**: индикатор теперь определяет статус по флагу `@pushEnabled`, а не по наличию токена — больше не показывает "не включены" когда уведомления на самом деле включены
- **PushFilterIndicator упрощён**: убрана кнопка "Синхронизировать" и логика сравнения фильтров — индикатор просто показывает текущее состояние
- **PushNotificationSettingsScreen переработан**: убрано дублирующее редактирование фильтров, оставлен только тумблер вкл/выкл + read-only отображение активных фильтров из списка грузов

---

## v1.0.4 — OTA patch #2 (2026-05-15)

**Status**: OTA published to production branch (targets users on binary v1.0.4)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.4** |
| iOS update group | acef914c-69c1-472d-9bb0-4da8839a4323 |
| iOS update ID | 019e2cd2-4b0a-7951-b2aa-7d6073c7eacc |
| Message | PushNotificationSettings экран, PushFilterIndicator на CargoListScreen, гостевой режим push-индикатор |
| EAS Dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/acef914c-69c1-472d-9bb0-4da8839a4323 |

### Changes in this OTA

- **PushNotificationSettingsScreen** (#115): отдельный экран настройки push-фильтров в Профиле
- **PushFilterIndicator** (#116): индикатор активных push-фильтров на экране списка грузов
- **Sync button** (#119): кнопка синхронизации push-фильтров с сервером
- **Guest mode push indicator** (#120): для гостей push-индикатор ведёт на экран входа
- **Push filter bug fix**: серверная логика `notifyNewAnnouncement` корректно фильтрует по `isNull` для пустых полей
- **Push/cargo filter decoupling**: push-фильтры хранятся в отдельном ключе `@pushFilters`

---

## v1.0.4 — OTA patch #1 (2026-05-15)

**Status**: OTA published to production branch (targets users on binary v1.0.4)

### OTA update details

| Field | Value |
|---|---|
| Branch | production |
| Runtime version | **1.0.4** |
| Android update ID | 019e2ad3-7fc0-7d1e-aadd-75a2767ce04f |
| Android update group | 86864fd0-9573-49a5-b5a2-9c887f2b52df |
| iOS update ID | 019e2ad4-270e-71e7-9f65-6ec96e528e9b |
| iOS update group | 361bfb68-5471-4fdc-9a1e-f0783be85e81 |
| Message | Fix allDay toggle UI + push filter foreground reset |
| EAS Dashboard (Android) | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/86864fd0-9573-49a5-b5a2-9c887f2b52df |
| EAS Dashboard (iOS) | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates/361bfb68-5471-4fdc-9a1e-f0783be85e81 |

> **Note**: Published with `app.json version: "1.0.4"` so runtimeVersion matches existing 1.0.4 binaries on devices. The `app.json` was immediately restored to `1.0.5` after publishing.

### Fixes in this OTA

- **allDay toggle UI (Bug #105)**: «В течение дня» переключатель вынесен на отдельную строку в CreateOrderScreen, MyAnnouncementsScreen, AnnouncementsScreen — больше не сжат в половине контейнера рядом с меткой
- **push filter foreground (Bug #104)**: foreground-обработчик push-уведомлений больше не перезаписывает NULL'ами серверные фильтры пользователя, если в AsyncStorage нет сохранённых настроек

---

## v1.0.5 (versionCode 22)

**Status**: Ready to build and submit

### Build command (run from `mobile/` directory)

```bash
npx eas build --platform android --profile production
```

### Submit command (after build completes)

```bash
npx eas submit --platform android --profile production --latest
```

Or upload the resulting `.aab` manually in Google Play Console → Internal testing → Promote to Production.

### Release notes

- Push notification filter preferences (origin, destination, transport type)
- Telegram authentication improvements
- Bug fixes and stability improvements

### Configuration

| Field | Value |
|---|---|
| version | 1.0.5 |
| versionCode | 22 |
| runtimeVersion | appVersion |
| EAS project | 7451932c-660d-4552-94ef-3810191bfc45 |
| EAS channel | production |
| Build type | app-bundle (.aab) |
| Submit track | internal → production |

### Prerequisites

- EAS CLI >= 12.0.0
- Logged in to Expo account: `npx eas whoami`
- `GOOGLE_SERVICES_JSON` EAS secret must be set (see README.md)
- Google Play service account key configured in EAS

---

## v1.0.3 (versionCode 20)

**Status**: Live on Play Store

- Initial public release with OTA update support
- Carrier and customer roles
- Order and announcement management
