'use client';

import { useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { useHistoryActions } from '@/lib/store/history';

/**
 * Global keyboard shortcuts for the canvas:
 *   - Esc: clear all selection
 *   - Delete / Backspace: delete the selected person/relationship(s) — always
 *     after a confirmation prompt
 *   - Cmd/Ctrl+Z: undo
 *   - Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y: redo
 *   - Cmd/Ctrl+A: select all nodes
 */
export default function KeyboardShortcuts() {
  const { setNodes, getNodes, getEdges } = useReactFlow();
  const {
    people,
    selectedPersonId,
    selectedRelationshipId,
    clearSelection,
    deletePerson,
    deleteRelationship,
  } = useGenogramStore();
  const { undo, redo } = useHistoryActions();

  useEffect(() => {
    function handleDelete(e: KeyboardEvent): boolean {
      const personIds = new Set<string>();
      const relationshipIds = new Set<string>();

      if (selectedPersonId) personIds.add(selectedPersonId);
      if (selectedRelationshipId) relationshipIds.add(selectedRelationshipId);

      // Pick up React Flow's native multi-select (rubber-band) so users can
      // box-select several people/relationships and delete them at once.
      const allNodes = getNodes();
      const allEdges = getEdges();
      for (const n of allNodes) {
        if (!n.selected) continue;
        if (n.type === 'person') personIds.add(n.id);
      }
      for (const ed of allEdges) {
        if (!ed.selected) continue;
        if (ed.type === 'relationship') relationshipIds.add(ed.id);
      }

      const total = personIds.size + relationshipIds.size;
      if (total === 0) return false;

      e.preventDefault();

      const parts: string[] = [];
      if (personIds.size === 1) {
        const id = personIds.values().next().value as string;
        const p = people.find((p) => p.id === id);
        const name =
          [p?.firstName, p?.lastName].filter(Boolean).join(' ') ||
          'this person';
        parts.push(`${name} (their relationships will also be removed)`);
      } else if (personIds.size > 1) {
        parts.push(
          `${personIds.size} people (their relationships will also be removed)`
        );
      }
      if (relationshipIds.size === 1) parts.push('1 relationship line');
      else if (relationshipIds.size > 1)
        parts.push(`${relationshipIds.size} relationship lines`);

      const summary = parts.join(', ');
      const message =
        total === 1
          ? `Delete ${summary}?`
          : `Delete ${summary}?\n\nYou can undo this with Cmd/Ctrl+Z.`;

      if (!window.confirm(message)) return true;

      for (const id of personIds) deletePerson(id);
      for (const id of relationshipIds) deleteRelationship(id);

      return true;
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable;
      if (isTyping) return;

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === 'Escape') {
        clearSelection();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDelete(e);
        return;
      }

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (mod && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const all = getNodes();
        setNodes(all.map((n) => ({ ...n, selected: true })));
        return;
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    people,
    selectedPersonId,
    selectedRelationshipId,
    clearSelection,
    deletePerson,
    deleteRelationship,
    undo,
    redo,
    getNodes,
    getEdges,
    setNodes,
  ]);

  return null;
}
