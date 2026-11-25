# Analytics: page statistics and recurring visitors

**Status: implemented (2026-11-25).**

- Code: `src/lib/analytics.ts` (pure, tested), `src/lib/server/analytics.ts` (the DB),
  `src/routes/api/{pv,stats}/+server.ts`, `src/lib/ConsentBanner.svelte` +
  `consent.svelte.ts`, and the beacon in `+layout.svelte`.
- The analytics module sits outside `src/lib/server/db/` on purpose: that package is the
  read-only game DB. This is a separate, writable file.
- Deviation from the plan below: `/api/stats` also returns `returning-per-day` (visitors on a
  day whose id was seen on an earlier day), a series instead of a share, so the board can draw
  it next to `visitors-per-day`.
- **Still open before going live:** the privacy policy page and the imprint (§1). The banner has
  no link to a privacy policy yet, because none exists.

Goal: know which pages are used and how many visitors come back. No individual's path through the
site is recorded, and the setup stays small enough to need no third-party tool.

## 1. Legal frame (Germany / EU, not legal advice)

- **TDDDG §25** (formerly TTDSG): storing or reading anything on the visitor's device needs
  consent unless it is strictly necessary for what the visitor asked for. A cookie to recognise
  returning visitors is not strictly necessary, so it **needs consent**.
- **GDPR**: server logs and counters are processing too, but legitimate interest
  (Art. 6(1)(f)) covers them without consent. They still go into the privacy policy.
- **An "OK"-only banner is not valid consent.** Refusing must be as easy as accepting (CJEU
  *Planet49*; German courts have struck down banners without a reject button). So: **two equal
  buttons, "OK" and "No thanks"**, and no cookie before a click.
- **Before this goes live:** a privacy policy page (Datenschutzerklärung) naming the cookie, the
  counters and the Caddy logs, and probably an imprint (Impressum).

## 2. Cookie and banner

- One cookie, `consent`:
  - after "OK": `crypto.randomUUID()`, which is the visitor id
  - after "No thanks": `no`. Remembering a refusal is strictly necessary, so it needs no consent.
  - `Max-Age` 13 months, `SameSite=Lax`, `Secure`, `Path=/`.
  - Set from JavaScript, so there is no consent endpoint.
- Banner: a small bar fixed at the bottom of `src/routes/+layout.svelte`, rendered only while
  `document.cookie` has no `consent=` (client-only, so nothing differs in SSR output).
- Revocation: a footer link "Cookie settings" deletes the cookie and shows the banner again.

## 3. Page statistics, unlinkable by construction

- SvelteKit navigates on the client, so most page changes never reach the server as a request.
  Count them in `+layout.svelte`:

  ```ts
  afterNavigate(({ to }) => {
  	if (to?.route.id) navigator.sendBeacon('/api/pv', to.route.id);
  });
  ```

- Send the **route id** (`/civics`), never the URL: the query string carries the empire state.
- The server only increments an aggregate counter: `page_views(day, route, count)`, with no
  per-request rows. **This write never sees the visitor id**, so no one's navigation can be
  rebuilt from the data.
- Page views are counted for every visitor, consent or not, because nothing is stored on the
  device and no identifier is sent. Grey area: a strict reading of §25 also covers a JS beacon.
  Restricting the counter to consenting visitors takes one `if` in the endpoint.
- Side effect: crawlers rarely run JS, so bots are mostly filtered out for free.

## 4. Recurring visitors (consent only)

- On the same beacon request, if `consent` holds a UUID:
  `INSERT OR IGNORE INTO visitor_days(day, vid) VALUES (?, ?)`. It is a separate table with no
  route column.
