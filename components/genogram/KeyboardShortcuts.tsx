'use client';

import { useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { useHistoryActions } from '@/lib/store/history';

/**
 * Global keyboard shortcuts for the canvas:
 *   - Esc: clear selection
 *   - Delete / Backspace: delete selected person/relationship
 *   - Cmd/Ctrl+Z: undo
 *   - Shift+Cmd/Ctrl+Z or Cmd/Ctrl+Y: redo
 *   - Cmd/Ctrl+A: select all nodes
 */
export default function KeyboardShortcuts() {
  const { setNodes, getNodes } = useReactFlow();
  const {
    selectedPersonId,
    selectedRelationshipId,
    setSelectedPerson,
    setSelectedRelationship,
    deletePerson,
    deleteRelationship,
  } = useGenogramStore();
  const { undo, redo } = useHistoryActions();

  useEffect(() => {
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
        setSelectedPerson(null);
        setSelectedRelationship(null);
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRelationshipId) {
          e.preventDefault();
          deleteRelationship(selectedRelationshipId);
          return;
        }
        if (selectedPersonId) {
          e.preventDefault();
          deletePerson(selectedPersonId);
          return;
        }
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
    selectedPersonId,
    selectedRelationshipId,
    setSelectedPerson,
    setSelectedRelationship,
    deletePerson,
    deleteRelationship,
    undo,
    redo,
    getNodes,
    setNodes,
  ]);

  return null;
}
