# Stellaris Empire Planner — Claude Context

## Keeping This File Current

**After every session where a major feature is implemented or an important pattern/fix is discovered, update the relevant sections of this file.** Treat it as the authoritative hand-off document for the next session. The memory at `~/.claude/projects/…/memory/` is local-only; this file travels with the repo.

---

## Project Overview

Two repos that work together:
- **`stellaris-empire-planner`** — SvelteKit 2 / Svelte 5 / SkeletonUI v4 / Tailwind v4 / `pnpm` / TypeScript. The web app.
- **`stellaris-data-extraction`** — Python extraction pipeline. Parses Stellaris game files → SQLite DB.

DB path: `STELLARIS_DB=/home/mk/Projects/stellaris-data-extraction/sqlite/stellaris.sqlite` (from `.env`).

After changing the extraction script, regenerate the DB:
```
cd stellaris-data-extraction
python3 stellaris-extract.py /home/mk/.local/share/Steam/steamapps/common/Stellaris --sqlite sqlite/stellaris.sqlite
```

---

## DB Schema

```
dlc                     — name (PK), steam_id, affects_gameplay
species_class           — key, label, archetype (BIOLOGICAL/LITHOID/MACHINE), graphical_culture, …
species_class_attribute
portrait_set
species_archetype       — key, trait_points, max_traits, robotic, base_trait
trait                   — key, cost, category, initial, hidden, required_dlc
trait_archetype         — trait_key, archetype
trait_species_class     — trait_key, species_class_key
trait_opposite          — trait_key, opposite_key
trait_tag               — trait_key, tag
trait_modifier          — trait_key, modifier_key, modifier_value, sort_order
modifier_label          — modifier_key (PK), label, positive_is_good  ← DROP+CREATE each run
named_color             — key, r, g, b, a, source_file
trait_category          — key, label, color_key (FK→named_color), display_order
ethic                   — key, label, cost (1/2/3), category, fanatic_variant, regular_variant, gestalt
ethic_modifier          — ethic_key, modifier_key, modifier_value, sort_order
ethic_tag_label         — tag (PK), label  ← DROP+CREATE each run
ethic_tag               — ethic_key, tag, sort_order
ethic_policy_restriction — policy_key, option_key, option_label, ethic_key
precursor               — key, name, required_dlc, system_initializer, picture, num_digsites, sort_order
precursor_relic         — precursor_key, relic_key, name, portrait, score, description, active_effect
precursor_relic_modifier — relic_key, modifier_key, modifier_value, condition (null=always), sort_order
precursor_reward_modifier — precursor_key, static_modifier, variant, name, modifier_key, modifier_value
precursor_building      — precursor_key, building_key, name, scope (planet/starbase)
precursor_full          — VIEW: one row/precursor with relic+building pre-joined
deposit                 — key, name, category, is_blocker, clear_time   (dictionary)
deposit_resource        — deposit_key, kind (produces/cost/upkeep), resource, amount
deposit_modifier        — deposit_key, modifier_key, modifier_value
precursor_system        — precursor_key, initializer, name, star_class, sort_order  (1..n per precursor)
precursor_planet        — id "<init>#<idx>", precursor_key, initializer, name, planet_class(+_label), size, is_moon, is_homeworld, flags
precursor_planet_deposit — planet_id, deposit_key (FK→deposit), sort_order
precursor_planet_modifier — planet_id, static_modifier, modifier_key, modifier_value
precursor_megastructure — precursor_key, initializer, type, type_label, count (e.g. 4 ruined ring sections)
```

All precursor/deposit tables are DROP+CREATE each extraction run.

---

## `src/lib/server/db.ts`

Key exports: `Trait`, `Archetype`, `TraitCategory`, `SpeciesClass`, `Modifier`, `Ethic`, `EthicImplication`, `PolicyRestriction`, `Precursor` (+ `PrecursorRelic`, `RelicModifier`, `RelicResource`, `PrecursorReward`, `PrecursorBuilding`, `PrecursorSystem`, `PrecursorPlanet`, `PlanetDeposit`, `DepositResource`, `PrecursorMegastructure`).

