#!/bin/bash

# =====================================================
# Yukbozor.uz - Скрипт автоматической установки
# Для Ubuntu 22.04 LTS на UzCloud VPS
# =====================================================

set -e

echo "================================================"
echo "  Yukbozor.uz - Установка на сервер"
echo "================================================"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Функция логирования
log() {
    echo -e "${GREEN}[✓]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

# Проверка root
if [ "$EUID" -ne 0 ]; then
    error "Запустите скрипт от имени root: sudo bash setup-server.sh"
fi

# Переменные
DOMAIN="yukbozor.uz"
APP_DIR="/var/www/yukbozor"
DB_NAME="yukbozor"
DB_USER="yukbozor"
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)
SESSION_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
ADMIN_SECRET=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

echo ""
log "Начинаем установку для домена: $DOMAIN"
echo ""

# =====================================================
# 1. Обновление системы
# =====================================================
log "Обновление системы..."
apt update && apt upgrade -y

# =====================================================
# 2. Установка необходимых пакетов
# =====================================================
log "Установка базовых пакетов..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw

# =====================================================
# 3. Установка Node.js 20
# =====================================================
log "Установка Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

log "Node.js версия: $(node -v)"
log "npm версия: $(npm -v)"

# =====================================================
# 4. Установка PostgreSQL
# =====================================================
log "Установка PostgreSQL..."
apt install -y postgresql postgresql-contrib

# Запуск PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Создание базы данных и пользователя
log "Настройка базы данных..."
sudo -u postgres psql << EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

log "База данных создана: $DB_NAME"

# =====================================================
# 5. Настройка файрвола
# =====================================================
log "Настройка файрвола..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# =====================================================
# 6. Создание директории приложения
# =====================================================
log "Создание директории приложения..."
mkdir -p $APP_DIR
chown -R www-data:www-data $APP_DIR

# =====================================================
# 7. Настройка Nginx
# =====================================================
log "Настройка Nginx..."
cat > /etc/nginx/sites-available/yukbozor << 'NGINX'
server {
    listen 80;
    server_name yukbozor.uz www.yukbozor.uz;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Статические файлы
    location /assets {
        alias /var/www/yukbozor/dist/public/assets;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip сжатие
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;

    client_max_body_size 50M;
}
NGINX

# Активация сайта
ln -sf /etc/nginx/sites-available/yukbozor /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверка конфигурации Nginx
nginx -t

# Перезапуск Nginx
systemctl restart nginx
systemctl enable nginx

log "Nginx настроен"

# =====================================================
# 8. Сохранение переменных окружения
# =====================================================
log "Сохранение переменных окружения..."
cat > $APP_DIR/.env << EOF
NODE_ENV=production
PORT=5000

# База данных
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
PGHOST=localhost
PGPORT=5432
PGUSER=$DB_USER
PGPASSWORD=$DB_PASSWORD
PGDATABASE=$DB_NAME

# Секреты
SESSION_SECRET=$SESSION_SECRET
BOOTSTRAP_ADMIN_SECRET=$ADMIN_SECRET
EOF

chmod 600 $APP_DIR/.env
chown www-data:www-data $APP_DIR/.env

# =====================================================
# 9. Создание скрипта развёртывания
# =====================================================
log "Создание скрипта развёртывания..."
cat > $APP_DIR/deploy.sh << 'DEPLOY'
#!/bin/bash
cd /var/www/yukbozor

echo "Установка зависимостей..."
npm install --production

echo "Сборка приложения..."
npm run build

echo "Применение миграций базы данных..."
npm run db:push

echo "Перезапуск приложения..."
pm2 restart yukbozor || pm2 start dist/index.js --name yukbozor

echo "Сохранение конфигурации PM2..."
pm2 save

echo "Готово!"
DEPLOY

chmod +x $APP_DIR/deploy.sh

# =====================================================
# 10. Настройка PM2 для автозапуска
# =====================================================
log "Настройка автозапуска PM2..."
pm2 startup systemd -u root --hp /root
pm2 save

# =====================================================
# Завершение
# =====================================================
echo ""
echo "================================================"
echo -e "${GREEN}  Установка завершена успешно!${NC}"
echo "================================================"
echo ""
echo "Данные для подключения к базе данных:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "Секреты приложения:"
echo "  SESSION_SECRET: $SESSION_SECRET"
echo "  ADMIN_SECRET: $ADMIN_SECRET"
echo ""
echo "Сохраните эти данные в надёжном месте!"
echo ""
echo "Следующие шаги:"
echo "1. Загрузите файлы проекта в: $APP_DIR"
echo "2. Запустите: cd $APP_DIR && ./deploy.sh"
echo "3. Настройте SSL: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo ""
echo "================================================"

# Сохранение данных в файл
cat > /root/yukbozor-credentials.txt << EOF
Yukbozor.uz - Данные для доступа
================================
Создано: $(date)

База данных:
  Host: localhost
  Port: 5432
  Database: $DB_NAME
  User: $DB_USER
  Password: $DB_PASSWORD
  URL: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

Секреты:
  SESSION_SECRET: $SESSION_SECRET
  ADMIN_SECRET: $ADMIN_SECRET

Директория приложения: $APP_DIR
Домен: $DOMAIN
EOF

chmod 600 /root/yukbozor-credentials.txt
log "Данные сохранены в /root/yukbozor-credentials.txt"
S