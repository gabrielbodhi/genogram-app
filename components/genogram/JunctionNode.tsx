'use client';

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

function JunctionNodeImpl({ selected }: NodeProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative flex h-3 w-3 items-center justify-center pointer-events-auto ${
        selected ? 'ring-2 ring-blue-400 rounded-full' : ''
      }`}
    >
      <div
        className={`h-3 w-3 rounded-full transition-all duration-200 ${
          isHovered ? 'opacity-100 bg-gray-800' : selected ? 'bg-blue-500' : 'opacity-90 bg-gray-700'
        }`}
      />

      <Handle
        id="top"
        type="target"
        position={Position.Top}
        isConnectable
        className={`w-3 h-3 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        isConnectable
        className={`w-3 h-3 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        isConnectable
        className={`w-3 h-3 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        isConnectable
        className={`w-3 h-3 rounded-full transition-opacity duration-200 ${isHovered ? 'opacity-100 bg-blue-500' : 'opacity-0'}`}
      />
    </div>
  );
}

export const JunctionNode = memo(JunctionNodeImpl);
