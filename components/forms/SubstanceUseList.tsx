'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export interface SubstanceUseEntry {
  type: string;
  status: 'current' | 'past' | 'never';
  notes?: string;
}

interface Props {
  value: SubstanceUseEntry[];
  onChange: (next: SubstanceUseEntry[]) => void;
  readOnly?: boolean;
}

const STATUS_LABEL: Record<SubstanceUseEntry['status'], string> = {
  current: 'Current',
  past: 'Past',
  never: 'Never',
};

export default function SubstanceUseList({ value, onChange, readOnly }: Props) {
  const [type, setType] = useState('');
  const [status, setStatus] = useState<SubstanceUseEntry['status']>('current');
  const [notes, setNotes] = useState('');

  const add = () => {
    if (!type.trim()) return;
    const entry: SubstanceUseEntry = {
      type: type.trim(),
      status,
      notes: notes.trim() || undefined,
    };
    onChange([...value, entry]);
    setType('');
    setStatus('current');
    setNotes('');
  };

  const remove = (idx: number) => {
    const next = value.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded.</p>
      ) : (
        <ul className="space-y-2">
          {value.map((entry, i) => (
            <li
              key={`${entry.type}-${i}`}
              className="rounded-md border border-dotted border-gray-200 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{entry.type}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      entry.status === 'current'
                        ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800'
                        : entry.status === 'past'
                        ? 'rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-800'
                        : 'rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700'
                    }
                  >
                    {STATUS_LABEL[entry.status]}
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="text-red-500 hover:text-red-700"
                      aria-label="Remove entry"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {entry.notes && (
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                  {entry.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-2 rounded-md border border-dashed border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Substance</Label>
              <Input
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="e.g. Alcohol"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={status}
                onValueChange={(v) =>
                  setStatus(v as SubstanceUseEntry['status'])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={add}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add entry
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
