# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
    extraction's `building.owner_type` (2026-11-01).
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
