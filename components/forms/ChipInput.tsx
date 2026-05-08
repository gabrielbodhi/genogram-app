'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Render as readonly when not in edit mode. */
  readOnly?: boolean;
}

/**
 * Tiny chip input. Press Enter or comma to commit a value, click X to remove.
 */
export default function ChipInput({
  value,
  onChange,
  placeholder = 'Add and press Enter',
  readOnly = false,
}: Props) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft('');
      return;
    }
    onChange([...value, v]);
    setDraft('');
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  if (readOnly) {
    if (value.length === 0) {
      return <span className="text-sm text-muted-foreground">Not specified</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
          >
            {v}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-2 py-1.5">
      {value.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="opacity-60 hover:opacity-100"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            e.preventDefault();
            remove(value.length - 1);
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}
