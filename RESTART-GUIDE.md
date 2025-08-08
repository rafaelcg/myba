# MyBA Rebuild & Restart Guide

This documents the standard steps to rebuild the frontend and restart the API on the VPS.

## Prereqs
- Ensure `.env` is configured (PUBLIC_BASE_URL, CORS_ORIGINS, INTERNAL_API_KEY, Stripe, Clerk, etc.)
- Nginx should proxy `/myba/api/` to `http://localhost:3001/api/`

## One-time (optional)
If using systemd instead of nohup, ensure the service exists:
- Unit file: `myba-api.service`
- Start/enable: `sudo systemctl enable --now myba-api`

## Rebuild frontend + deploy static
```bash
cd /var/www/html/myba
npm install
npm run build
./deploy.sh
```

## Restart API (nohup-based)
```bash
cd /var/www/html/myba
./stop-api.sh
nohup node server.js > api.log 2>&1 &
echo $! > api.pid
```

## Verify API
```bash
curl -s http://localhost:3001/api/health | jq .
```

## Alternative: Restart via systemd (if configured)
```bash
sudo systemctl restart myba-api
sudo systemctl status myba-api --no-pager -l
journalctl -u myba-api -n 100 --no-pager
```

## Notes
- Frontend is served at: `http://152.42.141.162/myba/`
- API proxied at: `http://152.42.141.162/myba/api/`
- Logs: `tail -f /var/www/html/myba/api.log`
