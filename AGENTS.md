# stellaris-empire-planner

SvelteKit 2 / Svelte 5 / SkeletonUI v4 / Tailwind v4 / TypeScript / pnpm. Reads the SQLite DB built
by the sibling `stellaris-data-extraction` repo.

Cross-project conventions come from the OKF vault; workspace rules from `../AGENTS.md`. **The full
DB schema, the `src/lib/server/db/` package layout and the per-route state machines are in
`docs/design-notes.md`** — that is the working spec for the 25+ tables and every route, so read it
before changing a query or a page.

## Running it

DB path comes from `STELLARIS_DB` in the gitignored `.env`, pointing at
`../stellaris-data-extraction/sqlite/stellaris.sqlite` (absolute).

**⚠ `.env` is a `denyRead` target, so a sandboxed `pnpm dev` reads it as empty and dies with
`STELLARIS_DB is not set`.** That is the sandbox, not a misconfiguration. Pass it explicitly:

```sh
STELLARIS_DB=<abs path>/stellaris-data-extraction/sqlite/stellaris.sqlite pnpm dev --port 5201
```

Two consequences when driving the app this way, both harmless and both easy to misread as bugs:

- Vite logs a `.env changed, restarting server...` loop against the stub.
- Prettier reports `EACCES` on `.mcp.json` (another stub), so **`pnpm lint` exits non-zero for a
  reason unrelated to the code** — read the file list it prints before believing it.

Start the server and make the requests **in one Bash command**; that is general sandbox behaviour
covered by the vault's `claude-sandbox` skill, not a planner quirk.

When the restart loop makes the dev server answer 500/504, smoke-test a production build
instead (in one command): `STELLARIS_DB=… pnpm build`, then `STELLARIS_DB=… PORT=5202 node build`
and `curl` the routes. That needs no `.env`.

**Open check (2026-10-27): the Starting Capital card and tables have not been compared with a
real game start.** Start 3–4 contrasting empires on Linux (default materialist, hive, machine,
nomads), save on day 1, and compare each capital's districts, zones and buildings with the
card. Nomads come out with no capital building: confirm that in game.

After changing the extraction script, regenerate the DB from the sibling repo — the two are only
consistent if you do.

## Conventions

- **Game version comes from the `meta` table** (`game_version` / `game_version_raw`, read from the
  game's `launcher-settings.json`), surfaced by `loadGameVersion()` → `+layout.server.ts`. Never
  hardcode a version string.
- DB access stays inside `src/lib/server/db/`; routes consume its functions rather than issuing
  their own SQL.
