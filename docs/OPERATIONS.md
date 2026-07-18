# SYLHN POS — Operations Runbook

Day-to-day operations for running SYLHN POS in production.

---

## Daily Operations

### Opening the store (cashier)

1. Log in with your cashier credentials
2. Open the cash drawer, count the opening float
3. Click "Open Shift" in the POS → enter the opening float amount
4. The shift is now open — all sales will be attributed to you

### End of day (cashier or manager)

1. Click "Close Shift" in the POS
2. Count the actual cash in the drawer
3. Enter the counted amount — the system computes the variance
4. Generate the Z-Report (`Reports → Z-Report`) — print or save it
5. The shift is now closed

### Z-Report

The Z-Report shows:
- Gross sales, voids, refunds (count + total)
- Payment method breakdown (cash, card, momo)
- Per-cashier breakdown
- Top products sold
- Cash variance (expected vs actual)

To generate: `Reports → Z-Report → Today → Generate`

---

## Backups

### Manual backup

```bash
# Via the API (requires admin token)
curl -X POST https://pos.sylhn.com/api/backups \
  -H "Authorization: Bearer $TOKEN"

# Or via direct file copy on the server
cp /var/lib/sylhn-pos/db/custom.db /var/lib/sylhn-pos/backups/manual-$(date +%Y%m%d-%H%M%S).db
```

### Automated daily backup (cron)

```bash
# Install the cron job
sudo crontab -e -u sylhn-pos

# Add this line — runs at 2am every day
0 2 * * * cd /var/lib/sylhn-pos/app && curl -X POST -H "Authorization: Bearer $(cat /var/lib/sylhn-pos/.admin-token)" http://localhost:3000/api/backups >> /var/log/sylhn-backup.log 2>&1

# Or use the included script (TODO: add scripts/backup-cron.sh)
```

### Off-site backup (recommended)

For disaster recovery, upload backups to cloud storage:

```bash
# In .env, set:
BACKUP_S3_BUCKET=sylhn-pos-backups
BACKUP_S3_REGION=af-west-1
BACKUP_S3_ACCESS_KEY=...
BACKUP_S3_SECRET_KEY=...

# The /api/backups POST endpoint will automatically upload to S3
# after creating the local copy.
```

### Restore

```bash
# Via the API (requires admin token)
curl -X POST https://pos.sylhn.com/api/backups/restore \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"backup-2026-07-18.db"}'

# A pre-restore safety backup is automatically created.
# The server must be restarted after restore:
sudo systemctl restart sylhn-pos
```

### Backup retention

- Local backups: keep 30 days (delete older with `find /var/lib/sylhn-pos/backups -mtime +30 -delete`)
- Off-site (S3): keep 90 days via S3 lifecycle policy

---

## Monitoring

### Health check

```bash
curl https://pos.sylhn.com/api/health
# Returns: { "status": "ok", "uptime": 12345, "env": "production", "db": "ok" }
# If DB is unreachable: HTTP 503 + { "status": "degraded", "db": "error" }
```

Set up an external monitor (UptimeRobot, Pingdom, or a custom script) to hit `/api/health` every 5 minutes and alert on non-200 responses.

### Sentry (error monitoring)

In `.env`:
```
SENTRY_DSN=https://your-key@sentry.io/your-project
```

The app automatically captures unhandled errors and reports them to Sentry.

### Log monitoring

The app logs to stdout. With systemd:
```bash
sudo journalctl -u sylhn-pos -f  # follow logs
sudo journalctl -u sylhn-pos --since "1 hour ago"
```

### Disk space

SQLite DB grows over time. Monitor disk usage:
```bash
df -h /var/lib/sylhn-pos
du -sh /var/lib/sylhn-pos/db /var/lib/sylhn-pos/backups
```

If disk is filling up:
1. Delete old backups: `find /var/lib/sylhn-pos/backups -mtime +30 -delete`
2. Vacuum the DB: `sqlite3 /var/lib/sylhn-pos/db/custom.db "VACUUM;"`

---

## User Management

### Add a new user

1. Log in as admin
2. Go to Admin Panel → Users → Add User
3. Enter username, full name, role, phone, email
4. The system generates a random password — give it to the user
5. The user should change their password on first login

