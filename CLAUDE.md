# Sightline — working on this theme with Claude

This file is for coding agents (Claude Code and others) and for people who edit the theme
through one. It covers the workflow, the rules that keep the theme consistent, and the
Power BI traps that cost real time to find. `docs/reference.md` is the full reference.

## What this repo is

A Power BI report theme compiled from design tokens. Light and dark variants are built from
the same templates and checked by two gates before they are written.

```
src/variables.json        design tokens (light). Every colour, radius, size lives here
src/themes/dark.json      dark overrides, deep-merged over variables.json
src/theme.json           theme root (name, top-level colours, schema version)
src/text.json            textClasses, referenced as "{{text.<class>.<prop>}}"
src/visuals/global.json  the wildcards: base font, container chrome, axes, legend
src/visuals/<type>.json  one file per visual type: what differs, plus named presets
src/definitions/**       shared fragments, referenced as "{{def.chart.legend}}" etc.
scripts/lib/tokens.js    token loading and the strict template resolver
scripts/build.js         compile, gate, then write dist/theme.json, dist/theme.dark.json
scripts/validate.js       gate 1: JSON schema
scripts/lint-design.js    gate 2: contrast, palette, surfaces, typography
pbi/Preview.pbip          preview report showing every visual with the theme
docs/                    reference, screenshots, cover art, parked experiments
```

## The loop

1. Edit `src/`. Never edit `dist/` or the theme copy inside `pbi/…/RegisteredResources/`.
2. `npm run build`. It downloads the schema on first run, builds both variants and runs
   both gates on each. A failure stops with the file and JSON path, and `dist/` stays untouched.
   Run `npm run format` before you finish; CI runs `format:check`.
3. Check it in Power BI (see *Verify in Power BI*). The gates cannot see rendering, and a
   property can pass both gates and still be ignored by Power BI.

## Rules

- **Tokens, not hex.** A new colour or size becomes a token in `src/variables.json`, then a
  matching value in `src/themes/dark.json`. Templates reference tokens (`{{otherColors.text}}`).
- **Every light change needs a dark answer.** If you touch a token, decide its dark value too.
- **Do not weaken the gate to pass it.** A failing contrast check means the colour is wrong.
  `a11y.waivers` exists, but a waiver needs a reason the maintainer agrees with. It is not a
  way to make the build green.
- **No global drop shadow.** The gate (`surface/elevation`) fails it on purpose: Power BI
  renders shadows coarsely. Separate cards with the hairline `borders.color`, which must stay
  1.1–1.25:1 against the card (`surface/hairline`).
- **Templates are JSON.** A value is either literal JSON or exactly `"{{token.path}}"`, which
  keeps the token's type. No other syntax exists; a token inside a longer string is an error.
- **Shared things go into the wildcards, differences into the visual file.**
  `global.json` holds `visualStyles["*"]["*"]["*"]` (base font) and `visualStyles["*"]["*"]`
  (container chrome, `categoryAxis`, `valueAxis`, `legend`). The more specific level wins
  property by property. Before moving anything up a level, check who else has that object:
  `labels` stays per visual because its default `show: false` would hide treemap, map and
  gauge labels. A wildcard also reaches objects the theme never styled, so look for changed
  rendering, not only for errors.
- **Opt-in looks are presets.** Add a named key next to `"*"` in the visual's file rather
  than changing `"*"` for everyone. Same preset name, same meaning across chart types
  (`Minimal`, `Labelled`, `Dense`, `Presentation`, `Comparison`).
- **Font sizes are points**, on a 1920×1080 canvas. `font.sizes` is for the canvas,
  `font.chrome` for the filter pane. Do not mix them.
- **Keep the design language** (`docs/reference.md` → *Design language*): zinc neutrals, one brand
  colour, 12 px cards and 8 px controls, hairline borders, solid light gridlines, muted
  axis labels and table headers, semibold rather than bold.

## Power BI traps

Each of these looked like a theme bug and was not, or looked fine and was broken.

- **The schema is not a contract.** `dist/schema.json` lists properties Power BI ignores
  from a theme (for example the 2.159 `listSlicer` objects, see `docs/parked-slicer-objects.md`).
  If a property does nothing, set it on a test visual first. If it works there and not from
  the theme, the theme cannot reach it.
- **`$id` is decided per object.** Many state arrays need `"$id": "default"` on the base
  entry, or they are silently dropped (`cardVisual`, `listSlicer.value`,
  `shape.fill/outline/shadow`). But `shape.shape` breaks *with* `$id`. Check the schema's
  `definitions.visual-<type>`: if the items reference an action-state enum, add `$id`.
- **A preset replaces whole object arrays.** A preset that defines `value` replaces all of
  `"*"`'s `value` entries, including the `selection:selected` state. Redefine every state
  you still need.
