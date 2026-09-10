import { describe, expect, it } from "vitest";

import { redactControlDLogValue } from "./redaction";

describe("redactControlDLogValue", () => {
  it("redacts secrets, authorization and resolver URLs recursively", () => {
    const secret = "write-token-123";
    const redacted = redactControlDLogValue(
      {
        apiKey: secret,
        header: `Bearer ${secret}`,
        resolver: "failed for https://dns.controld.com/secret-resolver-id",
        nested: [`failed for ${secret}`],
        status: 429,
      },
      secret,
    );

    expect(redacted).toEqual({
      apiKey: "[REDACTED]",
      header: "Bearer [REDACTED]",
      resolver: "failed for [CONTROL_D_URL_REDACTED]",
      nested: ["failed for [REDACTED]"],
      status: 429,
    });
  });
});
