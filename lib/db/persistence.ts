import { useEffect, useRef } from 'react';
import { getDb } from './local';
import { useGenogramStore } from '../store/genogramStore';
import { notify } from '../store/notifications';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { Genogram } from '../types/genogram';
import { JunctionNode, JunctionEdge } from '../types/junction';

const REVIVE_DATE_FIELDS = [
  'dateOfBirth',
  'dateOfDeath',
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
] as const;

function reviveDates<T extends object>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>;
  for (const field of REVIVE_DATE_FIELDS) {
    const v = out[field];
    if (typeof v === 'string') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) out[field] = d;
    }
  }
  return out as T;
}

/**
 * Ensure at least one Genogram exists, return the one to load. If a target id
 * is supplied, prefer it; otherwise the most recently updated genogram wins.
 */
async function resolveActiveGenogram(targetId?: string): Promise<Genogram> {
  const db = getDb();
  const all = await db.genograms.toArray();
  const revived = all.map(reviveDates);

  if (targetId) {
    const match = revived.find((g) => g.id === targetId);
    if (match) return match;
  }

  if (revived.length > 0) {
    return revived
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
  }

  // No genograms yet — bootstrap one.
  const fresh: Genogram = {
    id: `genogram-${Date.now()}`,
    title: 'My genogram',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await db.genograms.add(fresh);
  return fresh;
}

export async function loadGenograms(): Promise<Genogram[]> {
  if (typeof window === 'undefined') return [];
  try {
    const db = getDb();
    const all = await db.genograms.toArray();
    return all.map(reviveDates);
  } catch (err) {
    console.error('[persistence] Failed to list genograms:', err);
    notify.error(
      `Could not list genograms: ${(err as Error).message ?? err}`
    );
    return [];
  }
}

/**
 * Load entities for a given genogram into the Zustand store. If no id is
 * supplied, the most recently updated genogram is picked.
 */
export async function loadFromDb(targetGenogramId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const db = getDb();
    const active = await resolveActiveGenogram(targetGenogramId);

    const [people, relationships, junctions, junctionEdges, allGenograms] =
      await Promise.all([
        db.people.where('genogramId').equals(active.id).toArray(),
        db.relationships.where('genogramId').equals(active.id).toArray(),
        db.junctions.where('genogramId').equals(active.id).toArray(),
        db.junctionEdges.where('genogramId').equals(active.id).toArray(),
        db.genograms.toArray(),
      ]);

    const peopleR = people.map(reviveDates);
    const relsR = relationships.map(reviveDates);
    const junctionsR = junctions.map(reviveDates);
    const junctionEdgesR = junctionEdges.map(reviveDates);

    const store = useGenogramStore.getState();
    store.setGenogramsList(allGenograms.map(reviveDates));
    store.hydrate({
      currentGenogram: active,
      people: peopleR,
      relationships: relsR,
      junctions: junctionsR,
      junctionEdges: junctionEdgesR,
    });

    // Seed the diff tracker so the very first save after load doesn't rewrite
    // the whole table.
    lastSavedByGenogram.set(active.id, {
      genogramId: active.id,
      people: snapshotMap(peopleR),
      relationships: snapshotMap(relsR),
      junctions: snapshotMap(junctionsR),
      junctionEdges: snapshotMap(junctionEdgesR),
    });
  } catch (err) {
    console.error('[persistence] Failed to load from IndexedDB:', err);
    notify.error(
      `Could not load saved data from this browser: ${(err as Error).message ?? err}`
    );
  }
}

interface SavedSnapshot {
  genogramId: string;
  people: Map<string, Person>;
  relationships: Map<string, Relationship>;
  junctions: Map<string, JunctionNode>;
  junctionEdges: Map<string, JunctionEdge>;
}

/** Last-known on-disk state per genogram, used to compute diffs. */
const lastSavedByGenogram = new Map<string, SavedSnapshot>();

function snapshotMap<T extends { id: string }>(arr: T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const item of arr) m.set(item.id, item);
  return m;
}

function diffArrays<T extends { id: string }>(
  prev: Map<string, T> | undefined,
  next: T[]
): { upserts: T[]; deletes: string[] } {
  const upserts: T[] = [];
  const seen = new Set<string>();
  for (const item of next) {
    seen.add(item.id);
    const before = prev?.get(item.id);
    // Identity comparison is enough because the store always replaces objects
    // when a field changes (immutable update style).
    if (!before || before !== item) upserts.push(item);
  }
  const deletes: string[] = [];
  if (prev) {
    for (const id of prev.keys()) {
      if (!seen.has(id)) deletes.push(id);
    }
  }
  return { upserts, deletes };
}

/**
 * Persist the current entity arrays for a genogram. Uses bulkPut/bulkDelete
 * against a tracked diff so we don't rewrite the whole table on each save.
 */
