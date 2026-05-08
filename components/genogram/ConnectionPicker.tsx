'use client';

import React, { useEffect, useRef } from 'react';
import { RelationshipType } from '@/lib/types/relationship';

export interface PendingConnection {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  // Screen coords where the picker should appear.
  screenX: number;
  screenY: number;
  // Whether the dragged connection used vertical handles (parent/child) or
  // horizontal (couple). Used to filter relevant types.
  axis: 'vertical' | 'horizontal';
}

interface Props {
  pending: PendingConnection;
  onPick: (type: RelationshipType) => void;
  onCancel: () => void;
}

const VERTICAL_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'biological-parent', label: 'Biological parent' },
  { value: 'adoptive-parent', label: 'Adoptive parent' },
  { value: 'foster-parent', label: 'Foster parent' },
  { value: 'step-parent', label: 'Step parent' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'half-sibling', label: 'Half sibling' },
  { value: 'step-sibling', label: 'Step sibling' },
];

const HORIZONTAL_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'partner', label: 'Partner' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'separated', label: 'Separated' },
];

export default function ConnectionPicker({ pending, onPick, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const options = pending.axis === 'horizontal' ? HORIZONTAL_TYPES : VERTICAL_TYPES;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    function onClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onCancel();
      }
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickOutside);
    };
  }, [onCancel]);

  // Keep the popover on-screen.
  const left = Math.min(
    Math.max(8, pending.screenX),
    typeof window === 'undefined' ? pending.screenX : window.innerWidth - 240
  );
  const top = Math.min(
    Math.max(8, pending.screenY),
    typeof window === 'undefined' ? pending.screenY : window.innerHeight - 320
  );

  return (
    <div
      ref={containerRef}
      className="fixed z-50 w-56 rounded-md border bg-white shadow-lg"
      style={{ left, top }}
      role="menu"
    >
      <div className="border-b px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Choose relationship
      </div>
      <ul className="py-1">
        {options.map((opt) => (
          <li key={opt.value}>
            <button
              type="button"
              onClick={() => onPick(opt.value)}
              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
            >
              {opt.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="border-t px-3 py-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel (Esc)
        </button>
      </div>
    </div>
  );
}
