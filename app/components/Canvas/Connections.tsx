'use client';

import { useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';

interface ConnectionsProps {
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
}

export default function Connections({ canvasPosition, canvasZoom }: ConnectionsProps) {
  const { verses } = useCanvasStore();
  
  // Find all parent-child relationships for drawing connections
  const connections = useMemo(() => {
    const result = [];
    
    for (const verse of verses) {
      const children = verses.filter(child => child.parentId === verse.id);
      
      for (const child of children) {
        // Calculate start and end points for the connector line
        const startX = verse.position.x + verse.size.width / 2;
        const startY = verse.position.y + verse.size.height / 2;
        const endX = child.position.x + child.size.width / 2;
        const endY = child.position.y + child.size.height / 2;
        
        result.push({
          id: `${verse.id}-${child.id}`,
          startX,
          startY,
          endX,
          endY
        });
      }
    }
    
    return result;
  }, [verses]);
  
  if (connections.length === 0) return null;
  
  return (
    <svg 
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
      style={{
        position: 'absolute',
        zIndex: 5,
        transformOrigin: '0 0',
        transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`
      }}
      width="100%"
      height="100%"
      viewBox="0 0 10000 10000"
      preserveAspectRatio="none"
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
        </marker>
      </defs>
      
      {connections.map(conn => (
        <line
          key={conn.id}
          x1={conn.startX}
          y1={conn.startY}
          x2={conn.endX}
          y2={conn.endY}
          stroke="#3b82f6"
          strokeWidth={2}
          strokeDasharray="5,5"
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  );
}