# Развёртывание Yukbozor на VPS

## Быстрый деплой (2 команды)

**1. Загрузить файлы на сервер:**
```bash
scp release.zip deploy.sh ecosystem.config.cjs uz-user@198.163.207.109:~/yukbozor/
```

**2. Запустить деплой на сервере:**
```bash
ssh uz-user@198.163.207.109 "cd ~/yukbozor && chmod +x deploy.sh && ./deploy.sh"
```

Готово!

---

## Первоначальная настройка (один раз)

Если .env ещё не создан на сервере:

```bash
ssh uz-user@198.163.207.109
cat > ~/yukbozor/.env << 'EOF'
DATABASE_URL=postgresql://yukbozor:Yuk2025BozorSecure@localhost:5432/yukbozor_db
SESSION_SECRET=ваш_секретный_ключ
SMS_API_URL=ваш_url
SMS_LOGIN=ваш_логин
SMS_PASSWORD=ваш_пароль
EOF
```

---

## Данные сервера

- **IP**: 198.163.207.109
- **Пользователь**: uz-user
- **Путь**: /home/uz-user/yukbozor/
- **База**: yukbozor_db

## Команды управления

```bash
# Логи
pm2 logs yukbozor --lines 50

# Перезапуск
pm2 restart yukbozor

# Статус
pm2 status
```
