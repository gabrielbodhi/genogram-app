/**
 * Genogram metadata. The actual people/relationships/junctions are stored in
 * their own tables and tagged with `genogramId`.
 */
export interface Genogram {
  id: string;
  title: string;
  description?: string;

  // Client/Family info
  primaryClientId?: string;
  familyName?: string;

  // Professional context
  caseWorker?: string;
  organization?: string;
  purpose?: 'therapeutic' | 'social-work' | 'police' | 'genealogy' | 'medical';

  // Settings
  isPrivate?: boolean;
  sharedWith?: string[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy?: string;
}
