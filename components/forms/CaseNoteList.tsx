'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

export interface CaseNoteEntry {
  date: Date;
  note: string;
  author: string;
}

interface Props {
  value: CaseNoteEntry[];
  onChange: (next: CaseNoteEntry[]) => void;
  readOnly?: boolean;
}

function fmt(d: Date) {
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function CaseNoteList({ value, onChange, readOnly }: Props) {
  const [draftNote, setDraftNote] = useState('');
  const [draftAuthor, setDraftAuthor] = useState('');
  const [draftDate, setDraftDate] = useState(() => fmt(new Date()));

  const add = () => {
    if (!draftNote.trim()) return;
    const entry: CaseNoteEntry = {
      date: draftDate ? new Date(draftDate) : new Date(),
      note: draftNote.trim(),
      author: draftAuthor.trim() || 'unknown',
    };
    onChange([...value, entry]);
    setDraftNote('');
    setDraftAuthor('');
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const sorted = [...value].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No case notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((entry, i) => (
            <li
              key={`${fmt(entry.date)}-${i}`}
              className="rounded-md border border-dotted border-gray-200 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {fmt(entry.date)} · {entry.author}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => remove(value.indexOf(entry))}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Remove note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-foreground">
                {entry.note}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-2 rounded-md border border-dashed border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Author</Label>
              <Input
                value={draftAuthor}
                onChange={(e) => setDraftAuthor(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Note</Label>
            <textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="What happened?"
              className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={add}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add note
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
