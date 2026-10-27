---
name: ui-translation
description: Translate Privacy Thing interface copy. Use when a change adds or edits English UI strings that every locale must follow (the everyday case), or when adding a new interface language end to end. Do not use for store listings or manifest descriptions, which are store-owned metadata.
---

# Privacy Thing UI Translation

English in `src/ui/i18n/en-sections/` is the source. Every other locale must have the
same keys and message arguments, so a string change is not done until all locales are.
Shared checks run for every locale in
[`locale-copy.test.ts`](../../../src/ui/i18n/locale-copy.test.ts) through
[`testing/catalog-checks.ts`](../../../src/ui/i18n/testing/catalog-checks.ts); script
rules live in per-script tests such as
[`chinese-copy.test.ts`](../../../src/ui/i18n/chinese-copy.test.ts).

Where copy lives:

- main catalog: `src/ui/i18n/<locale>-sections/*.ts`, assembled in `<locale>.ts` with
  `satisfies LocaleCatalog`;
- plugin and shared copy keyed by locale: `src/experimental/control-d/ui-copy-<locale>.ts`,
  `cleanup-copy-<locale>.ts`, `ui-feature-copy.ts`, `ui-rule-feature-copy.ts`,
  `ui-rule-feature-explanation-copy.ts`, `src/ui/shared/rule-group-copy.ts`,
  `src/ui/components/provider-feature/provider-feature-copy.ts`;
- release notices: `src/shared/extension-notifications.json` (`{{brand}}` token);
- per-locale terminology: `src/ui/i18n/glossary/`, registered in `glossary/index.ts`.

## Rules for every string

- Product names come from `@/shared/brand` (`BRAND_DISPLAY_NAME`, `BRAND_DIAGNOSTICS_NAME`);
  never type the brand into a catalog.
- Apply the AGENTS.md vocabulary in every language: Domain (hostname), Pattern (matching
  expression), and Site only inside the Trusted Sites feature name. Use the glossary term
  when the locale has one.
- Plurals: `en`, `es`, `pt` use `count === 1 ? … : …`; `ru`, `uk` use
  `slavicCount` / `slavicPluralForm` (`src/ui/shared/slavic-plural.ts`); Chinese has no
  plural form. Keep the same parameters as English and show every number English shows.
- Keep `${…}` interpolations, `{value}`-style and `{{brand}}` placeholders, URLs, JavaScript
  method names (`sidebar.accessed.methods`) and brand link labels unchanged.
- Never hard-code a space, full stop or list comma between translated fragments in a
  component: use `t.common.typography` (`fragmentSpace`, `fullStop`, `listSeparator`).
  When a component splits a sentence around a link, add the joined sentence to
  `assembledSentences` in `catalog-checks.ts`.
- Safety-critical copy is translated literally and conservatively, with standard browser
  wording and no marketing: privacy guarantees and what spoofing does or does not protect,
  destructive actions (delete vs remove, reset, replace on import, disconnect), consent
  prompts (map access), data disclosure (Control D), legal and privacy-policy text, and
  error messages with instructions. Never make a promise stronger than the English.

## Mode B: English strings were added or changed

1. Edit English first. Then edit the same key in every locale catalog and every
   locale-keyed plugin file; `pnpm task check` fails until shapes match.
2. Translate from English, not from another translation. Check the locale glossary and
   the neighbouring strings for the terms already in use.
3. A new message parameter name must be added to `PARAMETER_KINDS` in
   `catalog-checks.ts`; use `latin` for values that are always Latin (hostnames,
   patterns, times, locale codes) so CJK locales are checked for the space next to them.
4. Run:

   ```sh
   pnpm exec vitest run --config config/vitest.config.app.neutral.ts \
     src/ui/i18n src/experimental/control-d src/shared/release-notification.test.ts
   ```

   Fix the copy, not the check. Extend an allowlist or exemption only with a reason
   written next to it.
5. In a locale marked unreviewed (`src/ui/i18n/translation-review.ts`), back-translate
   changed safety-critical strings in a separate context (see Mode A, step 8) and fix
   any drift.
6. If the change is visible, follow the AGENTS.md screenshot rules; long strings at
   360 px are covered by the `withUiLocale` stories (Mode A, step 9).
7. Translations of a feature's strings belong to that feature's CHANGELOG entry; do not
   add a separate one.

## Mode A: adding an interface language

