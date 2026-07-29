#!/bin/bash
set -e

APP_DIR=/home/uz-user/yukbozor
ARCHIVE=/home/uz-user/yukbozor-deploy.tar.gz

echo "==> [1/4] Очистка старых файлов..."
rm -f $APP_DIR/dist/*.js $APP_DIR/dist/*.cjs

echo "==> [2/4] Извлечение нового архива в $APP_DIR ..."
tar -xzf $ARCHIVE -C $APP_DIR

echo "==> [3/4] Установка зависимостей..."
cd $APP_DIR && npm install --omit=dev --registry https://registry.npmjs.org

echo "==> [4/4] Применение миграций БД..."
set -a && source $APP_DIR/.env && set +a
cd $APP_DIR
node $APP_DIR/run-migration.cjs

echo "==> [4/4] Перезапуск pm2..."
pm2 delete yukbozor 2>/dev/null || true
pm2 start ecosystem.config.cjs --update-env
pm2 save

echo "==> [5/5] Ожидание запуска..."
DEPLOY_TIME=$(date '+%Y-%m-%d %H:%M')
sleep 8

echo ""
pm2 status yukbozor

echo ""
echo "==> Ошибки с момента деплоя (если есть):"
grep "$DEPLOY_TIME" /home/uz-user/.pm2/logs/yukbozor-error.log 2>/dev/null || echo "(нет новых ошибок)"
echo ""
echo "✓ Деплой завершён."
