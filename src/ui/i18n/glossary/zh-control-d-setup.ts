import type { ZhGlossaryEntry } from "./zh-glossary";

/**
 * Control D “setup” (PT-82): the bundle of one profile, one browser endpoint and rule
 * folders that the product creates, reuses or reconnects.
 *
 * The 配置 / 設定組合 split is by variant only; each catalog uses one term in every
 * Control D “setup” string. Conservative decision without native review: keep both. The
 * terms are reasoned product choices with no browser precedent, listed for native review
 * in docs/i18n/chinese-review.md.
 */
export const ZH_CONTROL_D_SETUP: ZhGlossaryEntry = {
  id: "control-d-setup",
  english: "Control D setup (noun)",
  // Only the Control D noun forms. “during setup”, “its own setup” (containers),
  // “Setup progress” and “Setup instructions” are the generic wizard sense.
  required:
    /choose setup|\b(?:this|a|new|separate|compatible|existing|other) setups?\b|^setup(?: ⟦|$)/i,
  exempt: {
    "controlDRuleFeature.suggestQuestion":
      "“Setup {value} service?” is the verb (set up a service), not the bundle.",
    "about.body2": "Generic “setup” of the product, not the Control D bundle.",
  },
  "zh-CN": { term: "配置", forbidden: ["设置组合", "設定組合"] },
  "zh-TW": { term: "設定組合", forbidden: ["配置", "设置组合"] },
  rationale:
    "zh-CN 配置 is the mainland word for a named configuration; the bundle is never written 配置文件 (profile). zh-TW has no 配置 anywhere and uses 設定組合, a plain compound that cannot be confused with 設定檔 (profile) or 設定 (settings). Weak points for a native reviewer: zh-CN “此配置” can read as the profile, and 設定組合 is coined.",
  evidence: [],
};
