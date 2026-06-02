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
```

---

## `src/lib/server/db.ts`

Key exports: `Trait`, `Archetype`, `TraitCategory`, `SpeciesClass`, `Modifier`, `Ethic`, `EthicImplication`, `PolicyRestriction`.

Key functions:
- `loadTraits()` — main trait query + separate modifier query, merged by key. Filters `initial=1 AND hidden=0`.
- `loadTraitsForKeys(keys)` — loads specific trait keys (used for base traits: organic, lithoid, machine_unit).
- `loadSpeciesClasses()` — returns `{ key, label, archetype }`, filtered to BIOLOGICAL/LITHOID/MACHINE.
- `loadEthics()` — returns ethics with `modifiers[]`, `implications[]`, `policyRestrictions[]`.

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
