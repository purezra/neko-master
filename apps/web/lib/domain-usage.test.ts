import { describe, expect, it } from "vitest";
import { groupDomainUsage, usageValue } from "./domain-usage";

describe("domain usage attribution", () => {
  const rows = [
    { sourceIP: "192.168.1.2", chain: "Node > Group A", totalUpload: 10, totalDownload: 90, totalConnections: 1 },
    { sourceIP: "192.168.1.2", chain: "DIRECT", totalUpload: 0, totalDownload: 20, totalConnections: 3 },
    { sourceIP: "192.168.1.3", chain: "Node > Group B", totalUpload: 20, totalDownload: 60, totalConnections: 2 },
    { sourceIP: "", chain: "", totalUpload: 0, totalDownload: 0, totalConnections: 5 },
    { sourceIP: null, chain: null, totalUpload: 0, totalDownload: 10, totalConnections: 1 },
  ];
  it("merges chains by actual first-hop node and preserves device/proxy denominators", () => {
    const devices = groupDomainUsage(rows, "device", "traffic");
    const proxies = groupDomainUsage(rows, "proxy", "traffic");
    expect(devices[0]).toMatchObject({ key: "192.168.1.2", totalDownload: 110, totalUpload: 10 });
    expect(proxies[0]).toMatchObject({ key: "Node", totalDownload: 150, totalUpload: 30, chains: ["Node > Group A", "Node > Group B"] });
    for (const list of [devices, proxies]) expect(list.reduce((sum, item) => sum + usageValue(item, "traffic"), 0)).toBe(210);
    const selected = groupDomainUsage(rows.filter(row => row.sourceIP === "192.168.1.2"), "proxy", "traffic");
    expect(selected.reduce((sum, item) => sum + usageValue(item, "traffic"), 0)).toBe(120);
  });
  it("supports connection-only traffic, unknown and overflow groups", () => {
    const list = groupDomainUsage(rows, "device", "connections");
    expect(list[0].key).toBe("");
    expect(list[0].totalConnections).toBe(5);
    expect(list.some(item => item.key === null)).toBe(true);
  });
});
