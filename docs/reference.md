# Sightline reference

Everything about how the theme is built and why it looks the way it does. For a quick start, see the [README](../README.md); for working on the theme with a coding agent, see [CLAUDE.md](../CLAUDE.md).

## Commands

| Command | Effect |
|---|---|
| `npm run build` | build light + dark, run both gates |
| `npm run build:light` | `dist/theme.json` only |
| `npm run build:dark` | `dist/theme.dark.json` only |
| `npm run validate` | JSON schema check of both built themes |
| `npm run lint` | design gate on both variants (contrast, palette, type steps, surfaces) |
| `npm run format` | Prettier across `src/**/*.json` and `scripts/**/*.js` (`format:check` in CI) |


## Design language

The look borrows from [shadcn/ui](https://ui.shadcn.com) (MIT): quiet neutral surfaces, one brand colour, and hierarchy from type weight and muted text instead of boxes and colour.

| shadcn/ui | In this theme |
|---|---|
| `background` / `card` / `border` (zinc) | canvas `#FAFAFA`, cards `#FFFFFF`, hairline `#E7E7EA` (dark: `#09090B` / `#18181B` / `#27272A`) |
| `foreground` / `muted-foreground` | text `#09090B`, muted `#6B6B73`: a touch darker than zinc-500, so it still clears 4.5:1 on the muted track |
| `rounded-xl` cards, `rounded-md` controls | `borders.corners` 12 px for visuals, `borders.controlCorners` 8 px for buttons, slicers and navigators |
| `CardTitle` + `CardDescription` | visual titles 16 pt Semibold, subtitles 11 pt muted |
| Charts: `CartesianGrid`, muted ticks | solid gridlines in the border colour, axis labels in muted text |
| `Tabs` | the tile slicer's default style: a muted track with the selected tab raised in white and outlined |
| `Button` variants | `default` = outline, `selected` = primary fill, `secondary` = primary outline |
| `Table` (`TableHead` / `TableCell` / `TableFooter`) | table and matrix share one anatomy: muted semibold headers over a hairline, regular cells with row hairlines only (no zebra, no vertical rules), and the total row as a light `#FAFAFA` footer band in Semibold rather than Bold. The matrix total column stays white. `Bordered` (table and matrix) adds vertical hairlines in the same colour, for wide numeric grids |
| Stat card (`section-cards`) | the default card puts the muted label above a semibold value |

Two shadcn habits are left out on purpose. There is no drop shadow, because Power BI renders shadows coarsely; the design gate (`surface/elevation`) fails a global one. And bars stay square, because Power BI has no bar corner radius.

## Two gates, two questions

The build aborts if either gate fails.

**`scripts/validate.js`** answers: *is this valid Power BI?* — JSON schema check against `dist/schema.json`.

**`scripts/lint-design.js`** answers: *is this valid design?* — a set of checks that turn the design standard into an enforced rule rather than a documented intention:

| Rule | Checks |
|---|---|
| `contrast/text` | every text token ≥ 4.5:1 on its declared surface (WCAG 1.4.3 AA) |
| `contrast/palette` | every palette slot ≥ 3:1 on canvas **and** card (WCAG 1.4.11) |
| `contrast/semantic` | semantic fill colours ≥ 3:1 |
| `contrast/affordance` | interactive borders ≥ 3:1 — an invisible border is not an affordance |
| `contrast/onFill` | label on a filled selected state ≥ 4.5:1 (light: white on dark, dark: dark on light) |
| `palette/unique` | no duplicate hex — otherwise two series get the same colour |
| `palette/length` | 8 slots maximum |
| `palette/brand` | the primary colour must not carry white text below the floor — a filled control needs a darker sibling |
| `palette/semantic` | good/warning/bad colours not spent as an arbitrary category |
| `ramp/sequential` | sequential ramp strictly monotonic, direction matching the variant |
| `type/step` | adjacent font steps ≥ 1.15× apart |
| `type/collapse` | `title` ≠ `largeTitle`, `label` ≠ `smallLabel` |
| `type/callout` | KPI headline value ≥ 24 pt |
| `surface/separation` | at least one of canvas step ≥ 1.08:1, a visible card edge, or elevation separates a visual from the page |
| `surface/hairline` | the card edge stays between 1.1:1 and 1.25:1 — below it is invisible, above it reads as a box outline |
| `surface/elevation` | `dropShadow` not enabled globally — Power BI renders it coarsely at every strength |
| `surface/page` | page background not set to `transparency: 100` |
| `surface/shadow` | no visual carrying both `shadow` **and** `dropShadow` |
| `build/palette` | `dist.dataColors` === `chartPalette` |

Thresholds are collected in the `FLOOR` object at the top of `scripts/lint-design.js`.

One rule is wired up but currently inert: `contrast/affordance` iterates `a11y.interactiveBorderTokens`, which is empty because no border in this theme carries state on its own. It starts reporting the moment a token is listed there.

`contrast/palette` normally holds every slot to 3:1. If you fork the theme for a brand whose mandated colour is itself below 3:1, name it in `a11y.markFloorToken`: the floor then drops to that colour's own contrast and the gate says so. No such token is declared here, so the floor is the full 3:1.

Findings can be waived per rule via the `a11y.waivers` map in `src/variables.json` (and `src/themes/dark.json`). A waived finding is reported as *decided, not blocking* — the reason string is printed with it, so a waiver has to be argued for, not just switched off. **Both variants currently pass with no waivers.**

---

## Project structure

```
src/
├── variables.json          # design tokens (light) + a11y contract
├── themes/dark.json        # token overrides for the dark variant
├── theme.json              # theme root: name, colour roles, schema version
├── text.json               # textClasses
├── definitions/            # shared fragments, referenced as {{def.<folder>.<key>}}
│   ├── chart/              # categoryAxis · valueAxis · labels · legend · totals
│   ├── table/              # columnHeaders · values · grid · total
│   └── preset/             # the chart style presets
└── visuals/                # global.json (wildcards), page.json, one file per visual type
dist/
├── theme.json              # light → "Sightline"
├── theme.dark.json         # dark  → "Sightline Dark"
└── schema.json             # downloaded on build, git-ignored
scripts/
├── lib/tokens.js           # token loading and the strict template resolver
├── build.js                # compile, gate, then write dist/ (--variant <name>)
├── validate.js             # gate 1: JSON schema
├── lint-design.js          # gate 2: design rules
└── fetch-schema.js         # downloads the schema named in src/theme.json
pbi/Preview.pbip            # preview report: every visual type on the theme
docs/                       # this reference, screenshots, cover art, parked experiments
.github/workflows/build.yml # CI: format check, build with both gates, dist/ up to date
```

---

## Token architecture

Every token lives at the top level of `src/variables.json`. These are the groups that exist:

| Group | Contents | Notes |
|---|---|---|
| `surfaces` | `canvas` · `card` · `sunken` | `canvas` `#FAFAFA`, `card` `#ffffff`, `sunken` `#F4F4F5` (dark: `#09090B` / `#18181B` / `#09090B`) |
| `chartPalette` | **ordered array**, 8 slots, all distinct | becomes `dataColors` in the built theme 1:1; slot N → series N |
| `dataColors` | named colour aliases | `primary`, `secondary`, hue names (`red`, `blue`, …) and the directional trio `positive` / `neutral` / `negative`; the templates reference these by name |
| `otherColors` | neutrals and text | `text`, `text_muted`, `white`, `black`, four greys, `light` / `dark` / `light_active` |
| `semantic` | `positive_fill` · `warning_fill` · `negative_fill` · `neutral_fill` | status colours, checked by the gate and kept out of the series palette |
| `sequential` | `step1` … `step6` | single-hue ramp for magnitude, darkening as values rise (lightening in dark) |
| `borders` | `corners` (12) · `controlCorners` (8) · `width` (1) · `color` (`#E7E7EA`) | one edge colour for card edges, dividers and gridlines; `controlCorners` rounds buttons, slicers and navigators |
| `font` | `sizes` · `chrome` · `family` · `semibold` · `bold` | two size scales — see below |
| `gridlines` | the full gridline property set | applied identically to both axes |
| `buttons` | `default` · `hover` · `pressed` · `selected` · `secondary` | each a complete `value` / `background` / `border` triple |
| `margin` | `10` | a bare number |
| `a11y` | check contract | tells the gate which token lands on which surface, plus `waivers` |

`dataColors.positive` / `neutral` / `negative` map onto green `#2B8A3E`, slate `#5F6B7A` and red `#C92A2A`. Green and red deliberately do **not** appear in the series palette, so a reader never has to wonder whether a red bar means "bad" or just "category 5".

### The series palette

8 slots per variant. Contrast is measured against the canvas, the harsher of the two surfaces.

| Slot | Light | Contrast on `#FAFAFA` | Dark | Contrast on `#09090B` | Hue |
|---|---|---|---|---|---|
| 1 | `#0F766E` | 5.24 | `#2DD4BF` | 10.69 | petrol (primary) |
| 2 | `#D9480F` | 4.12 | `#FF8A50` | 8.53 | orange |
| 3 | `#7B4FD6` | 5.12 | `#B39BFF` | 8.57 | violet |
| 4 | `#C2255C` | 5.42 | `#F06A9B` | 6.86 | magenta |
| 5 | `#9A6B00` | 4.49 | `#E0B341` | 10.13 | ochre |
| 6 | `#5C7F1E` | 4.46 | `#9CC35A` | 9.82 | olive |
| 7 | `#2F7CB8` | 4.28 | `#5EB1F2` | 8.57 | sky |
| 8 | `#5F6B7A` | 5.20 | `#9BA6B5` | 8.07 | slate — use for "Other" |

Slot N names the same hue in both variants, so a report keeps its colour meaning when switched to dark.

The order alternates cool and warm hues (petrol, orange, violet, magenta, …) so that the first few series — the common case — stay apart for readers with red-green colour-vision deficiency. **From five series onwards, colour needs a second channel** — direct labels or distinguishable markers. No palette can carry eight hues on colour alone.

Status colours (`semantic`): positive `#2B8A3E` / `#55C26F`, warning `#B35C00` / `#FFA94D`, negative `#C92A2A` / `#FF7676` (light / dark).

### Font sizes

Two separate scales, because they scale differently.

**`font.sizes`** — canvas. The 1920×1080 canvas is scaled down to the window width in the browser (typically ~0.78×), so canvas text appears smaller than its point size. That is why the floor is 11 pt, not 9.

| Step | pt | Role |
|---|---|---|
| `xs` | 11 | axes, legend, data labels, subtitles |
| `s` | 13 | body text, table values, slicers, buttons |
| `m` | 16 | card labels, emphasis, `header` |
| `l` | 19 | visual titles (`largeTitle`) |
| `xl` | 23 | page titles (`title`) |
| `xxl` | 28 | KPI headline value (`callout`) |
| `xxxl` | 36 | hero KPI |

Step ratios 1.18–1.29× — every step reads as hierarchy, not as inconsistency.

**`font.chrome`** — filter pane. The filter pane sits **outside** the canvas and does not scale with it. It therefore needs smaller numbers than the canvas scale: `title` 12, `header` 11, `body` 11.

### Weights

Distinguish by weight first, by size second.

| Element | Weight |
|---|---|
| page and visual titles | Semibold |
| table column headers, card labels | Semibold |
| axes, data labels, legend, table values | Regular |
| KPI headline value | **Bold** — and nowhere else |

### Gridlines

One `gridlines` group in `src/variables.json`, applied identically by both `def.chart.categoryAxis` and `def.chart.valueAxis`:

| Property | Value |
|---|---|
| `gridlineShow` | `true` — on both axes |
| `gridlineStyle` | `solid` — a hairline, like shadcn's chart grid |
| `gridlineColor` | `borders.color` |
| `gridlineThickness` | `1` |
| `gridlineTransparency` | `0` |
| `gridlineDashCap` | `square` |

Because both axes read the same group, a bar chart gets a grid across its category axis too. Turning that off means splitting the group, or overriding `gridlineShow` in `categoryAxis.json`. See *Known limitations*.

### Data labels

`def.chart.labels` sets `show: false`; report authors switch them on where they help, and the labels themselves carry no `labelPrecision`, so they inherit the measure's number format instead of rendering whole numbers as `1234.0`. `labelPrecision` does still survive in three other places — `def.chart.totals` (`1`), `filledMap` (`1`) and `pivotTable` (`0`).

`scripts/build.js` adds label precision for some visual types after the visual files are merged (`LABEL_PRECISION`). Without it, percentages render with Power BI's automatic two decimals (`15,47%`, `€ 3M (19,84%)`), and the funnel's automatic millions turn small stages into `€ 0M`. The build sets `percentageLabelPrecision: 0` on `pieChart`, `donutChart` and `funnel`, `labelPrecision: 1` on `funnel`, and `labelPrecision: 0` on the two `hundredPercentStacked*` bar/column types — in every style. These cannot live in the shared preset label objects: `percentageLabelPrecision` exists only on those three visuals, and `labelPrecision: 0` on an ordinary bar chart would turn `€ 1,3M` into `€ 1M`.

### Button states

Light variant, from the `buttons` group. `value.fontFamily` is Segoe UI Semibold at `font.sizes.s` in every state.

| State | Background | Text | Border |
|---|---|---|---|
| `default` | `otherColors.white` | `otherColors.text` | `#E7E7EA`, 1 px |
| `hover` | `#F4F4F5` | `otherColors.text` | `#E7E7EA`, 1 px |
| `pressed` | `#E4E4E7` | `otherColors.text` | `#D4D4D8`, 1 px |
| `selected` | `dataColors.primary` `#0F766E` | white — **5.47:1** | `dataColors.primary`, 1 px |

A `buttons.secondary` set mirrors these four with a transparent ground and the primary colour as text and border.

The dark variant inverts the selected state: `#09090B` on `#2DD4BF` is **10.69:1**. White on that same petrol would be 1.86:1 — the mistake an automatically derived dark variant makes.

There is no `focus` state: Power BI does not expose focus-ring styling as a theme property. The standard relies on the Power BI default — do not override it.

---

## Template syntax

Templates are plain JSON. A string that is exactly `"{{path.to.token}}"` is replaced by that token's value, keeping its JSON type: a number stays a number, a colour object stays an object.

```json
"fontSize": "{{font.sizes.m}}"
"color": "{{otherColors.text}}"
"categoryAxis": "{{def.chart.categoryAxis}}"
```

The same rule covers all namespaces:

| Namespace | Source |
|---|---|
| tokens (`otherColors`, `font`, `borders`, …) | `src/variables.json`, plus `src/themes/<variant>.json` for a variant |
| `text.<class>.<prop>` | `src/text.json`, the theme's `textClasses` |
| `def.<folder>.<key>` | `src/definitions/<folder>/*.json`, each file contributes its top-level keys |

Tokens may reference other tokens, and definitions may reference tokens and other definitions. There is no other syntax: no blocks, no helpers, no interpolation inside a longer string.

The resolver (`scripts/lib/tokens.js`) is strict. The build stops with the file and JSON path for an unknown token, a reference cycle, a token embedded in a longer string, invalid JSON, and two files defining the same definition key or the same visual type.

## Wildcards: what lives where

Power BI reads `visualStyles` at three levels, and each one can be `"*"`:

```
visualStyles.<visual>.<style>.<object>
```

| Level | In this theme | Holds |
|---|---|---|
| `["*"]["*"]["*"]` | `src/visuals/global.json` | the base `fontFamily` for every object of every visual |
| `["*"]["*"].<object>` | `src/visuals/global.json` | container chrome (background, title, border, padding, header, tooltip) and the shared `categoryAxis`, `valueAxis`, `legend` |
| `[<visual>]["*"]` | `src/visuals/<visual>.json` | what differs for that visual |
| `[<visual>][<name>]` | same file | named presets, chosen per visual in the format pane |

The more specific level wins, property by property. A visual file therefore only states what differs from the shared defaults. For example, `funnel` and `waterfallChart` override `categoryAxis` with their own variants.

Not everything belongs at the top. `labels` stays per visual: its shared default is `show: false`, and as a wildcard it would also switch off the labels on treemaps, maps and gauges. A font family set only by the wildcard also reaches objects the theme never styled. The donut's centre value turned regular that way, so `donutChart.value` sets its family explicitly.

When moving anything up a level, compare screenshots of every preview page before and after. The move into the wildcards was checked this way: every page was pixel-identical apart from map tiles, which load asynchronously.

---

## Common tasks

### Change a colour

In `src/variables.json` only. If the design gate aborts, the new colour is below a contrast threshold — the message names the actual and the required value.

### Add a new data colour to the series palette

Extend `chartPalette` in `src/variables.json` **and** `src/themes/dark.json`. The gate checks uniqueness, length and contrast on both surfaces.

### Add a new visual

```json
{
    "$schema": "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/refs/heads/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.159.json",
    "name": "<visualType>",
    "visualStyles": {
        "<visualType>": {
            "*": {
                "labels": "{{def.chart.labels}}"
            }
        }
    }
}
```

Then `npm run build`. Axes, legend, base font and container chrome already come from the wildcards in `global.json`. Add only what differs, and pull in partials wherever they fit.

### Add a new visual style

Add a key next to `"*"` in the corresponding visual file; the name has to be assigned as the style name in the report.

Existing custom styles (as opposed to the chart presets below): `cardVisual` → `KPI Tile`, `KPI Card`, `KPI Card 2`, `Record View`, `Info Panel`, `Dark KPI Card` · `tableEx` → `Bordered`, `Condensed` · `pivotTable` → `Record View`, `Condensed`, `Embedded`, `Bordered` · `advancedSlicerVisual` → `Filled`, `Text Slicer`, `Tab`, `Badge` · `actionButton` → `Navigator`, `Back Button`, `Icon` · `shape` → `Page Header`, `Dark Panel` · `textbox` → `Page Header`.

The tile slicer's `"*"` style is a segmented control in the shape of shadcn's Tabs. It sets `layout.style: "Table"`, because the track (`layout.backgroundShow`) renders only in that style. It has no fixed tile height, so it fits a 88 px header row under its own title. `Filled` keeps the earlier look: separate 40 px tiles, with the selected one filled in the primary colour.

**Power BI built-in table and matrix styles.** The style picker offers Power BI built-ins such as *Alternating rows* or *Bold header*. Their internal names are written without spaces. A theme style under such a name replaces the built-in look. Without one, the built-ins render exactly like `"*"`, because the theme values win. `ContrastAlternatingRows` also broke: its white band text landed on the theme white band, so every second row disappeared. The theme therefore defines each built-in for `tableEx` and `pivotTable`, in theme colours:

| Built-in (internal name) | Look in this theme |
|---|---|
| `Minimal` | header hairline only, no row rules |
| `BoldHeader` | muted header band (`#F4F4F5`), header text in the foreground colour |
| `AlternatingRows` | zebra in `otherColors.light` |
| `ContrastAlternatingRows` | zebra in `otherColors.gray_lighter`, text stays readable |
| `FlashyRows` | zebra in the brand tint `sequential.step1` |
| `BoldHeaderFlashyRows` | brand-tint zebra under a primary header with the selected-button text colour |
| `Sparse` | row padding 14 |
| `Condensed` | row padding 5 |

`Default` and `None` are left alone. `Default` already is `"*"`, and `None` stays the escape hatch for conditional cell colours.

`Tab` is the name of one of Power BI's own button-slicer presets. Without a theme style of that name, a slicer set to it inherited the `"*"` selected state — white text on a transparent fill, so the selected tab disappeared. The theme's `Tab` is a copy of `Text Slicer` without its forced single select: primary-coloured text plus an underline on the selected item.

`ganttChart` (the native Gantt, preview since Desktop 2.159) has a `"*"` style built only from existing tokens: the primary colour cascading from `row.color`, `borders.color` row dividers, the shared gridline tokens on the time axis, and table typography for the column panel. Bars sit at `transparency: 65`, and progress is drawn in the full colour on top (`progress.customizeColor`, `relativeHeight: 100`). Done work therefore reads as solid and open work as pale. Power BI's default does the opposite — a white overlay that makes finished tasks look faded. None of the Gantt objects take `$id`. Its columns must be measures (`SELECTEDVALUE` behind `ISINSCOPE`): a text column in the Columns well becomes an extra grouping level and replaces the task label.

### `KPI Tile` — the web-style stat card

The style for KPI rows. It derives from `KPI Card` and changes only what made that card look cramped: a muted 13 px label above a 28 px Semibold value, no accent bar, no divider, comparison lines in 11 px (muted title, value in text colour, delta muted), and real breathing room.

The breathing room comes from `padding[$id=default]` with `leftMargin` / `rightMargin` / `topMargin` / `bottomMargin` (24 / 24 / 24 / 16). The `top` / `left` / … keys in the same entry do **not** move the content (that was checked on the render). Neither do the container padding VCO or `layout.paddingUniform` — both shrink or shift the whole tile — nor `cardCalloutArea` padding, which clips the label and value inside a fixed-height area. Empty deltas use `showBlankAs: " "`: an empty string renders as "(Blank)".

Data-driven colour (red when behind target) belongs on the visual as a conditional `value.fontColor` or `referenceLabelValue.valueFontColor`; the theme cannot know the sign.

### The inverted pair — `Dark KPI Card` and `Dark Panel`

Two opt-in styles that put an inverted, dark plane on the page: a hero KPI band
at the top of a report, a dark section behind a group of visuals, a cover strip. They are
siblings — same surface, same border, same accent — so a `shape` set to `Dark Panel` can
sit directly behind or beside `cardVisual` tiles set to `Dark KPI Card` without a seam.

| | `cardVisual` → `Dark KPI Card` | `shape` → `Dark Panel` |
|---|---|---|
| Surface | `darkPanel.surface`, corner radius from `borders.corners` | same |
| Edge | no outline — the fill is the edge | 1 px `darkPanel.border` outline |
| Accent | 4 px top accent bar + inner top-left glow | none — the shape visual's glow is outer-only and reads as a halo on a light canvas |
| Type | label `s` muted / value `xxl` bold white | text `m` semibold white, title `xl` bold |
| Padding | 16 px all round (the default card uses 10) | 16 / 12 px text margins |

**`$id` is per object, not per visual.** On `cardVisual` the style entries need
`"$id": "default"` or they no-op. On `shape` it splits: `fill`, `shadow` and `outline`
need it — without `$id` on `outline`, `lineColor` is dropped and Desktop draws its own
default stroke instead — while the `shape` object must **not** have it, or the corner
radius and `tileShape` are silently dropped and the rectangle comes back square. The
`"*"` block in `src/visuals/shape.json` already encodes the split; follow it
object by object. Verified by render and pixel-check, not by schema.

**Chrome colours belong to the page, not to the panel.** Both styles' container `title`
and `subTitle` draw *above* the visual, on the page surface — so they use
`otherColors.text` / `text_muted`, not the light `darkPanel` tokens. Only the card's own
label/value and the shape's `text` object sit on the dark fill. Related: a card preset
that hides the title hides the subtitle with it, so a label on a `Dark KPI Card` has to
go in the title slot.

Both draw from a dedicated `darkPanel` token block in `src/variables.json`, **not** from
`surfaces` / `borders` / `dataColors` — the default `"*"` look is untouched. The dark
variant overrides `darkPanel` in `src/themes/dark.json`: on a dark canvas the panel cannot
go darker than the page, so it becomes a *raised* slightly teal plane (`#1A2624`) instead of
a sunken near-black one.

Everything is opt-in per visual, exactly like a chart preset: pick it under
**Format visual → Style preset**.

---

## Chart style presets

Every chart type ships named presets. They appear in Power BI Desktop under
**Format visual → Style preset** and change **nothing** about the default look —
`"*"` remains the standard, a preset is a deliberate per-visual decision.

The goal is a shared vocabulary: "Minimal" means the same thing on every chart type.

| Preset | Axes | Gridlines | Legend | Data labels | For |
|---|---|---|---|---|---|
| *(no preset)* | both | value axis | top | off | default, widest use |
| `Labelled` | category only | off | top | **on** | exact values matter more than comparison — direct labelling instead of an axis |
| `Minimal` | category only | off | **off** | **on** | dashboard tiles, small multiples |
| `Dense` | both, 11 pt | value axis | top | off | many categories, narrow marks |
| `Presentation` | both, 13 pt | value axis | top, 13 pt | **on**, 13 pt | slides, management readouts |
| `Comparison` | both | value axis | **bottom** | off | reading several series against each other |

**Availability.** `Labelled` · `Minimal` · `Dense` · `Presentation` · `Comparison` on
`columnChart`, `barChart`, `clusteredColumnChart`, `clusteredBarChart`,
`hundredPercentStacked{Bar,Column}Chart`, `waterfallChart`, `ribbonChart`, `scatterChart`.
`Labelled` · `Minimal` · `Presentation` on `donutChart`, `pieChart`, `treemap` and `funnel`.
The area and combo charts — `areaChart`, `stackedAreaChart`,
`hundredPercentStackedAreaChart`, `lineClusteredColumnComboChart`,
`lineStackedColumnComboChart` — carry those three plus `Smooth`.

### Line presets

`lineChart` has its own, because with lines the interpolation changes the statement:

| Preset | Effect |
|---|---|
| *(no preset)* | **straight segments**, 2 px, no markers |
| `Markers` | straight segments + circle markers — few data points, exact sample points visible |
| `Smooth` | monotoneX smoothing — only when the curve matters more than the individual value |
| `Step` | steps (center) — states and rates that stay constant between points |
| `Labelled` | markers + direct labelling, value axis off |
| `Sparkline` | no axes, gridlines, legend or labels — for tiles |

**The default is `linear`, not `smooth`.** Power BI smooths line and area charts by
default; a smoothed curve invents values between the data points and over-/undershoots
at extrema. The theme sets `lineStyles.lineChartType: "linear"` on `lineChart` and on all
area and combo charts. If you want the curve, take `Smooth`.

> The property is called **`lineChartType`** (`linear` · `smooth` · `step`), not
> `interpolation` — the latter does appear in the JSON schema but is rejected by
> Power BI. Verify with
> `powerbi-report-author formatting describe-object lineChart lineStyles`.

### Why stacked charts get no segment labels

`Labelled`/`Minimal`/`Presentation` switch on **no** data labels for `stackedAreaChart`,
`hundredPercentStackedAreaChart` and both combo charts: with 12 categories × 4 series
that would be 48 labels stacked on top of each other. `labelDensity` does not help there
— Power BI ignores it for these types. Instead `totals` carries the value: one label per
category. For stacked columns Power BI does this by itself.

### Preset sources

Presets are partials under `src/definitions/preset/`. One file per preset, top-level
key = preset name, formatting objects underneath:

```
src/definitions/preset/
├── labelled.json      → def.preset.labelled.{categoryAxis,valueAxis,legend,labels,…}
├── minimal.json
├── dense.json
├── presentation.json
├── comparison.json
├── sparkline.json     → everything off
└── line.json          → def.preset.line.{straight,markers,smooth,step,sparkline}
```

Wiring a preset into a visual file:

```json
"Minimal": {
    "categoryAxis": "{{def.preset.minimal.categoryAxis}}",
    "valueAxis":    "{{def.preset.minimal.valueAxis}}",
    "legend":       "{{def.preset.minimal.legend}}",
    "labels":       "{{def.preset.minimal.labels}}"
}
```

**Only set objects the visual type actually knows.** `funnel` has no ordinary
`categoryAxis`, `donutChart` no `labels.enableBackground`, `waterfallChart` no gridline
properties on the category axis, and `innerPadding` exists only where there are bars (not
on area charts). Mistakes like these show up neither in the build nor in the schema gate —
only `powerbi-report-author validate <report>` reports them as
`PBIR_THEME_VISUAL_PROP_UNKNOWN`. Run it once after every preset change.

That is why there are side variants for types with a differing property set:
`categoryAxisBars` (with `innerPadding` — bar thickness, 10 / 20 / 35 depending on the
preset), `categoryAxisPlain` (without gridline properties, for `waterfallChart`) and
`labelsThinned` (with `labelDensity`, for `lineChart`).

### Adjust the dark variant

`src/themes/dark.json` contains only the diverging tokens; everything else is inherited from `variables.json`. Deep merge; keys starting with `_` are ignored.

### Change the canvas size

`src/visuals/page.json` → `pageSize`.

---

## Known pitfalls

- **Set axis and label colours explicitly.** `labelColor` in `categoryAxis`/`valueAxis` and `color` in `labels` have to be set, otherwise Power BI inherits `backgroundLight` or picks auto-contrast.
- **Tokens keep their JSON type.** `"{{borders.corners}}"` becomes the number `12`, not the string `"12"`, so numeric properties need numeric tokens.
- **6-digit hex only.** The gate's contrast parser rejects 8-digit alpha hex and reports it as a violation.
- **Do not edit `dist/` by hand** — it is overwritten on every build.
- **Legend position** is called `Top`, not `TopLeft`. `gridlineDashCap` only knows `none`, `round`, `square`.
- **Canvas size via theme** requires schema 2.152 / March 2026 or later.

---

## Not controllable via a theme

- **The "Pages" pane** (page navigation on the left) and the **collapsed "Filters" bar** on the right are Power BI Service chrome. No theme reaches them. Their size follows browser zoom and Windows display scaling — not the theme. Only the **expanded** filter pane is styleable, via `page.outspacePane` and `page.filterCard` (see `font.chrome`).
- **Treemap label colour.** `treemap.categoryLabels.color` and `treemap.labels.color`
  exist as properties but are ignored — Power BI enforces auto-contrast and writes the
  labels white. The theme still sets them, in case Power BI ever respects them. Setting
  `stylePreset: 'None'` on the visual does not help either.
- **A text-only action button renders blank.** A button whose text is set but which has no
  glyph-free action icon (`clearAllSlicers`, `applyAllSlicers`) shows nothing. This holds
  without an `icon` object, with `shapeType: 'blank'`, with `placement: 'left'`, and with
  an inactive `visualLink`. Re-checked on Desktop 2.159. A button that has an icon shows only
  the icon. Put the label in the container `title` instead.
- Focus ring / keyboard focus styling
- Drillthrough styling
- Tooltip visual styling (global defaults only)
- Excluding individual pages — the theme applies report-wide

---

## Known limitations

The build gates check the theme file: its schema and the design rules above. Nothing below is covered by them. These points are known and documented, not waived, and some are only visible in Power BI itself.

**`powerbi-report-author validate` is not fully green on reports using this theme.** A report that imports it gets these findings from the CLI (0.5.0, Desktop 2.159). They are safe to ignore:

- `PBIR_THEME_VISUAL_PROP_UNKNOWN` for `padding.top/right/bottom/left` on `cardVisual` and `advancedSlicerVisual`. The card presets need these values, and the tile slicer needs its container padding at 0 so its title lines up with the dropdown slicers next to it. Both render correctly.
- `PBIR_FORMATTING_OBJECT_UNKNOWN` for `slicer.dropdown`, and `PBIR_THEME_VISUAL_UNKNOWN` for `ganttChart`. Both render correctly in Desktop 2.159; the CLI's metadata predates them.
- `PBIR_VISUAL_TYPE_UNKNOWN` for a native Gantt visual in the report, for the same reason.
- `PBIR_FORMATTING_PROP_UNKNOWN` for `categoryAxis.autoExpand` on charts with a hierarchy axis or a field parameter. It is set in the report, not the theme, and is in schema 2.159.
- `PBIR_SCHEMA_UNREACHABLE` when the CLI cannot download a schema, and the warning `PBIR_SLICER_HEADER_MAY_CLIP` for a dropdown slicer in an 88 px header row. Neither is about the theme.

Anything else `validate` reports is a real problem.

**Gridlines are drawn on both axes.** `categoryAxis` and `valueAxis` read the same `gridlines` group, so a bar chart gets a grid across its category axis too. Splitting the group, or overriding `gridlineShow` in `categoryAxis.json`, is the fix.

**Schema 2.159 slicer objects are in the schema but not themeable.** See [docs/parked-slicer-objects.md](parked-slicer-objects.md) for the tested behaviour and the parked JSON.

**Classic `slicer` dropdown box** (`slicer.dropdown`) is themed and verified on Desktop 2.159: `borders.color` hairline, `borders.corners` radius, `text_muted` chevron. It also needs `accentBarShow: false` — otherwise the box's default accent bar draws a darker underline over the bottom edge.

---
