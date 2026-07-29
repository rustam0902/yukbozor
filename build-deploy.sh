#!/bin/bash
set -e

echo "==> [1/3] Сборка фронтенда..."
npx vite build

echo "==> [2/3] Сборка сервера..."
rm -f dist/index.js dist/index.cjs

# ESM bundle (для Replit deployment / отладки)
npx esbuild server/index.ts \
  --platform=node \
  --bundle \
  --format=esm \
  --outfile=dist/index.js \
  --define:process.env.NODE_ENV='"production"' \
  --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
  --external:pg-native \
  --external:bufferutil \
  --external:utf-8-validate \
  --external:fsevents \
  --external:lightningcss \
  --external:esbuild \
  --external:vite \
  --external:@babel/core \
  --external:@babel/preset-typescript \
  --external:@babel/parser \
  --log-level=warning

# CJS bundle (используется pm2 на VPS через ecosystem.config.cjs)
# ВАЖНО: --define:import.meta.dirname=__dirname — без этого path.join падает с undefined
npx esbuild server/index.ts \
  --platform=node \
  --bundle \
  --format=cjs \
  --outfile=dist/index.cjs \
  --define:process.env.NODE_ENV='"production"' \
  --define:import.meta.dirname=__dirname \
  --banner:js="'use strict';" \
  --external:pg-native \
  --external:bufferutil \
  --external:utf-8-validate \
  --external:fsevents \
  --external:lightningcss \
  --external:esbuild \
  --external:vite \
  --external:@babel/core \
  --external:@babel/preset-typescript \
  --external:@babel/parser \
  --log-level=warning

echo ""
echo "==> Проверка: нет ли npm-пакетов снаружи бандла (только node: допустимы)..."
EXTERNAL_IMPORTS=$(grep -E "^import .* from " dist/index.js | grep -v '"node:' | grep -v "^import.*from \"node" | grep -v "^import.*from 'node" | grep -v "\"path\"" | grep -v "\"fs\"" | grep -v "\"crypto\"" | grep -v "\"http\"" | grep -v "\"https\"" | grep -v "\"os\"" | grep -v "\"url\"" | grep -v "\"stream\"" | grep -v "\"util\"" | grep -v "\"events\"" | grep -v "\"buffer\"" | grep -v "\"querystring\"" | grep -v "\"assert\"" | grep -v "\"tty\"" | grep -v "\"zlib\"" | grep -v "\"net\"" | grep -v "\"tls\"" | grep -v "\"child_process\"" | grep -v "\"http2\"" | grep -v "\"module\"" | grep -v "\"readline\"" | grep -v "\"perf_hooks\"" | grep -v "pg-native\|bufferutil\|utf-8-validate\|fsevents\|lightningcss\|esbuild\|@babel\|vite" 2>/dev/null || true)

if [ -n "$EXTERNAL_IMPORTS" ]; then
  echo "⚠ ВНИМАНИЕ — найдены внешние npm импорты:"
  echo "$EXTERNAL_IMPORTS" | head -10
else
  echo "✓ Все npm-зависимости внутри бандла"
fi

echo ""
echo "==> [3/3] Создание архива yukbozor-deploy.tar.gz..."
tar -czf yukbozor-deploy.tar.gz \
  dist/ \
  server/templates/ \
  package.json \
  package-lock.json \
  ecosystem.config.cjs \
  deploy-server.sh \
  run-migration.cjs \
  migrate-task36.sql

echo ""
echo "✓ Готово! Архив: yukbozor-deploy.tar.gz ($(du -sh yukbozor-deploy.tar.gz | cut -f1))"
echo ""
echo "Следующие шаги (веб-сервер):"
echo "  1. Скачайте yukbozor-deploy.tar.gz из файлового менеджера Replit"
echo "  2. scp yukbozor-deploy.tar.gz uz-user@198.163.207.109:/home/uz-user/"
echo "  3. ssh uz-user@198.163.207.109"
echo "  4. tar -xzf ~/yukbozor-deploy.tar.gz -C ~/yukbozor"
echo "  5. bash ~/yukbozor/deploy-server.sh"
echo "  6. (Миграция БД) set -a && source ~/yukbozor/.env && set +a && node ~/yukbozor/run-migration.cjs"
echo ""
echo "Следующий шаг (мобильное приложение — OTA):"
echo "  bash mobile-ota-update.sh \"Описание изменений\""
echo "  Пользователи получат обновление при следующем запуске приложения."
