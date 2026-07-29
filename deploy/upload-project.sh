#!/bin/bash

# =====================================================
# Yukbozor.uz - Скрипт загрузки проекта на сервер
# Запускать на ЛОКАЛЬНОМ компьютере
# =====================================================

SERVER_IP="198.163.207.93"
SERVER_USER="root"
APP_DIR="/var/www/yukbozor"

echo "================================================"
echo "  Загрузка проекта на сервер"
echo "================================================"

# Проверяем наличие необходимых файлов
if [ ! -f "package.json" ]; then
    echo "Ошибка: Запустите скрипт из корневой папки проекта"
    exit 1
fi

echo "Создание архива проекта..."
# Исключаем ненужные папки
tar -czf /tmp/yukbozor-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='mobile/node_modules' \
    --exclude='.replit' \
    --exclude='replit.nix' \
    --exclude='deploy' \
    .

echo "Загрузка на сервер..."
scp /tmp/yukbozor-deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/

echo "Распаковка на сервере..."
ssh $SERVER_USER@$SERVER_IP << 'REMOTE'
cd /var/www/yukbozor
rm -rf *
tar -xzf /tmp/yukbozor-deploy.tar.gz
rm /tmp/yukbozor-deploy.tar.gz

echo "Установка зависимостей..."
npm install

echo "Сборка проекта..."
npm run build

echo "Применение миграций..."
npm run db:push --force

echo "Запуск приложения..."
pm2 restart yukbozor 2>/dev/null || pm2 start dist/index.js --name yukbozor
pm2 save

echo "Готово!"
REMOTE

rm /tmp/yukbozor-deploy.tar.gz

echo ""
echo "================================================"
echo "  Загрузка завершена!"
echo "================================================"
echo "Сайт доступен по адресу: https://yukbozor.uz"