Key functions:
- `loadTraits()` — main trait query + separate modifier query, merged by key. Filters `initial=1 AND hidden=0`.
- `loadTraitsForKeys(keys)` — loads specific trait keys (used for base traits: organic, lithoid, machine_unit).
- `loadSpeciesClasses()` — returns `{ key, label, archetype }`, filtered to BIOLOGICAL/LITHOID/MACHINE.
- `loadEthics()` — returns ethics with `modifiers[]`, `implications[]`, `policyRestrictions[]`.
- `loadPrecursors()` — fully-stitched `Precursor[]`: each with `relic` (+passives w/ `condition`), `rewards[]` (grouped by variant — Vultaum has 4), `buildings[]`, and `systems[]` → `planets[]` → `deposits[]` (resolved against the `deposit` dictionary) + planet `modifiers[]` + system `megastructures[]`. Several queries stitched in JS by `precursor_key`/`relic_key`/`initializer`/`planet_id`.

`Modifier.positiveIsGood` — false for cost/upkeep/size modifiers (see INVERTED_MODIFIERS in extraction script).

---

## Routes

### `/` — Species Builder (`src/routes/+page.svelte`)

**Page data:** `{ traits, archetypes, traitCategories, speciesClasses, baseTraits, debugDisableSelection }`

**State:**
- `archetypeGroup: 'BIOLOGICAL' | 'MACHINE'` — top-level group (Lithoid is NOT a top-level choice)
- `selectedClassKey: string | null` — specific species class within the group
- `archetype` (derived) — actual trait filter archetype: `selectedClass?.archetype ?? archetypeGroup`
- `selected: Set<string>` — selected trait keys
- `activeTags: Set<string>` — active tag filter keys

**Budget:** `effectiveBudget = maxPoints + |negativeBonus|` (expands with negative-cost traits).

**Trait card snippet:** `traitCard(trait, borderColor, isBase = false)`
- `isBase=true` → renders as `<div>`, "Base" badge (amber), no interaction. Base trait shown first in summary grid.
- States: selected (primary), conflicted (red ring, opacity-50), blocked (opacity-35), normal (card-hover).
- Bottom: modifier list → species class badges → tag badges (filtered by `HIDDEN_CARD_TAGS`).

**Tag filter (below sticky header):**
- Groups: Tags / Species / Polarity
- `HIDDEN_CARD_TAGS` — tags not shown on cards (polarity/archetype classification)
- `SPECIES_PHENOTYPE_TAGS` — aquatic, arthropoid, avian, fungoid, humanoid, lithoid, mammalian, molluscoid, necroid, organic, plantoid, reptilian, species, toxoid
- `POLARITY_TAGS` — positive, negative
- Species row: `species` tag first, then `|` separator, then rest alphabetically
- Polarity row: positive before negative (explicit order, not alphabetical)

**Species picker (below archetype group buttons, above tags):**
- Shows all classes for current `archetypeGroup` (including Lithoid under Biological)
- Selecting a class filters phenotype traits to that class only; "By phenotype" toggle hidden
- Changing `archetypeGroup` clears `selectedClassKey` and `activeTags`

**Category sections:** `traitsByCategory` derives from `filteredVisibleTraits` (tag-filtered), which derives from `visibleTraits` (archetype+class filtered). Category grouping: phenotype has flat/by-phenotype toggle (hidden when class selected); others have species-class sub-groups.

### `/ethics` — Ethics Picker (`src/routes/ethics/+page.svelte`)

**Page data:** `{ ethics }`  — `Ethic[]` with modifiers, implications, policyRestrictions pre-loaded.

**State:** `selected: Set<string>` — selected ethic keys. Budget: 3 pts.

**AXES** (defines picker layout and table column order):
```js
[['ethic_authoritarian', 'ethic_egalitarian'],
 ['ethic_xenophobe',     'ethic_xenophile'],
 ['ethic_militarist',    'ethic_pacifist'],
 ['ethic_spiritualist',  'ethic_materialist']]
```

**Sections:**
1. Budget indicator (3 dots)
2. Ethics picker — 4 axis rows + Gestalt below separator. Buttons show modifiers in `title` tooltip.
3. Selected effects — flat modifier list (`max-w-sm`) + "Gameplay Implications" (tags + policy restrictions), both with source annotation.
4. **Effects by Ethic** table — `overflow-auto max-h-128`, 8 paired columns, rows = all modifier keys, cell = `+5% (+10%)`.
5. **Gameplay Implications by Ethic** table — same columns. Tag rows (● / reg / fan / —) then "Policy restrictions" sub-section. Policy key shown as `title` on hover.
6. **Monument Bonuses per 100 Civilians** — hard-coded from wiki (game building scripts too complex to parse). 4 columns: Ethic / Effect / Regular / Fanatic.

