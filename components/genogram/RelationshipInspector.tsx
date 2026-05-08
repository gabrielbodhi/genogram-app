'use client';

import React, { useMemo } from 'react';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, X } from 'lucide-react';
import {
  EmotionalBond,
  Relationship,
  RelationshipType,
} from '@/lib/types/relationship';

const RELATIONSHIP_TYPES: RelationshipType[] = [
  'biological-parent',
  'adoptive-parent',
  'foster-parent',
  'step-parent',
  'guardian',
  'spouse',
  'partner',
  'divorced',
  'separated',
  'sibling',
  'half-sibling',
  'step-sibling',
];

const EMOTIONAL_BONDS: EmotionalBond[] = [
  'close',
  'distant',
  'conflictual',
  'cutoff',
  'enmeshed',
  'abusive',
];

const ABUSE_TYPES: NonNullable<Relationship['abuseType']>[] = [
  'physical',
  'emotional',
  'sexual',
  'neglect',
];

function personLabel(
  id: string,
  people: ReturnType<typeof useGenogramStore.getState>['people']
) {
  const p = people.find((x) => x.id === id);
  if (!p) return id;
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.id;
}

export default function RelationshipInspector() {
  const {
    relationships,
    people,
    selectedRelationshipId,
    setSelectedRelationship,
    updateRelationship,
    deleteRelationship,
  } = useGenogramStore();

  const rel = useMemo(
    () => relationships.find((r) => r.id === selectedRelationshipId) || null,
    [relationships, selectedRelationshipId]
  );

  if (!rel) return null;

  const handleDelete = () => {
    const ok = window.confirm('Delete this relationship?');
    if (!ok) return;
    deleteRelationship(rel.id);
  };

  return (
    <aside className="pointer-events-auto fixed left-4 bottom-4 z-20 w-[320px]">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-sm font-semibold">Relationship</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
              onClick={handleDelete}
              title="Delete relationship"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setSelectedRelationship(null)}
              title="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pb-4">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{personLabel(rel.person1Id, people)}</span>
            <span className="mx-1">↔</span>
            <span className="font-medium">{personLabel(rel.person2Id, people)}</span>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={rel.type}
              onValueChange={(val) =>
                updateRelationship(rel.id, {
                  type: val as RelationshipType,
                  updatedAt: new Date(),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/-/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Emotional bond</Label>
            <Select
              value={rel.emotionalBond ?? 'none'}
              onValueChange={(val) =>
                updateRelationship(rel.id, {
                  emotionalBond:
                    val === 'none' ? undefined : (val as EmotionalBond),
                  updatedAt: new Date(),
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {EMOTIONAL_BONDS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              id="rel-abusive"
              type="checkbox"
              checked={rel.isAbusive ?? false}
              onChange={(e) =>
                updateRelationship(rel.id, {
                  isAbusive: e.target.checked,
                  abuseType: e.target.checked ? rel.abuseType : undefined,
                  updatedAt: new Date(),
                })
              }
              className="h-4 w-4"
            />
            <Label htmlFor="rel-abusive" className="text-xs">
              Mark as abusive
            </Label>
          </div>

          {rel.isAbusive && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Abuse type</Label>
              <Select
                value={rel.abuseType ?? ''}
                onValueChange={(val) =>
                  updateRelationship(rel.id, {
                    abuseType: val as NonNullable<Relationship['abuseType']>,
                    updatedAt: new Date(),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {ABUSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <textarea
              className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              value={rel.notes ?? ''}
              onChange={(e) =>
                updateRelationship(rel.id, {
                  notes: e.target.value,
                  updatedAt: new Date(),
                })
              }
            />
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}
