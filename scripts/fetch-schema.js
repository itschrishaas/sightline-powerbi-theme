"use strict"

/**
 * Downloads the Power BI report theme JSON schema to dist/schema.json if it is
 * not there yet. The URL is the "$schema" of src/theme.json, so bumping the
 * schema version in that file is all it takes to validate against a newer one
 * (delete dist/schema.json to force a fresh download).
 *
 *   node scripts/fetch-schema.js
 */

const fs = require("fs")
const path = require("path")
const https = require("https")

const ROOT = path.join(__dirname, "..")
const target = path.join(ROOT, "dist", "schema.json")

if (fs.existsSync(target)) {
  console.log("✓ dist/schema.json present")
  process.exit(0)
}

const template = fs.readFileSync(path.join(ROOT, "src", "theme.json"), "utf8")
const match = /"\$schema"\s*:\s*"([^"]+)"/.exec(template)
if (!match) {
  console.error('✗ No "$schema" URL found in src/theme.json')
  process.exit(1)
}
const url = match[1]

function get(u, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(u, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          res.resume()
          return resolve(get(new URL(res.headers.location, u).toString(), redirects - 1))
        }
        if (res.statusCode !== 200) {
          res.resume()
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`))
        }
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      })
      .on("error", reject)
  })
}

get(url)
  .then((body) => {
    JSON.parse(body) // refuse to cache anything that is not JSON
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, body)
    console.log(`✓ downloaded ${url} → dist/schema.json`)
  })
  .catch((err) => {
    console.error(`✗ could not download the theme schema: ${err.message}`)
    process.exit(1)
  })