### Reset a forgotten password

**Option A — via the Admin Panel (admin only):**
1. Log in as admin
2. Go to Admin Panel → Users → find the user → Reset Password
3. The system generates a new random password

**Option B — via the seed script (server-side):**
```bash
sudo -u sylhn-pos bun run /var/lib/sylhn-pos/app/scripts/reset-password.js <username>
```

### Disable a user (without deleting)

1. Go to Admin Panel → Users → find the user → uncheck "Active"
2. The user can no longer log in, but their historical sales are preserved

---

## Common Issues

### "Database is locked" errors

This usually means concurrent writes are conflicting. The app uses SQLite WAL mode, which should prevent this. If you still see it:

1. Check that no other process is writing to the DB file
2. Restart the app: `sudo systemctl restart sylhn-pos`
3. If it persists, switch to PostgreSQL (see `docs/MIGRATE_TO_POSTGRES.md` — TODO)

### Bluetooth printer not connecting

1. Make sure the printer is paired with the device (Settings → Bluetooth)
2. Make sure the printer is ESC/POS compatible (most thermal printers are)
3. Try the printer at `/api/printer/test` (admin only)
4. Some browsers (Firefox, Safari) don't support Web Bluetooth — use Chrome or Edge

### Offline sales not syncing

1. Check that the device is online
2. Click the "Sync" button in the mobile nav drawer
3. If a sale is stuck in the queue, you can inspect it via the Sync Settings page
4. As a last resort, clear the queue: `localStorage.removeItem("sylhn-offline-queue")` (this LOSES the unsynced sales)

### "Session expired" errors

The session cookie expires after 8 hours. The user will be logged out automatically. They just need to log in again.

If this happens immediately after login, the cookie isn't being set — check:
1. The browser isn't blocking third-party cookies (in dev/preview only)
2. The server is on HTTPS in production (cookies require `Secure` flag)
3. The `SESSION_SECRET` env var is set

---

## Security Incident Response

### If you suspect a data breach

1. **Immediately**: Change all user passwords via the Admin Panel
2. Rotate the `SESSION_SECRET` env var (this invalidates all sessions — all users must log in again)
3. Review the Audit Log (`Admin Panel → Audit Log`) for suspicious activity
4. Restore from a known-good backup if data was modified
5. File a report with the Ghana Data Protection Commission if PII was exposed

### If a cashier's credentials are leaked

1. Disable the user account in the Admin Panel
2. Review all sales made by that user in the past 24 hours
3. Void any fraudulent sales (requires manager approval)

### If the server is compromised

1. Disconnect the server from the network
2. Take a disk image for forensic analysis
3. Rebuild from a known-good backup on a fresh server
4. Rotate ALL credentials (SESSION_SECRET, SMTP, MoMo API keys, etc.)
5. Notify affected customers if PII was exposed

---

## Performance Tuning

### For stores with 10,000+ products

1. Enable SQLite WAL mode (already enabled by default)
2. Add database indexes for frequently-queried fields (most are already indexed — see `prisma/schema.prisma`)
3. Consider switching to PostgreSQL for better concurrent-write performance

### For stores with 5+ concurrent cashiers

1. SQLite WAL handles this, but monitor for "database is locked" errors
2. If you see lock errors, switch to PostgreSQL:
   ```bash
   # In .env:
   DATABASE_URL=postgresql://user:pass@localhost:5432/sylhn_pos
   # Then:
   bun run db:migrate:deploy
   ```

### For stores with slow internet

1. The offline sale queue handles this automatically
2. Adjust the queue flush interval in `/api/sync-settings` (default: every 30 seconds when online)
3. For very slow connections, set the queue to flush only on manual sync

---

## Disaster Recovery

### Recovery Time Objective (RTO): 1 hour
### Recovery Point Objective (RPO): 24 hours (daily backups)

### Recovery procedure

1. Provision a new server (or use a spare)
2. Follow the deployment guide in `docs/DEPLOYMENT.md`
3. Restore the latest backup:
   ```bash
   curl -X POST https://newserver/api/backups/restore \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"filename":"backup-2026-07-17.db"}'
   ```
4. Verify the restore by checking today's sales count
5. Update DNS to point to the new server
6. Notify cashiers of any IP/URL change
