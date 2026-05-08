import { create } from 'zustand';
import { Person } from '../types/person';
import { Relationship, RelationshipType } from '../types/relationship';
import { Genogram } from '../types/genogram';
import { JunctionNode, JunctionEdge } from '../types/junction';
import { notify } from './notifications';

const PARENT_TYPES = new Set<RelationshipType>([
  'biological-parent',
  'adoptive-parent',
  'foster-parent',
  'step-parent',
  'guardian',
]);

function buildChildToParents(rels: Relationship[]): Map<string, string[]> {
  // For parent-style relationships we model person1 as the *parent* and
  // person2 as the *child* (matches how the canvas creates them: source =
  // bottom of parent -> target = top of child).
  const map = new Map<string, string[]>();
  for (const r of rels) {
    if (!PARENT_TYPES.has(r.type)) continue;
    const parents = map.get(r.person2Id) ?? [];
    parents.push(r.person1Id);
    map.set(r.person2Id, parents);
  }
  return map;
}

function wouldIntroduceCycle(
  rels: Relationship[],
  newParentId: string,
  newChildId: string
): boolean {
  if (newParentId === newChildId) return true;
  const childToParents = buildChildToParents(rels);
  // Walk up from the proposed parent and see if we ever reach the child.
  const stack = [newParentId];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop() as string;
    if (id === newChildId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const parents = childToParents.get(id);
    if (parents) stack.push(...parents);
  }
  return false;
}

interface GenogramState {
  /** Metadata for all known genograms (loaded from Dexie at startup). */
  genograms: Genogram[];
  /** The genogram currently being edited. Entities below all belong to it. */
  currentGenogram: Genogram | null;

  people: Person[];
  relationships: Relationship[];
  junctions: JunctionNode[];
  junctionEdges: JunctionEdge[];
  selectedPersonId: string | null;
  selectedRelationshipId: string | null;

  /** Replace the active-genogram pointer (does not touch entity arrays). */
  setCurrentGenogram: (genogram: Genogram | null) => void;
  /** Replace the cached list of genogram metadata. */
  setGenogramsList: (genograms: Genogram[]) => void;
  /** Insert or update a genogram in the cached list. */
  upsertGenogram: (genogram: Genogram) => void;
  /** Remove a genogram from the cached list. */
  removeGenogram: (id: string) => void;

  /** Add a new person to the active genogram. */
  addPerson: (person: Person) => void;
  /** Patch a person by id; only changed fields are merged. */
  updatePerson: (id: string, updates: Partial<Person>) => void;
  /** Delete a person; cascades to remove their relationships. */
  deletePerson: (id: string) => void;

  /** Add a relationship after running self/duplicate/cycle guards. */
  addRelationship: (relationship: Relationship) => void;
  /** Patch a relationship by id. */
  updateRelationship: (id: string, updates: Partial<Relationship>) => void;
  /** Delete a relationship and clear its selection if needed. */
  deleteRelationship: (id: string) => void;

  /** Add a junction (anchor point used to route group/sibling edges). */
  addJunction: (junction: JunctionNode) => void;
  /** Patch a junction by id (typically just its position). */
  updateJunction: (id: string, updates: Partial<JunctionNode>) => void;
  /** Delete a junction; cascades to remove its junction-edges. */
  deleteJunction: (id: string) => void;

  /** Add a junction-edge (an edge whose source or target is a junction). */
  addJunctionEdge: (edge: JunctionEdge) => void;
  /** Delete a junction-edge. */
  deleteJunctionEdge: (id: string) => void;

  /** Mark a person as selected; clears any other selection. */
  setSelectedPerson: (id: string | null) => void;
  /** Mark a relationship as selected; clears any other selection. */
  setSelectedRelationship: (id: string | null) => void;
  /** Clear every kind of selection. */
  clearSelection: () => void;

  /**
   * Bulk-replace state from a snapshot (persistence / JSON import). Only
   * supplied fields are replaced; the rest are kept.
   */
  hydrate: (state: {
    people?: Person[];
    relationships?: Relationship[];
    junctions?: JunctionNode[];
    junctionEdges?: JunctionEdge[];
    currentGenogram?: Genogram | null;
  }) => void;
  /** Wipe all entity arrays for the active genogram. */
  reset: () => void;
}

