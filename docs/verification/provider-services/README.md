# Control D service scope feasibility

Checked on 2026-10-09 against `origin/main` at `50f9fc5`.

## Acceptance gate

Service expansion requires a complete, provider-supplied domain/pattern scope.
Privacy Thing must prepare the source rule's protection for two distinct domains of
one service before navigation. The scope must remain available when a Custom Rule
overrides the service's DNS verdict. Service names, sampled lookups and activity logs
do not satisfy this requirement.

**Result: the complete-scope gate has not been met.** Do not activate expansion,
change rule resolution or offer service confirmation until the scope is verified.

## Evidence

- Public [service catalogue](https://api.controld.com/services/categories/all) returned HTTP 200
  with 1,012 services. The union of entry fields was `PK`, `id`, `label`, `name`,
  `category`, `unlock_location`, `locations`, `warning`. No domain/pattern scope was
  present. `locations` contains proxy location identifiers, not hostnames.
- The [official profile service list API](https://docs.controld.com/reference/get_profiles-profile-id-services)
  returns services with configured rules. The public dashboard consumes
  `body.services` and each entry's `PK`, `name`, `category`, `action.status`.
  This is action configuration, not evidence of service membership.
- The [official service modification API](https://docs.controld.com/reference/put_profiles-profile-id-services-service)
  accepts the service key plus action/status/proxy parameters. A native DNS service
  rule does not give the extension the domains needed for its local bootstrap.
- The public dashboard's [Domain Test](https://controld.com/dashboard/domain-test) performs a DNS lookup with `controld=1` and
  reads `controld.verdict.verdictSource` / `verdictMatch`. `svc` identifies a winning
  service rule; `rules` identifies a winning Custom Rule. This is not an enumeration
  API or proof of all services containing a hostname. A Custom Rule result cannot
  establish underlying service membership.
- [Profile export exists](https://controld.com/blog/updates-january-2025/), but its
  announcement does not promise domain definitions for built-in services.

No account token was used for this verification. Authenticated profile responses,
profile exports and Custom Rule masking were not tested against a live account.
The documented and publicly observed interfaces do not establish that a complete
scope is available; this is not a claim that no private interface exists.

An independent research task run through Cursor with Grok 4.7 checked the published
OpenAPI operations, live dashboard and Control D's public repositories. It reached
the same conclusion: none of those sources supplied a complete service scope.

## Implemented boundary

The experimental adapter now supports read-only service catalogue and profile
service configuration requests. It uses the service `PK` (not the catalogue UUID),
normalizes numeric catalogue names/keys and rejects malformed or partial collections.
Focused tests use controlled responses and do not contain credentials.

These reads expose metadata and configured actions only. They are not wired into
UI, storage, the compiler or the resolver and do not represent an approved domain
scope. No substitute domain catalogue was created. No main model, export schema,
page runtime or generated worker source changed. There are no UI changes to capture.

## Reopening the gate

Obtain a provider-supported scope endpoint/export with an explicit completeness
contract. Verify two distinct domains, an excluded domain, scope freshness and
availability despite overriding Custom Rules. Then implement the generic provider
contracts and the remaining UI, resolver and synchronization plan. DNS activity
samples must not be promoted to complete scopes.
