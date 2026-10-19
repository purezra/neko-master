interface ChainFlowNode {
  name: string;
  nodeType: string;
  layer: number;
}

interface ChainFlowLink {
  source: number;
  target: number;
}

interface ChainFlowPath {
  nodeIndices: number[];
  linkIndices: number[];
}

// Clash's /proxies object is alphabetized by JSON encoding; GLOBAL.all retains
// the configuration's proxy/group order. Keep unknown or historical names last.
export function orderPolicyGroups(names: string[], configuredOrder: string[] = []): string[] {
  const remaining = new Set(names);
  const ordered: string[] = [];
  for (const name of configuredOrder) {
    // GLOBAL prepends built-ins; they are not YAML proxy-groups entries.
    if (["DIRECT", "REJECT", "REJECT-TINY", "GLOBAL"].includes(name)) continue;
    if (remaining.delete(name)) ordered.push(name);
  }
  return [...ordered, ...remaining];
}

// Walk upstream and downstream separately: a shared exit must not pull in
// sibling policy groups that happen to use the same proxy.
export function filterChainFlowByGroups<N extends ChainFlowNode, L extends ChainFlowLink>(
  data: { nodes: N[]; links: L[]; rulePaths: Record<string, ChainFlowPath>; maxLayer: number },
  groupNames: string[],
): typeof data {
  if (groupNames.length === 0) return data;

  const selected = new Set(groupNames);
  const roots = data.nodes.flatMap((node, index) =>
    node.nodeType !== "proxy" && selected.has(node.name) ? [index] : [],
  );
  const keptNodes = new Set(roots);
  const keptLinks = new Set<number>();
  const incoming = new Map<number, number[]>();
  const outgoing = new Map<number, number[]>();
  data.links.forEach((link, index) => {
    if (!data.nodes[link.source] || !data.nodes[link.target]) return;
    incoming.set(link.target, [...(incoming.get(link.target) ?? []), index]);
    outgoing.set(link.source, [...(outgoing.get(link.source) ?? []), index]);
  });

  for (const direction of ["source", "target"] as const) {
    const adjacency = direction === "source" ? incoming : outgoing;
    const visited = new Set(roots);
    const pending = [...roots];
    while (pending.length > 0) {
      const index = pending.pop()!;
      for (const linkIndex of adjacency.get(index) ?? []) {
        keptLinks.add(linkIndex);
        const neighbor = data.links[linkIndex][direction];
        keptNodes.add(neighbor);
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
  }

  const nodeMap = new Map<number, number>();
  const nodes = data.nodes.filter((_, index) => {
    if (!keptNodes.has(index)) return false;
    nodeMap.set(index, nodeMap.size);
    return true;
  });
  const linkMap = new Map<number, number>();
  const links = data.links.flatMap((link, index) => {
    if (!keptLinks.has(index)) return [];
    linkMap.set(index, linkMap.size);
    return [{ ...link, source: nodeMap.get(link.source)!, target: nodeMap.get(link.target)! }];
  });
  const rulePaths: Record<string, ChainFlowPath> = {};
  for (const [name, path] of Object.entries(data.rulePaths)) {
    const nodeIndices = path.nodeIndices.flatMap(index => {
      const mapped = nodeMap.get(index);
      return mapped === undefined ? [] : [mapped];
    });
    const linkIndices = path.linkIndices.flatMap(index => {
      const mapped = linkMap.get(index);
      return mapped === undefined ? [] : [mapped];
    });
    if (nodeIndices.length > 0) rulePaths[name] = { nodeIndices, linkIndices };
  }
  return { nodes, links, rulePaths, maxLayer: Math.max(0, ...nodes.map(node => node.layer)) };
}
