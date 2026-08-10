# Code Style

> Canonical product and architecture documentation lives in Notion. This file is a
> code-adjacent reference kept in the repository for automation and contributor
> navigation; it is not the source of truth.

Repo-local, code-adjacent reference. Product and architecture documentation lives
in Notion (see `CLAUDE.md` → "Documentation Source").

This guide mostly **writes down what the codebase already does well**. At the time
it was introduced, 91.5% of functions were already ≤ 40 lines, there were zero
`@ts-ignore`/`@ts-expect-error` directives, and ~2000 imports used path aliases
against only 17 deep relative paths. The rules below protect that, and put a
ceiling on the thin tail of god-functions that does exist.

## 1. Formatting is not a review topic

Prettier owns all whitespace, line breaks, quotes and commas. Never argue about
them in review, and never hand-format around the formatter.

```bash
pnpm task format
```

`pnpm task format:check` runs in `verify` and `verify:quick`. Settings live in
`.prettierrc.json`: `printWidth: 88`, double quotes, semicolons, trailing commas
everywhere.

Scope is TypeScript and JavaScript (`src/`, `packages/*/src/`, `tests/`, `config/`,
`scripts/`). Markdown, JSON and CSS are deliberately **not** formatted: `CHANGELOG.md`
is rewritten by `scripts/promote-unreleased-changelog.mjs` and `config/store-listings/`
is diffed by `check:amo-metadata`, so reformatting them would break those generators.

Two things to know:

- **Generated files are excluded** (`.prettierignore`): `**/*.generated.ts` and
  `packages/refract-worker/src/generated-worker-source.ts`. Regenerate them with
  `pnpm generate:*` / `pnpm task generate:worker-source` instead.
- **Prettier is occasionally non-idempotent** on method chains carrying generic
  type arguments plus an `as` cast — one pass expands the chain, the next collapses
  it. If `format:check` fails right after `format`, just run `format` again; it
  converges. Do not hand-edit to chase it.

### `eslint-disable` directives must survive reflowing

A directive comment attaches to the _next line_. If the suppressed expression sits
on the same line as its call head, the formatter may split them apart and silently
detach the directive — the suppression goes stale and the real violation reappears
two lines down. Put the directive immediately above the line that actually
violates the rule, including inside a JSX opening tag:

```tsx
<VersionOdometerDigit
  // eslint-disable-next-line react/no-array-index-key -- digit slot position is the identity
  key={`build-${index}`}
/>
```

Always give a `--` reason. An unexplained suppression is a bug report with no text.

## 2. Complexity limits

Section 7 of `config/eslint.config.mjs` sets three limits over `src/**` and
`packages/*/src/**` (tests, stories and `refract-test-harness` excluded, because a
`describe()` callback is a function to ESLint and measuring its length says nothing):

| Rule                     | Limit |
| ------------------------ | ----- |
| `max-params`             | 4     |
| `max-lines-per-function` | 120   |
| `max-lines`              | 600   |

They remain warnings in the ESLint configuration so editors show them as design
guidance. The repository lint task rejects every warning:

```bash
pnpm task lint
```

`lint`, `verify` and `verify:quick` run ESLint with `--max-warnings 0`. The current
baseline is zero violations, so there is no separate debt budget or ratchet.
Do not add suppressions beyond the four documented `max-params` exceptions that
preserve the native Canvas and OffscreenCanvas Web API overloads.

When the check fails, extract rather than suppress:

- 4+ parameters → a named options object
- long function → a helper, or a `useXState` hook for React
- long file → move a cohesive group into its own module

## 3. Function and module shape

`packages/refract-core/src/geolocation/cache.ts` is the reference implementation.
Read it before adding a subsystem. It demonstrates all of the following.

**Options object past 3 arguments.** Positional arguments do not scale and are not
self-documenting at the call site. `src/background/rules/resolver.ts` is the worked
example: its four snapshot entry points took 14, 11, 9 and 9 positional arguments
until their contracts moved to `src/background/rules/resolver-options.ts`. Two of
`resolveProfileSnapshot`'s booleans sat at positions 7 and 9, so swapping them
compiled silently.

**Make options members required unless absence is meaningful.** An optional member
with a default is a silent fallback. The same resolver defaulted three collections
to `[]`, so a forgotten argument quietly dropped geo behaviour, disabled Firefox
container assignments, or spoofed on a trusted site. Prefer an explicit
`T | undefined` member the caller must write over a default it can forget.

