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

## What a native reviewer should check first

1. Safety-critical copy listed in the pull request: limitations (`about.limitations`,
   `about.terms`, `rules.globalFallback.dialog.locationProfileWarning*`), worker modes,
   destructive confirmations, map consent (`osm`, `welcome.steps.privacy`), Control D data
   disclosure (`controlD.intro`) and the privacy policy pointer.
2. Coined or contested terms: 匹配模式 / 比對模式 (Pattern), 预设 / 預設集 (Preset),
   伪装 / 偽裝 (spoofing), 检查器 / 檢查器 (Inspector), 演练场 / 演練場 (Playground),
   Control D “setup” (配置 / 設定組合).
3. Register: both catalogs use 你; Chrome and Firefox zh-CN use 您.
4. Whether “受信任的网站 / 受信任的網站” needs quotes when it names the feature.
5. Strings shortened to meet the width budget, for example `common.coordinateRandomization`
   and `locations.editor.disabledDependencySuffix`.
