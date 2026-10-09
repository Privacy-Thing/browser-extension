import { describe, expect, it } from "vitest";

import { controlDDomainQueryUrl, interpretControlDQuery } from "./domain-test";

const verdict = (
  verdictSource: string,
  verdictMatch?: unknown,
  status = 0,
): unknown => ({
  Status: status,
  Answer: [{ data: "203.0.113.9" }],
  QNAME: "other.example.",
  controld: { verdict: { verdictSource, verdictMatch, verdictVia: "WAW" } },
});

describe("Control D domain query recognition", () => {
  it("builds the dedicated no-log DoH query and rejects any other origin", () => {
    expect(controlDDomainQueryUrl("resolver-1", "www.example.com")).toBe(
      "https://dns.controld.com/resolver-1?name=www.example.com&type=A&controld=1&no_log=1",
    );
    expect(
      controlDDomainQueryUrl("https://evil.example/steal", "example.com"),
    ).toBeNull();
    expect(controlDDomainQueryUrl("resolver@evil.example", "example.com")).toBeNull();
    expect(controlDDomainQueryUrl("../evil", "example.com")).toBeNull();
    expect(controlDDomainQueryUrl("resolver-1", "example.com/path")).toBeNull();
    expect(controlDDomainQueryUrl("resolver-1", "")).toBeNull();
  });

  it("treats only a service verdict with an id as membership", () => {
    expect(interpretControlDQuery("example.com", verdict("svc", "netflix"))).toEqual({
      hostname: "example.com",
      status: "matched",
      serviceId: "netflix",
    });
    expect(interpretControlDQuery("example.com", verdict("svc", 1688))).toEqual({
      hostname: "example.com",
      status: "matched",
      serviceId: "1688",
    });
    expect(
      interpretControlDQuery("example.com", verdict("svc", "netflix")),
    ).not.toHaveProperty("Answer");
  });

  it("keeps custom and global rules from proving service membership", () => {
    expect(interpretControlDQuery("example.com", verdict("rules", "netflix"))).toEqual({
      hostname: "example.com",
      status: "overridden",
      serviceId: null,
    });
    expect(interpretControlDQuery("example.com", verdict("grules", "ads"))).toEqual({
      hostname: "example.com",
      status: "overridden",
      serviceId: null,
    });
  });

  it.each(["default", "filter", "bl", "rebind", "ml", ""])(
    "leaves %j unresolved instead of reporting no membership",
    (source) => {
      expect(interpretControlDQuery("example.com", verdict(source, "netflix"))).toEqual(
        { hostname: "example.com", status: "unresolved", serviceId: null },
      );
    },
  );

  it("treats a nonzero DNS status as unresolved", () => {
    expect(interpretControlDQuery("example.com", verdict("svc", "netflix", 3))).toEqual(
      {
        hostname: "example.com",
        status: "unresolved",
        serviceId: null,
      },
    );
    expect(
      interpretControlDQuery("example.com", verdict("rules", "netflix", 2)),
    ).toEqual({
      hostname: "example.com",
      status: "unresolved",
      serviceId: null,
    });
  });

  it("leaves a service verdict without an id unresolved", () => {
    expect(interpretControlDQuery("example.com", verdict("svc"))).toEqual({
      hostname: "example.com",
      status: "unresolved",
      serviceId: null,
    });
    expect(interpretControlDQuery("example.com", verdict("svc", "  "))).toEqual({
      hostname: "example.com",
      status: "unresolved",
      serviceId: null,
    });
    expect(interpretControlDQuery("example.com", { Status: 0 })).toEqual({
      hostname: "example.com",
      status: "unresolved",
      serviceId: null,
    });
  });

  it.each([undefined, "0", 1.5, 16, -1, { status: 0 }])(
    "rejects a malformed DNS status: %j",
    (payload) => {
      const body =
        payload !== null && typeof payload === "object" ? payload : { Status: payload };
      expect(interpretControlDQuery("example.com", body)).toBeNull();
    },
  );
});
