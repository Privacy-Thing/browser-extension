import { describe, expect, it } from "vitest";

import { featureMatchSchema } from "@/shared/provider-feature";

const match = (checkedAt: string) => ({
  hostname: "shop.example.com",
  providerId: "provider",
  featureId: null,
  matchSource: "manual",
  status: "matched",
  checkedAt,
});

describe("provider feature timestamps", () => {
  it("accepts the UTC timestamps the extension writes", () => {
    const checkedAt = new Date(Date.UTC(2026, 9, 25, 10)).toISOString();
    expect(featureMatchSchema.parse(match(checkedAt)).checkedAt).toBe(checkedAt);
  });

  it("keeps minute-precision timestamps that zod 3 accepted", () => {
    expect(featureMatchSchema.parse(match("2026-10-25T10:00Z")).checkedAt).toBe(
      "2026-10-25T10:00Z",
    );
  });

  it.each(["2026-10-25T10:00:00+02:00", "2026-10-25T10:00:00", "2026-02-30T10:00:00Z"])(
    "rejects %s",
    (checkedAt) => {
      expect(featureMatchSchema.safeParse(match(checkedAt)).success).toBe(false);
    },
  );
});
