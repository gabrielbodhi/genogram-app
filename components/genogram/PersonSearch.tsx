'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { Search, X } from 'lucide-react';

function fullName(p: { firstName: string; lastName: string; preferredName?: string }) {
  return [p.firstName, p.lastName].filter(Boolean).join(' ');
}

/**
 * Search input that filters people by name and zooms to the chosen person.
 * Cmd/Ctrl+K to focus the input.
 */
export default function PersonSearch() {
  const people = useGenogramStore((s) => s.people);
  const setSelectedPerson = useGenogramStore((s) => s.setSelectedPerson);
  const { setCenter, getNode } = useReactFlow();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return people
      .filter((p) => {
        return (
          fullName(p).toLowerCase().includes(q) ||
          (p.preferredName ?? '').toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [people, query]);

  const handlePick = (id: string) => {
    const node = getNode(id);
    if (node) {
      const x = (node.position.x ?? 0) + (node.width ?? 60) / 2;
      const y = (node.position.y ?? 0) + (node.height ?? 60) / 2;
      setCenter(x, y, { zoom: 1.5, duration: 400 });
    }
    setSelectedPerson(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="absolute top-4 right-4 z-10 w-64">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search people (Cmd/Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length > 0) {
              e.preventDefault();
              handlePick(matches[0].id);
            }
            if (e.key === 'Escape') {
              setQuery('');
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          className="h-9 w-full rounded-md border border-input bg-white pl-8 pr-8 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && matches.length > 0 && (
        <ul className="mt-1 max-h-64 overflow-y-auto rounded-md border bg-white py-1 shadow-md">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => handlePick(p.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-100"
              >
                <span className="truncate">
                  {fullName(p) || (
                    <span className="text-muted-foreground">Unnamed</span>
                  )}
                </span>
                {p.preferredName && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.preferredName}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