- Retention: delete `visitor_days` rows older than 13 months (the cookie's lifetime) at startup
  and once a day.

## 5. Storage and code

- A **separate, writable** SQLite file at `ANALYTICS_DB`, opened with the existing
  `better-sqlite3`. The game DB stays read-only and untouched. With `ANALYTICS_DB` unset, analytics
  is off, so dev, tests and the DB smoke test are unaffected.
- Schema:

  ```sql
  CREATE TABLE IF NOT EXISTS page_views (
  	day TEXT NOT NULL, route TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  	PRIMARY KEY (day, route)
  );
  CREATE TABLE IF NOT EXISTS visitor_days (
  	day TEXT NOT NULL, vid TEXT NOT NULL,
  	PRIMARY KEY (day, vid)
  );
  ```

- Code:
  - `src/lib/server/analytics.ts`: open, migrate, `countPageView`, `recordVisitor`, `prune`.
  - `src/routes/api/pv/+server.ts`: a `POST` handler. Validate the route id against the known
    routes so arbitrary strings cannot fill the table, then return 204.
  - Pure helpers (day bucketing in UTC, parsing the `consent` value) get unit tests like the rest
    of `src/lib`.
- Deployment: the container stops being stateless. Model it on `quadlet-joplin`'s bind mounts.
  - `stellaris-empire-planner.container`:

    ```ini
    # The image runs as `node` (UID 1000). keep-id maps that UID to the service user, so
    # files written in the volume belong to the service user on the host.
    UserNS=keep-id:uid=1000,gid=1000
    User=1000
    Group=1000

    Volume=%h/analytics:/app/analytics:Z
    ```

    Without `UserNS=keep-id`, rootless podman maps container UID 1000 to a subuid. The service
    user's directory is then not writable from inside, and the first beacon fails with
    `SQLITE_CANTOPEN` / `EACCES`. The unit's current comment ("no host-mounted writable paths")
    becomes wrong. Replace it.
  - **Mount the directory, not the file.** SQLite writes `-wal`/`-journal` files next to the DB,
    and a single-file mount has nowhere to put them.
  - env: `ANALYTICS_DB=/app/analytics/analytics.sqlite`. The app creates the file and runs the
    migrations on first start.
  - `DEPLOY.md`: a new step,
    `sudo -u stellaris-empire-planner mkdir -p ~stellaris-empire-planner/analytics`, and remove
    the "no volumes / stateless" statements.
  - Updating the game DB is still a rebuild and reship of the image. The analytics data survives
    that, because it lives on the host.
  - Backup per house rule: a host-side `sqlite3 ~stellaris-empire-planner/analytics/analytics.sqlite
    ".backup …"` into `/var/backups/stellaris-empire-planner/` (`UMask=0027`, the
    `backup-readers` ACL). Never copy the live file with `cp`/`rsync`.
  - Check after the first deploy: the file is owned by `stellaris-empire-planner` on the host
    (`ls -ln ~stellaris-empire-planner/analytics`), and a page view grows `page_views`.

## 6. Reading the numbers

Phase 1 has no UI. Query the file on the server:

```sql
-- top routes, last 30 days
SELECT route, SUM(count) AS views FROM page_views
WHERE day >= date('now', '-30 days') GROUP BY route ORDER BY views DESC;

-- unique consenting visitors per day
SELECT day, COUNT(*) AS visitors FROM visitor_days GROUP BY day ORDER BY day DESC LIMIT 30;

-- returning visitors: seen on 2+ distinct days in the last 30
SELECT COUNT(*) FROM (
	SELECT vid FROM visitor_days WHERE day >= date('now', '-30 days')
	GROUP BY vid HAVING COUNT(*) >= 2
);
```

Unique and returning counts cover consenting visitors only. Page views cover everyone.

Phase 2: no `/stats` page in the planner. `GET /api/stats` returns the aggregates in
stats-board's native format, protected by Caddy `basic_auth` on `/api/stats*` (its own
credential). The stats-board displays them (`workspace_homelab/docs/stats-board.md`). The queries
above stay as the fallback.

## 7. Caddy access logs

Independent of the above, and worth doing first. The defaults log full client IPs and keep them
for 90 days (`roll_keep_for 2160h`), and a small site may never reach `roll_size 100MiB`, so
nothing is ever deleted. `Cookie` is redacted by default, so the `consent` value never shows up
in the logs. Leave `log_credentials` off.

```caddy
log {
	output file /var/log/caddy/access.log {
		roll_interval 24h
		roll_keep_for 168h
	}
	format filter {
		request>remote_ip ip_mask {
			ipv4 24
			ipv6 48
		}
		request>client_ip ip_mask {
			ipv4 24
			ipv6 48
		}
		wrap json
	}
}
```

- If `caddy validate` rejects `roll_interval` (older Caddy), use `roll_size 1MiB` instead.
- Use `ip_mask`, not `hash`: Caddy's `hash` is an unsalted, truncated SHA-256, and anyone can
  reverse it by trying every IPv4 address.
- Once it works, delete the old `access.log*` files that still hold full IPs.
- Check: `sudo tail -n1 /var/log/caddy/access.log | jq '.request.remote_ip, .request.client_ip'`
  should end in `.0`.
