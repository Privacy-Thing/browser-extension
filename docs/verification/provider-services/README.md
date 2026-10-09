# Provider feature matching verification

Implemented from `origin/main` at `50f9fc5`, with the corrected per-domain design.
The earlier requirement for a complete service domain catalogue no longer gates
this feature. Privacy Thing neither downloads nor invents such a catalogue.

## Behavior under review

A saved domain rule can query its representative hostname and suggest a
`ProviderFeature` with `type: "service"`. The user explicitly confirms the
suggestion, chooses a different feature, dismisses it or detaches the binding.
A broad pattern remains a broad pattern: checking one hostname never proves that
all its matches belong to the service.

Control D maps a confirmed binding to its native service redirect using the
source rule's regional proxy mapping. Control D controls DNS membership and can
route further service domains. Privacy Thing's local spoofing still resolves
its existing domain rules, Trusted Sites, Firefox containers and fallback.
A binding does not add implicit local rules or change `ruleSeedKey` / `authKey`.
No provider query runs in a page, worker or injected bootstrap.

`ProviderFeature`, `ProviderFeatureMatch`, `RuleFeatureBinding`, `featureBindings`
and messaging/storage names are generic. Adapter-only `Service`/profile/endpoint
and native action details remain under `src/experimental/control-d`.
Bindings are persisted separately from `DomainRule` and from recognition cache.
Backups preserve generic bindings without credentials, resolvers or query history.
Old backups normalize missing bindings to an empty collection. Import selection
keeps bindings with their source rule; deletion removes them and stable-identity
pattern changes move them. Disabling a source keeps its local binding but removes
an unchanged, owned native service action.

## API evidence and limits

- The public [service catalogue](https://api.controld.com/services/categories/all)
  supplies IDs and names. Its 1,012 observed entries do not supply domain scope.
- The [profile service API](https://docs.controld.com/reference/get_profiles-profile-id-services)
  supplies configured service actions; the
  [service modification API](https://docs.controld.com/reference/put_profiles-profile-id-services-service)
  accepts native service actions.
- The dashboard's [Domain Test](https://controld.com/dashboard/domain-test) queries
  `https://dns.controld.com/{resolverId}` with `controld=1` and `no_log=1`.
  Only `controld.verdict.verdictSource === "svc"` with a known `verdictMatch`
  counts as a positive suggestion. Winning `rules` / `grules` are overridden;
  other results are unresolved. Names and domain-name resemblance are not evidence.
- [Matching order](https://docs.controld.com/docs/org-profiles) places Custom Rules
  above service rules. Recognition therefore needs a separate lookup profile and
  endpoint with enabled Bypass service rules; the lookup resolver is not the
  browser's regional resolver. A global override can still leave the domain
  unresolved/overridden, so manual selection remains available.

Lookup setup uses the dashboard's bulk JSON `PUT /profiles/{id}/services`
with enabled Bypass actions. This route is frontend-derived and is not listed
in the published singular service API; live account compatibility remains unverified.

API contracts were verified against official documentation and the public
frontend. Automated API evidence uses controlled responses. No live authenticated
Control D account or production profile was modified or represented as tested.
Positive lookups establish individual results, not exhaustive membership or
first-inline protection on previously unknown service domains.

## Safety and lifecycle evidence

Client tests confine the bearer token to the Control D DoH origin, validate the
resolver ID and hostname, bound request time, redact failures and distinguish
service verdicts from overrides. Catalogue metadata survives restart and failed
refresh. Recognition cache is bounded and has separate positive/negative TTLs;
failures preserve the last good result. UI sends a hostname only after Check.

Compiler/reconcile tests cover native add, update and unchanged actions, source
location changes, disabling/deleting/detaching, duplicate source/feature conflicts,
unowned services, remote drift, stale previews and explicit repair. Fresh remote
preflight happens before custom-rule writes. Unrelated service actions are kept,
and remotely changed removals are refused. Before native writes, a persisted intent
journal records planned add/update ownership and the current profile/endpoint.
A partial API failure preserves that journal, allowing reviewed repair without
adopting independently configured services. Cache-only recognition/dismissal
writes cannot restore a binding removed by a concurrent rule deletion.

The four runtime paths (Chromium main, early-inline, Firefox pre-bootstrap and
workers) have no semantic change: their resolver inputs and generated worker
source are unchanged. Header/preload/bootstrap identity remains the domain rule's.
Both compile targets have matching lifecycle/import/reconcile tests; release
build contracts prove exclusion of the experimental adapter/UI.

## Rendered UI evidence

Screenshots are attached directly in the before/after table of
[PR #59](https://github.com/Privacy-Thing/browser-extension/pull/59), rather than
stored in the source repository. They show actual Storybook views with controlled
data: the rule editor, popup, Control D lookup setup and native service preview,
plus bound, error, conflict, manual-picker and dark states. No account credentials
appear in these images.

Validation commands and final counts are recorded in PR #59.
