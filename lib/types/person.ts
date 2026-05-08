export type Gender = 'male' | 'female' | 'non-binary' | 'other' | 'unknown';
export type VitalStatus = 'alive' | 'deceased' | 'unknown';

export interface Person {
  id: string;
  /** Foreign key to the owning Genogram. */
  genogramId?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  
  // Demographics
  dateOfBirth?: Date;
  dateOfDeath?: Date;
  age?: number;
  gender: Gender;
  vitalStatus: VitalStatus;
  
  // Cultural/Tribal
  tribalAffiliation?: string[];
  culturalIdentity?: string[];
  tribalRoles?: string[];
  indigenousHeritage?: string;
  
  // Medical/Health
  medicalConditions?: string[];
  mentalHealthConditions?: string[];
  substanceUse?: {
    type: string;
    status: 'current' | 'past' | 'never';
    notes?: string;
  }[];
  
  // Social
  occupation?: string;
  education?: string;
  livingSituation?: string;
  currentResidence?: string;
  placeOfBirth?: string;
  mobNation?: string;
  languageGroup?: string;
  
  // Professional notes (for workers)
  riskIndicators?: string[];
  assessmentNotes?: string;
  notes?: string;
  caseNotes?: {
    date: Date;
    note: string;
    author: string;
  }[];
  
  // Visual positioning
  position?: { x: number; y: number };
  generation?: number;

  // Genogram-specific markers
  isIndexPerson?: boolean;
  pregnancyStatus?: 'pregnancy' | 'miscarriage' | 'stillbirth' | 'abortion';

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}