import fs from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";
import { URL } from "node:url";

const require = createRequire(import.meta.url);
const localeCodes = require("locale-codes");

const FIREFOX_SOURCE_URL =
  "https://raw.githubusercontent.com/mozilla-firefox/firefox/main/intl/locale/language.properties";
const CHROMIUM_SOURCE_URL =
  "https://raw.githubusercontent.com/chromium/chromium/main/ui/base/l10n/l10n_util.cc";

// Pinned from Firefox's webpage-language catalog in intl/locale/language.properties.
const FX_ACCEPT_LANG_CODES = `
aa
ab
ach
ae
af
ak
am
an
ar
ar-ae
ar-bh
ar-dz
ar-eg
ar-iq
ar-jo
ar-kw
ar-lb
ar-ly
ar-ma
ar-om
ar-qa
ar-sa
ar-sy
ar-tn
ar-ye
as
ast
av
ay
az
ba
be
bg
bh
bi
bm
bn
bo
br
bs
ca
ca-valencia
cak
ce
ch
co
cr
crh
cs
csb
cu
cv
cy
da
de
de-at
de-ch
de-de
de-li
de-lu
dsb
dv
dz
ee
el
en
en-au
en-bz
en-ca
en-gb
en-ie
en-jm
en-nz
en-ph
en-tt
en-us
en-za
en-zw
eo
es
es-ar
es-bo
es-cl
es-co
es-cr
es-do
es-ec
es-es
es-gt
es-hn
es-mx
es-ni
es-pa
es-pe
es-pr
es-py
es-sv
es-uy
es-ve
et
eu
fa
fa-ir
ff
fi
fj
fo
fr
fr-be
fr-ca
fr-ch
fr-fr
fr-lu
fr-mc
fur
fy
ga
gd
gl
gn
gu
gv
ha
haw
he
hi
hil
ho
hr
hsb
ht
hu
hy
hz
ia
id
ie
ig
ii
ik
io
is
it
it-ch
iu
ja
jv
ka
kab
kg
ki
kk
kl
km
kn
ko
ko-kp
ko-kr
kok
kr
ks
ku
kv
kw
ky
la
lb
lg
li
lij
ln
lo
lt
ltg
lu
lv
mai
meh
mg
mh
mi
mix
mk
mk-mk
ml
mn
mr
ms
mt
my
na
nb
nd
ne
ng
nl
nl-be
nn
no
nr
nso
nv
ny
oc
oj
om
or
os
pa
pa-in
pa-pk
pi
pl
ps
pt
pt-br
pt-pt
qu
rm
rn
ro
ro-md
ro-ro
ru
ru-md
rw
sa
sat
sc
sco
sd
sg
si
sk
skr
sl
sm
so
son
son-ml
sq
sr
ss
st
su
sv
sv-fi
sv-se
sw
szl
ta
te
tg
th
ti
tig
tk
tl
tlh
tn
to
tr
trs
ts
tt
tw
ty
ug
uk
ur
uz
ve
vi
vo
wa
wo
xh
yi
yo
za
zam
zh
zh-cn
zh-hk
zh-sg
zh-tw
zu
`
  .trim()
  .split(/\s+/);

// Pinned from Chromium's kAcceptLanguageList in ui/base/l10n/l10n_util.cc.
const CHROME_ACCEPT_LANG_CODES = `
af
ak
am
an
ar
ar-XB
as
ast
ay
az
be
bg
bho
bm
bn
br
bs
ca
ceb
chr
ckb
co
cs
cy
da
de
de-AT
de-CH
de-DE
de-LI
doi
dv
ee
el
en
en-AU
en-CA
en-GB
en-GB-oxendict
en-IE
en-IN
en-NZ
en-US
en-XA
en-ZA
eo
es
es-419
es-AR
es-CL
es-CO
es-CR
es-ES
es-HN
es-MX
es-PE
es-US
es-UY
es-VE
et
eu
fa
fi
fil
fo
fr
fr-CA
fr-CH
fr-FR
fy
ga
gd
gl
gn
gu
ha
haw
he
hi
hmn
hr
ht
hu
hy
ia
id
ig
ilo
is
it
it-CH
it-IT
ja
jv
ka
kk
km
kn
ko
kok
kri
ku
ky
la
lb
lg
ln
lo
lt
lus
lv
mai
mg
mi
mk
ml
mn
mni-Mtei
mo
mr
ms
mt
my
nb
ne
nl
nn
no
nso
ny
oc
om
or
pa
pl
ps
pt
pt-BR
pt-PT
qu
rm
ro
ru
rw
sa
sd
sh
si
sk
sl
sm
sn
so
sq
sr
st
su
sv
sw
ta
te
tg
th
ti
tk
tn
to
tr
ts
tt
tw
ug
uk
ur
uz
vi
wa
wo
xh
yi
yo
zh
zh-CN
zh-HK
zh-TW
zu
`
  .trim()
  .split(/\s+/);

const EXCLUDED_CHROMIUM_CODES = new Set(["ar-XB", "en-XA"]);

const LABEL_ALIAS_TAGS = {
  "ca-valencia": ["ca-ES-valencia"],
  tl: ["fil"],
};

const VARIANT_LABELS = {
  oxendict: "Oxford English Dictionary spelling",
  valencia: "Valencian",
};

const localeCodeEntriesByTag = new Map(
  localeCodes.all.map((entry) => [String(entry.tag).toLowerCase(), entry]),
);

