export interface JunctionNode {
  id: string;
  /** Foreign key to the owning Genogram. */
  genogramId?: string;
  position: { x: number; y: number };
  createdAt: Date;
  updatedAt: Date;
}

export interface JunctionEdge {
  id: string;
  /** Foreign key to the owning Genogram. */
  genogramId?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  createdAt: Date;
  updatedAt: Date;
}
