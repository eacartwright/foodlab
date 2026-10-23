# Runbook: foodlab on the mini PC

foodlab is hosted exactly like sideshow, beside it on the same mini PC. **sideshow's
[runbook](../../sideshow/docs/runbook.md) is the reference** (tools, Cloudflare, reboots, why this
setup); this file has only what's different. Legend: **[Evan]** = needs Evan.

## At a glance

| | |
|---|---|
| Code | `C:\Apps\foodlab`, a clone that only pulls `main` |
| Server | Scheduled task **foodlab** (at startup, as SYSTEM); `scripts\run.cmd` restarts it |
| Port | **8082**, reached as `127.0.0.1:8082` (8080 Caddy, 8081 sideshow) |
| Address | **https://foodlab.evans.tools** |
| Login | Cloudflare Access app `foodlab`, only Evan's email; `foodlab icons` app lets the manifest and icons through (needed for Android) |
| Data | `C:\Apps\foodlab\data\foodlab.db` |
| Backups | Daily to `\\evnas\Junk\Tech\DBBackups\foodlab`, 30 kept |
| Log | `C:\Apps\foodlab\data\server.log` |

## First deploy (done 2026-10-22)

1. Push the repo to GitHub (`eacartwright/foodlab`, private), from NOSTROMO. Done 2026-10-22.
2. On the mini PC:
   ```powershell
   git clone https://github.com/eacartwright/foodlab C:\Apps\foodlab
   cd C:\Apps\foodlab
   npm ci
   npm test
   ```
3. **[Evan]** Admin PowerShell:
   ```powershell
   cd C:\Apps\foodlab
   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Port 8082 -BackupDir \\evnas\Junk\Tech\DBBackups\foodlab
   ```
   Ends with `foodlab is up on http://127.0.0.1:8082 …`.
4. **[Evan]** Cloudflare, in this order (sideshow runbook §3b–3e):
   - **Access app first**: Self-hosted, name `foodlab`, hostname `foodlab.evans.tools`, session
     1 month, policy Allow → Emails → Evan's.
   - **Tunnel hostname**: the existing evans.tools tunnel → Public hostname `foodlab` ·
     `evans.tools` → HTTP `127.0.0.1:8082`.
   - **Public icons** (`foodlab icons`, Bypass, Everyone) for `manifest.webmanifest`, `icon.svg`,
     `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`. **Android needs this one:** Chrome
     builds the installed app (a "WebAPK") from the manifest and icons, partly through Google's
     servers, which have no Access cookie. Without it, Chrome makes a plain shortcut, and a
     shortcut can't be a share target, so **Share to foodlab** won't appear.
5. Verify, as for sideshow: the site and `/api/health` → 302 to the Access login; the five icon
   paths → 200; **[Evan]** desktop: sign in, status **Saved**.
6. **[Evan]** Android: Chrome → `foodlab.evans.tools` → sign in → ⋮ → **Install app** (or *Add to
   Home screen* → *Install*). Then share any web page and look for **foodlab** in the share
   sheet. If it's missing, uninstall, check step 4's bypass, and install again.

## Everyday

- **Update** after a push to `main`: admin PowerShell, `cd C:\Apps\foodlab; .\scripts\update.ps1`
  (a shortcut like sideshow's "Update sideshow" is worth making). The installed app picks up the
  new build next time it's opened.
- **Health:** `Invoke-RestMethod http://127.0.0.1:8082/api/health`.
- **Restore a backup:** `Stop-ScheduledTask foodlab`, copy the backup over `data\foodlab.db`,
  delete `data\foodlab.db-wal` and `-shm`, `Start-ScheduledTask foodlab`.
- **Signed out:** the status badge says **Signed out · Sign in**; changes wait on the device
  until then.
