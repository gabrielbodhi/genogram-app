'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Person } from '@/lib/types/person';
import { useGenogramStore } from '@/lib/store/genogramStore';

const NODE_SIZE = 32;

function PersonNodeImpl({ data }: NodeProps<Person>) {
  const setSelectedPerson = useGenogramStore((s) => s.setSelectedPerson);
  const isSelected = useGenogramStore((s) => s.selectedPersonId === data.id);
  const [isHovered, setIsHovered] = useState(false);

  const isMiscarriage = data.pregnancyStatus === 'miscarriage';
  const isStillbirth = data.pregnancyStatus === 'stillbirth';
  const isAbortion = data.pregnancyStatus === 'abortion';
  const isPregnancy = data.pregnancyStatus === 'pregnancy';
  const isLossOfPregnancy = isMiscarriage || isStillbirth || isAbortion;

  // Genogram-conventional shape:
  //   male         -> square
  //   female       -> circle
  //   pregnancy    -> small triangle
  //   miscarriage  -> small filled circle
  //   stillbirth   -> small triangle (slashed)
  //   abortion     -> small slashed circle
  const getShapeClass = () => {
    if (isLossOfPregnancy || isPregnancy) {
      // Render via SVG below.
      return '';
    }
    switch (data.gender) {
      case 'male':
        return 'rounded-none';
      case 'female':
        return 'rounded-full';
      default:
        return 'rounded-md';
    }
  };

  const handleClick = () => setSelectedPerson(data.id);

  const fullName = [data.firstName, data.lastName].filter(Boolean).join(' ');
  const birthYear = data.dateOfBirth ? new Date(data.dateOfBirth).getFullYear() : undefined;
  const deathYear = data.dateOfDeath ? new Date(data.dateOfDeath).getFullYear() : undefined;

  const computedAge = (() => {
    if (!data.dateOfBirth) return undefined;
    const today = new Date();
    const dob = new Date(data.dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    const day = today.getDate() - dob.getDate();
    if (m < 0 || (m === 0 && day < 0)) age -= 1;
    return age >= 0 ? age : undefined;
  })();

  const displayAge = data.age ?? computedAge;
  const lifeLabel = (() => {
    if (!birthYear && !deathYear) return undefined;
    if (birthYear && deathYear) return `${birthYear} – ${deathYear}`;
    if (birthYear) return `b. ${birthYear}`;
    return `d. ${deathYear}`;
  })();

  const isDeceased = data.vitalStatus === 'deceased';

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex cursor-pointer flex-col items-center justify-center text-center transition-all"
    >
      {lifeLabel && (
        <div className="mb-1 inline-flex min-w-[40px] items-center justify-center rounded-full bg-gray-100 px-3 py-0.5 text-[10px] font-medium text-gray-700">
          {lifeLabel}
        </div>
      )}

      {/* Node body */}
      {isLossOfPregnancy || isPregnancy ? (
        <PregnancySymbol
          status={data.pregnancyStatus}
          isSelected={isSelected}
        />
      ) : (
        <div
          className={`
            ${getShapeClass()}
            ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-800'}
            border-2
            relative
            flex h-[${NODE_SIZE}px] w-[${NODE_SIZE}px] items-center justify-center bg-white
          `}
          style={{ width: NODE_SIZE, height: NODE_SIZE }}
        >
          {/* Genogram-standard cross-through for deceased */}
          {isDeceased && (
            <svg
              className="pointer-events-none absolute inset-0"
              viewBox="0 0 32 32"
              aria-hidden
            >
              <line
                x1="2"
                y1="30"
                x2="30"
                y2="2"
                stroke="#111827"
                strokeWidth="2"
              />
            </svg>
          )}

          {/* Index-person star */}
          {data.isIndexPerson && (
            <svg
              className="pointer-events-none absolute -left-1 -top-2 h-3 w-3"
              viewBox="0 0 24 24"
              fill="#f59e0b"
              aria-hidden
            >
              <path d="M12 2 14.6 8.6 21.5 9.3 16.3 13.9 17.8 20.7 12 17.3 6.2 20.7 7.7 13.9 2.5 9.3 9.4 8.6Z" />
            </svg>
          )}

          {displayAge != null && (
            <span className="text-xs font-semibold text-gray-800">
              {displayAge}
            </span>
          )}

          {data.riskIndicators && data.riskIndicators.length > 0 && (
            <div
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500"
              title="Risk indicator"
            />
          )}
          {data.tribalAffiliation && data.tribalAffiliation.length > 0 && (
            <div
              className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-purple-500"
              title="Tribal affiliation"
            />
          )}
        </div>
      )}

      <div className="relative mt-1 inline-flex max-w-[120px] items-center justify-center rounded-full bg-gray-100 px-3 py-1 text-[11px] leading-tight">
        <Handle
          id="top"
          type="target"
          position={Position.Top}
          className={`w-4 h-4 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
        />
        <Handle
          id="bottom"
          type="source"
          position={Position.Bottom}
          className={`w-4 h-4 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
        />
        <Handle
          id="left"
          type="source"
          position={Position.Left}
          className={`w-4 h-4 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
        />
        <Handle
          id="right"
          type="source"
          position={Position.Right}
          className={`w-4 h-4 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
        />

        <span className="w-full truncate text-center text-gray-800">
          {fullName || <span className="text-gray-400">Unnamed</span>}
        </span>
      </div>
    </div>
  );
}

interface PregnancySymbolProps {
  status?: Person['pregnancyStatus'];
  isSelected: boolean;
}

function PregnancySymbol({ status, isSelected }: PregnancySymbolProps) {
  const stroke = isSelected ? '#3b82f6' : '#111827';
  const ring = isSelected
    ? 'ring-2 ring-blue-300 rounded-full'
    : '';

  if (status === 'miscarriage') {
    return (
      <svg
        width={NODE_SIZE}
        height={NODE_SIZE}
        viewBox="0 0 32 32"
        className={ring}
        aria-label="Miscarriage"
      >
        <circle cx="16" cy="16" r="6" fill={stroke} />
      </svg>
    );
  }

  if (status === 'abortion') {
    return (
      <svg
        width={NODE_SIZE}
        height={NODE_SIZE}
        viewBox="0 0 32 32"
        className={ring}
        aria-label="Abortion"
      >
        <circle cx="16" cy="16" r="6" stroke={stroke} strokeWidth="2" fill="white" />
        <line x1="6" y1="26" x2="26" y2="6" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (status === 'stillbirth') {
    return (
      <svg
        width={NODE_SIZE}
        height={NODE_SIZE}
        viewBox="0 0 32 32"
        className={ring}
        aria-label="Stillbirth"
      >
        <polygon
          points="16,4 28,28 4,28"
          stroke={stroke}
          strokeWidth="2"
          fill="white"
        />
        <line x1="6" y1="26" x2="26" y2="6" stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  // pregnancy
  return (
    <svg
      width={NODE_SIZE}
      height={NODE_SIZE}
      viewBox="0 0 32 32"
      className={ring}
      aria-label="Pregnancy"
    >
      <polygon
        points="16,4 28,28 4,28"
        stroke={stroke}
        strokeWidth="2"
        fill="white"
      />
    </svg>
  );
}

export const PersonNode = memo(PersonNodeImpl);