**Factories return an explicitly typed contract.** Declare `export type XApi = {…}`
and `createX(options: XOptions): XApi` rather than inferring the shape. The named
type is the seam that keeps callers honest.

**Inject time and randomness.** Take `now: () => number` and `random: () => number`
as options instead of reaching for `Date.now()` or `Math.random()`. This is also
what makes the testing rules in `CLAUDE.md` achievable — a test controls the clock
instead of sleeping.

**Sort object type members and options keys alphabetically.** Cheap to apply,
removes a class of merge conflict.

**No inline per-field defaults.** Every scalar preference default comes from
`DEFAULT_PREFERENCES` / `normalizePreferences` in `src/shared/settings-defaults.ts`.
Never `?? true`, `Boolean(x)`, `= false`, or `useState(false)` per field — and never
a default in a parameter list either. A parameter default that contradicts the
canonical one is worse than no default: the resolver's `sharedWorkerHandlingMode`
defaulted to `"native"` while `DEFAULT_PREFERENCES` said `"strict"`, so any caller
that forgot the argument silently got the weaker setting.

**Declaration style: `export const fn = () => {}`.** Already the convention at
778 occurrences versus 15 `export function`. Match it.

## 4. Naming

| Kind                                   | Convention                 |
| -------------------------------------- | -------------------------- |
| `.ts` files                            | `kebab-case.ts`            |
| `.tsx` exporting a component           | `PascalCase.tsx`           |
| `.tsx` with primitives/hooks/utilities | `kebab-case.tsx`           |
| Types and components                   | `PascalCase`               |
| Everything else                        | `camelCase`                |
| Factories                              | `createX`                  |
| Booleans                               | `is`/`has`/`should` prefix |

Imports use path aliases (`@/…`, `@privacy-brand/…`), never `../../..`.
`import/order` enforces grouping and alphabetization.

Prefer concise labels; avoid redundant wording and near-synonyms. If a shorter
name is clear, use it.

## 5. Comments

Comment density in this repo runs 1–9% by directory, which is right. The house
style is a comment that carries evidence — the strongest examples cite a commit
and a regression test:

```ts
// Raw UTC offset breaks getTimezoneOffset() on non-UTC hosts and around DST
// transitions. Fixed in 5af57e4; tests in src/background/rules/resolver.target.test.ts.
```

Write comments that explain **why**, name an invariant, or record a footgun. Do not
paraphrase the code. Everything — code, comments, commit messages, docs — is in
English.

## 6. Types

Keep `strict`, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on.
Never relax them to make a change compile.

`any`, `as any` and `as unknown as` are acceptable only at a genuine boundary with
untyped platform code — page-world patching, worker bootstrap, browser shims — where
they are already concentrated (53 of ~120 occurrences sit in
`packages/refract-worker/src/worker-runtime.ts`). Anywhere else, model the type.
`@ts-ignore` and `@ts-expect-error` are not used in this repo; keep it that way.

With `exactOptionalPropertyTypes`, spread optional properties conditionally rather
than passing `undefined`:

```ts
...(positionOptions === undefined ? {} : { options: positionOptions })
```

## 7. Known deviations

Tracked in Notion — [Dług czytelności kodu — god-moduły i kontrakty funkcji](https://app.notion.com/p/3a819f2ad83881d9951bf242832d0da3),
which carries the remediation order, risk per item and the rejected alternatives.
Not fixed by this guide:

- `src/background/rules/resolver.target.test.ts` — the assertions still reach the
  resolver through positional adapters, and one of them pins
  `browserFingerprintSpoofingEnabled` to `false` where production defaults to
  `true`. Kept deliberately so the options-object refactor could be verified
  against untouched assertions; tracked as its own ticket.
- `SettingsContext` keeps one provider and one public `useSettings()`, while its
  implementation is composed from domain state hooks and handler factories in
  `src/ui/options/state/use-settings-*.ts`. Preserve the composition order:
  state, latest-value refs, persistence, handlers, effects, then the spread-based
  context value.

  Do **not** split the provider merely to reduce re-renders. The context value is
  still a fresh object with no selectors, so multiple providers would update at
  the same cadence. Domains also cannot own independent persisted snapshots:
  both save commands echo canonical state that is re-applied across domains in
  one `await`. A real render-boundary change requires a separately designed
  selector/store layer such as `useSyncExternalStore`.

- Four coexisting brand namespaces (`pt`, `refract`, `privacy-brand`,
  `privacy-thing`). This is a deliberately deferred migration, not drift — the
  Notion naming-architecture page keeps implementation identifiers frozen until a
  separate code migration. Do not rename them opportunistically.
