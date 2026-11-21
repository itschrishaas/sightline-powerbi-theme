# Changelog

All notable changes to this theme are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/): a change to how existing reports look is a
major version, a new preset or token is a minor version.

## [1.0.0]

First public release.

- Light and dark theme for Power BI report theme schema 2.159, covering 45 visual types,
  the filter pane and the page.
- Design language after shadcn/ui: zinc neutrals, petrol as the single brand colour,
  12 px cards and 8 px controls, hairline borders, solid light gridlines.
- Chart presets `Minimal`, `Labelled`, `Dense`, `Presentation`, `Comparison` on every chart,
  plus `Markers`, `Smooth`, `Step`, `Sparkline` for lines.
- Theme versions of all Power BI built-in table and matrix styles, plus `Bordered`.
- Tile slicer drawn as segmented tabs by default; `Filled` keeps separate filled tiles.
- Build with two gates: Microsoft's JSON schema and a design linter (WCAG contrast,
  palette, surfaces, type scale). A theme that fails either never reaches `dist/`.
- Every visual container takes the card surface from the theme, so the dark variant has no white
  chart panels left over from Power BI's base theme.
- Preview report (`pbi/Preview.pbip`) showing every visual type on fictional data.

[1.0.0]: https://github.com/itschrishaas/sightline-powerbi-theme/releases/tag/v1.0.0
