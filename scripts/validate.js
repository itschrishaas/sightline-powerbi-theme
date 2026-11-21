"use strict"

/**
 * Gate 1: is the theme valid against Microsoft's report theme JSON schema?
 *
 *   node scripts/validate.js [--variant dark] [--theme <file>]
 *
 * Without --theme it checks the built file in dist/. The schema is dist/schema.json,
 * downloaded by scripts/fetch-schema.js.
 */

const fs = require("fs")
const path = require("path")
const Ajv = require("ajv")

const ROOT = path.join(__dirname, "..")
const argValue = (flag) => {
  const i = process.argv.indexOf(flag)
  return i !== -1 ? process.argv[i + 1] : null
}
const VARIANT = argValue("--variant")
const themePath =
  argValue("--theme") || path.join(ROOT, "dist", VARIANT ? `theme.${VARIANT}.json` : "theme.json")
const schemaPath = path.join(ROOT, "dist", "schema.json")

function fail(message, details) {
  console.error(`✗ ${message}`)
  if (details) console.error(details)
  process.exit(1)
}

if (!fs.existsSync(schemaPath)) fail("dist/schema.json is missing. Run: node scripts/fetch-schema.js")

const theme = JSON.parse(fs.readFileSync(themePath, "utf8"))
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"))

// Microsoft's schema repeats some enum members. Ajv treats that as an error in the schema
// itself, so the duplicates are dropped in memory before compiling.
;(function dedupeEnums(node) {
  if (!node || typeof node !== "object") return
  for (const [key, value] of Object.entries(node)) {
    if (key === "enum" && Array.isArray(value)) node[key] = [...new Set(value)]
    else dedupeEnums(value)
  }
})(schema)

const validate = new Ajv({ allErrors: true, strict: false }).compile(schema)
if (!validate(theme)) {
  const lines = validate.errors.map((e) => `  ${e.instancePath || "(root)"}: ${e.message}`)
  fail(`schema validation failed (${validate.errors.length})`, [...new Set(lines)].join("\n"))
}
if (!theme.visualStyles) fail("theme has no visualStyles")
console.log("✓ schema: theme matches reportThemeSchema")
