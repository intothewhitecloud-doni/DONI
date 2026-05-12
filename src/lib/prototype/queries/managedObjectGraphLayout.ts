import type {
  ManagedObjectDetail,
  ManagedObjectGraphEdge,
  ManagedObjectGraphEdgeType,
  ManagedObjectGraphLegendItem,
  ManagedObjectGraphNode
} from "./managedObjectQueries";

export type ManagedObjectGraphLaneKind = "category" | "managed_object" | "workflow" | "metric" | "insight";
export type ManagedObjectGraphEdgePriority = "primaryInfluence" | "containedStructural" | "downstream";

export type ManagedObjectGraphPoint = {
  x: number;
  y: number;
};

export type ManagedObjectGraphBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ManagedObjectGraphViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type ManagedObjectGraphLaneMeta = {
  kind: ManagedObjectGraphLaneKind;
  laneIndex: number;
  order: number;
};

export type ManagedObjectGraphEdgeVisual = {
  color: string;
  labelVisible: boolean;
  markerSize: number;
  opacity: number;
  priority: ManagedObjectGraphEdgePriority;
  rank: number;
  strokeWidth: number;
};

export type ManagedObjectGraphEdgeRoute = {
  offset: number;
  parallelOffset: number;
  stepPosition: number;
};

export type ManagedObjectGraphLayout = {
  contentBounds: ManagedObjectGraphBounds;
  defaultViewport: ManagedObjectGraphViewport;
  edgePriorityByEdgeId: Record<string, ManagedObjectGraphEdgeVisual>;
  edgeRouteByEdgeId: Record<string, ManagedObjectGraphEdgeRoute>;
  laneByNodeId: Record<string, ManagedObjectGraphLaneMeta>;
  positionsByNodeId: Record<string, ManagedObjectGraphPoint>;
};

const nodeWidth = 172;
const nodeHeight = 76;
const rowGap = 92;
const managedObjectLayerGap = 178;
const workflowOrder = ["event-order", "event-outbound", "event-delivery", "event-claim", "event-compensation"];

const laneX: Record<ManagedObjectGraphLaneKind, number> = {
  category: 32,
  managed_object: 232,
  workflow: 590,
  metric: 790,
  insight: 990
};

const laneOrder: Record<ManagedObjectGraphLaneKind, number> = {
  category: 0,
  managed_object: 1,
  workflow: 2,
  metric: 3,
  insight: 4
};

const laneBaseY: Record<ManagedObjectGraphLaneKind, number> = {
  category: 122,
  managed_object: 74,
  workflow: 74,
  metric: 74,
  insight: 74
};

export function buildManagedObjectGraphLayout(
  detail: Pick<ManagedObjectDetail, "graphEdges" | "graphLegend" | "graphNodes">
): ManagedObjectGraphLayout {
  const positionsByNodeId: Record<string, ManagedObjectGraphPoint> = {};
  const laneByNodeId: Record<string, ManagedObjectGraphLaneMeta> = {};
  const edgePriorityByEdgeId: Record<string, ManagedObjectGraphEdgeVisual> = {};
  const nodeById = new Map(detail.graphNodes.map((node) => [node.id, node]));
  const managedLayers = managedObjectLayers(detail.graphNodes, detail.graphEdges);
  const laneGroups = groupNodesByLane(detail.graphNodes);

  for (const laneKind of Object.keys(laneGroups) as ManagedObjectGraphLaneKind[]) {
    const nodes = laneGroups[laneKind];
    const sorted = sortLaneNodes(laneKind, nodes);
    const groupedByLayer = laneKind === "managed_object" ? groupManagedNodesByLayer(sorted, managedLayers) : new Map([[0, sorted]]);

    for (const [laneIndex, laneNodes] of groupedByLayer.entries()) {
      laneNodes.forEach((node, rowIndex) => {
        laneByNodeId[node.id] = {
          kind: laneKind,
          laneIndex,
          order: laneOrder[laneKind]
        };
        positionsByNodeId[node.id] = {
          x: laneKind === "managed_object" ? laneX.managed_object + laneIndex * managedObjectLayerGap : laneX[laneKind],
          y: laneBaseY[laneKind] + rowIndex * rowGap
        };
      });
    }
  }

  for (const edge of detail.graphEdges) {
    const priority = classifyEdgePriority(edge, nodeById.get(edge.fromId), nodeById.get(edge.toId));
    edgePriorityByEdgeId[edge.id] = edgeVisual(priority, edge.edgeType, detail.graphLegend);
  }

  return {
    contentBounds: boundsForPositions(positionsByNodeId),
    defaultViewport: { x: 24, y: 36, zoom: 0.9 },
    edgePriorityByEdgeId,
    edgeRouteByEdgeId: edgeRoutes(detail.graphEdges),
    laneByNodeId,
    positionsByNodeId
  };
}

