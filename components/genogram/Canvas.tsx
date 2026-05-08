'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  ConnectionMode,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGenogramStore } from '@/lib/store/genogramStore';
import { useDbPersistence } from '@/lib/db/persistence';
import { initHistoryRecorder } from '@/lib/store/history';
import { RelationshipType } from '@/lib/types/relationship';
import { PersonNode } from './PersonNode';
import { JunctionNode } from './JunctionNode';
import { RelationshipEdge } from './RelationshipEdge';
import Toolbar from './Toolbar';
import InfoPanel from './InfoPanel';
import RelationshipInspector from './RelationshipInspector';
import ConnectionPicker, { PendingConnection } from './ConnectionPicker';
import KeyboardShortcuts from './KeyboardShortcuts';
import PersonSearch from './PersonSearch';

const nodeTypes = {
  person: PersonNode,
  junction: JunctionNode,
};

const edgeTypes = {
  relationship: RelationshipEdge,
};

export default function GenogramCanvas() {
  useDbPersistence();

  useEffect(() => initHistoryRecorder(), []);

  const {
    people,
    relationships,
    junctions,
    junctionEdges,
    addRelationship,
    updatePerson,
    deleteRelationship,
    updateJunction,
    deleteJunction,
    addJunctionEdge,
    deleteJunctionEdge,
    setSelectedPerson,
    setSelectedRelationship,
  } = useGenogramStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [pendingConnection, setPendingConnection] =
    useState<PendingConnection | null>(null);

  // Persist final node position when dragging stops
  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type === 'person') {
        updatePerson(node.id, { position: node.position });
      } else if (node.type === 'junction') {
        updateJunction(node.id, { position: node.position });
      }
    },
    [updatePerson, updateJunction]
  );

  // Handle node changes - update positions and handle deletions
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);

      changes.forEach((change) => {
        if (change.type === 'remove') {
          const nodeToRemove = nodes.find((n) => n.id === change.id);
          if (nodeToRemove?.type === 'junction') {
            deleteJunction(change.id);
          }
        }
      });
    },
    [onNodesChange, nodes, deleteJunction]
  );

  // Derive nodes from people and junctions
  useEffect(() => {
    const personNodes: Node[] = people.map((person) => ({
      id: person.id,
      type: 'person',
      position: person.position || { x: 250, y: 250 },
      data: person,
    }));

    const junctionNodes: Node[] = junctions.map((junction) => ({
      id: junction.id,
      type: 'junction',
      position: junction.position || { x: 250, y: 250 },
      data: { id: junction.id },
    }));

    setNodes([...personNodes, ...junctionNodes]);
  }, [people, junctions, setNodes]);

  // Sync edges from relationships + junction edges in the store.
  // Note: spouse handle direction is computed from the latest people positions
  // but we intentionally do NOT depend on `nodes` to avoid rebuilding edges on every drag tick.
  useEffect(() => {
    const personById = new Map(people.map((p) => [p.id, p]));

    const relationshipEdges: Edge[] = relationships.map((rel) => {
      const isHorizontal =
        rel.type === 'spouse' ||
        rel.type === 'partner' ||
        rel.type === 'divorced' ||
        rel.type === 'separated';

      let sourceHandle = 'bottom';
      let targetHandle = 'top';

      if (isHorizontal) {
        const source = personById.get(rel.person1Id);
        const target = personById.get(rel.person2Id);
        if (source?.position && target?.position) {
          if (source.position.x < target.position.x) {
            sourceHandle = 'right';
            targetHandle = 'left';
          } else {
            sourceHandle = 'left';
            targetHandle = 'right';
          }
        } else {
          sourceHandle = 'right';
          targetHandle = 'left';
        }
      }

      return {
        id: rel.id,
        source: rel.person1Id,
        target: rel.person2Id,
        sourceHandle,
        targetHandle,
        type: 'relationship',
        data: rel,
      };
    });

    const junctionFlowEdges: Edge[] = junctionEdges.map((je) => ({
      id: je.id,
      source: je.source,
      target: je.target,
      sourceHandle: je.sourceHandle,
      targetHandle: je.targetHandle,
    }));

    setEdges([...relationshipEdges, ...junctionFlowEdges]);
  }, [relationships, junctionEdges, people, setEdges]);

  // Keep store in sync when edges are changed via React Flow
  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);

      changes.forEach((change) => {
        if (change.type === 'remove') {
          const edgeToRemove = edges.find((e) => e.id === change.id);
          if (!edgeToRemove) return;

          const sourceNode = nodes.find((n) => n.id === edgeToRemove.source);
          const targetNode = nodes.find((n) => n.id === edgeToRemove.target);
          const involvesJunction =
            sourceNode?.type === 'junction' || targetNode?.type === 'junction';

          if (involvesJunction) {
            deleteJunctionEdge(change.id);
          } else {
            deleteRelationship(change.id);
          }
        }
      });
    },
    [onEdgesChange, deleteRelationship, deleteJunctionEdge, edges, nodes]
  );

  // Validate that connections use the correct handles
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const { source, target, sourceHandle, targetHandle } = connection;

      if (!sourceHandle || !targetHandle) return false;

      const isJunctionNode = (nodeId: string) =>
        nodes.find((n) => n.id === nodeId)?.type === 'junction';

      const sourceIsJunction = source ? isJunctionNode(source) : false;
      const targetIsJunction = target ? isJunctionNode(target) : false;

      // Junction nodes can connect in any direction
      if (sourceIsJunction || targetIsJunction) return true;

      const isHorizontalHandle = (h: string) =>
        h?.includes('left') || h?.includes('right');
      const isVerticalHandle = (h: string) => h === 'top' || h === 'bottom';

      const sourceIsHorizontal = isHorizontalHandle(sourceHandle);
      const targetIsHorizontal = isHorizontalHandle(targetHandle);
      const sourceIsVertical = isVerticalHandle(sourceHandle);
      const targetIsVertical = isVerticalHandle(targetHandle);

      if (sourceIsHorizontal && !targetIsHorizontal) return false;
      if (sourceIsVertical && !targetIsVertical) return false;

      // Vertical connections must be bottom -> top
      if (sourceIsVertical && targetIsVertical) {
        if (sourceHandle !== 'bottom' || targetHandle !== 'top') return false;
      }

      return true;
    },
    [nodes]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return;
      if (!isValidConnection(params)) return;

      const sourceNode = nodes.find((n) => n.id === params.source);
      const targetNode = nodes.find((n) => n.id === params.target);
      const sourceIsJunction = sourceNode?.type === 'junction';
      const targetIsJunction = targetNode?.type === 'junction';

      // Junction edges are persisted in the store as their own entity and
      // skip the type picker entirely.
      if (sourceIsJunction || targetIsJunction) {
        addJunctionEdge({
          id: `je-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle ?? undefined,
          targetHandle: params.targetHandle ?? undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        return;
      }

      const sourceHandle = params.sourceHandle || '';
      const targetHandle = params.targetHandle || '';
      const isHorizontalConnection =
        sourceHandle.includes('left') ||
        sourceHandle.includes('right') ||
        targetHandle.includes('left') ||
        targetHandle.includes('right');

      // Stash the pending connection and show a picker; the user chooses the
      // relationship type before we commit it to the store.
      const sourceEl = document.querySelector(
        `[data-id="${params.source}"]`
      ) as HTMLElement | null;
      const targetEl = document.querySelector(
        `[data-id="${params.target}"]`
      ) as HTMLElement | null;
      let screenX = window.innerWidth / 2;
      let screenY = window.innerHeight / 2;
      if (sourceEl && targetEl) {
        const a = sourceEl.getBoundingClientRect();
        const b = targetEl.getBoundingClientRect();
        screenX = (a.left + a.width / 2 + b.left + b.width / 2) / 2;
        screenY = (a.top + a.height / 2 + b.top + b.height / 2) / 2;
      }

      setPendingConnection({
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        screenX,
        screenY,
        axis: isHorizontalConnection ? 'horizontal' : 'vertical',
      });
    },
    [addJunctionEdge, isValidConnection, nodes]
  );

  const handlePickRelationshipType = useCallback(
    (type: RelationshipType) => {
      if (!pendingConnection) return;
      addRelationship({
        id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        person1Id: pendingConnection.source,
        person2Id: pendingConnection.target,
        type,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      setPendingConnection(null);
    },
    [pendingConnection, addRelationship]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedPerson(null);
    setSelectedRelationship(null);
  }, [setSelectedPerson, setSelectedRelationship]);

  return (
    <div className="w-full h-screen relative">
      <ReactFlowProvider>
        <Toolbar />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        </ReactFlow>
        <PersonSearch />
        <InfoPanel />
        <RelationshipInspector />
        <KeyboardShortcuts />
        {pendingConnection && (
          <ConnectionPicker
            pending={pendingConnection}
            onPick={handlePickRelationshipType}
            onCancel={() => setPendingConnection(null)}
          />
        )}
      </ReactFlowProvider>
    </div>
  );
}
