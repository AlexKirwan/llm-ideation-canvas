import { useState, useRef, MouseEvent as ReactMouseEvent, useEffect } from 'react';

export interface SystemMapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'component' | 'service' | 'database' | 'user' | 'external';
}

export interface SystemMapEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface SystemMapData {
  nodes: SystemMapNode[];
  edges: SystemMapEdge[];
}

interface SystemMapProps {
  data: SystemMapData;
  onClose: () => void;
  onNodeMove?: (nodeId: string, x: number, y: number) => void;
  onNodeEdit?: (nodeId: string, newLabel: string) => void;
  onEdgeEdit?: (edgeId: string, newLabel: string) => void;
}

export default function SystemMap({ 
  data, 
  onClose, 
  onNodeMove,
  onNodeEdit,
  onEdgeEdit
}: SystemMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number, y: number } | null>(null);
  const [editNode, setEditNode] = useState<string | null>(null);
  const [editEdge, setEditEdge] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  
  // Node type visual representations
  const nodeStyles = {
    component: {
      fill: "#3b82f6",
      shape: "rect",
      width: 120,
      height: 40,
      rx: 5
    },
    service: {
      fill: "#10b981",
      shape: "rect",
      width: 120, 
      height: 40,
      rx: 5
    },
    database: {
      fill: "#6366f1",
      shape: "cylinder",
      width: 100,
      height: 60,
      rx: 0
    },
    user: {
      fill: "#f59e0b",
      shape: "ellipse",
      width: 100,
      height: 40,
      rx: 20
    },
    external: {
      fill: "#9CA3AF",
      shape: "rect",
      width: 120,
      height: 40,
      rx: 0
    }
  };

  const handleDragStart = (nodeId: string, e: ReactMouseEvent) => {
    setDraggedNode(nodeId);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleNodeDoubleClick = (nodeId: string) => {
    if (!onNodeEdit) return;
    
    const node = data.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setEditNode(nodeId);
    setEditLabel(node.label);
  };

  const handleEdgeDoubleClick = (edgeId: string) => {
    if (!onEdgeEdit) return;
    
    const edge = data.edges.find(e => e.id === edgeId);
    if (!edge) return;
    
    setEditEdge(edgeId);
    setEditLabel(edge.label || '');
  };

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditLabel(e.target.value);
  };

  const handleLabelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editNode && onNodeEdit) {
      onNodeEdit(editNode, editLabel);
      setEditNode(null);
    } else if (editEdge && onEdgeEdit) {
      onEdgeEdit(editEdge, editLabel);
      setEditEdge(null);
    }
  };

  useEffect(() => {
    // Define handlers inside the effect to avoid dependency issues
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      if (!draggedNode || !dragStartPos || !onNodeMove) return;
      
      const node = data.nodes.find(n => n.id === draggedNode);
      if (!node) return;
      
      const dx = e.clientX - dragStartPos.x;
      const dy = e.clientY - dragStartPos.y;
      
      onNodeMove(draggedNode, node.x + dx, node.y + dy);
      setDragStartPos({
        x: e.clientX,
        y: e.clientY
      });
    };

    const handleGlobalMouseUp = () => {
      if (draggedNode) {
        setDraggedNode(null);
        setDragStartPos(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggedNode, dragStartPos, data.nodes, onNodeMove]);

  // Function to calculate path between nodes
  const getEdgePath = (edge: SystemMapEdge) => {
    const source = data.nodes.find(n => n.id === edge.source);
    const target = data.nodes.find(n => n.id === edge.target);
    
    if (!source || !target) return '';
    
    const sourceStyle = nodeStyles[source.type];
    const targetStyle = nodeStyles[target.type];
    
    // Define start and end points
    let startX = source.x;
    let startY = source.y;
    let endX = target.x;
    let endY = target.y;
    
    // Calculate edge path
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    
    // Calculate start and end points on node boundaries
    if (sourceStyle.shape === 'rect') {
      const halfWidth = sourceStyle.width / 2;
      const halfHeight = sourceStyle.height / 2;
      
      // Determine which side to exit from
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        // Exit from left or right
        startX += Math.cos(angle) > 0 ? halfWidth : -halfWidth;
        startY += Math.sin(angle) * (halfWidth / Math.abs(Math.cos(angle)));
      } else {
        // Exit from top or bottom
        startX += Math.cos(angle) * (halfHeight / Math.abs(Math.sin(angle)));
        startY += Math.sin(angle) > 0 ? halfHeight : -halfHeight;
      }
    } else if (sourceStyle.shape === 'ellipse') {
      // For ellipse, we exit along the angle
      const rx = sourceStyle.width / 2;
      const ry = sourceStyle.height / 2;
      const ex = rx * Math.cos(angle);
      const ey = ry * Math.sin(angle);
      startX += ex;
      startY += ey;
    } else if (sourceStyle.shape === 'cylinder') {
      // Simplified cylinder exit point
      const halfWidth = sourceStyle.width / 2;
      const halfHeight = sourceStyle.height / 2;
      
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        startX += Math.cos(angle) > 0 ? halfWidth : -halfWidth;
        startY += Math.sin(angle) * (halfWidth / Math.abs(Math.cos(angle)));
      } else {
        startX += Math.cos(angle) * (halfHeight / Math.abs(Math.sin(angle)));
        startY += Math.sin(angle) > 0 ? halfHeight : -halfHeight;
      }
    }
    
    // Similar for target node
    if (targetStyle.shape === 'rect') {
      const halfWidth = targetStyle.width / 2;
      const halfHeight = targetStyle.height / 2;
      
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        endX -= Math.cos(angle) > 0 ? halfWidth : -halfWidth;
        endY -= Math.sin(angle) * (halfWidth / Math.abs(Math.cos(angle)));
      } else {
        endX -= Math.cos(angle) * (halfHeight / Math.abs(Math.sin(angle)));
        endY -= Math.sin(angle) > 0 ? halfHeight : -halfHeight;
      }
    } else if (targetStyle.shape === 'ellipse') {
      const rx = targetStyle.width / 2;
      const ry = targetStyle.height / 2;
      const ex = rx * Math.cos(angle);
      const ey = ry * Math.sin(angle);
      endX -= ex;
      endY -= ey;
    } else if (targetStyle.shape === 'cylinder') {
      const halfWidth = targetStyle.width / 2;
      const halfHeight = targetStyle.height / 2;
      
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        endX -= Math.cos(angle) > 0 ? halfWidth : -halfWidth;
        endY -= Math.sin(angle) * (halfWidth / Math.abs(Math.cos(angle)));
      } else {
        endX -= Math.cos(angle) * (halfHeight / Math.abs(Math.sin(angle)));
        endY -= Math.sin(angle) > 0 ? halfHeight : -halfHeight;
      }
    }
    
    // Calculate control points for a curved path
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const offset = 30;
    
    // Perpendicular offset to create a curve
    const nx = -Math.sin(angle) * offset;
    const ny = Math.cos(angle) * offset;
    
    return `M ${startX},${startY} Q ${midX + nx},${midY + ny} ${endX},${endY}`;
  };

  // Function to render node shape based on type
  const renderNode = (node: SystemMapNode) => {
    const style = nodeStyles[node.type];
    const textX = node.x;
    const textY = node.y;
    
    switch (style.shape) {
      case 'rect':
        return (
          <g key={node.id}>
            <rect
              x={node.x - style.width / 2}
              y={node.y - style.height / 2}
              width={style.width}
              height={style.height}
              rx={style.rx}
              fill={style.fill}
              stroke="#FFFFFF"
              strokeWidth={2}
              className="cursor-move"
              onMouseDown={(e) => handleDragStart(node.id, e as unknown as ReactMouseEvent)}
              onDoubleClick={() => handleNodeDoubleClick(node.id)}
            />
            <text
              x={textX}
              y={textY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
            >
              {node.label}
            </text>
          </g>
        );
      
      case 'ellipse':
        return (
          <g key={node.id}>
            <ellipse
              cx={node.x}
              cy={node.y}
              rx={style.width / 2}
              ry={style.height / 2}
              fill={style.fill}
              stroke="#FFFFFF"
              strokeWidth={2}
              className="cursor-move"
              onMouseDown={(e) => handleDragStart(node.id, e as unknown as ReactMouseEvent)}
              onDoubleClick={() => handleNodeDoubleClick(node.id)}
            />
            <text
              x={textX}
              y={textY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
            >
              {node.label}
            </text>
          </g>
        );
      
      case 'cylinder':
        // Simplified cylinder shape
        return (
          <g key={node.id}>
            <rect
              x={node.x - style.width / 2}
              y={node.y - style.height / 2 + 5} // Move down slightly
              width={style.width}
              height={style.height - 10}
              rx={style.rx}
              fill={style.fill}
              stroke="#FFFFFF"
              strokeWidth={2}
              className="cursor-move"
              onMouseDown={(e) => handleDragStart(node.id, e as unknown as ReactMouseEvent)}
              onDoubleClick={() => handleNodeDoubleClick(node.id)}
            />
            <ellipse
              cx={node.x}
              cy={node.y - style.height / 2 + 5}
              rx={style.width / 2}
              ry={10}
              fill={style.fill}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
            <text
              x={textX}
              y={textY}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
            >
              {node.label}
            </text>
          </g>
        );
      
      default:
        return null;
    }
  };

  // Function to render arrow at the end of the edge
  const renderArrow = (edge: SystemMapEdge) => {
    const source = data.nodes.find(n => n.id === edge.source);
    const target = data.nodes.find(n => n.id === edge.target);
    
    if (!source || !target) return null;
    
    // Calculate direction vector
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const angle = Math.atan2(dy, dx);
    
    // Arrow position - calculate from the edge path end
    const targetStyle = nodeStyles[target.type];
    
    // Offset from target to position arrow head
    let offsetX = 0;
    let offsetY = 0;
    
    if (targetStyle.shape === 'rect') {
      const halfWidth = targetStyle.width / 2;
      const halfHeight = targetStyle.height / 2;
      
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        offsetX = Math.cos(angle) > 0 ? -halfWidth : halfWidth;
        offsetY = -Math.sin(angle) * (halfWidth / Math.abs(Math.cos(angle)));
      } else {
        offsetX = -Math.cos(angle) * (halfHeight / Math.abs(Math.sin(angle)));
        offsetY = Math.sin(angle) > 0 ? -halfHeight : halfHeight;
      }
    } else if (targetStyle.shape === 'ellipse') {
      const rx = targetStyle.width / 2;
      const ry = targetStyle.height / 2;
      offsetX = -rx * Math.cos(angle);
      offsetY = -ry * Math.sin(angle);
    } else if (targetStyle.shape === 'cylinder') {
      const halfWidth = targetStyle.width / 2;
      const halfHeight = targetStyle.height / 2;
      
      if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
        offsetX = Math.cos(angle) > 0 ? -halfWidth : halfWidth;
        offsetY = -Math.sin(angle) * (halfWidth / Math.abs(Math.cos(angle)));
      } else {
        offsetX = -Math.cos(angle) * (halfHeight / Math.abs(Math.sin(angle)));
        offsetY = Math.sin(angle) > 0 ? -halfHeight : halfHeight;
      }
    }
    
    const arrowX = target.x + offsetX;
    const arrowY = target.y + offsetY;
    
    // Arrow size
    const arrowSize = 10;
    
    // Calculate arrow points
    const points = [
      [arrowX, arrowY],
      [
        arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
      ],
      [
        arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
        arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
      ]
    ];
    
    return (
      <polygon
        points={points.map(p => p.join(',')).join(' ')}
        fill="#3b82f6"
      />
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-auto">
      <div className="flex justify-between items-center p-2 border-b">
        <h2 className="text-lg font-bold">System Map</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-block w-3 h-3 rounded-full bg-[#3b82f6]"></span>
            <span>Component</span>
            <span className="inline-block w-3 h-3 rounded-full bg-[#10b981]"></span>
            <span>Service</span>
            <span className="inline-block w-3 h-3 rounded-full bg-[#6366f1]"></span>
            <span>Database</span>
            <span className="inline-block w-3 h-3 rounded-full bg-[#f59e0b]"></span>
            <span>User</span>
            <span className="inline-block w-3 h-3 rounded-full bg-[#9CA3AF]"></span>
            <span>External</span>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
            title="Close system map"
          >
            ✕
          </button>
        </div>
      </div>
      
      <div className="relative flex-1">
        <svg 
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid meet"
        >
          <g>
            {/* Render edges */}
            {data.edges.map(edge => (
              <g key={edge.id}>
                <path
                  d={getEdgePath(edge)}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeDasharray={edge.label ? "" : "5,5"}
                  markerEnd="url(#arrowhead)"
                  onDoubleClick={() => handleEdgeDoubleClick(edge.id)}
                />
                {renderArrow(edge)}
                {edge.label && (
                  <text
                    x={((data.nodes.find(n => n.id === edge.source)?.x || 0) + (data.nodes.find(n => n.id === edge.target)?.x || 0)) / 2}
                    y={((data.nodes.find(n => n.id === edge.source)?.y || 0) + (data.nodes.find(n => n.id === edge.target)?.y || 0)) / 2 - 10}
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="12"
                    onDoubleClick={() => handleEdgeDoubleClick(edge.id)}
                    className="cursor-pointer"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            ))}
            
            {/* Render nodes */}
            {data.nodes.map(node => renderNode(node))}
          </g>
        </svg>
        
        {/* Edit modal for labels */}
        {(editNode || editEdge) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
              <h3 className="text-lg font-bold mb-2">
                {editNode ? "Edit Node Label" : "Edit Edge Label"}
              </h3>
              <form onSubmit={handleLabelSubmit}>
                <input
                  type="text"
                  value={editLabel}
                  onChange={handleLabelChange}
                  className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setEditNode(null);
                      setEditEdge(null);
                    }}
                    className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 bg-blue-500 text-white rounded"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}