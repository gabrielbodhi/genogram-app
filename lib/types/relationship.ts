export type RelationshipType = 
  | 'biological-parent'
  | 'adoptive-parent'
  | 'foster-parent'
  | 'step-parent'
  | 'guardian'
  | 'spouse'
  | 'partner'
  | 'divorced'
  | 'separated'
  | 'sibling'
  | 'half-sibling'
  | 'step-sibling';

export type EmotionalBond = 
  | 'close'
  | 'distant'
  | 'conflictual'
  | 'cutoff'
  | 'enmeshed'
  | 'abusive';

export interface Relationship {
  id: string;
  /** Foreign key to the owning Genogram. */
  genogramId?: string;
  person1Id: string;
  person2Id: string;
  type: RelationshipType;
  
  // Relationship details
  startDate?: Date;
  endDate?: Date;
  emotionalBond?: EmotionalBond;
  
  // Special markers
  isAbusive?: boolean;
  abuseType?: 'physical' | 'emotional' | 'sexual' | 'neglect';
  
  notes?: string;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}