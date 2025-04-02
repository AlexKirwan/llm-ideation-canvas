'use client';

import { useRef } from 'react';
import { Rnd } from 'react-rnd';
import { useCanvasStore } from '../../store/canvasStore';
import ChatWindow from '../Chat/ChatWindow';
import KanbanBoard from '../Board/KanbanBoard';
import SystemMap from '../SystemMap/SystemMap';
import PostIt from './PostIt';
import type { VerseComponent as ComponentType } from '../../types';
import type { PostItData } from '../../types';

interface VerseComponentProps {
  verseId: string;
  component: ComponentType;
}

export default function VerseComponent({
  verseId,
  component
}: VerseComponentProps) {
  const { 
    updateComponentPosition, 
    updateComponentSize, 
    setActiveComponent,
    updateCardColumn,
    updateSystemMapNode,
    updateSystemMapNodeLabel,
    updateSystemMapEdgeLabel,
    removeComponent,
    verses
  } = useCanvasStore();
  
  const rndRef = useRef<Rnd>(null);
  const verse = verses.find(v => v.id === verseId);
  
  if (!verse) return null;
  
  const handleResizeStop = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _e: any,
    _direction: string,
    ref: HTMLElement,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _delta: any,
    position: { x: number; y: number }
  ) => {
    updateComponentSize(verseId, component.id, {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height)
    });
    updateComponentPosition(verseId, component.id, position);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragStop = (_e: any, d: { x: number; y: number }) => {
    updateComponentPosition(verseId, component.id, { x: d.x, y: d.y });
  };

  const handleClick = () => {
    setActiveComponent(verseId, component.id);
  };
  
  const renderComponentContent = () => {
    console.log('Rendering component of type:', component.type, 'with data:', component.data);
    switch (component.type) {
      case 'chat':
        return <ChatWindow verseId={verseId} />;
      case 'board':
        return verse.boardCards ? (
          <KanbanBoard 
            cards={verse.boardCards}
            onClose={() => removeComponent(verseId, component.id)} // Remove this component
            onCardMove={(cardId, newColumn) => updateCardColumn(verseId, cardId, newColumn)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            No data available for board
          </div>
        );
      case 'systemMap':
        return verse.systemMapData ? (
          <SystemMap 
            data={verse.systemMapData}
            onClose={() => removeComponent(verseId, component.id)}
            onNodeMove={(nodeId, x, y) => updateSystemMapNode(verseId, nodeId, x, y)}
            onNodeEdit={(nodeId, label) => updateSystemMapNodeLabel(verseId, nodeId, label)}
            onEdgeEdit={(edgeId, label) => updateSystemMapEdgeLabel(verseId, edgeId, label)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            No data available for system map
          </div>
        );
      case 'postIt':
        return (
          <PostIt 
            verseId={verseId}
            componentId={component.id}
            data={component.data as PostItData}
          />
        );
      default:
        return <div>Unknown component type</div>;
    }
  };

  // For PostIt notes, handle directly in the Verse component
  if (component.type === 'postIt') {
    return null;
  }

  // For all other components, use Rnd as before
  return (
    <Rnd
      ref={rndRef}
      size={{ width: component.size.width, height: component.size.height }}
      position={{ x: component.position.x, y: component.position.y }}
      enableResizing={{
        top: true, right: true, bottom: true, left: true,
        topRight: true, topLeft: true, bottomRight: true, bottomLeft: true
      }}
      resizeHandleStyles={{
        bottomRight: { cursor: 'nwse-resize' },
        bottomLeft: { cursor: 'nesw-resize' },
        topRight: { cursor: 'nesw-resize' },
        topLeft: { cursor: 'nwse-resize' },
        right: { cursor: 'ew-resize' },
        left: { cursor: 'ew-resize' },
        top: { cursor: 'ns-resize' },
        bottom: { cursor: 'ns-resize' }
      }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onClick={handleClick}
      style={{
        zIndex: component.zIndex,
        position: 'absolute', // Ensure absolute positioning
        visibility: 'visible', // Force visibility
        display: 'block', // Force display
      }}
      dragHandleClassName="component-header"
      bounds="parent"
      minWidth={200}
      minHeight={200}
      className="verse-component rounded-lg overflow-hidden border-2 border-gray-300"
    >
      <div className="w-full h-full flex flex-col">
        <div className="component-header p-4 cursor-move flex justify-between items-center bg-blue-300">
          <div className="text-sm font-medium">
            {component.type === 'chat' 
              ? 'Chat' 
              : component.type === 'board' 
                ? 'Insights Board' 
                : 'System Map'}
          </div>
          <div className="flex items-center gap-1">
            <div className="text-xs text-gray-500">Drag header to move</div>
          </div>
        </div>
        <div className="flex-1 p-2 overflow-auto">
          {renderComponentContent()}
        </div>
      </div>
    </Rnd>
  );
}