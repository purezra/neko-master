import { describe, expect, it } from "vitest";
import { filterChainFlowByGroups, orderPolicyGroups } from "./chain-flow-filter";

const data = {
  nodes: [
    { name: "AI rule", nodeType: "rule", layer: 0 },
    { name: "Video rule", nodeType: "rule", layer: 0 },
    { name: "AI", nodeType: "group", layer: 1 },
    { name: "Video", nodeType: "group", layer: 1 },
    { name: "Region", nodeType: "group", layer: 2 },
    { name: "Shared exit", nodeType: "proxy", layer: 3 },
  ],
  links: [
    { source: 0, target: 2, rules: ["AI rule"] },
    { source: 1, target: 3, rules: ["Video rule"] },
    { source: 2, target: 4, rules: ["AI rule"] },
    { source: 4, target: 5, rules: ["AI rule"] },
    { source: 3, target: 5, rules: ["Video rule"] },
  ],
  rulePaths: {
    "AI rule": { nodeIndices: [0, 2, 4, 5], linkIndices: [0, 2, 3] },
    "Video rule": { nodeIndices: [1, 3, 5], linkIndices: [1, 4] },
  },
  maxLayer: 3,
};

describe("policy group ordering", () => {
  it("follows configuration order, deduplicates names and appends historical groups", () => {
    expect(orderPolicyGroups(["Video", "Old", "AI", "Video", "Region"], ["DIRECT", "AI", "Region", "Video", "AI"]))
      .toEqual(["AI", "Region", "Video", "Old"]);
  });

  it("preserves discovery order when the gateway does not provide configuration order", () => {
    expect(orderPolicyGroups(["Video", "AI", "Video"])).toEqual(["Video", "AI"]);
  });

  it("places GLOBAL's prepended built-ins after the configured policy groups", () => {
    expect(orderPolicyGroups(["DIRECT", "AI", "Video"], ["DIRECT", "REJECT", "Video", "AI"]))
      .toEqual(["Video", "AI", "DIRECT"]);
  });
});

describe("policy group chain filter", () => {
  it("keeps a group's upstream and downstream without leaking siblings through a shared proxy", () => {
    const result = filterChainFlowByGroups(data, ["Region"]);
    expect(result.nodes.map(node => node.name)).toEqual(["AI rule", "AI", "Region", "Shared exit"]);
    expect(result.links).toEqual([
      { source: 0, target: 1, rules: ["AI rule"] },
      { source: 1, target: 2, rules: ["AI rule"] },
      { source: 2, target: 3, rules: ["AI rule"] },
    ]);
    expect(result.rulePaths["AI rule"]).toEqual({ nodeIndices: [0, 1, 2, 3], linkIndices: [0, 1, 2] });
    expect(data.links[2]).toEqual({ source: 2, target: 4, rules: ["AI rule"] });
  });

  it("combines multiple selected chains and restores all when cleared", () => {
    expect(filterChainFlowByGroups(data, ["AI", "Video"])).toEqual(data);
    expect(filterChainFlowByGroups(data, [])).toBe(data);
  });

  it("supports top-level policy groups rendered as rule nodes and built-in DIRECT policies", () => {
    expect(filterChainFlowByGroups(data, ["AI rule"]).nodes.map(node => node.name))
      .toEqual(["AI rule", "AI", "Region", "Shared exit"]);
    const direct = { ...data, nodes: [...data.nodes, { name: "DIRECT", nodeType: "direct", layer: 3 }] };
    expect(filterChainFlowByGroups(direct, ["DIRECT"]).nodes.map(node => node.name)).toEqual(["DIRECT"]);
  });

  it("does not follow sibling branches via a shared upstream group", () => {
    const branched = { ...data, links: [...data.links, { source: 2, target: 3, rules: [] }] };
    expect(filterChainFlowByGroups(branched, ["Region"]).nodes.map(node => node.name))
      .not.toContain("Video");
  });

  it("returns an empty graph for unavailable groups and ignores proxy names", () => {
    for (const names of [["Removed group"], ["Shared exit"]]) {
      expect(filterChainFlowByGroups(data, names)).toEqual({ nodes: [], links: [], rulePaths: {}, maxLayer: 0 });
    }
  });

  it("handles cyclic chains and isolated zero-traffic groups", () => {
    const cyclic = { ...data, links: [...data.links, { source: 4, target: 2, rules: [] }] };
    expect(filterChainFlowByGroups(cyclic, ["AI"]).links).toHaveLength(4);
    const isolated = { ...data, nodes: [...data.nodes, { name: "Idle", nodeType: "group", layer: 1 }] };
    expect(filterChainFlowByGroups(isolated, ["Idle"]).nodes.map(node => node.name)).toEqual(["Idle"]);
  });
});
