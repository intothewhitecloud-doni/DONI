import type { StructureMapDepth, StructureMapEdgeType, StructureMapNodeType } from "../../domain/types";
import { structureMapEdgeMeta, structureMapNodeMeta } from "./structureMapLayerMeta";
import type { StructureMapGraphEdge, StructureMapGraphNode, StructureMapSearchFocus } from "./structureMapQueries";

export { structureMapEdgeMeta, structureMapNodeMeta } from "./structureMapLayerMeta";

export type StructureMapGraphTone = StructureMapGraphNode["tone"];

export type StructureMapReagraphNodeData = {
  caption: string;
  dimmed: boolean;
  focused: boolean;
  iconLabel: string;
  original: StructureMapGraphNode;
  searchMatch: boolean;
  selected: boolean;
  type: StructureMapNodeType;
};

export type StructureMapReagraphEdgeData = {
  dimmed: boolean;
  focused: boolean;
  original: StructureMapGraphEdge;
  readOnly: boolean;
  selected: boolean;
};

type ReagraphNode = {
  cluster?: string;
  fill?: string;
  fx?: number;
  fy?: number;
  fz?: number;
  icon?: string;
  id: string;
  label?: string;
  labelVisible?: boolean;
  size?: number;
  subLabel?: string;
};

type ReagraphEdge = {
  arrowPlacement?: "none" | "mid" | "end";
  dashed?: boolean;
  dashArray?: [number, number];
  fill?: string;
  id: string;
  interpolation?: "linear" | "curved";
  label?: string;
  size?: number;
  source: string;
  subLabel?: string;
  target: string;
};

export type StructureMapReagraphNode = Omit<ReagraphNode, "data"> & {
  data: StructureMapReagraphNodeData;
};

export type StructureMapReagraphEdge = Omit<ReagraphEdge, "data"> & {
  data: StructureMapReagraphEdgeData;
};

export type StructureMapReagraphModel = {
  activeIds: string[];
  edges: StructureMapReagraphEdge[];
  nodes: StructureMapReagraphNode[];
  selectedIds: string[];
};

export type BuildStructureMapReagraphModelOptions = {
  depth: StructureMapDepth;
  horizontalScale?: number;
  searchFocus: StructureMapSearchFocus;
  selectedItemId?: string;
};

export function buildStructureMapReagraphModel(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  {
    depth,
    horizontalScale = 1,
    searchFocus,
    selectedItemId
  }: BuildStructureMapReagraphModelOptions
): StructureMapReagraphModel {
  const relatedIds = selectedItemId ? getStructureMapRelatedIds(nodes, edges, selectedItemId, depth) : new Set<string>();
  const searchMatchNodeIds = new Set(searchFocus.matchNodeIds);
  const searchFocusNodeIds = new Set(searchFocus.nodeIds);
  const searchFocusEdgeIds = new Set(searchFocus.edgeIds);
  const hasSearch = Boolean(searchFocus.query);
  const hasSearchMatches = searchMatchNodeIds.size > 0;
  const hasSelection = Boolean(selectedItemId);
  const activeIds = new Set<string>();

  const graphNodes = nodes.map((node) => {
    const selected = node.id === selectedItemId;
    const searchMatch = searchMatchNodeIds.has(node.id);
    const focused = searchFocusNodeIds.has(node.id);
    const related = relatedIds.has(node.id);
    const dimmed = hasSelection ? !selected && !related : hasSearch && (!hasSearchMatches || (!focused && !searchMatch));
    const meta = structureMapNodeMeta[node.type];
    const position = reagraphNodePosition(node, horizontalScale);

    if (selected || searchMatch || focused || related) {
      activeIds.add(node.id);
    }

    return {
      id: node.id,
      cluster: node.type,
      data: {
        caption: node.caption,
        dimmed,
        focused,
        iconLabel: meta.icon,
        original: node,
        searchMatch,
        selected,
        type: node.type
      },
      fill: selected ? "#ffffff" : nodeFill(node.type, node.tone),
      fx: position.x,
      fy: position.y,
      icon: svgIconDataUrl({
        background: selected ? "#ffffff" : nodeFill(node.type, node.tone),
        foreground: selected ? "#1d4ed8" : meta.accent,
        glyph: meta.icon,
        ring: searchMatch ? "#f97316" : focused ? "#14b8a6" : selected ? "#2563eb" : meta.stroke
      }),
      label: node.label,
      labelVisible: false,
      size: selected || searchMatch ? 34 : focused ? 30 : 26,
      subLabel: node.caption
    } satisfies StructureMapReagraphNode;
  });

  const graphEdges = edges.map((edge) => {
    const selected = edge.id === selectedItemId;
    const related = relatedIds.has(edge.id);
    const focused = searchFocusEdgeIds.has(edge.id);
    const dimmed = hasSelection ? !selected && !related : hasSearch && (!hasSearchMatches || !focused);
    const meta = structureMapEdgeMeta[edge.edgeType];

    if (selected || related || focused) {
      activeIds.add(edge.id);
    }

    return {
      id: edge.id,
      arrowPlacement: "end",
      dashed: edge.readOnly || edge.strength === "weak",
      dashArray: edge.strength === "weak" ? [2, 2] : [5, 2],
      data: {
        dimmed,
        focused,
        original: edge,
        readOnly: edge.readOnly,
        selected
      },
      fill: selected ? "#1d4ed8" : focused ? "#14b8a6" : meta.color,
      interpolation: edge.readOnly ? "curved" : "linear",
      label: selected || focused || !edge.readOnly ? edge.label : undefined,
      size: selected ? 2.4 : focused ? 2 : edge.readOnly ? 0.9 : 1.5,
      source: edge.fromId,
      subLabel: edge.readOnly ? "자동" : edge.strength,
      target: edge.toId
    } satisfies StructureMapReagraphEdge;
  });

  return {
    activeIds: [...activeIds],
    edges: graphEdges,
    nodes: graphNodes,
    selectedIds: selectedItemId ? [selectedItemId] : []
  };
}

