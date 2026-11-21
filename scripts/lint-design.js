"use strict"

/**
 * Design guardrail gate.
 *
 * validate.js proves the theme is well-formed Power BI.
 * This proves it is well-formed *design*: WCAG contrast floors, a palette that
 * cannot hand two series the same colour, and a type ramp whose tiers are far
 * enough apart to read as hierarchy.
 *
 * Exits non-zero on any error, so `npm run build` refuses to ship a violation.
 *
 *   node scripts/lint-design.js
 */

const fs = require("fs")
const path = require("path")
const { loadTokens } = require("./lib/tokens")

const DIST = path.join(__dirname, "..", "dist")

// ---------------------------------------------------------------- thresholds

const FLOOR = {
  bodyText: 4.5, // WCAG 1.4.3 AA — text under 18pt regular
  largeText: 3.0, // WCAG 1.4.3 AA — 18pt+ regular / 14pt+ bold
  nonText: 3.0, // WCAG 1.4.11 — chart marks, interactive boundaries
  surfaceStep: 1.08, // a tinted canvas, if used, must read as a distinct plane
  hairlineMin: 1.1, // below this the card edge is not there at all
  hairlineMax: 1.25, // above this it reads as a box outline, not a hairline
  typeStep: 1.15, // adjacent font tiers, or the sizes read as inconsistency
  paletteMax: 8, // beyond this, categorical hues stop being separable
  calloutMin: 24, // KPI hero values
}

// ------------------------------------------------------------------- colour

const parse = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255)
}

const luminance = (hex) => {
  const rgb = parse(hex)
  if (!rgb) return null
  const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a, b) => {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// --------------------------------------------------------------- token access

const at = (obj, dotted) => dotted.split(".").reduce((cur, key) => (cur == null ? cur : cur[key]), obj)

// ------------------------------------------------------------------ reporting

const errors = []
const passes = []
const waived = []

// A rule listed in a11y.waivers is a design decision that was taken knowingly:
// the finding is still reported, but it no longer blocks the build. Every waiver
// needs a reason string, so the record says WHO decided and WHY — a silent
// deletion of the check would lose that.
const waivers = (vars) => (vars.a11y && vars.a11y.waivers) || {}

let WAIVED = {}
const fail = (rule, msg) => {
  if (WAIVED[rule]) waived.push({ rule, msg, reason: WAIVED[rule] })
  else errors.push({ rule, msg })
}
const ok = (rule, msg) => passes.push({ rule, msg })

function checkContrast(rule, label, fg, bg, floor) {
  const ratio = contrast(fg, bg)
  if (ratio === null) return fail(rule, `${label}: cannot parse ${fg} on ${bg}`)
  const r = ratio.toFixed(2)
  if (ratio < floor) fail(rule, `${label}: ${fg} on ${bg} = ${r}:1 (needs ${floor}:1)`)
  else ok(rule, `${label}: ${r}:1`)
}

// ---------------------------------------------------------------------- run

const argValue = (flag) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : null
}
const VARIANT = argValue("--variant")

const vars = loadTokens(VARIANT)
const themeFile = argValue("--theme") || path.join(DIST, VARIANT ? `theme.${VARIANT}.json` : "theme.json")
const theme = JSON.parse(fs.readFileSync(themeFile, "utf8"))
const a11y = vars.a11y || {}
WAIVED = waivers(vars)
const card = vars.surfaces.card
const canvas = vars.surfaces.canvas

// --- 1. text tokens clear the body-text floor on the card surface
for (const token of a11y.textTokens || []) {
  const hex = at(vars, token)
  if (!hex) fail("contrast/text", `a11y.textTokens names ${token}, which does not exist`)
  else checkContrast("contrast/text", token, hex, a11y.textOn || card, FLOOR.bodyText)
}

// --- 2. Every series colour must clear 3:1 against the surfaces it sits on
//        (WCAG 1.4.11). If you fork this theme for a brand whose mandated colour
//        is below 3:1, name it in a11y.markFloorToken: the brand then becomes the
//        floor, so no chart colour may be harder to see than the brand colour,
//        and the gate says so instead of silently dropping the check.
const surfaces = (a11y.markOn || [card, canvas]).filter(Boolean)
const brandFloor = a11y.markFloorToken ? at(vars, a11y.markFloorToken) : null
const markFloor = brandFloor
  ? Math.min(FLOOR.nonText, ...surfaces.map((s) => contrast(brandFloor, s)))
  : FLOOR.nonText

