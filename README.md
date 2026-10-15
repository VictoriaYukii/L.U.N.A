# AI Monitor — setup (Laragon)

1. Start Laragon (**Start All** — Apache + MySQL).
2. Unzip this folder to `C:\laragon\www\ai-dashboard\` (so `login.html` and `api/` sit directly inside it).
3. Open **http://ai-dashboard.test/api/install.php** once. It creates the `ai_monitor` database and tables.
4. Open **http://ai-dashboard.test** and create your account. **The first account becomes the admin.**
5. Optional: Settings -> API keys -> create a key so your real AI can report requests (see below).

Laragon's MySQL defaults (user `root`, no password) already match `api/config.php`. If you changed them, edit that file.

## Reporting requests from your AI

```
POST http://ai-dashboard.test/api/ingest.php
Authorization: Bearer aimon_xxxxxxxx            (or header  X-API-Key: aimon_xxxxxxxx)
Content-Type: application/json

{"user":"alice","chat":"Support bot","input_tokens":1200,"output_tokens":450,"latency_ms":900,"status":"ok"}
```
Send `{"events":[ ... ]}` for up to 500 at once. `user` must be an existing account (omit it to use the key owner).
Optional `timestamp_ms` backdates an event. `status` is `ok` or `error`.

## Folders
- `*.html`      the pages (login, overview, usage, requests, chats, performance, alerts, costs, users, settings, account)
- `css/`, `js/` styling and logic (`js/api.js` talks to the backend, `js/data.js` holds the numbers)
- `api/`        PHP backend (auth, bootstrap, requests, admin, ingest, install)
- `database/`   `schema.sql` (the tables)

## Going live checklist
- Use a host with PHP 8+ and MySQL/MariaDB (static-only hosts like Netlify can't run this).
- Create a dedicated MySQL user (not root) with a strong password; set it in `api/config.php`, or via `AIMON_DB_*` environment variables.
- Serve over HTTPS (cookies become `Secure` automatically).
- Create your admin account first, then close sign-ups on the Users page if you don't want strangers registering.
- Delete `api/install.php` after setup.
- Apache: the included `.htaccess` files block `api/inc/` and `database/`. On Nginx, add equivalent `deny all` rules for those folders.
- Back up the database with `mysqldump`.

## Limits worth knowing
- The dashboard loads the most recent 50,000 requests (last 65 days) and calculates charts in the browser. Beyond that, move the aggregation into SQL.
- No email: an admin resets a forgotten password from the Users page.