function reagraphNodePosition(node: StructureMapGraphNode, horizontalScale: number): { x: number; y: number } {
  const seed = hashString(node.id);
  const horizontalBias = ((seed % 1000) / 1000 - 0.5) * 170;
  const verticalBias = (((Math.floor(seed / 1000) % 1000) / 1000) - 0.5) * 62;
  const typeBias: Record<StructureMapNodeType, { x: number; y: number }> = {
    category: { x: 0, y: -28 },
    insight: { x: 42, y: 10 },
    managed_object: { x: -34, y: -10 },
    metric: { x: 18, y: -16 },
    workflow: { x: 0, y: 18 }
  };
  const bias = typeBias[node.type];

  return {
    x: Math.round(node.position.x * horizontalScale * 4.2 + horizontalBias + bias.x),
    y: Math.round(node.position.y * 3.2 + verticalBias + bias.y)
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getStructureMapRelatedIds(
  nodes: StructureMapGraphNode[],
  edges: StructureMapGraphEdge[],
  selectedItemId: string,
  depth: StructureMapDepth
): Set<string> {
  const related = new Set<string>([selectedItemId]);
  const selectedEdge = edges.find((edge) => edge.id === selectedItemId);
  if (selectedEdge) {
    related.add(selectedEdge.fromId);
    related.add(selectedEdge.toId);
    const relatedNodeIds = traverseGraphNodeIds(edges, [selectedEdge.fromId, selectedEdge.toId], depth);
    relatedNodeIds.forEach((id) => related.add(id));
    edges.forEach((edge) => {
      if (relatedNodeIds.has(edge.fromId) && relatedNodeIds.has(edge.toId)) {
        related.add(edge.id);
      }
    });
    return related;
  }

  if (!nodes.some((node) => node.id === selectedItemId)) {
    return related;
  }

  const relatedNodeIds = traverseGraphNodeIds(edges, [selectedItemId], depth);
  relatedNodeIds.forEach((id) => related.add(id));
  edges.forEach((edge) => {
    if (relatedNodeIds.has(edge.fromId) && relatedNodeIds.has(edge.toId)) {
      related.add(edge.id);
      related.add(edge.fromId);
      related.add(edge.toId);
    }
  });
  return related;
}

export function nodeFill(type: StructureMapNodeType, tone: StructureMapGraphTone): string {
  if (tone === "danger") {
    return "#fff1f2";
  }
  if (tone === "warning") {
    return "#fffbeb";
  }
  return structureMapNodeMeta[type].fill;
}

function traverseGraphNodeIds(edges: StructureMapGraphEdge[], rootIds: string[], depth: StructureMapDepth): Set<string> {
  const visited = new Set(rootIds);
  if (depth === "all") {
    let changed = true;
    while (changed) {
      changed = expandGraphOneHop(edges, visited);
    }
    return visited;
  }

  for (let level = 0; level < depth; level += 1) {
    expandGraphOneHop(edges, visited);
  }
  return visited;
}

function expandGraphOneHop(edges: StructureMapGraphEdge[], visited: Set<string>): boolean {
  let changed = false;
  for (const edge of edges) {
    if (visited.has(edge.fromId) && !visited.has(edge.toId)) {
      visited.add(edge.toId);
      changed = true;
    }
    if (visited.has(edge.toId) && !visited.has(edge.fromId)) {
      visited.add(edge.fromId);
      changed = true;
    }
  }
  return changed;
}

function svgIconDataUrl({
  background,
  foreground,
  glyph,
  ring
}: {
  background: string;
  foreground: string;
  glyph: string;
  ring: string;
}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="7" y="7" width="50" height="50" rx="13" fill="${background}" stroke="${ring}" stroke-width="4"/><text x="32" y="40" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="${foreground}">${glyph}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