if (brandFloor && markFloor < FLOOR.nonText) {
  console.log(
    `  ℹ mark floor relaxed to ${markFloor.toFixed(2)}:1 — set by the brand colour ` +
      `${brandFloor} (${a11y.markFloorToken}), below the ${FLOOR.nonText}:1 guideline`,
  )
}

vars.chartPalette.forEach((hex, i) => {
  for (const surface of surfaces) {
    checkContrast(
      "contrast/palette",
      `chartPalette[${i}] on ${surface}`,
      hex,
      surface,
      // rounded so a slot equal to the brand colour is not tripped by float noise
      Math.floor(markFloor * 100) / 100,
    )
  }
})

// --- 3. Semantic fills are chart marks too, so they answer to the same
//        floor as the palette.
for (const key of Object.keys(vars.semantic || {}).filter((k) => k.endsWith("_fill"))) {
  for (const surface of surfaces) {
    checkContrast(
      "contrast/semantic",
      `semantic.${key} on ${surface}`,
      vars.semantic[key],
      surface,
      Math.floor(markFloor * 100) / 100,
    )
  }
}

// --- 4. a border that IS the affordance must be seen (WCAG 1.4.11)
for (const token of a11y.interactiveBorderTokens || []) {
  checkContrast("contrast/affordance", token, at(vars, token), card, FLOOR.nonText)
}

// --- 5. On-fill states (selected buttons) are body text on a coloured ground.
//        Light mode puts white on a dark fill; dark mode puts near-black on a
//        light fill. Auto-derived dark themes routinely get this backwards, so
//        each variant declares which direction applies and the gate checks it.
for (const token of a11y.whiteOnFillTokens || []) {
  checkContrast("contrast/onFill", `white on ${token}`, "#ffffff", at(vars, token), FLOOR.bodyText)
}
for (const token of a11y.darkOnFillTokens || []) {
  const label = at(vars, "buttons.selected.value.fontColor") || "#0F1419"
  checkContrast("contrast/onFill", `${label} on ${token}`, label, at(vars, token), FLOOR.bodyText)
}
// A selected control can also be label-on-tint rather than label-on-saturated-fill.
// That is the segmented-control pattern; the label still has to clear the
// body-text floor.
for (const [labelToken, fillToken] of a11y.tintPairs || []) {
  checkContrast(
    "contrast/onFill",
    `${labelToken} on ${fillToken}`,
    at(vars, labelToken),
    at(vars, fillToken),
    FLOOR.bodyText,
  )
}
const onFillDeclared =
  (a11y.whiteOnFillTokens || []).length + (a11y.darkOnFillTokens || []).length + (a11y.tintPairs || []).length
if (!onFillDeclared) {
  fail("contrast/onFill", "no on-fill tokens declared — selected-state contrast is unchecked")
}

// --- 6. the palette cannot hand two series the same colour
{
  const seen = new Map()
  vars.chartPalette.forEach((hex, i) => {
    const k = hex.toLowerCase()
    if (seen.has(k)) fail("palette/unique", `slot ${i + 1} repeats slot ${seen.get(k) + 1} (${hex})`)
    else seen.set(k, i)
  })
  if (!errors.some((e) => e.rule === "palette/unique")) {
    ok("palette/unique", `${vars.chartPalette.length} distinct slots`)
  }

  if (vars.chartPalette.length > FLOOR.paletteMax) {
    fail("palette/length", `${vars.chartPalette.length} slots exceeds ${FLOOR.paletteMax}`)
  } else {
    ok("palette/length", `${vars.chartPalette.length} slots`)
  }

  // The primary colour leads the palette and fills selected controls. If it is
  // too light to carry white text, a darker sibling is needed. Guard the misuse.
  {
    const primary = String((vars.brand && vars.brand.primary) || vars.dataColors.primary || "")
    if (!primary) {
      ok("palette/brand", "no brand colour declared — check skipped")
    } else {
      const onPrimary = contrast("#ffffff", primary)
      const usedForWhiteText = (a11y.whiteOnFillTokens || []).some(
        (t) => String(at(vars, t)).toLowerCase() === primary.toLowerCase(),
      )
      if (usedForWhiteText && onPrimary < FLOOR.bodyText) {
        fail(
          "palette/brand",
          `the primary colour (${primary}) carries white text at ${onPrimary.toFixed(2)}:1 — a darker sibling is needed for filled controls`,
        )
      } else {
        ok("palette/brand", "primary colour not carrying white text below the floor")
      }
    }
  }

  // Directional semantics (positive / warning / negative) carry meaning a reader
  // decodes without a legend — spending them on an arbitrary category teaches the
  // wrong thing. Neutral grey is exempt: "context / Other" IS its semantic use,
  // and slot 1 is exempt because a primary colour may legitimately double as positive.
  const directional = Object.entries(vars.semantic || {})
    .filter(([k]) => /^(positive|warning|negative)_/.test(k))
    .map(([, c]) => String(c).toLowerCase())
  const directionalSet = new Set(directional)
  const leaked = vars.chartPalette
    .map((c, i) => [c, i])
    .filter(([c, i]) => i > 0 && directionalSet.has(String(c).toLowerCase()))
  if (leaked.length) {
    const detail = leaked.map(([c, i]) => `slot ${i + 1} (${c})`).join(", ")
    fail("palette/semantic", `directional semantic colours used as categorical slots: ${detail}`)
  } else {
    ok("palette/semantic", "no directional semantic colour spent as a categorical slot")
  }
}

