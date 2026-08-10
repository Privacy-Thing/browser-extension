# Store listing copy (versioned publication sources)

The canonical editorial content lives in Notion, with
[the Polish listing document](https://app.notion.com/p/39d19f2ad838819b81d3c1dd9fd877c8)
as the semantic source of truth. This directory contains the versioned,
publication-ready copy synchronized from those documents. Update Notion first,
then sync the human-friendly files here. Never hand-edit the generated
`amo/stable-metadata.json`.

```
config/store-listings/
  ../manifest-locales.json         short descriptions → manifest (_locales); firefox value reused as AMO summary
  meta.json                        structured AMO fields (categories, compatibility) + per-locale title
  firefox/description.<locale>.md  long AMO listing body (with Firefox Containers section)
  chrome/titles.json               localized CWS titles for manual dashboard updates
  chrome/description.<locale>.md   long CWS listing body for every manifest locale (no Containers)
  amo/stable-metadata.json         GENERATED — do not edit by hand
```

AMO descriptions are shipped for every configured manifest locale supported by
production AMO: `de`, `en-US`, `es-ES`, `fr`, `it`, `ja`, `ko`, `pl`, `pt-BR`,
`ru`, `uk`, and `zh-CN`. The corresponding manifest codes are mapped in
`meta.json` (for example `en`, `pt_BR`, and `zh_CN`).

The extension also ships an Arabic (`ar`) manifest locale. Production AMO does
not currently accept Arabic listing translations, so `meta.json` records it in
`unsupportedManifestLocales`. The translated `description.ar.md` is kept ready
for publication when AMO adds support. The generator requires every manifest
locale to be either mapped or explicitly excluded, never silently omitted.

## Where each piece goes

| Field | Source | Destination | How |
|---|---|---|---|
| Chromium listing title | `chrome/titles.json` | manifest `name` + CWS/Edge title | auto (`_locales` + build) |
| AMO listing title | `meta.json` `title` | AMO `name` | **auto** via generator → `amo/stable-metadata.json` |
| Short description / summary | `manifest-locales.json` | manifest `description` + AMO summary | auto (`_locales` + generator) |
| AMO long description | `firefox/description.*.md` | AMO listing | **auto** via generator → `amo/stable-metadata.json` |
| Chrome long description | `chrome/description.*.md` | Chrome Web Store listing | **manual** — copy-paste into the CWS dashboard (the CWS API cannot set listing copy) |

## AMO (Firefox) — automated

`amo/stable-metadata.json` is **generated** from `meta.json`, the
`firefox/description.<locale>.md` bodies, and the firefox short description in
`manifest-locales.json`. The stable publish pushes it via web-ext `--amo-metadata`,
so it is the source of truth for the AMO name, summary, and description (manual
AMO dashboard edits get overwritten on publish). `LICENSE.md` is the source of
truth for the generated AMO license.

AMO supports only a limited Markdown subset. Use bold paragraphs such as
`**Section title**` instead of `#` headings, because AMO removes heading
elements and their text during sanitization. Bold, italic, links, blockquotes,
code, and ordered or unordered lists are supported. Keep every list item in one
Markdown paragraph: AMO closes the list before an indented continuation
paragraph, which makes ordered-list counters restart. The metadata generator
rejects unsupported headings, thematic breaks, images, tables, raw HTML, and
indented continuation blocks.
The complete AGPL grant and its section 7 terms are converted from `LICENSE.md`
to clean plain text. AMO's predefined AGPL choice is 3.0-only, so the generated
metadata uses `custom_license` to preserve the project's or-later option and
additional terms without narrowing them.

```bash
pnpm task generate:amo-metadata   # rebuild amo/stable-metadata.json
pnpm task check:amo-metadata      # CI guard: fails on drift (wired into verify lanes)
```

## Chromium stores

The package supplies each localized title and short description through
`manifest.name` and `manifest.description`. The build emits `extName` from
`chrome/titles.json` for Chromium release builds, preserving the same localized
slogan with the beta channel name for beta builds. CWS and Edge read these
fields from the uploaded package.

Long descriptions remain dashboard-managed. Paste the matching
`chrome/description.<locale>.md` into each store dashboard per language.

`pnpm task check:cws-listings` verifies that titles and full descriptions cover
every manifest locale, translated descriptions preserve the Polish listing's
section separators, titles stay within the 75-character limit, and retired
branding does not return. The check runs in the standard verification suites.
