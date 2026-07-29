# Установка E-IMZO Server на VPS (UzCloud)

## Требования
- Ubuntu 22.04 LTS
- Java 8+ (JRE)
- Интернет соединение до vpn.e-imzo.uz:3443

## Шаг 1: Подключение к VPS

```bash
ssh root@ВАШ_IP_АДРЕС
```

## Шаг 2: Установка Java

```bash
apt update && apt install -y openjdk-8-jre-headless unzip
```

## Шаг 3: Создание директории

```bash
mkdir -p /opt/e-imzo-server
cd /opt/e-imzo-server
```

## Шаг 4: Загрузка файлов

Загрузите файлы с вашего компьютера на VPS:

```bash
# С вашего компьютера (не на VPS!):
scp e-imzo-server.jar root@ВАШ_IP:/opt/e-imzo-server/
scp config.properties root@ВАШ_IP:/opt/e-imzo-server/
scp -r keys root@ВАШ_IP:/opt/e-imzo-server/
```

## Шаг 5: Настройка Firewall

```bash
ufw allow 22/tcp
ufw allow 8080/tcp
ufw --force enable
```

## Шаг 6: Создание systemd сервиса

```bash
cat > /etc/systemd/system/e-imzo.service << 'EOF'
[Unit]
Description=E-IMZO Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/e-imzo-server
ExecStart=/usr/bin/java -Dfile.encoding=UTF-8 -jar e-imzo-server.jar config.properties
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
```

## Шаг 7: Запуск сервиса

```bash
systemctl daemon-reload
systemctl enable e-imzo
systemctl start e-imzo
```

## Шаг 8: Проверка

```bash
# Проверка статуса
systemctl status e-imzo

# Проверка логов
journalctl -u e-imzo -f

# Проверка VPN соединения
curl http://127.0.0.1:8080/ping
```

Ожидаемый ответ:
```json
{
  "serverDateTime": "2024-12-09 12:00:00",
  "yourIP": "127.0.0.1",
  "vpnKeyInfo": {
    "serialNumber": "...",
    "X500Name": "CN=yukbozor.uz",
    "validFrom": "...",
    "validTo": "2026-12-09 ..."
  }
}
```

## Шаг 9: Сообщите IP адрес

После успешной установки сообщите IP адрес VPS для интеграции с yukbozor.uz
