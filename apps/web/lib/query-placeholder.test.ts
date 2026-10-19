import { describe, expect, it } from "vitest";
import { keepPreviousByIdentity } from "./query-placeholder";
import { getDevicesQueryKey } from "./stats-query-keys";

describe("device list transitions", () => {
  const previous = [{ sourceIP: "192.168.1.161" }];
  const query = { queryKey: getDevicesQueryKey(1, 2000, { start: "2026-10-18T00:00:00Z", end: "2026-10-19T00:00:00Z" }) };

  it("keeps the same gateway's list mounted while a rolling range refetches", () => {
    expect(keepPreviousByIdentity(previous, query, { backendId: 1 })).toBe(previous);
  });

  it("never shows the previous gateway's devices after a switch", () => {
    expect(keepPreviousByIdentity(previous, query, { backendId: 2 })).toBeUndefined();
  });

  it("does not reuse data when the previous query has no identity", () => {
    expect(keepPreviousByIdentity(previous, undefined, { backendId: 1 })).toBeUndefined();
  });
});
