#!/bin/bash
set -e

# =============================================================
# OTA-обновление мобильного приложения Yukbozor
# =============================================================
# Запускать после КАЖДОГО значимого изменения JS/TS-кода, чтобы
# пользователи получили новую версию без обновления в Play Store.
#
# Использование:
#   bash mobile-ota-update.sh "Краткое описание изменений"
#
# Что происходит:
#   1. EAS публикует новый JS-бандл в ветку "production" на expo.dev.
#   2. При следующем открытии приложения Expo обнаруживает обновление,
#      скачивает его в фоне и показывает алерт «Перезапустить сейчас?».
#   3. Нажатие «Перезапустить» применяет новый код немедленно.
#      Нажатие «Позже» — новый код применится при следующем холодном старте.
#
# НЕ нужно для изменений в нативном коде (app.json, AndroidManifest,
# новые нативные пакеты) — там требуется полный EAS Build + Play Store.
# =============================================================

MESSAGE="${1:-"Обновление приложения"}"
LOG_FILE="ota-releases.md"
TIMESTAMP=$(date -u "+%Y-%m-%d %H:%M UTC")

echo "==> OTA-обновление мобильного приложения..."
echo "    Ветка : production"
echo "    Сообщение: $MESSAGE"
echo ""

cd mobile

if command -v eas &> /dev/null; then
  EAS_CMD="eas"
else
  echo "eas не найден глобально — используем npx eas..."
  EAS_CMD="npx eas"
fi

echo "--- Android ---"
ANDROID_OUT=$($EAS_CMD update --branch production --message "$MESSAGE" --platform android 2>&1)
echo "$ANDROID_OUT"
ANDROID_GROUP=$(echo "$ANDROID_OUT" | grep "Update group ID" | awk '{print $NF}')
ANDROID_UPDATE=$(echo "$ANDROID_OUT" | grep "Android update ID" | awk '{print $NF}')
RUNTIME=$(echo "$ANDROID_OUT" | grep "Runtime version" | awk '{print $NF}')

echo ""
echo "--- iOS ---"
IOS_OUT=$($EAS_CMD update --branch production --message "$MESSAGE" --platform ios 2>&1)
echo "$IOS_OUT"
IOS_GROUP=$(echo "$IOS_OUT" | grep "Update group ID" | awk '{print $NF}')
IOS_UPDATE=$(echo "$IOS_OUT" | grep "iOS update ID" | awk '{print $NF}')

echo ""
echo "✓ OTA-обновление опубликовано для Android и iOS!"
echo "  Пользователи увидят алерт «Перезапустить?» при следующем открытии."
echo ""
echo "  История обновлений:"
echo "  https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates"

# Append to release log
cd ..
cat >> "$LOG_FILE" << EOF

## $TIMESTAMP — $MESSAGE

| Field | Value |
|---|---|
| Runtime version | $RUNTIME |
| Android update group | $ANDROID_GROUP |
| Android update ID | $ANDROID_UPDATE |
| iOS update group | $IOS_GROUP |
| iOS update ID | $IOS_UPDATE |
| EAS dashboard | https://expo.dev/accounts/rustamuzb/projects/yukbozor/updates |
EOF

echo ""
echo "  Записано в $LOG_FILE"
