# SYLHN POS — Deployment Guide

This guide covers three deployment options:
1. **Docker** (recommended for most stores)
2. **Caddy + systemd** (for bare-metal Linux servers)
3. **PM2** (alternative process manager)

---

## Option 1: Docker (Recommended)

### Prerequisites
- Docker 20+ installed on the host
- A domain name (e.g. `pos.sylhn.com`) pointed at the server

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Sallysak/sylhn-pos.git
cd sylhn-pos

# 2. Build the Docker image
docker build -t sylhn-pos .

# 3. Create a Docker network for the proxy
docker network create sylhn-net

# 4. Run Caddy (reverse proxy with automatic TLS)
docker run -d \
  --name caddy \
  --network sylhn-net \
  -p 80:80 -p 443:443 \
  -v caddy_data:/data \
  -v $PWD/Caddyfile:/etc/caddy/Caddyfile \
  --restart unless-stopped \
  caddy:2

# 5. Run the POS app
docker run -d \
  --name sylhn-pos \
  --network sylhn-net \
  -v sylhn_pos_db:/app/db \
  -v sylhn_pos_backups:/app/backups \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e NODE_ENV=production \
  -e DATABASE_URL=file:/app/db/custom.db \
  --restart unless-stopped \
  sylhn-pos

# 6. Run the initial migration + seed (one-time)
docker exec -it sylhn-pos bun run db:migrate:deploy
docker exec -it sylhn-pos bun run seed
# ⚠️ SAVE THE PRINTED CREDENTIALS — they will NOT be shown again.
```

### Caddyfile (reverse proxy with TLS)

```
pos.sylhn.com {
    reverse_proxy sylhn-pos:3000
    encode gzip zstd
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options nosniff
        X-Frame-Options SAMEORIGIN
        Referrer-Policy strict-origin-when-cross-origin
    }
}
```

### Updating

```bash
git pull
docker build -t sylhn-pos .
docker restart sylhn-pos
# If schema changed:
docker exec -it sylhn-pos bun run db:migrate:deploy
```

---

## Option 2: Caddy + systemd (bare-metal)

### Prerequisites
- Ubuntu 22.04+ or Debian 12+
- Bun 1.0+ installed (`curl -fsSL https://bun.sh/install | bash`)
- Caddy installed (`sudo apt install caddy`)

### Steps

```bash
# 1. Create a dedicated user
sudo useradd -r -s /bin/false -m -d /var/lib/sylhn-pos sylhn-pos

# 2. Clone the repo
sudo -u sylhn-pos git clone https://github.com/Sallysak/sylhn-pos.git /var/lib/sylhn-pos/app
cd /var/lib/sylhn-pos/app

# 3. Install dependencies + build
sudo -u sylhn-pos bun install
sudo -u sylhn-pos bun run build

# 4. Create the database directory
sudo -u sylhn-pos mkdir -p /var/lib/sylhn-pos/db
sudo -u sylhn-pos cp .env.example /var/lib/sylhn-pos/app/.env
sudo -u sylhn-pos nano /var/lib/sylhn-pos/app/.env
# Set SESSION_SECRET and DATABASE_URL=file:/var/lib/sylhn-pos/db/custom.db

# 5. Run migration + seed
sudo -u sylhn-pos bun run db:migrate:deploy
sudo -u sylhn-pos bun run seed
# SAVE THE PRINTED CREDENTIALS

# 6. Install the systemd service
sudo tee /etc/systemd/system/sylhn-pos.service << 'EOF'
[Unit]
Description=SYLHN POS
After=network.target

[Service]
Type=simple
User=sylhn-pos
WorkingDirectory=/var/lib/sylhn-pos/app
EnvironmentFile=/var/lib/sylhn-pos/app/.env
ExecStart=/home/sylhn-pos/.bun/bin/bun run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sylhn-pos

# 7. Configure Caddy
sudo tee /etc/caddy/Caddyfile << 'EOF'
pos.sylhn.com {
    reverse_proxy localhost:3000
    encode gzip zstd
}
EOF
sudo systemctl reload caddy
```

---

## Option 3: PM2

If you prefer PM2 over systemd:

```bash
sudo npm install -g pm2
cd /var/lib/sylhn-pos/app
pm2 start "bun run start" --name sylhn-pos
pm2 save
pm2 startup  # follow the instructions
```

---

## Post-Deployment Checklist

1. **Verify the app is up**: `curl https://pos.sylhn.com/api/health` should return `{"status":"ok"}`
2. **Log in**: Open `https://pos.sylhn.com` and log in with the seeded credentials
3. **Change all default passwords**: Go to Admin Panel → Users → change each user's password
4. **Set up daily backups**: See `docs/OPERATIONS.md`
5. **Set up monitoring**: See `docs/OPERATIONS.md`
6. **Test offline mode**: Disconnect the network, make a sale, reconnect — the sale should sync
7. **Test the thermal printer**: Pair a Bluetooth ESC/POS printer and print a test receipt
8. **Train the cashiers**: Walk them through the POS, void/refund flow, and end-of-day Z-Report

## Rollback

If a deployment goes wrong:

```bash
# Docker
docker stop sylhn-pos
docker run -d --name sylhn-pos-old --network sylhn-net sylhn-pos:previous-version
# Or restore the DB from backup:
docker exec -it sylhn-pos curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"pre-restore-YYYY-MM-DD.db"}' \
  http://localhost:3000/api/backups/restore
```
