#!/bin/bash

DEPLOY_DIR="$HOME/yukbozor"
ARCHIVE="$HOME/yukbozor-deploy.tar.gz"
ENV_FILE="$HOME/yukbozor.env"

echo "==> Загрузка переменных окружения..."
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
  echo "    Загружено из $ENV_FILE"
else
  echo "    ВНИМАНИЕ: Файл $ENV_FILE не найден!"
  echo "    Создайте файл ~/yukbozor.env с переменными окружения:"
  echo "      DATABASE_URL=postgresql://..."
  echo "      SESSION_SECRET=..."
  echo "      (и другие переменные)"
  echo ""
  echo "    Деплой отменён."
  exit 1
fi

echo "==> Остановка сервера..."
pm2 stop yukbozor 2>/dev/null || true

echo "==> Распаковка архива в $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR"
tar -xzf "$ARCHIVE" -C "$DEPLOY_DIR"

echo "==> Очистка старых зависимостей..."
rm -rf "$DEPLOY_DIR/node_modules"

echo "==> Установка зависимостей (npm ci)..."
( cd "$DEPLOY_DIR" && npm ci --omit=dev )

echo "==> Запуск сервера..."
pm2 delete yukbozor 2>/dev/null || true
NODE_ENV=production pm2 start "$DEPLOY_DIR/dist/index.js" --name yukbozor
pm2 save

echo ""
echo "==> Проверка (через 3 сек):"
sleep 3
pm2 logs yukbozor --lines 10 --nostream 2>/dev/null | tail -20 || true

echo ""
echo "✓ Деплой завершён."
