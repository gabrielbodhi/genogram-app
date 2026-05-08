import Dexie, { Table } from 'dexie';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { Genogram } from '../types/genogram';
import { JunctionNode, JunctionEdge } from '../types/junction';

export class GenogramDatabase extends Dexie {
  genograms!: Table<Genogram>;
  people!: Table<Person>;
  relationships!: Table<Relationship>;
  junctions!: Table<JunctionNode>;
  junctionEdges!: Table<JunctionEdge>;

  constructor() {
    super('GenogramDB');

    // v1: original schema
    this.version(1).stores({
      genograms: 'id, title, createdAt, updatedAt',
      people: 'id, firstName, lastName, dateOfBirth',
      relationships: 'id, person1Id, person2Id, type',
    });

    // v2: junctions + junctionEdges as first-class entities
    this.version(2).stores({
      genograms: 'id, title, createdAt, updatedAt',
      people: 'id, firstName, lastName, dateOfBirth',
      relationships: 'id, person1Id, person2Id, type',
      junctions: 'id',
      junctionEdges: 'id, source, target',
    });

    // v3: tag entities with their owning genogramId so we can support
    // multiple genograms in one Dexie database. The new index makes
    // `where('genogramId').equals(...)` queries fast.
    this.version(3)
      .stores({
        genograms: 'id, title, createdAt, updatedAt',
        people: 'id, genogramId, firstName, lastName, dateOfBirth',
        relationships: 'id, genogramId, person1Id, person2Id, type',
        junctions: 'id, genogramId',
        junctionEdges: 'id, genogramId, source, target',
      })
      .upgrade(async (tx) => {
        // Backfill any existing entities into a default genogram so users
        // upgrading from v2 don't lose their work.
        const defaultId = `genogram-${Date.now()}`;
        const now = new Date();
        const genogramTable = tx.table<Genogram>('genograms');
        const existingDefault = (await genogramTable.toArray())[0];
        const targetId = existingDefault?.id ?? defaultId;

        if (!existingDefault) {
          await genogramTable.add({
            id: defaultId,
            title: 'My genogram',
            createdAt: now,
            updatedAt: now,
          });
        }

        for (const tableName of [
          'people',
          'relationships',
          'junctions',
          'junctionEdges',
        ] as const) {
          const t = tx.table(tableName);
          await t.toCollection().modify((row: Record<string, unknown>) => {
            if (row && row.genogramId === undefined) {
              row.genogramId = targetId;
            }
          });
        }
      });
  }
}

let dbInstance: GenogramDatabase | null = null;

export const getDb = (): GenogramDatabase => {
  if (typeof window === 'undefined') {
    throw new Error('Database can only be accessed in the browser');
  }
  if (!dbInstance) {
    dbInstance = new GenogramDatabase();
  }
  return dbInstance;
};

export const db = new Proxy({} as GenogramDatabase, {
  get(_target, prop) {
    return getDb()[prop as keyof GenogramDatabase];
  },
  set(_target, prop, value) {
    (getDb() as unknown as Record<string | symbol, unknown>)[
      prop as string | symbol
    ] = value;
    return true;
  },
});