export const useGenogramStore = create<GenogramState>((set) => ({
  genograms: [],
  currentGenogram: null,
  people: [],
  relationships: [],
  junctions: [],
  junctionEdges: [],
  selectedPersonId: null,
  selectedRelationshipId: null,

  setCurrentGenogram: (genogram) => set({ currentGenogram: genogram }),
  setGenogramsList: (genograms) => set({ genograms }),
  upsertGenogram: (genogram) =>
    set((state) => {
      const idx = state.genograms.findIndex((g) => g.id === genogram.id);
      const next = state.genograms.slice();
      if (idx === -1) next.push(genogram);
      else next[idx] = genogram;
      return { genograms: next };
    }),
  removeGenogram: (id) =>
    set((state) => ({ genograms: state.genograms.filter((g) => g.id !== id) })),

  addPerson: (person) =>
    set((state) => ({
      people: [
        ...state.people,
        person.genogramId
          ? person
          : { ...person, genogramId: state.currentGenogram?.id },
      ],
    })),

  updatePerson: (id, updates) =>
    set((state) => ({
      people: state.people.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  // Cascade: when a person is deleted, drop any relationships that reference them.
  deletePerson: (id) =>
    set((state) => {
      const removedRelIds = new Set(
        state.relationships
          .filter((r) => r.person1Id === id || r.person2Id === id)
          .map((r) => r.id)
      );
      return {
        people: state.people.filter((p) => p.id !== id),
        relationships: state.relationships.filter(
          (r) => r.person1Id !== id && r.person2Id !== id
        ),
        selectedPersonId:
          state.selectedPersonId === id ? null : state.selectedPersonId,
        selectedRelationshipId:
          state.selectedRelationshipId &&
          removedRelIds.has(state.selectedRelationshipId)
            ? null
            : state.selectedRelationshipId,
      };
    }),

  addRelationship: (relationship) =>
    set((state) => {
      if (relationship.person1Id === relationship.person2Id) {
        notify.warning('A person cannot have a relationship with themselves.');
        return state;
      }

      const isDuplicate = state.relationships.some(
        (rel) =>
          (rel.person1Id === relationship.person1Id &&
            rel.person2Id === relationship.person2Id) ||
          (rel.person1Id === relationship.person2Id &&
            rel.person2Id === relationship.person1Id)
      );
      if (isDuplicate) {
        notify.warning('Those two people are already connected.');
        return state;
      }

      // Cycle / duplicate-parent guards apply only to parent-style links.
      if (PARENT_TYPES.has(relationship.type)) {
        const existingParents = state.relationships.filter(
          (r) =>
            PARENT_TYPES.has(r.type) && r.person2Id === relationship.person2Id
        );
        if (
          existingParents.some((r) => r.person1Id === relationship.person1Id)
        ) {
          notify.warning('That person is already recorded as a parent.');
          return state;
        }

        if (
          wouldIntroduceCycle(
            state.relationships,
            relationship.person1Id,
            relationship.person2Id
          )
        ) {
          notify.warning(
            'That parent link would create a circular ancestry chain.'
          );
          return state;
        }
      }

      const tagged = relationship.genogramId
        ? relationship
        : { ...relationship, genogramId: state.currentGenogram?.id };
      return { relationships: [...state.relationships, tagged] };
    }),

  updateRelationship: (id, updates) =>
    set((state) => ({
      relationships: state.relationships.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),

  deleteRelationship: (id) =>
    set((state) => ({
      relationships: state.relationships.filter((r) => r.id !== id),
      selectedRelationshipId:
        state.selectedRelationshipId === id
          ? null
          : state.selectedRelationshipId,
    })),

  addJunction: (junction) =>
    set((state) => ({
      junctions: [
        ...state.junctions,
        junction.genogramId
          ? junction
          : { ...junction, genogramId: state.currentGenogram?.id },
      ],
    })),

  updateJunction: (id, updates) =>
    set((state) => ({
      junctions: state.junctions.map((j) =>
        j.id === id ? { ...j, ...updates } : j
      ),
    })),

  // Cascade: when a junction is deleted, drop any junction edges that reference it.
  deleteJunction: (id) =>
    set((state) => ({
      junctions: state.junctions.filter((j) => j.id !== id),
      junctionEdges: state.junctionEdges.filter(
        (e) => e.source !== id && e.target !== id
      ),
    })),

  addJunctionEdge: (edge) =>
    set((state) => ({
      junctionEdges: [
        ...state.junctionEdges,
        edge.genogramId
          ? edge
          : { ...edge, genogramId: state.currentGenogram?.id },
      ],
    })),

  deleteJunctionEdge: (id) =>
    set((state) => ({
      junctionEdges: state.junctionEdges.filter((e) => e.id !== id),
    })),

  setSelectedPerson: (id) =>
    set({ selectedPersonId: id, selectedRelationshipId: null }),

  setSelectedRelationship: (id) =>
    set({ selectedRelationshipId: id, selectedPersonId: null }),

  clearSelection: () =>
    set({ selectedPersonId: null, selectedRelationshipId: null }),

  hydrate: (snapshot) =>
    set((state) => ({
      people: snapshot.people ?? state.people,
      relationships: snapshot.relationships ?? state.relationships,
      junctions: snapshot.junctions ?? state.junctions,
      junctionEdges: snapshot.junctionEdges ?? state.junctionEdges,
      currentGenogram:
        snapshot.currentGenogram !== undefined
          ? snapshot.currentGenogram
          : state.currentGenogram,
    })),

  reset: () =>
    set({
      currentGenogram: null,
      people: [],
      relationships: [],
      junctions: [],
      junctionEdges: [],
      selectedPersonId: null,
      selectedRelationshipId: null,
    }),
}));
