"use strict"

/**
 * Builds the documentation site for GitHub Pages into _site/.
 *
 *   node scripts/build-site.js
 *
 * The landing page is generated here; the other pages come from the Markdown files in the
 * repository (docs/reference.md, CHANGELOG.md, CLAUDE.md), so GitHub and the site always show the
 * same text. Colours, the palette and its contrast values are read from the theme tokens, so the
 * site cannot drift from the theme it documents.
 */

const crypto = require("crypto")
const fs = require("fs")
const path = require("path")
const { marked } = require("marked")
const { loadTokens } = require("./lib/tokens")

const ROOT = path.join(__dirname, "..")
const OUT = path.join(ROOT, "_site")

/** width="…" height="…" read from the PNG header, so the attributes always match the file. */
function size(name) {
  const b = fs.readFileSync(path.join(ROOT, "docs/img", name))
  return `width="${b.readUInt32BE(16)}" height="${b.readUInt32BE(20)}"`
}
const REPO = "https://github.com/itschrishaas/sightline-powerbi-theme"
const RELEASE = `${REPO}/releases/latest/download`
const pkg = require(path.join(ROOT, "package.json"))

const light = loadTokens(null)
const dark = loadTokens("dark")

// ------------------------------------------------------------------ helpers

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8")
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

// GitHub's heading anchors: lower case, punctuation dropped, spaces to hyphens.
function slugger() {
  const seen = {}
  return (text) => {
    const base = decode(text)
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-")
    const n = seen[base] ?? 0
    seen[base] = n + 1
    return n ? `${base}-${n}` : base
  }
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// Repository links inside the Markdown become site links where a page exists,
// and GitHub links everywhere else.
const PAGE_FOR = {
  "README.md": "index.html",
  "docs/reference.md": "reference.html",
  "CHANGELOG.md": "changelog.html",
  "CLAUDE.md": "agents.html",
  "AGENTS.md": "agents.html",
}
function rewrite(href, fromDir) {
  if (/^(https?:|mailto:|#)/.test(href)) return href
  const [p, hash] = href.split("#")
  const repoPath = path.posix.normalize(path.posix.join(fromDir, p)).replace(/^\.\//, "")
  const anchor = hash ? `#${hash}` : ""
  if (PAGE_FOR[repoPath]) return PAGE_FOR[repoPath] + anchor
  if (repoPath.startsWith("docs/img/")) return repoPath.slice("docs/".length)
  const kind =
    fs.existsSync(path.join(ROOT, repoPath)) && fs.statSync(path.join(ROOT, repoPath)).isDirectory()
  return `${REPO}/${kind ? "tree" : "blob"}/main/${repoPath}${anchor}`
}

/** Markdown → HTML with GitHub-compatible heading ids, rewritten links, and a table of contents. */
function renderMarkdown(source, fromDir) {
  const slug = slugger()
  const toc = []
  let html = marked.parse(source, { gfm: true })
  html = html.replace(/<h([1-4])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const id = slug(inner)
    if (level === "2" || level === "3") toc.push({ level: Number(level), id, text: decode(inner) })
    return `<h${level} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${level}>`
  })
  html = html.replace(/(href|src)="([^"]+)"/g, (_, attr, url) => `${attr}="${rewrite(decode(url), fromDir)}"`)
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, "</table></div>")
  return { html, toc }
}

// ------------------------------------------------------------------ styles

const css = `
:root {
  --bg: ${light.surfaces.canvas}; --card: ${light.surfaces.card}; --muted-bg: ${light.surfaces.sunken};
  --border: ${light.borders.color}; --text: ${light.otherColors.text}; --muted: ${light.otherColors.text_muted};
  --accent: ${light.dataColors.primary}; --accent-fg: ${light.buttons.selected.value.fontColor};
  --accent-soft: ${light.sequential.step1};
  --radius: ${light.borders.corners}px; --radius-sm: ${light.borders.controlCorners}px;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: ${dark.surfaces.canvas}; --card: ${dark.surfaces.card}; --muted-bg: ${dark.otherColors.gray_lighter};
    --border: ${dark.borders.color}; --text: ${dark.otherColors.text}; --muted: ${dark.otherColors.text_muted};
    --accent: ${dark.dataColors.primary}; --accent-fg: ${dark.buttons.selected.value.fontColor};
    --accent-soft: ${dark.sequential.step2};
  }
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 80px; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 16px/1.6 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased; }
a { color: var(--accent); text-underline-offset: 3px; }
img { max-width: 100%; height: auto; display: block; }
code, pre { font-family: ui-monospace, "Cascadia Code", "SF Mono", Consolas, monospace; font-size: .875em; }
:not(pre) > code { background: var(--muted-bg); border: 1px solid var(--border); border-radius: 6px; padding: .1em .35em; }
pre { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 16px; overflow-x: auto; line-height: 1.5; }
.wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

/* header */
.site-header { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 85%, transparent);
  backdrop-filter: saturate(180%) blur(8px); border-bottom: 1px solid var(--border); }
.site-header .wrap { display: flex; align-items: center; gap: 24px; height: 60px; }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 600; color: var(--text); text-decoration: none; }
.brand-mark { width: 22px; height: 22px; border-radius: 6px; background: var(--accent); position: relative; }
.brand-mark::after { content: ""; position: absolute; inset: 6px 5px 5px 5px; border-left: 3px solid var(--accent-fg);
  border-bottom: 3px solid var(--accent-fg); }
.nav { display: flex; gap: 4px; margin-left: auto; }
.nav a { color: var(--muted); text-decoration: none; padding: 6px 10px; border-radius: var(--radius-sm); font-size: 15px; }
.nav a:hover, .nav a[aria-current] { color: var(--text); background: var(--muted-bg); }

/* buttons */
.btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: var(--radius-sm);
  font-weight: 600; font-size: 15px; text-decoration: none; border: 1px solid var(--border); background: var(--card); color: var(--text); }
.btn:hover { background: var(--muted-bg); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.btn-primary:hover { background: var(--accent); filter: brightness(1.08); }
.btn svg { width: 16px; height: 16px; }

/* landing */
.hero { padding: 72px 0 32px; text-align: center; }
.pill { display: inline-flex; gap: 8px; align-items: center; font-size: 13px; color: var(--muted); border: 1px solid var(--border);
  background: var(--card); border-radius: 999px; padding: 4px 12px; }
.pill b { color: var(--accent); font-weight: 600; }
.hero h1 { font-size: clamp(36px, 6vw, 60px); line-height: 1.05; letter-spacing: -.03em; margin: 20px auto 16px; max-width: 820px; font-weight: 700; }
.hero p.lead { font-size: 19px; color: var(--muted); max-width: 680px; margin: 0 auto 28px; }
.actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.shot { margin: 48px auto 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden;
  background: var(--card); box-shadow: 0 1px 2px rgb(0 0 0 / .04), 0 24px 48px -24px rgb(0 0 0 / .18); }
section { padding: 72px 0; }
section + section { border-top: 1px solid var(--border); }
.eyebrow { color: var(--accent); font-weight: 600; font-size: 14px; letter-spacing: .02em; }
h2.section-title { font-size: clamp(28px, 4vw, 36px); letter-spacing: -.02em; line-height: 1.15; margin: 8px 0 12px; }
p.section-lead { color: var(--muted); max-width: 680px; margin: 0 0 36px; font-size: 17px; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
.card h3 { margin: 0 0 6px; font-size: 17px; }
.card p { margin: 0; color: var(--muted); font-size: 15px; }
.icon { width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--accent-soft); color: var(--accent);
  display: grid; place-items: center; margin-bottom: 16px; }
.icon svg { width: 18px; height: 18px; }
.gallery { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.gallery figure { margin: 0; }
.gallery img { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); }
.gallery figcaption { color: var(--muted); font-size: 14px; margin-top: 10px; }
.gallery figcaption b { color: var(--text); }
.palette { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
.swatch { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--card); }
.swatch .chip { height: 64px; }
.swatch .meta { padding: 10px 12px; font-size: 13px; }
.swatch .meta code { background: none; border: 0; padding: 0; font-size: 12px; color: var(--text); }
.swatch .meta span { display: block; color: var(--muted); font-size: 12px; }
.palette .chip-dark { display: none !important; }
@media (prefers-color-scheme: dark) { .palette .chip-light { display: none !important; } .palette .chip-dark { display: block !important; } }
.split { display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); align-items: start; }
.steps { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
.steps li { display: flex; gap: 14px; }
.steps .n { flex: none; width: 28px; height: 28px; border-radius: 999px; border: 1px solid var(--border); background: var(--card);
  display: grid; place-items: center; font-size: 13px; font-weight: 600; }
.steps p { margin: 2px 0 0; color: var(--muted); font-size: 15px; }
.faq details { border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); padding: 0 20px; }
.faq details + details { margin-top: 10px; }
.faq summary { cursor: pointer; font-weight: 600; padding: 16px 0; list-style: none; display: flex; justify-content: space-between; gap: 16px; }
.faq summary::-webkit-details-marker { display: none; }
.faq summary::after { content: "+"; color: var(--muted); font-weight: 400; }
.faq details[open] summary::after { content: "–"; }
.faq .answer { color: var(--muted); padding-bottom: 16px; }
.faq .answer p { margin: 0; }
.cta { text-align: center; }

/* docs */
.docs { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 48px; padding: 40px 24px 80px; max-width: 1120px; margin: 0 auto; }
.toc { position: sticky; top: 84px; align-self: start; max-height: calc(100vh - 100px); overflow: auto; font-size: 14px; }
.toc p { font-weight: 600; margin: 0 0 8px; }
.toc a { display: block; color: var(--muted); text-decoration: none; padding: 3px 0; }
.toc a:hover { color: var(--text); }
.toc a.l3 { padding-left: 14px; font-size: 13px; }
.prose { min-width: 0; }
.prose h1 { font-size: 36px; letter-spacing: -.02em; line-height: 1.15; margin: 0 0 16px; }
.prose h2 { font-size: 24px; letter-spacing: -.01em; margin: 48px 0 12px; padding-top: 8px; }
.prose h3 { font-size: 18px; margin: 32px 0 8px; }
.prose h2, .prose h3 { position: relative; }
.prose .anchor { position: absolute; left: -1.1em; color: var(--muted); text-decoration: none; opacity: 0; }
.prose h2:hover .anchor, .prose h3:hover .anchor { opacity: 1; }
.prose hr { border: 0; border-top: 1px solid var(--border); margin: 40px 0; }
.prose blockquote { margin: 16px 0; padding: 12px 16px; border-left: 3px solid var(--accent); background: var(--card); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; color: var(--muted); }
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); background: var(--card); margin: 16px 0; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th { text-align: left; font-weight: 600; color: var(--muted); }
th, td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
.site-footer { border-top: 1px solid var(--border); color: var(--muted); font-size: 14px; }
.site-footer .wrap { display: flex; gap: 16px; justify-content: space-between; flex-wrap: wrap; padding-top: 28px; padding-bottom: 28px; }
.site-footer a { color: var(--muted); }
@media (max-width: 860px) {
  .docs { grid-template-columns: 1fr; gap: 24px; }
  .toc { position: static; max-height: none; border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; background: var(--card); }
  .nav a.hide-sm { display: none; }
  .hero { padding-top: 48px; }
}
`

// Pages serves files with a 10-minute cache; a content hash makes a changed stylesheet load at once.
const CSS_VERSION = crypto.createHash("sha256").update(css).digest("hex").slice(0, 8)

// ------------------------------------------------------------------ layout

const ICON = {
  github:
    '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>',
}
const SVG = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

function page({ title, description, current, body }) {
  const nav = [
    ["index.html", "Overview", ""],
    ["reference.html", "Reference", ""],
    ["agents.html", "Agents", "hide-sm"],
    ["changelog.html", "Changelog", "hide-sm"],
  ]
    .map(
      ([href, label, cls]) =>
        `<a href="${href}"${cls ? ` class="${cls}"` : ""}${current === href ? ' aria-current="page"' : ""}>${label}</a>`,
    )
    .join("")
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="img/sales-performance.png">
<meta name="theme-color" content="${light.surfaces.canvas}" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="${dark.surfaces.canvas}" media="(prefers-color-scheme: dark)">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${light.dataColors.primary}'/><path d='M10 9v13h13' stroke='white' stroke-width='4' fill='none'/></svg>`)}">
<link rel="stylesheet" href="site.css?v=${CSS_VERSION}">
</head>
<body>
<header class="site-header"><div class="wrap">
<a class="brand" href="index.html"><span class="brand-mark"></span>Sightline</a>
<nav class="nav">${nav}<a href="${REPO}" aria-label="GitHub repository">${ICON.github.replace("<svg", '<svg width="18" height="18"')}</a></nav>
</div></header>
${body}
<footer class="site-footer"><div class="wrap">
<span>Sightline ${pkg.version} · <a href="${REPO}/blob/main/LICENSE">MIT licence</a> · by <a href="https://github.com/itschrishaas">itschrishaas</a></span>
<span><a href="${REPO}">Source on GitHub</a> · <a href="${REPO}/issues">Issues</a></span>
</div></footer>
</body>
</html>
`
}

// ------------------------------------------------------------------ landing page

function faqFromReadme() {
  const readme = read("README.md")
  const start = readme.indexOf("## Why not")
  const end = readme.indexOf("\n## ", start + 5)
  const block = readme.slice(start, end).split("\n").slice(1).join("\n").trim()
  return block
    .split(/\n\s*\n/)
    .map((para) => {
      const m = /^\*\*(.+?)\*\*\s*\n?([\s\S]*)$/.exec(para.trim())
      if (!m) return ""
      const q = `Why not ${m[1].replace(/^…\s*/, "")}`
      const a = renderMarkdown(m[2].trim(), "").html
      return `<details><summary><span>${marked.parseInline(q)}</span></summary><div class="answer">${a}</div></details>`
    })
    .join("\n")
}

function swatches() {
  return light.chartPalette
    .map((hex, i) => {
      const d = dark.chartPalette[i]
      const cl = contrast(hex, light.surfaces.canvas).toFixed(2)
      const cd = contrast(d, dark.surfaces.canvas).toFixed(2)
      return `<div class="swatch">
<div class="chip chip-light" style="background:${hex}"></div><div class="chip chip-dark" style="background:${d}"></div>
<div class="meta"><code class="chip-light">${hex}</code><code class="chip-dark">${d}</code>
<span class="chip-light">Slot ${i + 1} · ${cl}:1</span><span class="chip-dark">Slot ${i + 1} · ${cd}:1</span></div></div>`
    })
    .join("\n")
}

function landing() {
  const features = [
    [
      "Every visual type styled",
      "45 visual types, the filter pane and the page, from one token file. Axes, legends and fonts are shared through the theme's wildcards.",
      '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    ],
    [
      "Accessible by construction",
      "Series colours clear WCAG 3:1 on the canvas, text clears 4.5:1. A build that misses either never reaches dist/.",
      '<path d="M20 6 9 17l-5-5"/>',
    ],
    [
      "Light and dark, one source",
      "The dark variant overrides tokens, not templates, so a fix lands in both. Slot N names the same hue in both.",
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    ],
    [
      "Presets with one vocabulary",
      "Minimal, Labelled, Dense, Presentation and Comparison mean the same on every chart. Lines add Markers, Smooth, Step and Sparkline.",
      '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    ],
    [
      "Tables that read like a web app",
      "Muted headers, row hairlines, a footer band for totals, and theme versions of every built-in table style, plus Bordered.",
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 10v10"/>',
    ],
    [
      "Built like software",
      "Plain JSON templates with a strict resolver, a schema gate, a design linter, CI, and a preview report to check every change.",
      '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
    ],
  ]
  const presets = [
    "Minimal",
    "Labelled",
    "Dense",
    "Presentation",
    "Comparison",
    "Markers",
    "Smooth",
    "Step",
    "Sparkline",
  ]
  const body = `
<main>
<div class="wrap hero">
<span class="pill"><b>v${pkg.version}</b> Power BI report theme · light and dark · MIT</span>
<h1>A Power BI theme that passes a design review.</h1>
<p class="lead">Sightline styles every Power BI visual from design tokens, in a calm, web-app look after shadcn/ui. Every build is checked for WCAG contrast before it ships.</p>
<div class="actions">
<a class="btn btn-primary" href="${RELEASE}/theme.json">${ICON.download}Download light</a>
<a class="btn" href="${RELEASE}/theme.dark.json">${ICON.download}Download dark</a>
<a class="btn" href="${REPO}">${ICON.github}GitHub</a>
</div>
<div class="shot"><picture>
<source srcset="img/sales-performance-dark.png" media="(prefers-color-scheme: dark)">
<img src="img/sales-performance.png" ${size("sales-performance.png")} alt="A sales dashboard styled with Sightline: KPI cards, a column chart against target, a bar chart, a table and a waterfall chart">
</picture></div>
</div>

<section><div class="wrap">
<div class="eyebrow">What you get</div>
<h2 class="section-title">Power BI defaults, replaced with a design system.</h2>
<p class="section-lead">Import one file and every visual follows the same rules: one brand colour, quiet neutrals, hairline borders and type that sets the hierarchy.</p>
<div class="grid">
${features.map(([t, d, i]) => `<div class="card"><div class="icon">${SVG(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join("\n")}
</div>
</div></section>

<section><div class="wrap">
<div class="eyebrow">Palette</div>
<h2 class="section-title">Eight series colours, checked on every build.</h2>
<p class="section-lead">Read from the theme tokens when this page was built. The contrast is measured against the page canvas, the harsher of the two surfaces. The swatches follow your system setting: switch between light and dark mode to see the other palette.</p>
<div class="palette">
${swatches()}
</div>
</div></section>

<section><div class="wrap">
<div class="eyebrow">In the preview report</div>
<h2 class="section-title">Every visual type, on fictional data.</h2>
<p class="section-lead">The repository includes a Power BI project with a page per visual family. Presets: ${presets.map((p) => `<code>${p}</code>`).join(", ")}.</p>
<div class="gallery">
<figure><img src="img/charts.png" ${size("charts.png")} loading="lazy" alt="Line and area charts with their style presets"><figcaption><b>Charts.</b> Line, area and ribbon charts, one preset per chart.</figcaption></figure>
<figure><img src="img/tables.png" ${size("tables.png")} loading="lazy" alt="A table and three matrices"><figcaption><b>Tables.</b> A table on Bordered, and the matrix presets.</figcaption></figure>
<figure><img src="img/slicers.png" ${size("slicers.png")} loading="lazy" alt="A dashboard with tabs slicers"><figcaption><b>Slicers.</b> Tile slicers drawn as segmented tabs.</figcaption></figure>
</div>
</div></section>

<section><div class="wrap split">
<div>
<div class="eyebrow">Use it</div>
<h2 class="section-title">Two minutes, no build.</h2>
<ol class="steps">
<li><span class="n">1</span><div><b>Download</b><p><a href="${RELEASE}/theme.json">theme.json</a> for light, <a href="${RELEASE}/theme.dark.json">theme.dark.json</a> for dark.</p></div></li>
<li><span class="n">2</span><div><b>Import</b><p>In Power BI Desktop: View → Themes → Browse for themes.</p></div></li>
<li><span class="n">3</span><div><b>Pick presets</b><p>Choose a style per visual in the format pane, for example Minimal next to a hero chart.</p></div></li>
</ol>
</div>
<div>
<div class="eyebrow">Make it yours</div>
<h2 class="section-title">Change the tokens, keep the guarantees.</h2>
<pre><code>npm install
npm run build</code></pre>
<p class="section-lead" style="margin-top:16px">Put your brand colours into <code>src/variables.json</code> and their dark values into <code>src/themes/dark.json</code>. The build fails with the token, the measured value and the threshold if a colour is not readable. <a href="reference.html">Read the reference</a>.</p>
</div>
</div></section>

<section><div class="wrap">
<div class="eyebrow">FAQ</div>
<h2 class="section-title">Why not just …?</h2>
<p class="section-lead">The questions this approach usually gets, answered.</p>
<div class="faq">
${faqFromReadme()}
</div>
</div></section>

<section class="cta"><div class="wrap">
<h2 class="section-title">Ship reports that look designed.</h2>
<p class="section-lead" style="margin:0 auto 28px">Free and open source under the MIT licence.</p>
<div class="actions">
<a class="btn btn-primary" href="${RELEASE}/theme.json">${ICON.download}Download light</a>
<a class="btn" href="${RELEASE}/theme.dark.json">${ICON.download}Download dark</a>
<a class="btn" href="${REPO}">${ICON.github}Star on GitHub</a>
</div>
</div></section>
</main>`
  return page({
    title: "Sightline · Accessible Power BI theme, light and dark",
    description: pkg.description,
    current: "index.html",
    body,
  })
}

function docPage(file, out, title, description) {
  const { html, toc } = renderMarkdown(read(file), path.posix.dirname(file))
  const tocHtml = toc.map((t) => `<a class="l${t.level}" href="#${t.id}">${esc(t.text)}</a>`).join("")
  const body = `<div class="docs"><aside class="toc"><p>On this page</p>${tocHtml}</aside><main class="prose">${html}</main></div>`
  fs.writeFileSync(
    path.join(OUT, out),
    page({ title: `${title} · Sightline`, description, current: out, body }),
  )
}

// ------------------------------------------------------------------ build

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(path.join(OUT, "img"), { recursive: true })
for (const f of fs.readdirSync(path.join(ROOT, "docs/img"))) {
  fs.copyFileSync(path.join(ROOT, "docs/img", f), path.join(OUT, "img", f))
}
fs.writeFileSync(path.join(OUT, "site.css"), css.trim() + "\n")
fs.writeFileSync(path.join(OUT, "index.html"), landing())
docPage(
  "docs/reference.md",
  "reference.html",
  "Reference",
  "Tokens, gates, template syntax, wildcards and presets of the Sightline Power BI theme.",
)
docPage("CHANGELOG.md", "changelog.html", "Changelog", "Release history of the Sightline Power BI theme.")
docPage(
  "CLAUDE.md",
  "agents.html",
  "Working with agents",
  "How to edit the Sightline theme with Claude or another coding agent.",
)
fs.writeFileSync(path.join(OUT, ".nojekyll"), "")
console.log(`✔ site built: ${fs.readdirSync(OUT).join(", ")}`)
