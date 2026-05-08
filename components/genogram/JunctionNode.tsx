'use client';

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

/**
 * Junction nodes are non-interactive routing points used by the auto-layout
 * to draw clean sibling lines (genogram convention). They are not exposed in
 * the UI; users do not create, click, or delete them directly.
 */
function JunctionNodeImpl() {
  return (
    <div
      aria-hidden
      className="relative flex h-2 w-2 items-center justify-center pointer-events-none"
    >
      {/* Tiny dot at the routing point so the meeting of lines reads cleanly
          even when the surrounding strokes don't perfectly align on retina. */}
      <div className="h-1 w-1 rounded-full bg-gray-700 opacity-70" />

      <Handle id="top" type="target" position={Position.Top} isConnectable={false} className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="bottom" type="source" position={Position.Bottom} isConnectable={false} className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="left" type="source" position={Position.Left} isConnectable={false} className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent" />
      <Handle id="right" type="source" position={Position.Right} isConnectable={false} className="!h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent" />
    </div>
  );
}

export const JunctionNode = memo(JunctionNodeImpl);
