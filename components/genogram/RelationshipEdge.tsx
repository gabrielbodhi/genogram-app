'use client';

import React, { memo } from 'react';
import { EdgeProps, getSmoothStepPath } from 'reactflow';
import { Relationship } from '@/lib/types/relationship';
import { useGenogramStore } from '@/lib/store/genogramStore';

function RelationshipEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Relationship>) {
  const selectedRelationshipId = useGenogramStore(
    (s) => s.selectedRelationshipId
  );
  const setSelectedRelationship = useGenogramStore(
    (s) => s.setSelectedRelationship
  );
  const isSelected = selectedRelationshipId === id;

  // Use a smooth-step routing for parent/child links so they bend around
  // junctions instead of cutting straight through them. Couple lines stay
  // straight (genogram convention).
  const isCoupleLink =
    data?.type === 'spouse' ||
    data?.type === 'partner' ||
    data?.type === 'divorced' ||
    data?.type === 'separated';

  const [edgePath, labelX, labelY] = isCoupleLink
    ? [
        `M ${sourceX},${sourceY} L ${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
      ]
    : (() => {
        const [path, lx, ly] = getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 8,
        });
        return [path, lx, ly] as const;
      })();

  const getStrokeStyle = (): React.CSSProperties => {
    if (!data) return {};
    switch (data.type) {
      case 'divorced':
      case 'separated':
        return { strokeDasharray: '6,4' };
      case 'foster-parent':
        return { strokeDasharray: '4,3' };
      default:
        return {};
    }
  };

  const getStrokeColor = () => {
    if (isSelected) return '#3b82f6';
    if (!data?.emotionalBond) return '#374151';
    switch (data.emotionalBond) {
      case 'close':
        return '#10b981';
      case 'distant':
        return '#94a3b8';
      case 'conflictual':
        return '#f59e0b';
      case 'cutoff':
        return '#ef4444';
      case 'abusive':
        return '#dc2626';
      default:
        return '#374151';
    }
  };

  // Adoption / step bracket: a small "[" symbol near the parent end of the
  // edge so the link's nature is visible at a glance without a legend.
  const renderTypeMarker = () => {
    if (!data) return null;
    const labelMap: Partial<Record<Relationship['type'], string>> = {
      'adoptive-parent': 'A',
      'foster-parent': 'F',
      'step-parent': 'S',
      guardian: 'G',
      'half-sibling': '½',
      'step-sibling': 'S',
    };
    const label = labelMap[data.type];
    if (!label) return null;

    return (
      <g transform={`translate(${labelX} ${labelY})`}>
        <rect
          x={-9}
          y={-9}
          width={18}
          height={18}
          rx={4}
          fill="white"
          stroke={getStrokeColor()}
          strokeWidth={1}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontFamily="ui-sans-serif, system-ui"
          fill={getStrokeColor()}
        >
          {label}
        </text>
      </g>
    );
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRelationship(id);
  };

  return (
    <g onClick={handleClick} style={{ cursor: 'pointer' }}>
      <path
        d={edgePath}
        stroke="transparent"
        strokeWidth={20}
        fill="none"
      />
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        strokeWidth={isSelected ? 3 : data?.isAbusive ? 3 : 2}
        stroke={getStrokeColor()}
        style={getStrokeStyle()}
        fill="none"
      />
      {renderTypeMarker()}
    </g>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeImpl);
