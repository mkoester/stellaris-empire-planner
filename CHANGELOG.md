# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [0.1.5] - 2026-11-06

### Changed

- Picks work from the keyboard: Tab reaches each card or chip (outlined while focused), Space or
  Enter picks it, and screen readers announce its name and whether it is picked.
- Runs on SvelteKit 3 and Node 26 (the current LTS). **Deployment:** the `ORIGIN` setting is gone —
  the planner takes its origin from the request's `Host` header, so the reverse proxy must pass it
  through (`DEPLOY.md`); an `ORIGIN` line left in `.override.env` is ignored.

### Fixed

- Invalid HTML on the builder pages: cards were buttons holding chips, popups and other buttons,
  and tooltips sat inside paragraphs. The browser repaired that markup, so the page could differ
  from what the app expected and shift while loading.

## [0.1.4] - 2026-11-04

### Added

- Bugs and feedback go to the planner's forum on the Mirko's paradox Discord: linked from the
  home page, the footer, and a Discord icon in the header (before the versions).

## [0.1.3] - 2026-11-01

### Added

- Branch offices: a marker on each building for who may build it — every MegaCorp (a Criminal
  Syndicate only with a tie to the host), a Criminal Syndicate, a civic's (with the civics or
  origin that unlock it) or special —, what else it needs (a tech, 25+ pops on the colony, an
  upgraded capital), the civics that boost it, and "hide conflicting civics" as on council seats.
  Needs the extraction's `building.owner_trigger_json` and siblings (v0.1.9); without them
  the markers stay hidden.
  The same markers stand next to each building in "Civics that add to them".

### Fixed

- The version in the nav is git-decorated outside the container build too (`pnpm dev`, a local
  `pnpm build`): `-<hash>` off `main`, `-SNAPSHOT` with uncommitted changes
  (`scripts/version.mjs`). Before, only the server's build decorated it.

### Changed

- Branch offices: job amounts as the game's texts give them, in workforce ("+200 Trader
  jobs"), the job count on hover (before: +2, the workforce on hover).

## [0.1.2] - 2026-11-01

### Added

- "Jump to" links on the pages grouped into sections (civics, origins, jobs, buildings, repeatable
  and fallen empire techs, precursors).
- **Help me choose**, a new tab collecting the helpers that compare picks side by side:
  - **Council seats** — every seat a civic opens (who can hold it, what it gives per leader
    level), filterable by leader class, conflicting civics can be hidden; picking a row picks its
    civic.
  - **Branch offices** — each MegaCorp branch office building with what it gives the host colony
    and your capital, a badge per job it gives or adds to (↑: adds to its output) and a job
    filter, and the civics that add to which building, each a button that picks it. Needs the
    extraction's `building.owner_type` (v0.1.8).
  - **Agendas and edicts** — the council agendas and edicts a civic, origin or authority opens,
    each pick a button that picks it; conflicting picks can be hidden.
- Civic, origin and authority cards: a chip per council agenda or edict the pick opens (what it
  gives while active / once launched, what else it needs), and on civics a "Branch offices" chip
  with what the civic adds to them.
- Job amounts show the workforce they stand for on hover (200 workforce = 2 jobs).
- A floating "↑ Top" button on every page once it is scrolled down (before: traditions, ascension
  perks and federations only).

## [0.1.1] - 2026-10-27

### Added

- **Starting capital**: the empire page runs the game's own start-of-game setup scripts against
  the draft and shows the districts, zones and buildings the capital starts with — each with the
  conditions that put it there, district counts split by reason (3 base · +1 from Prosperous
  Unification), and any condition it cannot decide listed. Not yet compared with a real game start.
- Every builder page (ethics, government, civics, origins, species, planets, ships) has a table of
  what each pick adds to the starting capital.
- Starting-capital buildings show their numbers on hover, including the jobs' base output when
  worked.
- The ethics page pairs each axis side by side in its starting-capital and monument tables.

## [0.1.0] - 2026-10-20

First public release, hosted at https://stellaris-empire-planner.mirkokoester.de/.

### Added

- Build an empire step by step from the game's own data — species and traits, portrait, ethics,
  government and authority, civics, origin, planet, ships, names, flag and room — with the game's
  eligibility rules, costs and effects, and a running summary of the empire.
- Import and export empires in the game's own empire file format.
- Reference pages: precursors, tradition trees, ascension perks, federations, jobs, buildings,
  repeatable techs and Fallen Empire techs.
- The game version the data comes from, shown in the nav.
