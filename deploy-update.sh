#!/bin/bash
set -e

echo "==> Получение последних изменений..."
git pull origin main

echo "==> Установка зависимостей..."
npm ci --omit=dev

echo "==> Сборка проекта..."
npm run build

echo "==> Перезапуск приложения..."
pm2 restart yukbozor --update-env

echo "==> Готово! Статус:"
pm2 status yukbozor
