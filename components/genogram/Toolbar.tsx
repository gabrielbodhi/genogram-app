'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Save,
  Circle,
  Upload,
  Image as ImageIcon,
  Trash,
  Undo2,
  Redo2,
  LayoutGrid,
} from 'lucide-react';
import { useHistoryActions, useUndoRedoCounts } from '@/lib/store/history';
import { computeAutoLayout } from '@/lib/layout/autoLayout';
import ThemeToggle from '@/components/ThemeToggle';
import GenogramSwitcher from './GenogramSwitcher';
import CloudSyncButton from './CloudSyncButton';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { Person } from '@/lib/types/person';
import { JunctionNode } from '@/lib/types/junction';
import { useReactFlow, useViewport, getRectOfNodes, getTransformForBounds } from 'reactflow';
import { toPng } from 'html-to-image';
import { buildSnapshot, parseSnapshot } from '@/lib/io/snapshot';
import { notify, useNotifications } from '@/lib/store/notifications';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function Toolbar() {
  const { addPerson, addJunction, hydrate, reset } = useGenogramStore();
  const viewport = useViewport();
  const { getNodes } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { undo, redo } = useHistoryActions();
  const { canUndo, canRedo } = useUndoRedoCounts();

  const handleAddPerson = () => {
    const { people } = useGenogramStore.getState();
    const { x, y, zoom } = viewport;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const centerX = (screenWidth / 2 - x) / zoom;
    const centerY = (screenHeight / 2 - y) / zoom;
    const offset = people.length * 10;

    const newPerson: Person = {
      id: `person-${Date.now()}`,
      firstName: 'New',
      lastName: 'Person',
      gender: 'unknown',
      vitalStatus: 'alive',
      position: { x: centerX + offset, y: centerY + offset },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addPerson(newPerson);
  };

  const handleAddJunction = () => {
    const { x, y, zoom } = viewport;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const centerX = (screenWidth / 2 - x) / zoom;
    const centerY = (screenHeight / 2 - y) / zoom;

    const newJunction: JunctionNode = {
      id: `junction-${Date.now()}`,
      position: { x: centerX, y: centerY },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addJunction(newJunction);
  };

  const handleSaveJson = () => {
    const s = useGenogramStore.getState();
    const snapshot = buildSnapshot({
      people: s.people,
      relationships: s.relationships,
      junctions: s.junctions,
      junctionEdges: s.junctionEdges,
    });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, `genogram-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleLoadJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleLoadJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-loading the same file
    if (!file) return;

    let raw: unknown;
    try {
      const text = await file.text();
      raw = JSON.parse(text);
    } catch (err) {
      console.error('[Toolbar] JSON parse failed:', err);
      notify.error('That file is not valid JSON.');
      return;
    }

    const result = parseSnapshot(raw);
    if (!result.ok || !result.snapshot) {
      console.error('[Toolbar] Invalid snapshot:', result.errors);
      notify.error(
        `Could not load that file. ${(result.errors ?? ['Unknown error']).join(' ')}`
      );
      return;
    }

    const { snapshot } = result;
    hydrate({
      people: snapshot.people,
      relationships: snapshot.relationships,
      junctions: snapshot.junctions,
      junctionEdges: snapshot.junctionEdges,
    });
    notify.success(
      `Loaded ${snapshot.people.length} people and ${snapshot.relationships.length} relationships.`
    );
  };

  const [exporting, setExporting] = React.useState(false);

  const handleExportPng = async () => {
    const flowEl = document.querySelector(
      '.react-flow__viewport'
    ) as HTMLElement | null;
    const wrapperEl = document.querySelector(
      '.react-flow'
    ) as HTMLElement | null;
    if (!flowEl || !wrapperEl) return;

    const nodes = getNodes();
    if (nodes.length === 0) {
      notify.warning('Nothing to export yet — add some people first.');
      return;
    }

    setExporting(true);
    const progressId = notify.info('Rendering PNG…', 0);

    // Defer the heavy work until the browser is idle so the progress toast
    // actually paints before we lock the main thread.
    const idleStart = () =>
      new Promise<void>((resolve) => {
        const w = window as Window & {
          requestIdleCallback?: (cb: () => void) => void;
        };
        if (typeof w.requestIdleCallback === 'function') {
          w.requestIdleCallback(() => resolve());
        } else {
          setTimeout(resolve, 50);
        }
      });

    try {
      await idleStart();

      const padding = 50;
      const bounds = getRectOfNodes(nodes);
      const width = Math.ceil(bounds.width) + padding * 2;
      const height = Math.ceil(bounds.height) + padding * 2;
      const transform = getTransformForBounds(
        bounds,
        width,
        height,
        0.5,
        2,
        padding
      );

      const dataUrl = await toPng(flowEl, {
        backgroundColor: '#ffffff',
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
        },
      });
      downloadDataUrl(
        dataUrl,
        `genogram-${new Date().toISOString().slice(0, 10)}.png`
      );
      notify.success('PNG exported.');
    } catch (err) {
      console.error('[Toolbar] PNG export failed:', err);
      notify.error('PNG export failed. See console for details.');
    } finally {
      useNotifications.getState().dismiss(progressId);
      setExporting(false);
    }
  };

  const handleClear = () => {
    if (
      window.confirm(
        'Clear the entire genogram? This cannot be undone (export first if you want a backup).'
      )
    ) {
      reset();
    }
  };

  const handleAutoLayout = () => {
    const s = useGenogramStore.getState();
    if (s.people.length === 0) return;
    const { positions } = computeAutoLayout(s.people, s.relationships);
    // Apply through the store so undo/redo and persistence pick it up.
    for (const p of s.people) {
      const next = positions.get(p.id);
      if (next) s.updatePerson(p.id, { position: next });
    }
    notify.success('Tidied layout into generation lanes.');
  };

  return (
    <div className="absolute top-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 flex flex-wrap items-center gap-2">
      <GenogramSwitcher />

      <div className="mx-1 h-7 w-px self-center bg-gray-200" />

      <Button onClick={handleAddPerson} size="sm">
        <Plus className="w-4 h-4 mr-2" />
        Add Person
      </Button>
      <Button onClick={handleAddJunction} variant="outline" size="sm">
        <Circle className="w-4 h-4 mr-2" />
        Add Junction
      </Button>

      <div className="mx-1 h-7 w-px self-center bg-gray-200" />

      <Button
        onClick={undo}
        variant="outline"
        size="sm"
        disabled={!canUndo}
        title="Undo (Cmd/Ctrl+Z)"
      >
        <Undo2 className="w-4 h-4" />
      </Button>
      <Button
        onClick={redo}
        variant="outline"
        size="sm"
        disabled={!canRedo}
        title="Redo (Shift+Cmd/Ctrl+Z)"
      >
        <Redo2 className="w-4 h-4" />
      </Button>

      <div className="mx-1 h-7 w-px self-center bg-gray-200" />

      <Button onClick={handleSaveJson} variant="outline" size="sm">
        <Save className="w-4 h-4 mr-2" />
        Save JSON
      </Button>
      <Button onClick={handleLoadJsonClick} variant="outline" size="sm">
        <Upload className="w-4 h-4 mr-2" />
        Load JSON
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleLoadJson}
        className="hidden"
      />
      <Button
        onClick={handleExportPng}
        variant="outline"
        size="sm"
        disabled={exporting}
      >
        <ImageIcon className="w-4 h-4 mr-2" />
        {exporting ? 'Exporting…' : 'Export PNG'}
      </Button>

      <div className="mx-1 h-7 w-px self-center bg-gray-200" />

      <Button onClick={handleAutoLayout} variant="outline" size="sm">
        <LayoutGrid className="w-4 h-4 mr-2" />
        Tidy
      </Button>

      <div className="mx-1 h-7 w-px self-center bg-gray-200" />

      <Button
        onClick={handleClear}
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
      >
        <Trash className="w-4 h-4 mr-2" />
        Clear
      </Button>

      <CloudSyncButton />
      <ThemeToggle />
    </div>
  );
}
