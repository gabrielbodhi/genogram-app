'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { useHistory } from '@/lib/store/history';
import {
  loadFromDb,
  persistGenogramMeta,
  deleteGenogramFromDb,
} from '@/lib/db/persistence';
import { notify } from '@/lib/store/notifications';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { Genogram } from '@/lib/types/genogram';

export default function GenogramSwitcher() {
  const genograms = useGenogramStore((s) => s.genograms);
  const currentGenogram = useGenogramStore((s) => s.currentGenogram);
  const upsertGenogram = useGenogramStore((s) => s.upsertGenogram);
  const removeGenogram = useGenogramStore((s) => s.removeGenogram);
  const reset = useHistory((s) => s.reset);

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  const handleSwitch = async (id: string) => {
    if (currentGenogram?.id === id) return;
    await loadFromDb(id);
    reset(); // history doesn't carry across genograms
  };

  const handleCreate = async () => {
    const title = draftTitle.trim() || 'Untitled genogram';
    const fresh: Genogram = {
      id: `genogram-${Date.now()}`,
      title,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await persistGenogramMeta(fresh);
    upsertGenogram(fresh);
    await loadFromDb(fresh.id);
    reset();
    setDraftTitle('');
    setCreateOpen(false);
    notify.success(`Created "${title}".`);
  };

  const handleRename = async () => {
    if (!currentGenogram) return;
    const title = draftTitle.trim() || currentGenogram.title;
    const updated: Genogram = {
      ...currentGenogram,
      title,
      updatedAt: new Date(),
    };
    await persistGenogramMeta(updated);
    upsertGenogram(updated);
    useGenogramStore.getState().setCurrentGenogram(updated);
    setDraftTitle('');
    setRenameOpen(false);
  };

  const handleDelete = async () => {
    if (!currentGenogram) return;
    if (genograms.length <= 1) {
      notify.warning('Create another genogram first before deleting this one.');
      return;
    }
    const ok = window.confirm(
      `Delete "${currentGenogram.title}" and all its data? This cannot be undone.`
    );
    if (!ok) return;
    const id = currentGenogram.id;
    await deleteGenogramFromDb(id);
    removeGenogram(id);
    const remaining = genograms.filter((g) => g.id !== id);
    if (remaining[0]) {
      await loadFromDb(remaining[0].id);
    }
    reset();
    notify.success('Genogram deleted.');
  };

  return (
    <div className="flex items-center gap-1">
      <Select
        value={currentGenogram?.id ?? ''}
        onValueChange={handleSwitch}
      >
        <SelectTrigger className="h-9 w-[180px]" title="Switch genogram">
          <SelectValue placeholder="Select genogram" />
        </SelectTrigger>
        <SelectContent>
          {genograms.length === 0 && (
            <SelectItem value="__none__" disabled>
              No genograms yet
            </SelectItem>
          )}
          {genograms
            .slice()
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime()
            )
            .map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.title}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (o) setDraftTitle('');
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" title="Create genogram">
            <FolderPlus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New genogram</DialogTitle>
            <DialogDescription>
              Start a new family map. You can switch between genograms anytime.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="e.g. The Smith family"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameOpen}
        onOpenChange={(o) => {
          setRenameOpen(o);
          if (o) setDraftTitle(currentGenogram?.title ?? '');
        }}
      >
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title="Rename genogram"
            disabled={!currentGenogram}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename genogram</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        title="Delete genogram"
        className="text-red-600 hover:text-red-700"
        disabled={!currentGenogram}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
