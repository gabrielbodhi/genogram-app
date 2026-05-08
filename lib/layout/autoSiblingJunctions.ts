import type { Node, Edge } from 'reactflow';
import type { Person } from '../types/person';
import type { Relationship, RelationshipType } from '../types/relationship';

/**
 * Parent-style relationship types — these are what we cluster on to detect
 * a sibling group. We use the *full set* of parent IDs (regardless of which
 * parent type each one is) as the grouping key, so legal/adoptive/biological
 * siblings all collapse into the same sibling line as long as they share an
 * identical parent set.
 */
const PARENT_TYPES: ReadonlySet<RelationshipType> = new Set([
  'biological-parent',
  'adoptive-parent',
  'foster-parent',
  'step-parent',
  'guardian',
]);

export interface AutoSiblingResult {
  /** Synthetic junction nodes to add to the canvas. */
  nodes: Node[];
  /** Synthetic junction edges (parents → junction → children). */
  edges: Edge[];
  /**
   * IDs of relationships whose direct parent → child line should be hidden
   * because they're being represented through a junction instead.
   */
  coveredRelationshipIds: Set<string>;
}

/**
 * Derive synthetic sibling-line junctions from the relationships graph.
 *
 * Genogram convention: when 2+ children share the *same* parent set, they
 * should be drawn off a horizontal sibling line that hangs off a single
 * vertical line going up to the parents — not as N independent parent → child
 * lines that fan out and crisscross.
 *
 * This is a render-time derivation: nothing here is persisted. The output
 * nodes/edges have synthetic IDs (`auto-sib-...`) and the function tells the
 * caller which relationships to suppress so they don't double up with the
 * routed line.
 */
export function computeAutoSiblingJunctions(
  people: Person[],
  relationships: Relationship[]
): AutoSiblingResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const coveredRelationshipIds = new Set<string>();

  if (relationships.length === 0 || people.length === 0) {
    return { nodes, edges, coveredRelationshipIds };
  }

  // Build child -> set(parentIds) using all parent-style relationship types.
  const childToParents = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (!PARENT_TYPES.has(rel.type)) continue;
    let parents = childToParents.get(rel.person2Id);
    if (!parents) {
      parents = new Set();
      childToParents.set(rel.person2Id, parents);
    }
    parents.add(rel.person1Id);
  }

  // Group children by their parent-set fingerprint so we can find
  // sibling groups (children sharing an identical parent set).
  const groupKeyToChildren = new Map<string, string[]>();
  for (const [childId, parentSet] of childToParents) {
    if (parentSet.size === 0) continue;
    const key = [...parentSet].sort().join('|');
    let list = groupKeyToChildren.get(key);
    if (!list) {
      list = [];
      groupKeyToChildren.set(key, list);
    }
    list.push(childId);
  }

  const personPosById = new Map(
    people.map((p) => [p.id, p.position ?? { x: 0, y: 0 }])
  );

  for (const [parentKey, childIds] of groupKeyToChildren) {
    if (childIds.length < 2) continue; // single child needs no sibling line

    const parentIds = parentKey.split('|').filter(Boolean);
    if (parentIds.length === 0) continue;

    const parentPositions = parentIds
      .map((pid) => personPosById.get(pid))
      .filter((p): p is { x: number; y: number } => Boolean(p));
    const childPositions = childIds
      .map((cid) => personPosById.get(cid))
      .filter((p): p is { x: number; y: number } => Boolean(p));
    if (parentPositions.length === 0 || childPositions.length === 0) continue;

    const childAvgX =
      childPositions.reduce((s, p) => s + p.x, 0) / childPositions.length;
    const parentAvgY =
      parentPositions.reduce((s, p) => s + p.y, 0) / parentPositions.length;
    const childAvgY =
      childPositions.reduce((s, p) => s + p.y, 0) / childPositions.length;

    // Place the junction halfway between the parents and the kids vertically,
    // and centred horizontally above the children. Smooth-step routing then
    // produces a clean inverted-T sibling line.
    const junctionPos = {
      x: childAvgX,
      y: (parentAvgY + childAvgY) / 2,
    };

    const junctionId = `auto-sib-${parentIds.slice().sort().join('-')}`;

    nodes.push({
      id: junctionId,
      type: 'junction',
      position: junctionPos,
      data: { id: junctionId },
      draggable: false,
      selectable: false,
      focusable: false,
    });

    for (const parentId of parentIds) {
      edges.push({
        id: `auto-edge-${parentId}-to-${junctionId}`,
        source: parentId,
        target: junctionId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'junction-edge',
        focusable: false,
        deletable: false,
      });
    }

    for (const childId of childIds) {
      edges.push({
        id: `auto-edge-${junctionId}-to-${childId}`,
        source: junctionId,
        target: childId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'junction-edge',
        focusable: false,
        deletable: false,
      });
    }

    // Hide the direct parent → child relationship lines that this junction
    // is now visually representing.
    const parentIdSet = new Set(parentIds);
    const childIdSet = new Set(childIds);
    for (const rel of relationships) {
      if (!PARENT_TYPES.has(rel.type)) continue;
      if (
        parentIdSet.has(rel.person1Id) &&
        childIdSet.has(rel.person2Id)
      ) {
        coveredRelationshipIds.add(rel.id);
      }
    }
  }

  return { nodes, edges, coveredRelationshipIds };
}