export function classifyEdgePriority(
  edge: ManagedObjectGraphEdge,
  from?: ManagedObjectGraphNode,
  to?: ManagedObjectGraphNode
): ManagedObjectGraphEdgePriority {
  if (edge.edgeType === "managed_object_structural" && from?.type === "managed_object" && to?.type === "managed_object") {
    return "primaryInfluence";
  }

  if (edge.edgeType === "managed_object_structural") {
    return "containedStructural";
  }

  return "downstream";
}

function managedObjectLayers(nodes: ManagedObjectGraphNode[], edges: ManagedObjectGraphEdge[]): Map<string, number> {
  const managedIds = new Set(nodes.filter((node) => node.type === "managed_object").map((node) => node.id));
  const layers = new Map(Array.from(managedIds).map((id) => [id, 0]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const primaryEdges = edges.filter((edge) => classifyEdgePriority(edge, nodeById.get(edge.fromId), nodeById.get(edge.toId)) === "primaryInfluence");

  for (let pass = 0; pass < managedIds.size; pass += 1) {
    let changed = false;

    for (const edge of primaryEdges) {
      const fromLayer = layers.get(edge.fromId) ?? 0;
      const targetLayer = Math.min(fromLayer + 1, 1);
      if ((layers.get(edge.toId) ?? 0) < targetLayer) {
        layers.set(edge.toId, targetLayer);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return layers;
}

function groupNodesByLane(nodes: ManagedObjectGraphNode[]): Record<ManagedObjectGraphLaneKind, ManagedObjectGraphNode[]> {
  return {
    category: nodes.filter((node) => node.type === "category"),
    insight: nodes.filter((node) => node.type === "insight"),
    managed_object: nodes.filter((node) => node.type === "managed_object"),
    metric: nodes.filter((node) => node.type === "metric"),
    workflow: nodes.filter((node) => node.type === "workflow")
  };
}

function groupManagedNodesByLayer(nodes: ManagedObjectGraphNode[], layers: Map<string, number>): Map<number, ManagedObjectGraphNode[]> {
  const grouped = new Map<number, ManagedObjectGraphNode[]>();

  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0;
    const group = grouped.get(layer) ?? [];
    group.push(node);
    grouped.set(layer, group);
  }

  return grouped;
}

function sortLaneNodes(laneKind: ManagedObjectGraphLaneKind, nodes: ManagedObjectGraphNode[]): ManagedObjectGraphNode[] {
  return [...nodes].sort((left, right) => {
    if (laneKind === "workflow") {
      const leftIndex = workflowOrder.indexOf(left.id);
      const rightIndex = workflowOrder.indexOf(right.id);
      return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex) || left.label.localeCompare(right.label);
    }

    return left.label.localeCompare(right.label);
  });
}

function edgeVisual(
  priority: ManagedObjectGraphEdgePriority,
  edgeType: ManagedObjectGraphEdgeType,
  legend: ManagedObjectGraphLegendItem[]
): ManagedObjectGraphEdgeVisual {
  const color = legend.find((item) => item.edgeType === edgeType)?.color ?? "#475569";

  if (priority === "primaryInfluence") {
    return {
      color,
      labelVisible: true,
      markerSize: 12,
      opacity: 0.96,
      priority,
      rank: 3,
      strokeWidth: 3.2
    };
  }

  if (priority === "containedStructural") {
    return {
      color,
      labelVisible: false,
      markerSize: 9,
      opacity: 0.54,
      priority,
      rank: 2,
      strokeWidth: 1.8
    };
  }

  return {
    color,
    labelVisible: false,
    markerSize: 9,
    opacity: 0.46,
    priority,
    rank: 1,
    strokeWidth: edgeType === "workflow_sequence" ? 1.7 : 1.9
  };
}

function edgeRoutes(edges: ManagedObjectGraphEdge[]): Record<string, ManagedObjectGraphEdgeRoute> {
  const groups = new Map<string, ManagedObjectGraphEdge[]>();
  const routes: Record<string, ManagedObjectGraphEdgeRoute> = {};

  for (const edge of edges) {
    const key = `${edge.fromId}->${edge.toId}`;
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const centerIndex = (group.length - 1) / 2;

    group.forEach((edge, index) => {
      const distanceFromCenter = index - centerIndex;
      routes[edge.id] = {
        offset: group.length > 1 ? 22 + Math.abs(distanceFromCenter) * 6 : 20,
        parallelOffset: group.length > 1 ? distanceFromCenter * 10 : 0,
        stepPosition: clamp(0.5 + distanceFromCenter * 0.12, 0.28, 0.72)
      };
    });
  }

  return routes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function boundsForPositions(positionsByNodeId: Record<string, ManagedObjectGraphPoint>): ManagedObjectGraphBounds {
  const positions = Object.values(positionsByNodeId);

  if (positions.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...positions.map((position) => position.x));
  const minY = Math.min(...positions.map((position) => position.y));
  const maxX = Math.max(...positions.map((position) => position.x + nodeWidth));
  const maxY = Math.max(...positions.map((position) => position.y + nodeHeight));

  return {
    height: maxY - minY,
    width: maxX - minX,
    x: minX,
    y: minY
  };
}
