#!/bin/bash
set -e

# =============================================================
# Нативная сборка мобильного приложения Yukbozor (EAS Build)
# =============================================================
# Запускать ТОЛЬКО при изменении runtimeVersion (app.json) —
# то есть при добавлении новых нативных зависимостей или при
# плановом выпуске новой версии, которая должна принимать
# будущие OTA-обновления.
#
# Использование:
#   bash mobile-native-build.sh [android|ios|all]
#
# По умолчанию собирает обе платформы.
#
# После сборки:
#   Android: загрузить AAB вручную в Google Play Console
#            (Production → Create new release → Upload)
#   iOS    : EAS автоматически отправит IPA в App Store Connect
#            через TestFlight, либо загрузите вручную через Transporter.
#
# Предварительные требования:
#   - eas-cli: npm install -g eas-cli
#   - Авторизация: eas login
#   - Для iOS: Apple Developer account подключён в eas.json / EAS dashboard
# =============================================================

PLATFORM="${1:-all}"
VERSION=$(node -e "console.log(require('./mobile/app.json').expo.version)")
RUNTIME=$(node -e "console.log(require('./mobile/app.json').expo.runtimeVersion)")
LOG_FILE="native-releases.md"
TIMESTAMP=$(date -u "+%Y-%m-%d %H:%M UTC")

echo "==> Нативная сборка Yukbozor v${VERSION} (runtimeVersion: ${RUNTIME})"
echo "    Платформа: ${PLATFORM}"
echo ""

if command -v eas &> /dev/null; then
  EAS_CMD="eas"
else
  echo "eas не найден глобально — используем npx eas..."
  EAS_CMD="npx eas"
fi

cd mobile

ANDROID_BUILD_URL=""
IOS_BUILD_URL=""

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
  echo "--- Android (AAB для Play Store) ---"
  ANDROID_OUT=$($EAS_CMD build --platform android --profile production --non-interactive 2>&1)
  echo "$ANDROID_OUT"
  ANDROID_BUILD_URL=$(echo "$ANDROID_OUT" | grep "Build details:" | awk '{print $NF}')
  echo ""
fi

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
  echo "--- iOS (IPA для App Store) ---"
  IOS_OUT=$($EAS_CMD build --platform ios --profile production --non-interactive 2>&1)
  echo "$IOS_OUT"
  IOS_BUILD_URL=$(echo "$IOS_OUT" | grep "Build details:" | awk '{print $NF}')
  echo ""
fi

echo "✓ Сборка запущена! Следите за прогрессом:"
echo "  https://expo.dev/accounts/rustamuzb/projects/yukbozor/builds"
echo ""
echo "После завершения сборки:"
if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
  echo "  Android: скачайте AAB и загрузите в Google Play Console вручную."
fi
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
  echo "  iOS: EAS отправит IPA в TestFlight автоматически."
  echo "       Затем в App Store Connect перенесите билд в Production."
fi

# Append to release log
cd ..
cat >> "$LOG_FILE" << EOF

## $TIMESTAMP — v${VERSION} (runtimeVersion: ${RUNTIME})

| Field | Value |
|---|---|
| App version | $VERSION |
| Runtime version | $RUNTIME |
| Platform | $PLATFORM |
| Android versionCode | $(node -e "console.log(require('./mobile/app.json').expo.android.versionCode)") |
| iOS buildNumber | $(node -e "console.log(require('./mobile/app.json').expo.ios.buildNumber)") |
| Android build | ${ANDROID_BUILD_URL:-n/a} |
| iOS build | ${IOS_BUILD_URL:-n/a} |
| EAS dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/builds |
EOF

echo ""
echo "  Записано в $LOG_FILE"