**Sticky headers:** Apply `sticky top-0 z-10` + `style="background-color: …"` to each `<th>` individually — NOT to `<thead>`. Required for Firefox. Tables must be in `overflow-auto max-h-128` scroll containers (not `overflow-x-auto`) for sticky to work cross-browser.

### `/precursors` — Precursors (`src/routes/precursors/+page.svelte`)

**Page data:** `{ precursors }` — `Precursor[]` from `loadPrecursors()`, fully pre-loaded.

A reference/"wiki-in-one" page: not really empire *planning*, but the in-game
galaxy setup lets you pick which precursors are available — so the page's one
piece of state is an **availability toggle** per precursor.

**State:** `enabled: Set<string>` — default all on. `Enable all` / `Disable all`;
disabled cards dim (`opacity-45`). (Initial set is read from `data` once →
needs a `// svelte-ignore state_referenced_locally` since it's an intentional
one-shot default.)

**Layout:** cards grouped by DLC (`Base game` / `Ancient Relics Story Pack` /
`Cosmic Storms`) in a `lg:grid-cols-2` via `groupByDlc()` — base game first, then
DLCs in first-appearance order, **precursors sorted alphabetically by name within
each group** (deterministic; covered by tests). Each card shows, always-visible:
Permanent effect, Relic, Building(s), and the **Home system(s)**.

**Relic block** shows the full picture: the **passive** (numeric modifiers w/
condition note + `passiveText` for non-numeric ones like the Cybrex Warform
armies) and a **Triumph (active)** sub-block — `activeEffect` text,
`activeModifiers` (temporary modifiers the active grants, e.g. the Reality
Perforator's four +40% combat buffs) + `activeDetail` (how they're granted, e.g.
"One at random for 2–5 years, or all of them for 1 year"), `produces`
(resources gained), activation `costs`, and cooldown. `relicResourceLabel(list)`
formats both `costs` and `produces` (e.g. "3000 Unity, 2000 Minerals (grows with
each use)", "1000 Alloys (grows with each use)"); `cooldownLabel(days)` →
Stellaris years. The produced amount comes from the script (`add_resource`), **not**
the loc tooltip, which can be stale (the War Forge loc wrongly says 5000 alloys;
the real payout is 1000, +1000/use). Relics with only a numeric passive (Cybrex)
used to look empty — now they don't.

**Empire-type filter.** A toolbar highlights the effects that apply to a chosen
empire type. `empireFilter: 'planner' | EmpireType`; `'planner'` is the default
**placeholder** (no highlighting — will later read the empire from the Species
Builder). `activeType` (derived) is null for `'planner'`. When a type is picked:
non-applicable reward variants / relic passives dim (`opacity-40`/`30`),
applicable ones get a `text-primary-400` accent (+ ✓ on the variant).
- `variantApplies(variant, type)` — reward variants (controlled vocab):
  `suppressed`/`public` → regular/wilderness, `machine`→machine, `hive`→hive,
  `hive_machine`→hive/machine, `default`→all.
- `conditionApplies(condition, type)` — parses the relic-passive condition string
  (AND = comma; OR = parenthesised `(a OR b)`) against `EMPIRE_FLAGS`
  (`is_machine_empire`/`is_wilderness_empire`; hive reads same as regular).
  `conditionLabel` is now derived from `applicableTypes()` ("regular / hive",
  "non-wilderness"), replacing the old hardcoded string map. **Depends on the
  extraction emitting parseable OR conditions** (see extraction CLAUDE.md).

**Reward variants (Vultaum).** Vultaum's `_machine`/`_hive` reward modifiers both
localise to the same name ("Secrets of the Vultaum"), so a bare name is
ambiguous. `VARIANT_LABELS` maps the `variant` key → empire-type/choice
descriptor ("Regular empire — research kept secret", "Machine empire", …); for
multi-variant rewards the card shows that descriptor + the loc name and an
"Only one applies, by empire type / choice" note.