// --- 7. A sequential ramp encodes magnitude by lightness, so step order must be
//        strictly monotonic. The direction flips per variant: on a light canvas
//        the ramp darkens as values rise; on a dark canvas it lightens. A ramp
//        that reverses mid-way makes "higher" unreadable.
{
  const steps = Object.keys(vars.sequential || {}).sort()
  const lums = steps.map((k) => luminance(vars.sequential[k]))
  const unparseable = steps.filter((k, i) => lums[i] === null)
  if (!steps.length) {
    ok("ramp/sequential", "no sequential ramp declared — check skipped")
  } else if (unparseable.length) {
    fail("ramp/sequential", `unparseable colours (6-digit hex only): ${unparseable.join(", ")}`)
  } else {
    const wantLightening = luminance(canvas) < 0.5
    const rising = lums.every((l, i) => i === 0 || l > lums[i - 1])
    const falling = lums.every((l, i) => i === 0 || l < lums[i - 1])
    if (!rising && !falling) {
      fail("ramp/sequential", "sequential ramp is not monotonic — it reverses direction mid-ramp")
    } else if (wantLightening && !rising) {
      fail("ramp/sequential", "on a dark canvas the sequential ramp must lighten as steps rise")
    } else if (!wantLightening && !falling) {
      fail("ramp/sequential", "on a light canvas the sequential ramp must darken as steps rise")
    } else {
      ok("ramp/sequential", `${steps.length} steps, monotonic ${rising ? "lightening" : "darkening"}`)
    }
  }
}

// --- 8. type tiers far enough apart to read as hierarchy
{
  const order = ["xs", "s", "m", "l", "xl", "xxl", "xxxl"]
  const sizes = order.map((k) => vars.font.sizes[k]).filter((v) => typeof v === "number")
  sizes.forEach((size, i) => {
    if (i === 0) return
    const ratio = size / sizes[i - 1]
    if (ratio < FLOOR.typeStep) {
      fail(
        "type/step",
        `${order[i - 1]} ${sizes[i - 1]} → ${order[i]} ${size} = ${ratio.toFixed(2)}× (needs ${FLOOR.typeStep}×)`,
      )
    }
  })
  if (!errors.some((e) => e.rule === "type/step")) {
    ok("type/step", `${sizes.length} tiers, all ≥ ${FLOOR.typeStep}× apart`)
  }
}

// --- 9. textClasses must not collapse tiers into each other
{
  const tc = theme.textClasses || {}
  const distinct = [
    ["title", "largeTitle", "page title vs visual title"],
    ["label", "smallLabel", "body label vs small label"],
  ]
  for (const [a, b, what] of distinct) {
    if (tc[a] && tc[b] && tc[a].fontSize === tc[b].fontSize) {
      fail("type/collapse", `${what}: ${a} and ${b} are both ${tc[a].fontSize}pt`)
    } else {
      ok("type/collapse", `${what} are distinct`)
    }
  }
  if (tc.callout && tc.callout.fontSize < FLOOR.calloutMin) {
    fail("type/callout", `callout is ${tc.callout.fontSize}pt (KPI hero values need ≥ ${FLOOR.calloutMin}pt)`)
  } else if (tc.callout) {
    ok("type/callout", `callout ${tc.callout.fontSize}pt`)
  }
}

