import { Person } from '../types/person';
import { Relationship, RelationshipType } from '../types/relationship';

const PARENT_TYPES: ReadonlySet<RelationshipType> = new Set([
  'biological-parent',
  'adoptive-parent',
  'foster-parent',
  'step-parent',
  'guardian',
]);

const COUPLE_TYPES: ReadonlySet<RelationshipType> = new Set([
  'spouse',
  'partner',
  'divorced',
  'separated',
]);

interface LayoutOptions {
  /** Horizontal spacing between siblings, in flow units. */
  hSpacing?: number;
  /** Vertical spacing between generations. */
  vSpacing?: number;
  /** Top-left corner of the layout. */
  originX?: number;
  originY?: number;
}

interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Compute generation lanes from parent-style relationships, then place
 * everyone in those lanes. Spouses are kept adjacent. Disconnected people
 * are placed in the deepest generation discovered.
 */
export function computeAutoLayout(
  people: Person[],
  relationships: Relationship[],
  opts: LayoutOptions = {}
): LayoutResult {
  const hSpacing = opts.hSpacing ?? 140;
  const vSpacing = opts.vSpacing ?? 160;
  const originX = opts.originX ?? 0;
  const originY = opts.originY ?? 0;

  const positions = new Map<string, { x: number; y: number }>();
  if (people.length === 0) return { positions };

  // Build child -> parents and parent -> children
  const childToParents = new Map<string, string[]>();
  const parentToChildren = new Map<string, string[]>();
  for (const r of relationships) {
    if (!PARENT_TYPES.has(r.type)) continue;
    const parent = r.person1Id;
    const child = r.person2Id;
    childToParents.set(child, [...(childToParents.get(child) ?? []), parent]);
    parentToChildren.set(parent, [
      ...(parentToChildren.get(parent) ?? []),
      child,
    ]);
  }

  // Compute generation depth for each person: roots = no parents, else 1 +
  // max(parents). Use memoised DFS with cycle protection.
  const generation = new Map<string, number>();
  const visiting = new Set<string>();

  function depth(id: string): number {
    const cached = generation.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // break cycles defensively
    visiting.add(id);
    const parents = childToParents.get(id) ?? [];
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(depth));
    visiting.delete(id);
    generation.set(id, d);
    return d;
  }

  for (const p of people) depth(p.id);

  // Couple groupings: union-find lite.
  const coupleOf = new Map<string, string>();
  for (const r of relationships) {
    if (!COUPLE_TYPES.has(r.type)) continue;
    if (!coupleOf.has(r.person1Id)) {
      coupleOf.set(r.person1Id, r.person2Id);
    }
    if (!coupleOf.has(r.person2Id)) {
      coupleOf.set(r.person2Id, r.person1Id);
    }
  }

  // Group people by generation; within a generation, keep stable insertion
  // order (createdAt asc) but pull spouses adjacent.
  const byGen = new Map<number, string[]>();
  const sortedPeople = [...people].sort((a, b) => {
    const ad = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
    const bd = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
    return ad - bd;
  });

  for (const p of sortedPeople) {
    const g = generation.get(p.id) ?? 0;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p.id);
  }

  // Within each generation, reorder so partners sit next to each other.
  for (const [g, ids] of byGen) {
    const order: string[] = [];
    const placed = new Set<string>();
    for (const id of ids) {
      if (placed.has(id)) continue;
      order.push(id);
      placed.add(id);
      const partner = coupleOf.get(id);
      if (partner && !placed.has(partner) && ids.includes(partner)) {
        order.push(partner);
        placed.add(partner);
      }
    }
    byGen.set(g, order);
  }

  // Place each generation as a horizontal row centred around 0.
  const generations = [...byGen.keys()].sort((a, b) => a - b);
  for (const g of generations) {
    const ids = byGen.get(g)!;
    const totalWidth = (ids.length - 1) * hSpacing;
    ids.forEach((id, i) => {
      const x = originX + i * hSpacing - totalWidth / 2;
      const y = originY + g * vSpacing;
      positions.set(id, { x, y });
    });
  }

  return { positions };
}