async function saveSnapshot(snapshot: {
  genogramId: string;
  people: Person[];
  relationships: Relationship[];
  junctions: JunctionNode[];
  junctionEdges: JunctionEdge[];
}) {
  if (typeof window === 'undefined') return;
  const db = getDb();
  const id = snapshot.genogramId;
  const last = lastSavedByGenogram.get(id);

  const peopleDiff = diffArrays(last?.people, snapshot.people);
  const relsDiff = diffArrays(last?.relationships, snapshot.relationships);
  const junctionsDiff = diffArrays(last?.junctions, snapshot.junctions);
  const junctionEdgesDiff = diffArrays(last?.junctionEdges, snapshot.junctionEdges);

  await db.transaction(
    'rw',
    [db.genograms, db.people, db.relationships, db.junctions, db.junctionEdges],
    async () => {
      const tagPeople = peopleDiff.upserts.map((p) => ({ ...p, genogramId: id }));
      const tagRels = relsDiff.upserts.map((r) => ({ ...r, genogramId: id }));
      const tagJ = junctionsDiff.upserts.map((j) => ({ ...j, genogramId: id }));
      const tagJE = junctionEdgesDiff.upserts.map((e) => ({ ...e, genogramId: id }));

      await Promise.all([
        tagPeople.length ? db.people.bulkPut(tagPeople) : Promise.resolve(),
        tagRels.length ? db.relationships.bulkPut(tagRels) : Promise.resolve(),
        tagJ.length ? db.junctions.bulkPut(tagJ) : Promise.resolve(),
        tagJE.length ? db.junctionEdges.bulkPut(tagJE) : Promise.resolve(),
        peopleDiff.deletes.length
          ? db.people.bulkDelete(peopleDiff.deletes)
          : Promise.resolve(),
        relsDiff.deletes.length
          ? db.relationships.bulkDelete(relsDiff.deletes)
          : Promise.resolve(),
        junctionsDiff.deletes.length
          ? db.junctions.bulkDelete(junctionsDiff.deletes)
          : Promise.resolve(),
        junctionEdgesDiff.deletes.length
          ? db.junctionEdges.bulkDelete(junctionEdgesDiff.deletes)
          : Promise.resolve(),
      ]);

      await db.genograms
        .where('id')
        .equals(id)
        .modify({ updatedAt: new Date() });
    }
  );

  // Update the in-memory record of "what's on disk".
  lastSavedByGenogram.set(id, {
    genogramId: id,
    people: snapshotMap(snapshot.people),
    relationships: snapshotMap(snapshot.relationships),
    junctions: snapshotMap(snapshot.junctions),
    junctionEdges: snapshotMap(snapshot.junctionEdges),
  });
}

export async function persistGenogramMeta(genogram: Genogram) {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.genograms.put(genogram);
}

export async function deleteGenogramFromDb(id: string) {
  if (typeof window === 'undefined') return;
  const db = getDb();
  await db.transaction(
    'rw',
    [db.genograms, db.people, db.relationships, db.junctions, db.junctionEdges],
    async () => {
      await Promise.all([
        db.genograms.delete(id),
        db.people.where('genogramId').equals(id).delete(),
        db.relationships.where('genogramId').equals(id).delete(),
        db.junctions.where('genogramId').equals(id).delete(),
        db.junctionEdges.where('genogramId').equals(id).delete(),
      ]);
    }
  );
}

const TAB_CHANNEL = 'genogram-tab-coordination';
const TAB_ID =
  typeof window === 'undefined'
    ? ''
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * React hook: loads from Dexie on mount and persists changes (debounced) on
 * every store update. Coordinates across browser tabs and scopes saves to
 * the currently-active genogram.
 */
export function useDbPersistence(opts: { debounceMs?: number } = {}) {
  const debounceMs = opts.debounceMs ?? 300;
  const hydratedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveTabRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    (async () => {
      await loadFromDb();
      if (!cancelled) hydratedRef.current = true;
    })();

    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(TAB_CHANNEL)
        : null;

    if (channel) {
      channel.postMessage({ type: 'hello', tabId: TAB_ID });
      channel.onmessage = (e: MessageEvent) => {
        const msg = e.data as { type?: string; tabId?: string };
        if (!msg || msg.tabId === TAB_ID) return;
        if (msg.type === 'hello') {
          if (isActiveTabRef.current) {
            isActiveTabRef.current = false;
            notify.warning(
              'Another tab opened this app and now owns local saving. Refresh this tab to take over again.',
              0
            );
          }
        }
      };
    }

    const unsubscribe = useGenogramStore.subscribe((state, prev) => {
      if (!hydratedRef.current) return;
      if (!isActiveTabRef.current) return;

      const entitiesChanged =
        state.people !== prev.people ||
        state.relationships !== prev.relationships ||
        state.junctions !== prev.junctions ||
        state.junctionEdges !== prev.junctionEdges;
      const metaChanged =
        state.currentGenogram !== prev.currentGenogram ||
        state.genograms !== prev.genograms;

      if (!entitiesChanged && !metaChanged) return;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const s = useGenogramStore.getState();
        if (!s.currentGenogram) return;

        const entitySave = saveSnapshot({
          genogramId: s.currentGenogram.id,
          people: s.people,
          relationships: s.relationships,
          junctions: s.junctions,
          junctionEdges: s.junctionEdges,
        });
        const metaSave = persistGenogramMeta(s.currentGenogram);

        Promise.all([entitySave, metaSave]).catch((err: unknown) => {
          console.error('[persistence] Save failed:', err);
          const msg = (err as Error)?.message ?? String(err);
          if (/quota/i.test(msg)) {
            notify.error(
              'Browser storage is full. Export to JSON and clear unused data to keep saving.'
            );
          } else {
            notify.error(`Could not save changes locally: ${msg}`);
          }
        });
      }, debounceMs);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      channel?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [debounceMs]);
}