// --- 10. the surface hierarchy has to actually be a hierarchy
{
  // A visual has to be tellable from the page by SOME means: a tinted canvas, a
  // hairline edge, or elevation. Any one is enough — Fluent 2 separates with a
  // hairline alone and a white canvas, which is exactly what this theme does.
  const step = contrast(canvas, card)
  const shadow = theme.visualStyles?.["*"]?.["*"]?.dropShadow?.[0]
  const elevated = shadow?.show === true && (shadow.transparency ?? 100) < 100
  const borderCard = theme.visualStyles?.["*"]?.["*"]?.border?.[0]
  const edge = vars.borders?.color ? contrast(vars.borders.color, card) : 1
  const hairlined = borderCard?.show !== false && edge >= FLOOR.hairlineMin

  const means = [
    step >= FLOOR.surfaceStep && `canvas step ${step.toFixed(3)}:1`,
    hairlined && `hairline ${edge.toFixed(2)}:1`,
    elevated && "elevation",
  ].filter(Boolean)

  if (!means.length) {
    fail(
      "surface/separation",
      `nothing separates a visual from the page: canvas step ${step.toFixed(3)}:1, card edge ${edge.toFixed(2)}:1, no elevation`,
    )
  } else {
    ok("surface/separation", means.join(" + "))
  }

  // The upper bound is the one that matters aesthetically. Past ~1.25:1 the edge
  // stops reading as a hairline and starts reading as a box, which is what dates
  // a dashboard. Power BI's dropShadow is coarse at any strength, so elevation is
  // rejected outright rather than tuned.
  if (vars.borders?.color) {
    if (edge > FLOOR.hairlineMax) {
      fail(
        "surface/hairline",
        `borders.color ${vars.borders.color} is ${edge.toFixed(2)}:1 on the card — a box outline, not a hairline (keep within ${FLOOR.hairlineMin}–${FLOOR.hairlineMax}:1)`,
      )
    } else {
      ok("surface/hairline", `card edge ${edge.toFixed(2)}:1`)
    }
  }
  if (elevated) {
    fail(
      "surface/elevation",
      "dropShadow is enabled globally — Power BI renders it coarsely at every strength and it dates the design; separate planes with the hairline instead",
    )
  } else {
    ok("surface/elevation", "no global drop shadow")
  }

  const pageBg = theme.visualStyles?.page?.["*"]?.background?.[0]
  if (pageBg && pageBg.transparency === 100) {
    fail("surface/page", "page background is at transparency 100 — the tinted canvas never renders")
  } else if (pageBg) {
    ok("surface/page", `page background transparency ${pageBg.transparency ?? 0}`)
  }
}

// --- 11. shadows are decoration; surface contrast does that job now
for (const [type, styles] of Object.entries(theme.visualStyles || {})) {
  for (const [styleName, props] of Object.entries(styles || {})) {
    const shadow = props?.shadow?.[0]
    const drop = props?.dropShadow?.[0]
    if (shadow?.show === true && drop?.show === true) {
      fail("surface/shadow", `${type}["${styleName}"] enables both shadow and dropShadow`)
    }
  }
}
if (!errors.some((e) => e.rule === "surface/shadow")) {
  ok("surface/shadow", "no visual stacks two shadow effects")
}

// --- 12. the built palette must be the palette we designed
{
  const built = JSON.stringify(theme.dataColors)
  const designed = JSON.stringify(vars.chartPalette)
  if (built !== designed) {
    fail(
      "build/palette",
      `dist dataColors does not match chartPalette\n      built:    ${built}\n      designed: ${designed}`,
    )
  } else {
    ok("build/palette", "dist dataColors === chartPalette")
  }
}

// -------------------------------------------------------------------- output

const byRule = passes.reduce((acc, p) => {
  acc[p.rule] = (acc[p.rule] || 0) + 1
  return acc
}, {})

console.log(`\n— design gate${VARIANT ? ` · ${VARIANT}` : ""} —`)
for (const [rule, count] of Object.entries(byRule)) {
  console.log(`  ✓ ${rule.padEnd(22)} ${count} check${count === 1 ? "" : "s"}`)
}

if (waived.length) {
  console.log(`
  ${waived.length} waived finding${waived.length === 1 ? "" : "s"} (decided, not blocking):`)
  const byRuleW = new Map()
  for (const w of waived) {
    if (!byRuleW.has(w.rule)) byRuleW.set(w.rule, { count: 0, reason: w.reason, first: w.msg })
    byRuleW.get(w.rule).count++
  }
  for (const [rule, info] of byRuleW) {
    console.log(`    ~ ${rule} ×${info.count} — ${info.reason}`)
    console.log(`        e.g. ${info.first}`)
  }
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} design violation${errors.length === 1 ? "" : "s"}:\n`)
  for (const e of errors) console.error(`  [${e.rule}] ${e.msg}`)
  console.error("")
  process.exit(1)
}

console.log(`\n✔ design gate passed — ${passes.length} checks\n`)
