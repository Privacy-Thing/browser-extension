# Chinese interface translation review

Status: machine-translated, **not reviewed by a native speaker** (2026-10-27). The language
setting shows this notice in Chinese until a native review removes the locale from
[`translation-review.ts`](../../src/ui/i18n/translation-review.ts).

## How the catalogs were made

1. Terms were fixed first in [`zh-glossary.ts`](../../src/ui/i18n/glossary/zh-glossary.ts),
   verified against the Chrome, Firefox, uBlock Origin, Privacy Badger, Mullvad and MDN
   zh-CN / zh-TW localizations it cites.
2. Separate model contexts translated `zh-CN` (mainland vocabulary) and `zh-TW` (Taiwan
   vocabulary) from the English source. The two catalogs are independent translations,
   not a character conversion.
3. [`chinese-copy.test.ts`](../../src/ui/i18n/chinese-copy.test.ts) checks catalog shape
   and message arguments, interpolated values and brands, script purity (OpenCC character
   sets), glossary terms and forbidden words, leftover English, punctuation and spacing,
   assembled sentence fragments and a width budget relative to English.
4. Independent back-translation: a different model, given only the anonymised Chinese
   strings (no English, no key names, no repository access), translated all 1,666 strings
   per variant back to English. A third context compared that with the English source and
   fixed real differences.

## Back-translation results

| Variant | Strings | Critical | Major | Minor | Fixed |
| ------- | ------: | -------: | ----: | ----: | ----: |
| zh-CN   |   1,666 |        0 |     3 |    53 |    55 |
| zh-TW   |   1,666 |        0 |     3 |    25 |    25 |

Major findings, all fixed: the close button label of the rule sheet read as “turn off the
Domain Rule” for screen readers (both variants); deleted (“inactive”) Firefox containers
read as “not enabled” (both; zh-CN counted the filter label and the help text
separately); zh-TW import retention text implied that only edits after seven days block
undo. No privacy, VPN/proxy/DNS, consent or data-disclosure string was
stronger than the English. The full findings tables are in the pull request description.

## Second review (independent, different model family)

Reviewed head 6a1b3f3. No critical findings; two major findings and a set of minor ones.

| Finding                                                                                                                                                                                                                                                                                           | Result                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Major, both scripts: Privacy and Options copy called map search and previews “the only optional network requests” and said the product “stays offline”. Control D ships in every build channel (off by default; `tests/build-contracts/*-build.test.ts`) and makes its own requests once enabled. | Accurate. The English sentences were scoped to map access in all seven locales (commit `fix(i18n): scope the offline claim to map access`, an English copy change for the maintainer to confirm).         |
| Major, zh-CN: `settingsImport.retention` “之后” was ambiguous.                                                                                                                                                                                                                                    | Fixed. zh-TW already said 匯入後… and is unchanged.                                                                                                                                                       |
| Trusted Sites read as “a trusted website” in prose.                                                                                                                                                                                                                                               | The name is now quoted (“…” zh-CN, 「…」 zh-TW) in every string with sentence punctuation; headings, labels and button text stay bare. A test enforces it (`QUOTED_FEATURE_NAMES`).                       |
| zh-TW scope description (低調), radius label, `notAvailable`; zh-CN screen description, `copyLinkTo`, default-rule line, `trustedSiteWinsTitle`.                                                                                                                                                  | Adopted. `notAvailable` is only ever used for a missing value, so 無法取得 needs no second string; it exceeds the width budget by design (documented exemption for “N/A”).                                |
| `intlConstructor` and `webGLGetExtension` stayed English.                                                                                                                                                                                                                                         | Translated in every locale (they describe a call, they are not method names); the identity checks exclude exactly these two keys.                                                                         |
| Glossary overstated its evidence.                                                                                                                                                                                                                                                                 | Reworded: Inspector, Preset, Playground and the Control D “setup” are reasoned product choices with partial precedent, and the Spoofing note no longer says the alternatives imply illegality.            |
| Spacing was not checked next to interpolated values.                                                                                                                                                                                                                                              | The test now renders always-Latin arguments (hostnames, patterns, times, locale codes) as Latin and requires the usual space next to Chinese text. Arguments that may be Chinese labels remain unchecked. |

Decided afterwards by the maintainer: zh-CN addresses users with the polite 您 (Chromium and
Mozilla support zh-CN do), and zh-TW keeps the plain 你 (Chromium zh-TW does). The MozTW style
guide prefers 您 for Taiwan, so a native zh-TW reviewer may reverse that. The choice is the
single `ZH_REGISTER` setting in the glossary conventions; the switch was one replacement of 146
occurrences in the zh-CN catalogs and notices, with no 您们 or other compound affected. The
back-translations above were made before the switch; the pronoun does not change their
meaning, so the findings and counts stand.

## What a native reviewer should check first

1. Safety-critical copy listed in the pull request: limitations (`about.limitations`,
   `about.terms`, `rules.globalFallback.dialog.locationProfileWarning*`), worker modes,
   destructive confirmations, map consent (`osm`, `welcome.steps.privacy`), Control D data
   disclosure (`controlD.intro`) and the privacy policy pointer.
2. Coined or contested terms: 匹配模式 / 比對模式 (Pattern), 预设 / 預設集 (Preset),
   伪装 / 偽裝 (spoofing), 检查器 / 檢查器 (Inspector), 演练场 / 演練場 (Playground),
   Control D “setup” (配置 / 設定組合).
3. Register: zh-CN uses 您 and zh-TW 你 (maintainer decision; MozTW prefers 您 for Taiwan, so confirm zh-TW). See the glossary's `ZH_REGISTER`.
4. Whether “受信任的网站 / 受信任的網站” needs quotes when it names the feature.
5. Strings shortened to meet the width budget, for example `common.coordinateRandomization`
   and `locations.editor.disabledDependencySuffix`.
