# stellaris-empire-planner — design notes

**Archive, not instruction. Nothing here is loaded into a session.** The full former CLAUDE.md, verbatim: the DB schema, per-route state machines and dated fixes.

The rules an agent must have in context are in `../AGENTS.md`. Read this for _why_; put
new rules there and new evidence here.

---

# Stellaris Empire Planner — Claude Context

## Keeping This File Current

**After every session where a major feature is implemented or an important pattern/fix is discovered, update the relevant sections of this file.** Treat it as the authoritative hand-off document for the next session. The memory at `~/.claude/projects/…/memory/` is local-only; this file travels with the repo.

---

## Project Overview

Two repos that work together:

- **`stellaris-empire-planner`** — SvelteKit 2 / Svelte 5 / SkeletonUI v4 / Tailwind v4 / `pnpm` / TypeScript. The web app.
- **`stellaris-data-extraction`** — Python extraction pipeline. Parses Stellaris game files → SQLite DB.

DB path: `STELLARIS_DB` in the gitignored `.env`, pointing at the sibling checkout's `../stellaris-data-extraction/sqlite/stellaris.sqlite` (absolute path).

### Running the dev server from a Claude Code session (sandbox)

`.env` is an explicit `denyRead` target, which the sandbox implements as a `/dev/null` mount — so a sandboxed `pnpm dev` reads it as **empty** and dies with `STELLARIS_DB is not set`. Pass the path explicitly instead:

```
STELLARIS_DB=<abs path>/stellaris-data-extraction/sqlite/stellaris.sqlite pnpm dev --port 5201
```

Further effects when driving the app this way (verified 2026-07-27):

- **Start the server and make the requests in one Bash command** — a server left running by an earlier call is unreachable from a later one, and `curl` returns `000` while the server logs look healthy. This is general sandbox behaviour, not a planner quirk; the OKF vault's `practices/claude-code-sandbox.md` gotcha #13 has the details, including waiting via `curl --retry-connrefused` (foreground `sleep` is blocked).
- Vite logs a `.env changed, restarting server...` loop against the stub. Harmless.
- Prettier reports `EACCES` on `.mcp.json` (another stub), so `pnpm lint` exits non-zero for a reason unrelated to the code. Check the file list it prints.

