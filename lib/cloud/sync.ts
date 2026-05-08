import { getSupabase } from './supabase';
import { useGenogramStore } from '../store/genogramStore';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { JunctionNode, JunctionEdge } from '../types/junction';
import { Genogram } from '../types/genogram';
import { notify } from '../store/notifications';

/**
 * Cloud sync — minimal "last writer wins" strategy.
 *
 * Tables expected in Supabase (one per entity), each keyed by `id` and tagged
 * with `genogram_id` and `owner` (auth.uid()):
 *
 *   create table genograms      ( id text primary key, owner uuid, ... );
 *   create table people         ( id text primary key, owner uuid, genogram_id text, ... );
 *   create table relationships  ( id text primary key, owner uuid, genogram_id text, ... );
 *   create table junctions      ( id text primary key, owner uuid, genogram_id text, ... );
 *   create table junction_edges ( id text primary key, owner uuid, genogram_id text, ... );
 *
 * RLS policies should restrict select/insert/update/delete to `owner = auth.uid()`.
 *
 * The functions below intentionally serialise the entire local genogram on
 * each sync. That's fine for typical genogram sizes (<500 entities) and
 * keeps the implementation lock-free.
 */

interface RemoteRow {
  id: string;
  data: unknown;
  genogram_id: string;
  owner?: string;
  updated_at: string;
}

function toRow<T extends { id: string }>(
  entity: T,
  genogramId: string,
  owner: string
): RemoteRow {
  return {
    id: entity.id,
    data: entity,
    genogram_id: genogramId,
    owner,
    updated_at: new Date().toISOString(),
  };
}

async function getOwner() {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function pushToCloud(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) {
    notify.error('Cloud sync is not configured.');
    return false;
  }
  const owner = await getOwner();
  if (!owner) {
    notify.error('Sign in first to sync to the cloud.');
    return false;
  }
  const s = useGenogramStore.getState();
  if (!s.currentGenogram) return false;
  const id = s.currentGenogram.id;

  const genogramRow = {
    id: s.currentGenogram.id,
    owner,
    data: s.currentGenogram,
    updated_at: new Date().toISOString(),
  };

  const peopleRows = s.people.map((p) => toRow(p, id, owner));
  const relRows = s.relationships.map((r) => toRow(r, id, owner));
  const junctionRows = s.junctions.map((j) => toRow(j, id, owner));
  const edgeRows = s.junctionEdges.map((e) => toRow(e, id, owner));

  try {
    const ops = await Promise.all([
      sb.from('genograms').upsert(genogramRow),
      sb.from('people').upsert(peopleRows),
      sb.from('relationships').upsert(relRows),
      sb.from('junctions').upsert(junctionRows),
      sb.from('junction_edges').upsert(edgeRows),
    ]);
    const failure = ops.find((r) => r.error);
    if (failure?.error) throw failure.error;
    notify.success('Pushed to cloud.');
    return true;
  } catch (err) {
    console.error('[sync] push failed:', err);
    notify.error(`Cloud push failed: ${(err as Error).message ?? err}`);
    return false;
  }
}

export async function pullFromCloud(): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) {
    notify.error('Cloud sync is not configured.');
    return false;
  }
  const owner = await getOwner();
  if (!owner) {
    notify.error('Sign in first to pull from the cloud.');
    return false;
  }
  const s = useGenogramStore.getState();
  if (!s.currentGenogram) return false;
  const id = s.currentGenogram.id;

  try {
    const [
      { data: gen },
      { data: people },
      { data: rels },
      { data: junctions },
      { data: edges },
    ] = await Promise.all([
      sb.from('genograms').select('data').eq('id', id).maybeSingle(),
      sb.from('people').select('data').eq('genogram_id', id),
      sb.from('relationships').select('data').eq('genogram_id', id),
      sb.from('junctions').select('data').eq('genogram_id', id),
      sb.from('junction_edges').select('data').eq('genogram_id', id),
    ]);

    if (!gen) {
      notify.warning('No cloud copy of this genogram yet — push first.');
      return false;
    }

    const remote = (gen as { data: unknown }).data as Genogram;
    s.setCurrentGenogram({
      ...remote,
      createdAt: new Date(remote.createdAt),
      updatedAt: new Date(remote.updatedAt),
    });

    const reviveRow = <T,>(rows: { data: unknown }[] | null): T[] =>
      rows ? rows.map((r) => r.data as T) : [];

    s.hydrate({
      people: reviveRow<Person>(people),
      relationships: reviveRow<Relationship>(rels),
      junctions: reviveRow<JunctionNode>(junctions),
      junctionEdges: reviveRow<JunctionEdge>(edges),
    });
    notify.success('Pulled from cloud.');
    return true;
  } catch (err) {
    console.error('[sync] pull failed:', err);
    notify.error(`Cloud pull failed: ${(err as Error).message ?? err}`);
    return false;
  }
}

export async function signInWithEmailLink(email: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) {
    notify.error('Cloud sync is not configured.');
    return false;
  }
  const { error } = await sb.auth.signInWithOtp({ email });
  if (error) {
    notify.error(`Sign-in failed: ${error.message}`);
    return false;
  }
  notify.success('Magic link sent — check your email.');
  return true;
}

export async function signOut() {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  notify.success('Signed out.');
}
