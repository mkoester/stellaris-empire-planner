# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