**Home system — relevant-first.** `isRelevant(planet)` = homeworld OR has a
resource (non-blocker) deposit OR has a modifier OR class ∈ `RELEVANT_CLASSES`
(habitable/colonizable, the special precursor worlds, ringworld sections) OR ∈
`TERRAFORM_CANDIDATE` (`pc_toxic`). Relevant bodies render by default; the rest
(barren/asteroids/gas giants w/o deposits) sit behind a "N more bodies"
`<details>`. The `planetRow` snippet renders each: type/size, a `terraformable`
tag, deposit chips via `depositChips()` (resource yields green & individual;
blockers collapsed by name with `×count`; homeworld ★) + `precursor_planet_modifier`
rows. Megastructures are violet chips on the system header via `megaLabel()`,
which appends `×N` when `count > 1` (e.g. Cybrex Alpha's "Ruined Ring Section ×4").
The empty-state note ("No habitable worlds…") is suppressed when a megastructure
is present (e.g. Cybrex Alpha's ruined ring world).

These planet-class sets are **hardcoded** in the component (like the home page's
phenotype-tag sets) — not data-driven. Extend if a precursor world isn't shown.

**Formatting helpers** mirror the ethics page: `formatValue` (sign; `_add` →
integer, else `×100%`), `valueColor` (`positiveIsGood`), `modLabel` (strips
`[...]` tags). Plus `resourceLabel` (deposit yields), `conditionLabel` (relic
`potential` → short note), `variantLabel` (reward variant display name).

**Nav chain:** Species Builder → Ethics → Precursors (footer/header links).

**Pure helpers live in [`src/lib/precursors.ts`](src/lib/precursors.ts)** (not the
component): the empire-type applies-logic (`variantApplies`, `conditionApplies`,
`clauseMatches`, `applicableTypes`, `conditionLabel`), modifier formatting
(`formatValue`, `valueColor`, `modLabel`), `variantLabel`, `resourceLabel`, and
the planet/deposit helpers (`shownPlanets`, `isRelevant`, `isTerraformable`,
`depositChips`, `RELEVANT_CLASSES`, `TERRAFORM_CANDIDATE`), plus `dlcBadge`. The
component keeps only reactive state/derived (`enabled`, `empireFilter`,
`activeType`, `groups`) and the `planetRow` snippet. Types are imported
type-only from `$lib/server/db` (erased at runtime, so the file is client-safe).

---

## Testing

**Vitest** (`pnpm test`, `pnpm test:watch`). Config: `test` block in
[vite.config.ts](vite.config.ts) (`defineConfig` from `vitest/config`); specs are
`src/**/*.{test,spec}.ts`.

[`src/lib/precursors.test.ts`](src/lib/precursors.test.ts) covers the pure
helpers — the empire-type truth table is the high-value part (e.g. Baol's
AND/OR `potential` branches → which empire types each relic passive applies to;
Vultaum/Inetian reward variants; plus formatting helpers like `relicCostLabel`,
`cooldownLabel`, `groupByDlc`, `megaLabel`). Tests import the module **relatively**
(`./precursors`) and build fixtures from the `$lib/server/db` types, so they need
no `$lib` alias or DB at runtime. Pure presentation logic only — no component
rendering, no DB. Add cases here when extending `precursors.ts`.

---

## Trait Category Colors

| category  | label            | hex      |
|-----------|------------------|----------|
| normal    | Species Traits   | #30dfb9  |
| phenotype | Phenotype Traits | #2cec45  |
| robotic   | Synthetic Traits | #00d2c6  |
| psionic   | Psionic Traits   | #8b30f0  |
| overtuned | Overtuned Traits | #d58800  |
| cyborg    | Cybernetic Traits| #009dd4  |
| malleable | Malleable Traits | #ceb108  |
| mutation  | Mutation Traits  | #d82d39  |

---

## Known Deferred Issues

- Modifier sign color for Overtuned traits (positive-cost but mixed +/– effects).
- Phase 2 modifiers: triggered/conditional modifiers, `custom_tooltip`, `inline_script`.
- Portrait picker (data already in DB).
- Species name generation (`common/species_names/`).

---

## Companion repo: Stellaris Modding Insights

A sibling repo collects hard-won, poorly-documented Stellaris findings — engine quirks, parser/format gotchas, things only obvious in hindsight:
`../stellaris-modding-insights` (`/home/mk/Projects/stellaris-modding-insights`, https://github.com/mkoester/stellaris-modding-insights). It's community-facing notes organised as `docs/NN-topic.md` with a TL;DR index in `README.md`. Especially relevant here: how vanilla game scripts (traits, ethics, species classes, `localisation/`) are structured, since this planner consumes that extracted data.

**When you discover something noteworthy** — a surprising bit of how the game data is modelled, an undocumented localisation/format detail, a non-obvious gotcha, or anything that cost real time to figure out — proactively suggest recording it in the insights repo. Don't write there silently: propose what to add (which `docs/` file, a one-line TL;DR) and let the user confirm, since it's a separate, published repo. Keep planner/app-specific notes in this file; route generally-useful Stellaris modding knowledge to the insights repo.
