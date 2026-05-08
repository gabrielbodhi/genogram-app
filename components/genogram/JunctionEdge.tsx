'use client';

import React, { memo } from 'react';
import { EdgeProps, getSmoothStepPath } from 'reactflow';

/**
 * Junction edges connect a person to a routing junction (or two junctions).
 * They are non-interactive: their existence is fully managed by the
 * auto-layout that derives sibling lines from parent-child relationships.
 */
function JunctionEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  return (
    <path
      id={id}
      d={edgePath}
      className="react-flow__edge-path pointer-events-none"
      strokeWidth={2}
      stroke="#374151"
      fill="none"
    />
  );
}

export const JunctionEdge = memo(JunctionEdgeImpl);
