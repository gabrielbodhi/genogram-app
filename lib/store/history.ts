import { create } from 'zustand';
import { useGenogramStore } from './genogramStore';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { JunctionNode, JunctionEdge } from '../types/junction';

interface Snapshot {
  people: Person[];
  relationships: Relationship[];
  junctions: JunctionNode[];
  junctionEdges: JunctionEdge[];
}

interface HistoryState {
  past: Snapshot[];
  future: Snapshot[];
  /** Hard cap on retained snapshots so memory stays bounded. */
  limit: number;
  /** Set to true while applying an undo/redo so the recorder ignores it. */
  applying: boolean;
  push: (snap: Snapshot) => void;
  setApplying: (v: boolean) => void;
  reset: () => void;
}

export const useHistory = create<HistoryState>((set) => ({
  past: [],
  future: [],
  limit: 100,
  applying: false,
  push: (snap) =>
    set((s) => {
      const past = [...s.past, snap];
      if (past.length > s.limit) past.splice(0, past.length - s.limit);
      return { past, future: [] };
    }),
  setApplying: (v) => set({ applying: v }),
  reset: () => set({ past: [], future: [] }),
}));

function takeSnapshot(): Snapshot {
  const s = useGenogramStore.getState();
  return {
    people: s.people,
    relationships: s.relationships,
    junctions: s.junctions,
    junctionEdges: s.junctionEdges,
  };
}

function applySnapshot(snap: Snapshot) {
  const { hydrate } = useGenogramStore.getState();
  hydrate(snap);
}

let initialised = false;
let lastSnap: Snapshot | null = null;

/**
 * Subscribe to the genogram store and record a snapshot whenever entity arrays
 * change (excluding selection-only changes). Idempotent; safe to call from a
 * top-level effect.
 */
export function initHistoryRecorder() {
  if (initialised) return () => {};
  initialised = true;
  lastSnap = takeSnapshot();

  const unsubscribe = useGenogramStore.subscribe((state, prev) => {
    if (useHistory.getState().applying) return;

    const changed =
      state.people !== prev.people ||
      state.relationships !== prev.relationships ||
      state.junctions !== prev.junctions ||
      state.junctionEdges !== prev.junctionEdges;
    if (!changed) return;

    if (lastSnap) {
      useHistory.getState().push(lastSnap);
    }
    lastSnap = {
      people: state.people,
      relationships: state.relationships,
      junctions: state.junctions,
      junctionEdges: state.junctionEdges,
    };
  });

  return () => {
    initialised = false;
    unsubscribe();
  };
}

export function useHistoryActions() {
  const undo = () => {
    const { past, future, setApplying } = useHistory.getState();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = takeSnapshot();
    setApplying(true);
    try {
      applySnapshot(previous);
    } finally {
      setApplying(false);
    }
    useHistory.setState({
      past: past.slice(0, -1),
      future: [current, ...future],
    });
    lastSnap = previous;
  };

  const redo = () => {
    const { past, future, setApplying } = useHistory.getState();
    if (future.length === 0) return;
    const next = future[0];
    const current = takeSnapshot();
    setApplying(true);
    try {
      applySnapshot(next);
    } finally {
      setApplying(false);
    }
    useHistory.setState({
      past: [...past, current],
      future: future.slice(1),
    });
    lastSnap = next;
  };

  return { undo, redo };
}

/**
 * Returns whether undo/redo is possible. Implemented as two primitive
 * selectors — returning a fresh object from a Zustand v5 selector causes the
 * snapshot identity to change every render and trips React's max-update-depth
 * protection.
 */
export function useUndoRedoCounts() {
  const canUndo = useHistory((s) => s.past.length > 0);
  const canRedo = useHistory((s) => s.future.length > 0);
  return { canUndo, canRedo };
}