const languageDisplayNames = new Intl.DisplayNames(["en"], { type: "language" });
const regionDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
const scriptDisplayNames = new Intl.DisplayNames(["en"], { type: "script" });

const toTitleCase = (value) =>
  value.length === 0
    ? value
    : `${value[0].toUpperCase()}${value.slice(1).toLowerCase()}`;

const normalizeLocaleCode = (raw) =>
  raw
    .trim()
    .replace(/_/g, "-")
    .split("-")
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      if (/^\d{3}$/.test(part) || /^[a-z]{2}$/i.test(part)) {
        return part.toUpperCase();
      }
      if (/^[a-z]{4}$/i.test(part)) {
        return toTitleCase(part);
      }
      return part.toLowerCase();
    })
    .join("-");

const getBaseLanguage = (tag) => tag.split("-")[0] ?? tag;

const getLocaleCodesName = (tag) => {
  const directHit = localeCodeEntriesByTag.get(tag.toLowerCase());
  if (directHit) {
    return directHit.name;
  }

  for (const alias of LABEL_ALIAS_TAGS[tag] ?? []) {
    const aliasHit = localeCodeEntriesByTag.get(alias.toLowerCase());
    if (aliasHit) {
      return aliasHit.name;
    }
  }

  return null;
};

const getQualifierLabel = (subtag) => {
  const lowerSubtag = subtag.toLowerCase();
  if (VARIANT_LABELS[lowerSubtag]) {
    return VARIANT_LABELS[lowerSubtag];
  }
  if (/^[a-z]{4}$/i.test(subtag)) {
    return scriptDisplayNames.of(toTitleCase(subtag)) ?? toTitleCase(subtag);
  }
  if (/^\d{3}$/.test(subtag) || /^[a-z]{2}$/i.test(subtag)) {
    return regionDisplayNames.of(subtag.toUpperCase()) ?? subtag.toUpperCase();
  }
  return toTitleCase(subtag.replace(/_/g, " "));
};

const buildStructuredName = (tag, baseName) => {
  const subtags = tag.split("-").slice(1);
  if (subtags.length === 0) {
    return baseName;
  }

  const qualifiers = subtags.map(getQualifierLabel).filter(Boolean);
  return qualifiers.length > 0 ? `${baseName} (${qualifiers.join(", ")})` : baseName;
};

const buildLabel = (tag) => {
  const baseLanguage = getBaseLanguage(tag);
  const baseName =
    getLocaleCodesName(baseLanguage) ??
    languageDisplayNames.of(baseLanguage) ??
    baseLanguage;
  const exactName = getLocaleCodesName(tag);
  const resolvedName =
    exactName && (tag.split("-").length === 1 || exactName !== baseName)
      ? exactName
      : buildStructuredName(tag, baseName);

  return `${resolvedName} [${tag}]`;
};

const addLocaleEntry = (entriesByTag, target, rawCode) => {
  if (target === "chromium" && EXCLUDED_CHROMIUM_CODES.has(rawCode)) {
    return;
  }

  const tag = normalizeLocaleCode(rawCode);
  const existing = entriesByTag.get(tag);

  if (existing) {
    if (!existing.targets.includes(target)) {
      existing.targets.push(target);
    }
    return;
  }

  entriesByTag.set(tag, {
    value: tag,
    label: buildLabel(tag),
    targets: [target],
  });
};

const entriesByTag = new Map();
for (const code of FX_ACCEPT_LANG_CODES) {
  addLocaleEntry(entriesByTag, "firefox", code);
}
for (const code of CHROME_ACCEPT_LANG_CODES) {
  addLocaleEntry(entriesByTag, "chromium", code);
}

const localeCatalog = [...entriesByTag.values()].sort((left, right) => {
  const labelComparison = left.label.localeCompare(right.label, "en");
  return labelComparison !== 0
    ? labelComparison
    : left.value.localeCompare(right.value, "en");
});

const localeOptionsByTarget = {
  chromium: localeCatalog
    .filter((entry) => entry.targets.includes("chromium"))
    .map(({ value, label }) => ({ value, label })),
  firefox: localeCatalog
    .filter((entry) => entry.targets.includes("firefox"))
    .map(({ value, label }) => ({ value, label })),
};

const output = `// Generated by scripts/build-locales.mjs. Do not edit by hand.
// Source catalogs:
// - Firefox: ${FIREFOX_SOURCE_URL}
// - Chromium: ${CHROMIUM_SOURCE_URL}

export type BrowserLocaleTarget = "chromium" | "firefox";

export type BrowserLocaleOption = {
  readonly value: string;
  readonly label: string;
};

export type BrowserLocaleCatalogEntry = BrowserLocaleOption & {
  readonly targets: readonly BrowserLocaleTarget[];
};

export const localeCatalog = ${JSON.stringify(localeCatalog, null, 2)} as const satisfies readonly BrowserLocaleCatalogEntry[];

export const localeOptionsByTarget = ${JSON.stringify(localeOptionsByTarget, null, 2)} as const satisfies Record<BrowserLocaleTarget, readonly BrowserLocaleOption[]>;
`;

fs.writeFileSync(
  new URL("../src/shared/locale-catalog.generated.ts", import.meta.url),
  output,
);

process.stdout.write(
  `Generated ${localeCatalog.length} locale entries (${localeOptionsByTarget.chromium.length} Chromium / ${localeOptionsByTarget.firefox.length} Firefox)\n`,
);
