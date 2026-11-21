"use strict"

/**
 * Token loading and template resolution, shared by the build and the design gate.
 *
 * Templates are plain JSON. A string that is exactly "{{path.to.token}}" is replaced by
 * the token's value, keeping its JSON type (number, boolean, object, array). There is
 * no other syntax: no partial blocks, no helpers, no string interpolation.
 *
 * Everything fails loudly. An unknown token, a reference cycle, a token embedded inside a
 * longer string or a key defined twice stops the build with the file and the JSON path.
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..", "..")
const SRC = path.join(ROOT, "src")

const TOKEN = /^\{\{\s*([\w$.]+)\s*\}\}$/
const EMBEDDED = /\{\{\s*[\w$.]+\s*\}\}/

class BuildError extends Error {}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join("/")
const isPlainObject = (o) => o !== null && typeof o === "object" && !Array.isArray(o)
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))

function readJson(file) {
  let text
  try {
    text = fs.readFileSync(file, "utf8")
  } catch (e) {
    throw new BuildError(`${rel(file)}: cannot read (${e.message})`)
  }
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new BuildError(`${rel(file)}: invalid JSON (${e.message})`)
  }
}

function lookup(root, dotted) {
  let cur = root
  for (const part of dotted.split(".")) {
    if (!isPlainObject(cur) || !Object.prototype.hasOwnProperty.call(cur, part)) {
      return { found: false }
    }
    cur = cur[part]
  }
  return { found: true, value: cur }
}

/** Walk a JSON value, replacing whole-string tokens through `resolveRef`. */
function substitute(node, resolveRef, where) {
  if (typeof node === "string") {
    const m = TOKEN.exec(node)
    if (m) return resolveRef(m[1], where)
    if (EMBEDDED.test(node)) {
      throw new BuildError(`${where}: tokens must be the whole value, found "${node}"`)
    }
    return node
  }
  if (Array.isArray(node)) return node.map((v, i) => substitute(v, resolveRef, `${where}[${i}]`))
  if (isPlainObject(node)) {
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = substitute(v, resolveRef, `${where}.${k}`)
    return out
  }
  return node
}

/** Deep-merge `source` over `target`; keys starting with "_" are comments and skipped. */
function overlay(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (key.startsWith("_")) continue
    if (isPlainObject(value) && isPlainObject(target[key])) overlay(target[key], value)
    else target[key] = clone(value)
  }
  return target
}

/**
 * Build a resolver over a raw tree whose values may reference each other.
 * Every reference is resolved recursively, memoised, and checked for cycles.
 */
function makeResolver(raw, label, fallback) {
  const done = new Map()
  const resolve = (ref, where, stack = []) => {
    if (done.has(ref)) return clone(done.get(ref))
    if (stack.includes(ref)) {
      throw new BuildError(`${label}: reference cycle ${[...stack, ref].join(" → ")}`)
    }
    const hit = lookup(raw, ref)
    if (!hit.found) {
      if (fallback) return fallback(ref, where)
      throw new BuildError(`${where}: unknown token "{{${ref}}}"`)
    }
    const value = substitute(hit.value, (r, w) => resolve(r, w, [...stack, ref]), `${label}:${ref}`)
    done.set(ref, value)
    return clone(value)
  }
  return resolve
}

/** variables.json, with src/themes/<variant>.json deep-merged over it, fully resolved. */
function loadTokens(variant) {
  const raw = readJson(path.join(SRC, "variables.json"))
  if (variant) {
    const file = path.join(SRC, "themes", `${variant}.json`)
    if (!fs.existsSync(file))
      throw new BuildError(`unknown variant "${variant}": ${rel(file)} does not exist`)
    overlay(raw, readJson(file))
  }
  const resolve = makeResolver(raw, "variables")
  return substitute(raw, resolve, "variables")
}

/** All JSON files under a directory, sorted, so build output never depends on the OS. */
function listJson(dir) {
  const out = []
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name)
    if (fs.statSync(full).isDirectory()) out.push(...listJson(full))
    else if (name.endsWith(".json")) out.push(full)
  }
  return out
}

/**
 * src/definitions/<dir>/<file>.json → def.<dir>.<top-level key of the file>.
 * Two files claiming the same key is an error, not a silent overwrite.
 */
function loadDefinitions() {
  const dir = path.join(SRC, "definitions")
  const def = {}
  if (!fs.existsSync(dir)) return def
  for (const file of listJson(dir)) {
    const segments = path.relative(dir, path.dirname(file)).split(path.sep).filter(Boolean)
    let target = def
    for (const s of segments) target = target[s] ||= {}
    for (const [key, value] of Object.entries(readJson(file))) {
      if (key in target) {
        throw new BuildError(`${rel(file)}: def.${[...segments, key].join(".")} is already defined`)
      }
      target[key] = value
    }
  }
  return def
}

module.exports = {
  BuildError,
  SRC,
  ROOT,
  rel,
  readJson,
  listJson,
  lookup,
  substitute,
  makeResolver,
  loadTokens,
  loadDefinitions,
  isPlainObject,
}