**Game version:** `meta` table (`game_version` / `game_version_raw`, from the game's `launcher-settings.json`). `loadGameVersion()` → `+layout.server.ts` → shown fixed top-right by `+layout.svelte` ("Stellaris v4.3.7", full version as the `title`).

After changing the extraction script, regenerate the DB:

```
cd stellaris-data-extraction
python3 stellaris-extract.py ~/.local/share/Steam/steamapps/common/Stellaris --sqlite sqlite/stellaris.sqlite
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
civic                   — key, name, description, civic_type (normal/gestalt/corporate/special), required_dlc, selectable, locked, ascension_lock, ascension_blocks, icon, sort_order
civic_modifier          — civic_key, modifier_key, modifier_value, sort_order
council_position        — key, civic_key (NULL: not a civic seat), possible_json, name, description, leader_classes (comma list), effect (custom tooltip), sort_order  (every council seat; the planner reads the civic ones)
council_position_modifier — position_key, modifier_key, modifier_value (per leader level), sort_order
building_modifier       — building_key, scope (planet/country/system/station), modifier_key, value, condition (null or a required AP key), sort_order
building_unlock         — owner_key (civic/origin), building_key  (hard requirement only)
civic_requirement       — civic_key, kind (authority/ethic/civic/origin), operator (require/forbid/require_any), value, group_id (ties require_any OR sets)
origin                  — key, name, description, required_dlc, selectable, ascension_lock, ascension_blocks, starting_colony, forces_home_system, icon, sort_order
origin_modifier         — origin_key, modifier_key, modifier_value, sort_order
origin_requirement      — origin_key, kind, operator, value, group_id  (same shape as civic_requirement; kind includes 'ship_type' value 'organic' and 'gameplay' value 'nomadic')
planet_class            — key, name, climate (wet/dry/cold/null), colonizable, is_standard (default startable climate)
prescripted_empire      — key, name, species_class, species_portrait, authority, government, origin, planet_class, graphical_culture, sort_order  (the ~52 predefined empires)
prescripted_empire_item — empire_key, kind (trait/civic/ethic), value, sort_order
precursor               — key, name, required_dlc, system_initializer, picture, num_digsites, sort_order
precursor_relic         — precursor_key, relic_key, name, portrait, score, description, active_effect
precursor_relic_modifier — relic_key, modifier_key, modifier_value, condition (null=always), sort_order
precursor_reward_modifier — precursor_key, static_modifier, variant, name, modifier_key, modifier_value
precursor_building      — precursor_key, building_key, name, scope (planet/starbase), source (homeworld/technology), tech_key, category, build_time_days, empire_limit, planet_limit, can_demolish
precursor_building_resource — building_key, kind (cost/upkeep/produces), resource, amount, sort_order
precursor_building_modifier — building_key, scope (planet/country/system/station/job), modifier_key, modifier_value (base), ae_value (total with Archaeo-Engineers AP; null=no change), condition (null, or a different required AP key e.g. ap_cosmogenesis), sort_order
precursor_technology    — precursor_key, tech_key, name, cost, tier, area, category, unlocks_building_key  (the "Secrets of …" tech)
precursor_homeworld_reward — precursor_key, resource, multiplier (×monthly output; null=flat minor_artifacts), min_amount, max_amount, sort_order
precursor_full          — VIEW: one row/precursor with relic+building pre-joined
deposit                 — key, name, category, is_blocker, clear_time   (dictionary)
deposit_resource        — deposit_key, kind (produces/cost/upkeep), resource, amount
deposit_modifier        — deposit_key, modifier_key, modifier_value
precursor_system        — precursor_key, initializer, name, star_class, sort_order  (1..n per precursor)
precursor_planet        — id "<init>#<idx>", precursor_key, initializer, name, planet_class(+_label), size, is_moon, is_homeworld, flags
precursor_planet_deposit — planet_id, deposit_key (FK→deposit), sort_order
precursor_planet_modifier — planet_id, static_modifier, modifier_key, modifier_value
precursor_megastructure — precursor_key, initializer, type, type_label, count (e.g. 4 ruined ring sections)
tech_repeatable         — key, label, description, area, area_label, category, category_label, levels (-1 = unlimited), sort_order
tech_repeatable_modifier — tech_key, modifier_key, modifier_value, sort_order
tech_fallen_empire      — key, label, description, area, area_label, category, category_label, building_key (FK→building), sort_order
game_define             — key, value (tradition cost formula + slot limits)
tradition_category      — key, name, potential_json, required_dlc, adopt_key, finish_key, sort_order
tradition_category_desc — category_key, trigger_json, description (per-empire-type variants, first match)
tradition               — key, category_key, role (adopt/finish/normal), name, description, possible_json, unlocks_agenda, tooltip
tradition_prereq        — tradition_key, requires_key (tree edges)
tradition_swap          — id "<owner>#<n>", owner_key (tradition or perk), name, description, trigger_json, inherit_effects, weight, tooltip
tradition_modifier      — owner_key (tradition/perk/swap id), modifier_key, modifier_value, potential_json (triggered_modifier)
ascension_perk          — key, name, description, is_path, potential_json, possible_json, required_dlc, tooltip
edict                   — key, name, description, category, length (-1 = until cancelled), cost_json, potential_json, allow_json, unlocked_by_json, tooltip
council_agenda          — key, name, description, cost, finish_days, potential_json, allow_json, unlocked_by_json, effect_tooltip (modifiers: owner key / "<key>#finish")
federation_type         — key, name, description, base_intel, potential_json, allow_json, unlocked_by_json (tradition swap / ethic / civic keys), excluded_by_json (civics under NOT)
federation_type_perk    — type_key, level, experience (XP to next; NULL at top), perk_key
federation_perk         — key, name, description, effect
federation_perk_modifier — perk_key, scope (members/federation/leader/envoy), modifier_key, modifier_value, potential_json
federation_law_category — key, name, description, potential_json
federation_law          — key, category_key, name, description, potential_json, allow_json, types_json (only for these types), required_centralization, cohesion_growth
```

`*_json` columns hold normalised trigger trees (`{"op":"and|or|not","args":[…]}` | `{"leaf":k,"value":v,"cmp"?}`) — see the extraction's design notes.

All precursor/deposit tables are DROP+CREATE each extraction run.

---

## `src/lib/server/db/` (package)

Formerly one 2100-line `db.ts`; now domain modules behind an `index.ts` that re-exports everything, so `import { … } from '$lib/server/db'` is unchanged:

```
client.ts      db() — the shared read-only better-sqlite3 handle — + loadGameVersion
types.ts       shared Modifier / ScalingModifier shapes
species.ts     species classes, archetypes, portraits, traits (loadTraits*, scalingModifiersByTrait)
government.ts  ethics, civics, authorities, origins
empires.ts     planet classes, prescripted empires, initializers, rooms, flag assets/colors
jobs.ts        jobs, job swaps, reference buildings (+ modifiers, civic/origin unlocks)
labels.ts      loadEntityNames, loadModifierIndex, loadOverviewTooltips
precursors.ts  the whole precursor graph (loadPrecursors)
tech.ts        repeatable + fallen-empire techs (loadRepeatableTechs, loadFallenEmpireTechs)
traditions.ts  tradition trees, ascension perks, defines, profile inputs (loadTraditionTrees,
               loadAscensionPerks, loadGameDefines, loadProfileInputs) + the Trigger type
federations.ts federation types with their level perks, law categories + laws (loadFederations)
```

Key exports: `Trait`, `Archetype`, `TraitCategory`, `SpeciesClass`, `Modifier`, `Ethic`, `EthicImplication`, `PolicyRestriction`, `Precursor` (+ `PrecursorRelic`, `RelicModifier`, `ActiveModifier`, `RelicResource`, `RelicPassiveText`, `PrecursorReward`, `PrecursorBuilding`, `PrecursorSystem`, `PrecursorPlanet`, `PlanetDeposit`, `DepositResource`, `PrecursorMegastructure`).

Key functions:

- `loadTraits()` — main trait query + separate modifier query, merged by key. Filters `initial=1 AND hidden=0`.
- `loadTraitsForKeys(keys)` — loads specific trait keys (used for base traits: organic, lithoid, machine_unit).
- `loadSpeciesClasses()` — returns `{ key, label, archetype }`, filtered to BIOLOGICAL/LITHOID/MACHINE.
- `loadEthics()` — returns ethics with `modifiers[]`, `implications[]`, `policyRestrictions[]`.
- `loadCivics()` — player-selectable `Civic[]` (`selectable = 1`), each with `modifiers[]` and `requirements[]` (`{ kind, operator, value, groupId }`). Pure display helpers in [`src/lib/civics.ts`](src/lib/civics.ts) (`groupCivicsByType`, `prettyKey`, `civicRequirementLines`, `formatModifierValue`).
- `loadOrigins()` — player-selectable `Origin[]`; same `requirements`/`modifiers` shape as civics (reuses `CivicRequirement` + the civics.ts helpers). Effects are mostly the `description`. Requirements include `ship_type` gates (forbid/require organic ships) and `gameplay` gates (require = nomads only, forbid = settled only, none = both; display-only like every requirement chip).
- `loadPlanetClasses()` — `PlanetClass[]`; grouped for display by `src/lib/planets.ts` (`groupPlanetClasses`: wet/dry/cold standard climates, special/engineered worlds, uninhabitable bodies).
- `loadPrescriptedEmpires()` — the ~52 predefined `Empire[]` (species/traits/ethics/civics/origin/authority/planet/ship). `loadEntityNames()` — a `{key:name}` map (species_class/ethic/civic/origin/planet_class) for resolving an empire's raw keys. The shared `Empire` type is the shape for both predefined and parsed user empires.
- `loadPrecursors()` — fully-stitched `Precursor[]`: each with `relic` (+passives w/ `condition`), `rewards[]` (grouped by variant — Vultaum has 4), `buildings[]`, and `systems[]` → `planets[]` → `deposits[]` (resolved against the `deposit` dictionary) + planet `modifiers[]` + system `megastructures[]`. Several queries stitched in JS by `precursor_key`/`relic_key`/`initializer`/`planet_id`.

`Modifier.positiveIsGood` — false for cost/upkeep/size modifiers (see INVERTED_MODIFIERS in extraction script).

---

## Routes

### `/` — Landing page (`src/routes/+page.svelte`)

Project intro + status: what the planner does, links into the sections. No data loading beyond the layout's.

Navigation (`+layout.svelte`): a `NAV` list (Home · Empire · Species Builder · Portraits · Ethics · Government · Civics · Origins · Planets · Ships · Names · Flag · Room) plus an **Information dropdown** (`INFO`: Precursors · Tradition Trees · Ascension Perks · Federations · Jobs · Buildings · Repeatable Techs · Fallen Empire Techs) for reference tables that aren't part of empire creation.

### `/species` — Species Builder (`src/routes/species/+page.svelte`)

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

**Page data:** `{ ethics }` — `Ethic[]` with modifiers, implications, policyRestrictions pre-loaded.

**State:** `selected: Set<string>` — selected ethic keys. Budget: 3 pts.

**AXES** (defines picker layout and table column order):

```js
[
	['ethic_authoritarian', 'ethic_egalitarian'],
	['ethic_xenophobe', 'ethic_xenophile'],
	['ethic_militarist', 'ethic_pacifist'],
	['ethic_spiritualist', 'ethic_materialist']
];
```

**Sections:**

1. Budget indicator (3 dots)
2. Ethics picker — 4 axis rows + Gestalt below separator. Buttons show modifiers in `title` tooltip.
3. Selected effects — flat modifier list (`max-w-sm`) + "Gameplay Implications" (tags + policy restrictions), both with source annotation.
4. **Effects by Ethic** table — `overflow-auto max-h-128`, 8 paired columns, rows = all modifier keys, cell = `+5% (+10%)`.
5. **Gameplay Implications by Ethic** table — same columns. Tag rows (● / reg / fan / —) then "Policy restrictions" sub-section. Policy key shown as `title` on hover.
6. **Monument Bonuses per 100 Civilians** — hard-coded from wiki (game building scripts too complex to parse). 4 columns: Ethic / Effect / Regular / Fanatic.

**Sticky headers:** Apply `sticky top-0 z-10` + `style="background-color: …"` to each `<th>` individually — NOT to `<thead>`. Required for Firefox. Tables must be in `overflow-auto max-h-128` scroll containers (not `overflow-x-auto`) for sticky to work cross-browser.

### `/civics` — Civics reference (`src/routes/civics/+page.svelte`)

**Page data:** `{ civics }` — selectable `Civic[]` from `loadCivics()`. Grouped by type (Regular / Gestalt / Corporate / Special) via `groupCivicsByType`; a free-text filter over name+description; each card shows needs/excludes chips (`civicRequirementLines`), numeric modifiers, and the cleaned effects description. **Cards are selectable** (multi-toggle → `empire.toggleCivic`, highlighted from `empire.draft.civics`).

### `/origins` — Origins (`src/routes/origins/+page.svelte`)

**Page data:** `{ origins }` from `loadOrigins()`. Grouped by DLC (base game first), free-text filter; each card shows needs/excludes chips + modifiers + cleaned description. **Single-select** (`empire.setOrigin`, highlighted from `empire.draft.origin`).

### `/planets` — Planets (`src/routes/planets/+page.svelte`)

**Page data:** `{ planetClasses }` from `loadPlanetClasses()`, grouped by `groupPlanetClasses` (wet/dry/cold standard climates, special & engineered colonizable worlds, uninhabitable bodies). **Colonizable worlds are selectable as the homeworld** (`empire.setPlanetClass`); uninhabitable bodies are shown dimmed/non-selectable.

### `/ships` — Ships (`src/routes/ships/+page.svelte`)

**Page data:** `{ origins, civics }`. A regular-vs-organic (bio-ship) explainer, a **Regular/Organic picker** (`empire.setShipType` → a representative `graphical_culture`), plus lists of origins/civics that **force** or **exclude** organic ships (from their `ship_type` requirements).

### `/empire` — Empire (`src/routes/empire/+page.svelte`)

The central empire hub. A shared runes store [`src/lib/empire.svelte.ts`](src/lib/empire.svelte.ts) holds the single empire `draft` (species/traits/ethics/civics/origin/planet/ship). **All builder pages bind to it** — Species Builder traits (`empire.setTraits`), Ethics (`empire.setEthics`), Civics (`empire.toggleCivic`), Origins (`empire.setOrigin`), Planets/homeworld (`empire.setPlanetClass`), Ships (`empire.setShipType`). Each page's selected state is `$derived` from `empire.draft`, so a load populates every page and edits flow back. Import a predefined empire (from `loadPrescriptedEmpires()`) or upload a `user_empire_designs.txt` (parsed client-side by [`src/lib/empireFile.ts`](src/lib/empireFile.ts) `parseEmpireFile`).

**Conflict resolution:** the store defines composable **sections** (species/traits/ ethics/civics/origin/homeworld/ship). `empire.apply(e, 'all' | 'partial')` overrides everything, or fills only the currently-unset sections; loading prompts (override everything / only fill empty / cancel) **only when `empire.anySet()`**. A `generation` counter (bumped on load, not on edits) lets the Species Builder re-sync its archetype when an empire is loaded, without feedback loops. Note: the store is module-level `$state` → shared on the server, fine for this single-user local tool.

**Starting capital** ([`src/lib/StartingCapital.svelte`](src/lib/StartingCapital.svelte), [`src/lib/startCapital.ts`](src/lib/startCapital.ts)): the districts, zones and buildings the empire starts with. The extraction stores the game's start-of-game setup scripts as ordered effect lists (`game_start_script`, loaded by `loadGameStartScripts()`), and `simulateStartCapital` runs them in order against the draft: the profile (`profileFromDraft`), government, founder traits (base + granted), archetype, homeworld (forced by origin; `pc_ark` when nomadic) and ship set (organic = bio ships). The scripts keep their own state (variables counting rural districts, carrier flags, zones), and the interpreter keeps it too; the planet's checks reach `evaluate` through its `leaf` hook. An undecidable limit counts as false and is listed under the card. **Provenance:** each building and zone carries the explaining checks that held on the way to it (`why()`: through an `and` all of them, through an `or` the first that holds; a carrier flag stands for why it was set; scripts' bookkeeping — variables, zones, country type — explains nothing), and each count is kept as parts per set of reasons, so a district reads "3 base · +1 from Prosperous Unification (origin) + Organic (trait)". `reasonText` words a reason by kind (ethic, civic, origin, homeworld, …). No reasons = the base setup every empire of that kind gets. Void Dwellers run `void_dweller_home_planet_setup` instead. **Not modelled:** the planet's district caps (planet size, blockers), which the game applies to rural districts; pops, deposits, resources.

**Planned next:** edit + export the draft back to a Stellaris-importable `user_empire_designs.txt` (needs valid flag/ruler/portrait defaults).

Global nav: see the `/` section above (NAV + Information dropdown in `+layout.svelte`).

### `/precursors` — Precursors (`src/routes/precursors/+page.svelte`)

**Page data:** `{ precursors }` — `Precursor[]` from `loadPrecursors()`, fully pre-loaded.

A reference/"wiki-in-one" page: not really empire _planning_, but the in-game galaxy setup lets you pick which precursors are available — so the page's one piece of state is an **availability toggle** per precursor.

**State:** `enabled: Set<string>` — default all on. `Enable all` / `Disable all`; disabled cards dim (`opacity-45`). (Initial set is read from `data` once → needs a `// svelte-ignore state_referenced_locally` since it's an intentional one-shot default.)

**Layout:** cards grouped by DLC (`Base game` / `Ancient Relics Story Pack` / `Cosmic Storms`) in a `lg:grid-cols-2` via `groupByDlc()` — base game first, then DLCs in first-appearance order, **precursors sorted alphabetically by name within each group** (deterministic; covered by tests). Each card shows, always-visible: Permanent effect, Relic, Building(s), and the **Home system(s)**.

**Relic block** shows the full picture: the **passive** (numeric modifiers + `passiveTexts` for non-numeric ones like the Cybrex Warform armies — both carry a `condition`, shown as a `(wilderness)` note and dimmed/highlighted by the empire filter, e.g. the Cryo Core's wilderness-only district passive) and a **Triumph (active)** sub-block (below).

**Passive merging (planner-only).** Numeric passives are run through `mergeRelicPassives()` before display: rows with the **same modifier+value** across condition branches collapse into one whose `types` is the union of the branches' empire types (`typesLabel(types)` → the `(…)` note, null when the union spans all four types = effectively unconditional). E.g. the Baol grants +10% pop growth via a non-machine branch _and_ a machine/wilderness branch → shown once with no qualifier, while its +10% society research stays `(machine / wilderness)`. The extraction keeps both raw branches; this collapse is display-only.

The **Triumph (active)** sub-block — `activeEffect` text, `activeModifiers` (temporary modifiers the active grants) + `activeDetail` (how — e.g. "One at random for 2–5 years, or all of them for 1 year"). For `activeMode` `'choice'` the modifiers are rendered grouped under their `groupLabel` via `groupActiveModifiers()` (e.g. the Zro Crystal's "Martial Guidance" / "Statecraft Guidance" options); `'direct'`/`'random'` render flat. Plus `produces` (resources gained), activation `costs`, and cooldown. `relicResourceLabel(list)` formats both `costs` and `produces` (e.g. "3000 Unity, 2000 Minerals (grows with each use)", "1000 Alloys (grows with each use)"); `cooldownLabel(days)` → Stellaris years. The produced amount comes from the script (`add_resource`), **not** the loc tooltip, which can be stale (the War Forge loc wrongly says 5000 alloys; the real payout is 1000, +1000/use). Relics with only a numeric passive (Cybrex) used to look empty — now they don't.

**Empire-type filter.** A toolbar highlights the effects that apply to a chosen empire type. `empireFilter: 'planner' | EmpireType`; `'planner'` is the default **placeholder** (no highlighting — will later read the empire from the Species Builder). `activeType` (derived) is null for `'planner'`. When a type is picked: non-applicable reward variants / relic passives dim (`opacity-40`/`30`), applicable ones get a `text-primary-400` accent (+ ✓ on the variant).

- `variantApplies(variant, type)` — reward variants (controlled vocab): `suppressed`/`public` → regular/wilderness, `machine`→machine, `hive`→hive, `hive_machine`→hive/machine, `default`→all.
- `conditionApplies(condition, type)` — parses the relic-passive condition string (AND = comma; OR = parenthesised `(a OR b)`) against `EMPIRE_FLAGS` (`is_machine_empire`/`is_wilderness_empire`; hive reads same as regular). `conditionLabel` is now derived from `applicableTypes()` ("regular / hive", "non-wilderness"), replacing the old hardcoded string map. **Depends on the extraction emitting parseable OR conditions** (see extraction CLAUDE.md).

**Reward merging (permanent effect).** `mergeRewardModifiers(rewards)` collapses the per-variant reward modifiers into one flat list (like `mergeRelicPassives`): same modifier+value → one row whose `types` is the union of the granting variants' empire types, plus a `choiceNote` when, for those types, only some (choice) variants grant it. `rewardQualifier(m)` → the `(…)` note (type note + choice note; null when it applies to everyone). So Vultaum reads: Research Speed (Computing) — no note (all); Amenities — `(regular / wilderness)` (both regular choices); All-Tech / Happiness — `(regular / wilderness, research made public)` (the "made public" choice only); Pop Assembly — `(machine)`. (`VARIANT_LABELS`/`variantLabel` and the old per-variant "Only one applies" rendering are gone.)

**Home system — relevant-first.** `isRelevant(planet)` = homeworld OR has a resource (non-blocker) deposit OR has a modifier OR class ∈ `RELEVANT_CLASSES` (habitable/colonizable, the special precursor worlds, ringworld sections) OR ∈ `TERRAFORM_CANDIDATE` (`pc_toxic`). Relevant bodies render by default; the rest (barren/asteroids/gas giants w/o deposits) sit behind a "N more bodies" `<details>`. The `planetRow` snippet renders each: type/size, a `terraformable` tag, deposit chips via `depositChips()` (resource yields green & individual; blockers collapsed by name with `×count`; homeworld ★) + `precursor_planet_modifier` rows. Megastructures are violet chips on the system header via `megaLabel()`, which appends `×N` when `count > 1` (e.g. Cybrex Alpha's "Ruined Ring Section ×4"). The empty-state note ("No habitable worlds…") is suppressed when a megastructure is present (e.g. Cybrex Alpha's ruined ring world).

These planet-class sets are **hardcoded** in the component (like the home page's phenotype-tag sets) — not data-driven. Extend if a precursor world isn't shown.

**Formatting helpers** mirror the ethics page: `formatValue` (sign; `_add` → integer, else `×100%`; except `PERCENT_ADD_MODIFIERS` like `country_storm_repulsion_influence_add` — a fractional `_add` shown as % so the Tempest Invocator's 1.0 reads "+100%"), `valueColor` (`positiveIsGood`), `modLabel` (strips `[...]` tags). Plus `resourceLabel` (deposit yields), `conditionLabel` (relic `potential` → short note), `variantLabel` (reward variant display name).

**Nav chain:** Species Builder → Ethics → Precursors (footer/header links).

**Pure helpers live in [`src/lib/precursors.ts`](src/lib/precursors.ts)** (not the component): the empire-type applies-logic (`variantApplies`, `conditionApplies`, `clauseMatches`, `applicableTypes`, `conditionLabel`), modifier formatting (`formatValue`, `valueColor`, `modLabel`), `variantLabel`, `resourceLabel`, and the planet/deposit helpers (`shownPlanets`, `isRelevant`, `isTerraformable`, `depositChips`, `RELEVANT_CLASSES`, `TERRAFORM_CANDIDATE`), plus `dlcBadge`. The component keeps only reactive state/derived (`enabled`, `empireFilter`, `activeType`, `groups`) and the `planetRow` snippet. Types are imported type-only from `$lib/server/db` (erased at runtime, so the file is client-safe).

### `/portraits` — Portraits reference (`src/routes/portraits/+page.svelte`)

**Page data:** `{ portraits, traitInfo }` — `loadPortraits()` (portrait → species class(es) → set/DLC) plus a `TraitInfo` tooltip map (effect lines + flavour, `negative` flag → rose) built in the page server from `loadTraitsForKeys`. Reference page: which portraits exist, which classes use them, and each class's base trait as a hover tooltip. Multi-class portraits are Machine + Mechanical synths only.

### `/government` — Authorities (`src/routes/government/+page.svelte`)

**Page data:** `{ authorities }` from `loadAuthorities()`. Cards with modifiers + requirements; **single-select toggle** → `empire.setAuthority` (click again to clear), highlighted from `empire.draft.authority`.

### `/names` — Names (`src/routes/names/+page.svelte`)

Text inputs for the empire/species name fields (grouped Empire / Species / …), bound to the draft via `empire.setName(field, value)` / `empire.setSecondaryName(...)`. No server load.

### `/flag` — Flag (`src/routes/flag/+page.svelte`)

**Page data:** `{ flagAssets, flagColors }` (`loadFlagAssets`/`loadFlagColors`). Pick flag background/icon + colors into the draft (the .dds assets can't be rendered — pickers work on names/colors).

### `/room` — Room (`src/routes/room/+page.svelte`)

**Page data:** `{ rooms }` from `loadRooms()`. Single-select diplomacy room → `empire.setRoom` (`default_room` = empty value).

### `/tech` + `/fallen-empire-tech` — Technology reference tables

`{ techs }` from `loadRepeatableTechs()` / `loadFallenEmpireTechs()`. Repeatable techs group by research area (Physics/Society/Engineering) and category, showing their modifiers and level cap (`levels = -1` = unlimited). Fallen-empire techs show the building each unlocks (`building` — name, description, resources, jobs — pre-joined via `building_key`; null for the ship-component techs).

### `/traditions` + `/ascension-perks` — Tradition Trees, Ascension Perks

Both evaluate the stored trigger trees against an **`EmpireProfile`** ([`src/lib/triggers.ts`](src/lib/triggers.ts)): authority (Regular/Hive/Machine) + flags (Nomadic, Wilderness, Void Dweller, Individual Machine, Megacorp, Homicidal), plus ethics/civics/origin when built by `profileFromDraft` ("From planned empire"). Evaluation is **three-valued** (`null` = can't tell: flags, techs, traditions taken…); an item is only hidden when definitely false. `host_has_dlc` is always true — **all DLC assumed** (no ownership setting); items an all-DLC game replaces (Genetics, old Psionics, DLC-split perk copies) never show.

- **Global filter** (`EmpireProfileBar`, state in `settings.empireProfile`, shared by both pages) starts empty ("Any"): nothing hidden, variants listed. Once set, unavailable trees/perks hide (or grey with "show unavailable").
- **Per-tree switcher** (`ProfileChips`): only while no global filter is set, each tree card offers chips for just the axes it branches on (`profileAxes`).
- Variants: `effective()` picks the definitely-true swap with the highest weight; `inheritEffects` keeps the owner's modifiers. Triggered modifiers that may apply show "(if …)".
- Layout toggle (`settings.traditionView`): **Full trees** (default — one tree per row, every tradition as a full box: variant name, effects, requirements, other variants, flavour) or **Compact** (names only, hover tooltip, click opens a detail box).
- Tree layout: `treeColumns` builds branch columns from `tradition_prereq` edges. Trees split into standard / ascension by `isAscensionTree` (potential tests a `has_*_ascension`). `treeLinks`: "via <perk>" (adopt `possible` needs the perk) and "Unlocks ascension perk" (perks needing the finisher).
- Perk tiers are per profile: `perkTier` = fewest perks for which `possible` isn't false, with unknown origins/civics assumed absent.
- Cost calculator: `traditionCost` from the `game_define` values (formula matches the wiki).
- **Edict/agenda tooltips**: `loadUnlockables()` + `unlocksFor(item, …)` link by tradition/perk key **and** swap loc keys, filtered by the profile; same-named variants merge into one tooltip (`edictTip`/`agendaTip`). `EffectList` makes their names in the game's tooltip text hoverable (`linkify`), and adds an "Unlocks …" line for those the text doesn't name.
- Navigation: `JumpLinks` (sections + every tree) at the top, `BackToTop` floating button (left of the xl EmpireOverview panel); anchors use `scroll-mt-16` for the sticky nav.

### `/federations` — Federations (Information)

`loadFederations()` → `{ federationTypes, lawCategories }`; the server also maps every tradition finisher key **and its swap loc keys** (`tr_harmony_federations_finish`, which the game's `allow` names) to its tree (`finishers`), for requirement names and the "Also unlocked by finishing <tree>" links to `/traditions#<tree>`.

- One card per type (`id=<key>`, JumpLinks + "Laws"): description, "Who can form it" chips from `allow` run through **`withAllDlc`** (triggers.ts — every `host_has_dlc` taken as true and the branches an all-DLC game never takes pruned, so Trade League reads "Megacorp or Merchant Guilds or Commerce finished"), levels 1–5 with each perk's scoped modifiers (`SCOPE_LABELS`: Members / Federation / President / Envoys), effect text, flavour on hover.
- `EmpireProfileBar` like the tradition pages; a type whose `allow` is definitely false greys/hides. The scripted ethic leaves (`is_militarist` …) evaluate against the profile's ethics (plain or fanatic) in `evaluate`.
- Laws: one table per category (law, description, centralization needed, cohesion/month, "only for" type links); event-only Imperial Loyalists laws are dropped at extraction.
- **Linked from elsewhere** via [`FederationLink.svelte`](src/lib/FederationLink.svelte) (link to `/federations#<key>` + `federationTip` hover; stops click propagation so it works inside selectable cards): tradition/perk effect text through `unlocksFor(…, federationTypes)` (`Unlock.kind = 'federation'`, `linkify` finds "Grants access to the **Trade League** Federation type"), civic cards through [`FederationAccess.svelte`](src/lib/FederationAccess.svelte) (`federationsFor` → "Can form / Cannot form federation"), and the ethics page (a "Can form federation" row in the implications table + a line in the selected-ethics summary).

### `/jobs` + `/buildings` — Information reference tables

`{ jobs }` from `loadJobs()` / `{ buildings }` from `loadBuildings()`, grouped by category. Base produces/upkeep and (buildings) provided jobs; job **swaps** are deliberately _not_ here — swap tooltips live on the **civics/origins cards** ([SwapTables.svelte](src/lib/SwapTables.svelte), data from `loadJobSwapsBySource()` in those pages' servers).

Tooltips across the app use the Skeleton/Zag tooltip via [Tip.svelte](src/lib/Tip.svelte) — no native `title=` attributes left on interactive elements.

---

## Testing

**Vitest** (`pnpm test`, `pnpm test:watch`). Config: `test` block in [vite.config.ts](vite.config.ts) (`defineConfig` from `vitest/config`); specs are `src/**/*.{test,spec}.ts`.

[`src/lib/precursors.test.ts`](src/lib/precursors.test.ts) covers the pure helpers — the empire-type truth table is the high-value part (e.g. Baol's AND/OR `potential` branches → which empire types each relic passive applies to; Vultaum/Inetian reward variants; plus formatting helpers like `relicCostLabel`, `cooldownLabel`, `groupByDlc`, `megaLabel`). Tests import the module **relatively** (`./precursors`) and build fixtures from the `$lib/server/db` types, so they need no `$lib` alias or DB at runtime. Pure presentation logic only — no component rendering, no DB. Add cases here when extending `precursors.ts`.

---

## Trait Category Colors

| category  | label             | hex     |
| --------- | ----------------- | ------- |
| normal    | Species Traits    | #30dfb9 |
| phenotype | Phenotype Traits  | #2cec45 |
| robotic   | Synthetic Traits  | #00d2c6 |
| psionic   | Psionic Traits    | #8b30f0 |
| overtuned | Overtuned Traits  | #d58800 |
| cyborg    | Cybernetic Traits | #009dd4 |
| malleable | Malleable Traits  | #ceb108 |
| mutation  | Mutation Traits   | #d82d39 |

---

## Known Deferred Issues

- Modifier sign color for Overtuned traits (positive-cost but mixed +/– effects).
- Phase 2 modifiers: triggered/conditional modifiers, `custom_tooltip`, `inline_script`.
- Traditions/perks assume all DLC; a DLC-ownership setting would let `host_has_dlc` evaluate for real.
- `/traditions` ships the whole tree + perk graph to the client (~850 KB HTML incl. layout data); trim if it ever matters.
- Portrait picker _in the builder_ (data in DB; `/portraits` is a reference page, the draft has no portrait selection yet — needed for the planned `user_empire_designs.txt` export).
- Species name generation (`common/species_names/`).

---

## Companion repo: Stellaris Modding Insights

A sibling repo collects hard-won, poorly-documented Stellaris findings — engine quirks, parser/format gotchas, things only obvious in hindsight: `../stellaris-modding-insights` (sibling checkout, https://github.com/mkoester/stellaris-modding-insights). It's community-facing notes organised as `docs/NN-topic.md` with a TL;DR index in `README.md`. Especially relevant here: how vanilla game scripts (traits, ethics, species classes, `localisation/`) are structured, since this planner consumes that extracted data.

**When you discover something noteworthy** — a surprising bit of how the game data is modelled, an undocumented localisation/format detail, a non-obvious gotcha, or anything that cost real time to figure out — proactively suggest recording it in the insights repo. Don't write there silently: propose what to add (which `docs/` file, a one-line TL;DR) and let the user confirm, since it's a separate, published repo. Keep planner/app-specific notes in this file; route generally-useful Stellaris modding knowledge to the insights repo.
