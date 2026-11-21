"use strict"

/**
 * Compiles src/ into a Power BI theme.
 *
 *   node scripts/build.js                  → dist/theme.json
 *   node scripts/build.js --variant dark   → dist/theme.dark.json
 *
 * The theme is assembled in memory, written to a temporary file, and checked by both
 * gates (scripts/validate.js, scripts/lint-design.js). Only a theme that passes both
 * reaches dist/. Any error in any source file fails the build with its file and path.
 */

const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFileSync } = require("child_process")
const T = require("./lib/tokens")

const DIST = path.join(T.ROOT, "dist")

const arg = process.argv.indexOf("--variant")
const VARIANT = arg !== -1 ? process.argv[arg + 1] : null

// Label precision per visual type, applied to every style's labels. The shared preset
// label objects cannot carry these: percentageLabelPrecision exists only on pie, donut and
// funnel, and labelPrecision: 0 on an ordinary bar chart would turn "€ 1,3M" into "€ 1M".
const LABEL_PRECISION = {
  pieChart: { percentageLabelPrecision: 0 },
  donutChart: { percentageLabelPrecision: 0 },
  funnel: { percentageLabelPrecision: 0, labelPrecision: 1 },
  hundredPercentStackedBarChart: { labelPrecision: 0 },
  hundredPercentStackedColumnChart: { labelPrecision: 0 },
}

function compile() {
  const tokens = T.loadTokens(VARIANT)

  // textClasses are tokens too: templates reference them as {{text.<class>.<prop>}}.
  const textFile = path.join(T.SRC, "text.json")
  const tokenOnly = T.makeResolver(tokens, "tokens")
  const textClasses = T.substitute(T.readJson(textFile), tokenOnly, T.rel(textFile))

  // One resolver for templates: resolved tokens, text classes, and the raw definitions,
  // which may reference tokens and each other (cycles are reported, not looped).
  const resolve = T.makeResolver({ ...tokens, text: textClasses, def: T.loadDefinitions() }, "definitions")
  const render = (file) => T.substitute(T.readJson(file), resolve, T.rel(file))

  const theme = render(path.join(T.SRC, "theme.json"))

  // dataColors is Power BI's ORDERED series palette: slot N goes to series N. It comes
  // from the explicit chartPalette array, never from a map that also holds brand and
  // semantic tokens.
  if (!Array.isArray(tokens.chartPalette) || tokens.chartPalette.length === 0) {
    throw new T.BuildError("src/variables.json: chartPalette must be a non-empty array")
  }
  theme.dataColors = tokens.chartPalette

  // The dark build is a separate entry in Power BI's theme list. The name carries no
  // version: a report keeps its own copy of the theme, so a version in the name goes stale.
  if (VARIANT) theme.name = `${theme.name} ${VARIANT[0].toUpperCase()}${VARIANT.slice(1)}`

  theme.visualStyles = {}
  const owner = {}
  for (const file of T.listJson(path.join(T.SRC, "visuals"))) {
    const { visualStyles } = render(file)
    if (!T.isPlainObject(visualStyles)) throw new T.BuildError(`${T.rel(file)}: no visualStyles object`)
    for (const [visual, styles] of Object.entries(visualStyles)) {
      if (owner[visual]) {
        throw new T.BuildError(
          `${T.rel(file)}: visualStyles.${visual} is already defined in ${owner[visual]}`,
        )
      }
      owner[visual] = T.rel(file)
      theme.visualStyles[visual] = styles
    }
  }

  for (const [visual, props] of Object.entries(LABEL_PRECISION)) {
    for (const style of Object.values(theme.visualStyles[visual] || {})) {
      if (Array.isArray(style.labels)) style.labels = style.labels.map((entry) => ({ ...entry, ...props }))
    }
  }

  theme.textClasses = textClasses
  return theme
}

function main() {
  const theme = compile()
  const name = VARIANT ? `theme.${VARIANT}.json` : "theme.json"
  const json = JSON.stringify(theme, null, 2)

  // Gate a temporary copy first, so dist/ never holds a theme that failed a gate.
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "sightline-")), name)
  fs.writeFileSync(tmp, json)
  const gateArgs = ["--theme", tmp, ...(VARIANT ? ["--variant", VARIANT] : [])]
  try {
    for (const gate of ["validate.js", "lint-design.js"]) {
      execFileSync(process.execPath, [path.join(__dirname, gate), ...gateArgs], { stdio: "inherit" })
    }
  } catch {
    console.error(`✗ ${name} failed a gate; dist/ was not changed`)
    process.exit(1)
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
  }

  fs.mkdirSync(DIST, { recursive: true })
  fs.writeFileSync(path.join(DIST, name), json)
  console.log(`✔ dist/${name}`)
}

try {
  main()
} catch (e) {
  if (e instanceof T.BuildError) {
    console.error(`✗ ${e.message}`)
    process.exit(1)
  }
  throw e
}
