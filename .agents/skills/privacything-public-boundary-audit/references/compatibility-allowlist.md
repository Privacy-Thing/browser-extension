# Compatibility allowlist

The retired product name is forbidden everywhere except the exact values below. The
audit script validates their structure and requires exactly six matches in four files;
do not add a general filename, prefix or regex exception.

## Approved values

- `config/brand-config.json`: stable and beta Firefox extension IDs;
- `SECURITY.md`: the current security contact email;
- `CODE_OF_CONDUCT.md`: the current conduct contact email;
- `src/shared/extension-notifications.json`: the title and first English paragraph of
  `privacy-thing-rename`.

Tests must read these values from their canonical files or validate their hash and
shape. They must not repeat the retired name as a literal.

## Current technical contract

- environment variables use `PT_*`;
- build constants use `__PT_*__`;
- runtime commands, storage, DOM attributes, test bridges and tooling identifiers use
  `pt`;
- old persisted storage is imported only by the bounded background migration;
- deterministic fingerprint behavior is versioned as `fp-v1` without exposing its
  historical salt as a source literal;
- `@privacy-brand/*`, Refract and X-Ray remain current neutral names.

## Never acceptable in public source

- actual API tokens, passwords, service-account JSON or private-key material;
- committed `.env` files other than explicit examples without values;
- copied browser profiles, store credentials, signing keys or live user data;
- internal incident evidence containing account or user data.
