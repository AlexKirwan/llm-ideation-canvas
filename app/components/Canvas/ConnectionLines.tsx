'use client';

import React, { useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';

interface ConnectionLinesProps {
  canvasZoom: number;
}

export default function ConnectionLines({ canvasZoom }: ConnectionLinesProps) {
  const { verses } = useCanvasStore();
  const [connections, setConnections] = useState<React.ReactElement[]>([]);
  
  useEffect(() => {
    const svgElements: React.ReactElement[] = [];
    
    verses.forEach(verse => {
      const children = verses.filter(child => child.parentId === verse.id);
      
      children.forEach(child => {
        // Calculate center points for both verses
        const startX = verse.position.x + verse.size.width / 2;
        const startY = verse.position.y + verse.size.height / 2;
        const endX = child.position.x + child.size.width / 2;
        const endY = child.position.y + child.size.height / 2;
        
        // Create a separate SVG for each connection line
        svgElements.push(
          <svg 
            key={`${verse.id}-${child.id}`}
            className="absolute pointer-events-none"
            style={{
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
            }}
          >
            <line
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke="#3b82f6"
              strokeWidth={3 / canvasZoom}
              strokeDasharray="5,5"
              markerEnd="url(#arrowhead)"
            />
          </svg>
        );
      });
    });
    
    // Only update state if connections changed
    if (svgElements.length > 0 || connections.length > 0) {
      setConnections(svgElements);
    }
  }, [verses, canvasZoom, connections.length]);
  
  if (connections.length === 0) return null;
  
  return (
    <>
      {/* Define the arrowhead marker */}
      <svg 
        className="absolute" 
        style={{ width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
      </svg>
      
      {/* Render all connection lines */}
      {connections}
    </>
  );
}