1. **Choose the code.** Use the region code when vocabulary differs by region (`zh-CN`,
   `zh-TW`), otherwise the language code. Files are `<code>.ts` / `<code>-sections/`;
   the export drops the hyphen (`zhTW`).
2. **Wire the locale:** add it to `UI_LOCALES` and `UI_LOCALE_PREFERENCES`
   (`src/shared/ui-locale.ts`); extend `resolveUiLocale` in `src/ui/i18n/index.ts` for
   script and region subtags (`zh-Hant`, `zh-HK` → Traditional); add the catalog to
   `catalogs`. `auto` follows `navigator.language`, and `<html lang>` follows the active
   locale. Add `advanced.display.language.option<Name>` to every locale and a
   `SelectItem` in `options-preference-sections.tsx`.
3. **Scaffold catalogs:** copy `en-sections/` and `en.ts`, every locale-keyed plugin file
   and a key in each release notice; add the locale to `MAIN_CATALOGS`,
   `CONTROL_D_CATALOGS` and `CLEANUP_CATALOGS` in `catalog-checks.ts` and a profile
   (script, width budget) in `LOCALE_PROFILES` in `locale-copy.test.ts`. Set the
   locale's `common.typography`.
4. **Write the glossary first** (`glossary/<code>-glossary.ts`, shape `LocaleGlossary`):
   every core product term with rationale, required pattern, forbidden words and
   other-region vocabulary. Verify each term against downloaded localization files, not
   memory: Firefox (`github.com/mozilla-l10n/firefox-l10n`), Chromium
   (`chrome/app/resources/*.xtb`, `components/strings/*.xtb`), uBlock Origin and
   Privacy Badger `_locales`, MDN (`github.com/mdn/translated-content`). Cite them in
   the file. [`zh-glossary.ts`](../../../src/ui/i18n/glossary/zh-glossary.ts) is the
   model.
   Record the form of address (formal or plain; Chinese: `zh-conventions.ts`, zh-CN 您 and
   zh-TW 你) and how feature names such as Trusted Sites are quoted, and enforce both in the
   locale's tests.
5. **Script rules:** for a script with its own conventions, add a per-script test
   (character sets, punctuation, spacing, assembled sentences); generate character data
   with a pinned generator, as in `pnpm task generate:zh-script-charsets`. For a
   non-Latin script, add `:lang(<code>)` font stacks in `src/ui/styles/globals.css` that
   name the shipped fonts for macOS, Windows and Linux.
6. **Translate** in separate contexts per region or script, each briefed with the
   glossary, these rules and the test commands. Translators fix their own test failures
   and report uncertain strings.
7. **Mark it unreviewed:** add a one-sentence notice in the new language to
   `unreviewedLocaleNotices`. Remove it only after a native speaker has reviewed the
   catalog, and name that review in the pull request.
8. **Back-translate independently:** extract the rendered strings with numbered ids only
   (no English, no key names); a different model with no repository access translates
   them back; a third context compares with English, classifies findings
   (critical, major, minor, false alarm) and fixes real ones. Commit a short summary in
   `docs/i18n/<language>-review.md`; put the full findings table in the PR description.
9. **Check layout:** add Storybook stories with `withUiLocale(<code>)` and
   `expectNoClippedText` (`src/ui/shared/story-locale.tsx`) for the compact popup
   (360 px), the expanded popup (720 px) and the sidebar (360 px); capture dark-theme
   screenshots at the AGENTS.md widths.
10. **Leave generated and store-owned data alone:** `config/manifest-locales.json`,
    `config/store-listings/` (including `amo/stable-metadata.json`, regenerated by
    `pnpm task generate:amo-metadata`), and `src/shared/locale-catalog.generated.ts`. List what
    they still lack in the PR.
11. **Document:** a CHANGELOG `Added` entry that states the review status, the language
    list in `docs/project-structure.md`, and the translations section of
    `CONTRIBUTING.md`.

## Final checklist

- [ ] Every locale has the key, with the same arguments; neutral i18n tests pass.
- [ ] Glossary terms used; no other-region vocabulary; no leftover English.
- [ ] Fragments joined through `common.typography`; assembled sentences read correctly.
- [ ] Safety-critical strings literal; back-translated where the locale is unreviewed.
- [ ] Unreviewed notice present until a native review; residual risks listed in the PR.
- [ ] Width stories pass; screenshots follow AGENTS.md.
- [ ] Generated and store data untouched; CHANGELOG and docs updated.
