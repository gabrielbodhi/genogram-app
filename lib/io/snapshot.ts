import { z } from 'zod';
import { Person } from '../types/person';
import { Relationship } from '../types/relationship';
import { JunctionNode, JunctionEdge } from '../types/junction';

/**
 * Current export schema version. Bump whenever the on-disk shape changes in
 * a way that requires migration.
 */
export const CURRENT_SNAPSHOT_VERSION = 2 as const;

const dateLike = z.preprocess((v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return v;
}, z.date());

const optionalDate = dateLike.optional();

const positionSchema = z
  .object({ x: z.number(), y: z.number() })
  .optional();

const personSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  middleName: z.string().optional(),
  lastName: z.string(),
  preferredName: z.string().optional(),
  dateOfBirth: optionalDate,
  dateOfDeath: optionalDate,
  age: z.number().optional(),
  gender: z.enum(['male', 'female', 'non-binary', 'other', 'unknown']),
  vitalStatus: z.enum(['alive', 'deceased', 'unknown']),
  tribalAffiliation: z.array(z.string()).optional(),
  culturalIdentity: z.array(z.string()).optional(),
  tribalRoles: z.array(z.string()).optional(),
  indigenousHeritage: z.string().optional(),
  medicalConditions: z.array(z.string()).optional(),
  mentalHealthConditions: z.array(z.string()).optional(),
  substanceUse: z
    .array(
      z.object({
        type: z.string(),
        status: z.enum(['current', 'past', 'never']),
        notes: z.string().optional(),
      })
    )
    .optional(),
  occupation: z.string().optional(),
  education: z.string().optional(),
  livingSituation: z.string().optional(),
  currentResidence: z.string().optional(),
  placeOfBirth: z.string().optional(),
  mobNation: z.string().optional(),
  languageGroup: z.string().optional(),
  riskIndicators: z.array(z.string()).optional(),
  assessmentNotes: z.string().optional(),
  notes: z.string().optional(),
  caseNotes: z
    .array(
      z.object({
        date: dateLike,
        note: z.string(),
        author: z.string(),
      })
    )
    .optional(),
  position: positionSchema,
  generation: z.number().optional(),
  isIndexPerson: z.boolean().optional(),
  pregnancyStatus: z
    .enum(['pregnancy', 'miscarriage', 'stillbirth', 'abortion'])
    .optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
}) satisfies z.ZodType<Person>;

const relationshipSchema = z.object({
  id: z.string(),
  person1Id: z.string(),
  person2Id: z.string(),
  type: z.enum([
    'biological-parent',
    'adoptive-parent',
    'foster-parent',
    'step-parent',
    'guardian',
    'spouse',
    'partner',
    'divorced',
    'separated',
    'sibling',
    'half-sibling',
    'step-sibling',
  ]),
  startDate: optionalDate,
  endDate: optionalDate,
  emotionalBond: z
    .enum(['close', 'distant', 'conflictual', 'cutoff', 'enmeshed', 'abusive'])
    .optional(),
  isAbusive: z.boolean().optional(),
  abuseType: z.enum(['physical', 'emotional', 'sexual', 'neglect']).optional(),
  notes: z.string().optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
}) satisfies z.ZodType<Relationship>;

const junctionSchema = z.object({
  id: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  createdAt: dateLike,
  updatedAt: dateLike,
}) satisfies z.ZodType<JunctionNode>;

const junctionEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
}) satisfies z.ZodType<JunctionEdge>;

const v1SnapshotSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().optional(),
  people: z.array(personSchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  // v1 had no junctions / junctionEdges
  junctions: z.array(junctionSchema).optional(),
  junctionEdges: z.array(junctionEdgeSchema).optional(),
});

const v2SnapshotSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string().optional(),
  people: z.array(personSchema).default([]),
  relationships: z.array(relationshipSchema).default([]),
  junctions: z.array(junctionSchema).default([]),
  junctionEdges: z.array(junctionEdgeSchema).default([]),
});

export type GenogramSnapshot = {
  version: typeof CURRENT_SNAPSHOT_VERSION;
  exportedAt: string;
  people: Person[];
  relationships: Relationship[];
  junctions: JunctionNode[];
  junctionEdges: JunctionEdge[];
};

export interface ParseResult {
  ok: boolean;
  snapshot?: GenogramSnapshot;
  errors?: string[];
}

/**
 * Parse and validate an unknown JSON value into a current-version snapshot.
 * Older versions are migrated forward.
 */
export function parseSnapshot(input: unknown): ParseResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['File is not a valid JSON object.'] };
  }

  const version = (input as { version?: unknown }).version;

  if (version === 1) {
    const parsed = v1SnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, errors: collectErrors(parsed.error) };
    }
    return { ok: true, snapshot: migrateV1ToCurrent(parsed.data) };
  }

  if (version === 2) {
    const parsed = v2SnapshotSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, errors: collectErrors(parsed.error) };
    }
    return {
      ok: true,
      snapshot: {
        version: CURRENT_SNAPSHOT_VERSION,
        exportedAt: parsed.data.exportedAt ?? new Date().toISOString(),
        people: parsed.data.people,
        relationships: parsed.data.relationships,
        junctions: parsed.data.junctions,
        junctionEdges: parsed.data.junctionEdges,
      },
    };
  }

  return {
    ok: false,
    errors: [
      `Unsupported snapshot version: ${JSON.stringify(version)}. Expected 1 or 2.`,
    ],
  };
}

function migrateV1ToCurrent(
  v1: z.infer<typeof v1SnapshotSchema>
): GenogramSnapshot {
  return {
    version: CURRENT_SNAPSHOT_VERSION,
    exportedAt: v1.exportedAt ?? new Date().toISOString(),
    people: v1.people,
    relationships: v1.relationships,
    junctions: v1.junctions ?? [],
    junctionEdges: v1.junctionEdges ?? [],
  };
}

function collectErrors(err: z.ZodError): string[] {
  return err.issues.slice(0, 10).map((i) => {
    const path = i.path.join('.');
    return path ? `${path}: ${i.message}` : i.message;
  });
}

/**
 * Build a snapshot from current store entities.
 */
export function buildSnapshot(input: {
  people: Person[];
  relationships: Relationship[];
  junctions: JunctionNode[];
  junctionEdges: JunctionEdge[];
}): GenogramSnapshot {
  return {
    version: CURRENT_SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    people: input.people,
    relationships: input.relationships,
    junctions: input.junctions,
    junctionEdges: input.junctionEdges,
  };
}