- **Built-in style names.** Power BI's own table/matrix presets are addressed without spaces:
  `Minimal`, `BoldHeader`, `AlternatingRows`, `ContrastAlternatingRows`, `FlashyRows`,
  `BoldHeaderFlashyRows`, `Sparse`, `Condensed`. Without a theme style of that name they
  render like `"*"`, or break. The theme defines all of them; keep it that way when you
  change table tokens. The tile slicer's `Tab` is the same case.
- **Matrix totals read backwards:** `pivotTable.columnTotal` is the Total *column*,
  `rowTotal` the Total *row*.
- **Tile slicer (`advancedSlicerVisual`):** the muted tab track (`layout.backgroundShow`)
  renders only with `layout.style: "Table"`. Its container padding must stay 0, or its title
  sits 10 px lower than the dropdown slicers beside it.
- **Not themeable at all:** `actionButton.outline` (use the container `border`), text on a
  button that has an icon, treemap label colour, the gap between a slicer title and its
  content, bar corner radius, row hover, the Pages pane.
- **The container background must come from the theme.** Without `background` in
  `visualStyles["*"]["*"]`, charts inherit white from Power BI's base theme: invisible in light,
  broken in dark. Always check a change in **both** variants, by importing `dist/theme.dark.json`.
- **No fixed text colours in the preview report.** A hex literal does not switch with the variant.
  `ThemeDataColor` `ColorId 1` is pure black, not the theme foreground; to fall back to the theme
  text colour, leave the property (or a conditional `DefaultValue`) out.
- **Raising the global `margin`** (container padding) clips the 88 px header-row slicers.

## Verify in Power BI

Manual: open `pbi/Preview.pbip` in Power BI Desktop, then *View → Themes → Browse for
themes* and pick `dist/theme.json`. Click *Refresh* once after cloning, because the data
cache is not in the repo.

Scripted: the Power BI authoring plugin for Claude Code (`powerbi-authoring`) brings two
CLIs, `powerbi-desktop` (open, reload, screenshot) and `powerbi-report-author` (validate,
formatting lookup). If they are installed:

1. Copy `dist/theme.json` into `pbi/Preview.Report/StaticResources/RegisteredResources/`
   under a **new** filename (Desktop caches by filename). Set the copy's internal `"name"`
   to exactly that filename including `.json`, update both references in
   `pbi/Preview.Report/definition/report.json` (`themeCollection.customTheme.name` and the
   `RegisteredResources` item), and delete the old file.
2. `powerbi-report-author validate pbi/Preview.Report`. These findings are known and accepted:
   `PBIR_THEME_VISUAL_PROP_UNKNOWN` for `padding.*` on `cardVisual` and `advancedSlicerVisual`,
   `PBIR_FORMATTING_OBJECT_UNKNOWN` for `slicer.dropdown`, `PBIR_THEME_VISUAL_UNKNOWN` and
   `PBIR_VISUAL_TYPE_UNKNOWN` for `ganttChart`, `PBIR_FORMATTING_PROP_UNKNOWN` for
   `categoryAxis.autoExpand`, `PBIR_SCHEMA_UNREACHABLE`, and the warning
   `PBIR_SLICER_HEADER_MAY_CLIP`. Anything else is a real error.
3. `powerbi-desktop reload`, then screenshot the affected pages. A screenshot taken right
   after a reload can be blank or half-drawn, so take it twice before judging. Compare
   measurements only within one image, because the window size changes between screenshots.
4. Use `powerbi-report-author formatting search <visualType> <regex>` to find the real name of
   a property before guessing one.

To check that a refactor changes nothing, screenshot every page before and after and compare
the images pixel by pixel. Map pages differ between any two shots because tiles load late;
re-shoot them before reading anything into it.

To test many variants at once, add a temporary page with one visual per variant, screenshot
it, and remove the page again (folder under `definition/pages/` plus its entry in
`pages.json`). Do not leave test pages or inline hex colours in the preview report.

## Housekeeping

- `dist/theme.json` and `dist/theme.dark.json` are committed (people download them);
  `dist/schema.json` is not.
- Keep the PBIP paths short. Windows stops at 260 characters, and Desktop then reports a
  missing `visual.json` that is actually there.
- The documentation site (GitHub Pages) is generated from `README.md`, `docs/reference.md`,
  `CHANGELOG.md` and this file by `scripts/build-site.js` on every push to `main`. Edit the Markdown,
  not the site. Check the output with `npm run site` (`_site/`, git-ignored).
- Update `docs/reference.md` when you add a preset, a token group or an accepted finding, and
  `CHANGELOG.md` for anything a report author would notice.
