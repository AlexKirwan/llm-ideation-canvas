'use client';

import { useState, MouseEvent as ReactMouseEvent, useRef, useEffect, useMemo } from 'react';
import type { DraggableEvent } from 'react-draggable';
import type { DraggableData } from 'react-draggable';
import { Rnd } from 'react-rnd';
import { useCanvasStore } from '../../store/canvasStore';
import SystemPromptEditor from '../SystemPromptEditor';
import VerseComponent from './VerseComponent';
import type { Verse as VerseType } from '../../types';
import type { SystemMapData } from '../SystemMap/SystemMap';
import type { BoardCard } from '../Board';
import { availableModels } from '../../types';


interface VerseProps {
  verse: VerseType;
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
}

export default function Verse({ verse, canvasPosition, canvasZoom }: VerseProps) {
  const { 
    updateVersePosition, 
    updateVerseSize,
    setActiveVerse, 
    removeVerse, 
    activeVerseId, 
    branchVerse,
    addComponent,
    updateBoardCards,
    updateSystemMapData,
    updateVerseName
  } = useCanvasStore();
  
  const [showSystemPromptEditor, setShowSystemPromptEditor] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingSystemMap, setIsGeneratingSystemMap] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [verseName, setVerseName] = useState(verse.name || `Verse ${verse.id.slice(0, 4)}`);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [selectedBranchModel, setSelectedBranchModel] = useState(verse.modelId);
  
  // Reference to the content container
  const contentRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // State for message-level branching
  const [branchMessageId, setBranchMessageId] = useState<string | null>(null);
  
  // Update local name state when verse name changes externally
  useEffect(() => {
    setVerseName(verse.name || `Verse ${verse.id.slice(0, 4)}`);
  }, [verse.name, verse.id]);
  
  // Function to handle message branching
  const handleBranchFromMessage = (messageId: string) => {
    console.log('Verse received branch request for message:', messageId);
    // Store the message ID and show model picker
    setBranchMessageId(messageId);
    setSelectedBranchModel(verse.modelId);
    setShowModelPicker(true);
  };
  
  // Listen for branchFromMessage event
  useEffect(() => {
    const handleBranchEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      // Check if the event is for this verse by checking any chat components
      const messageId = customEvent.detail?.messageId;
      if (messageId) {
        console.log('Checking if message exists in verse:', verse.id);
        // Find if this message belongs to this verse
        const messageExists = verse.chatHistory.some(msg => msg.id === messageId);
        if (messageExists) {
          console.log('Message found in verse, initiating branch');
          handleBranchFromMessage(messageId);
        }
      }
    };
    
    // Add event listener
    document.addEventListener('branchFromMessage', handleBranchEvent);
    
    // Clean up
    return () => {
      document.removeEventListener('branchFromMessage', handleBranchEvent);
    };
  }, [verse.id, verse.chatHistory, verse.modelId]);

  const handleDragStop = (_e: DraggableEvent, d: DraggableData) => {
    // Convert position to account for canvas zoom and position
    // When zoom is 0.01 (1%), a 1px screen movement = 100px canvas movement
    const adjustedX = (d.x - canvasPosition.x) / canvasZoom;
    const adjustedY = (d.y - canvasPosition.y) / canvasZoom;
    
    updateVersePosition(verse.id, { 
      x: adjustedX, 
      y: adjustedY 
    });
  };

  const handleResizeStop = (
    _e: MouseEvent | TouchEvent, 
    _direction: string, 
    ref: HTMLElement,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    _delta: any,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
    _position: any
  ) => {
    // Convert the visual size back to logical size based on zoom level
    // This ensures when you resize at 1% zoom, you're resizing the actual size accordingly
    updateVerseSize(verse.id, {
      width: parseInt(ref.style.width) / canvasZoom,
      height: parseInt(ref.style.height) / canvasZoom
    });
  };

  const handleClick = (e: ReactMouseEvent) => {
    // Set this verse as active when clicked
    setActiveVerse(verse.id);
    e.stopPropagation();
  };
  
  // We've removed internal verse panning to make the verse behave like a simple frame

  const handleClose = (e: ReactMouseEvent) => {
    e.stopPropagation();
    removeVerse(verse.id);
  };

  const handleBranch = (e: ReactMouseEvent) => {
    e.stopPropagation();
    // Show model picker before creating branch
    setSelectedBranchModel(verse.modelId); // Default to same model as parent
    setShowModelPicker(true);
  };
  
  const handleCreateBranch = (messageId?: string) => {
    branchVerse(verse.id, selectedBranchModel, messageId);
    setShowModelPicker(false);
  };
  
  const handleSystemPromptClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setShowSystemPromptEditor(true);
  };
  
  // Start editing the verse name
  const handleNameClick = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setIsEditingName(true);
    // Focus the input after rendering
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  };
  
  // Save the verse name
  const handleNameSave = () => {
    const trimmedName = verseName.trim();
    if (trimmedName) {
      updateVerseName(verse.id, trimmedName);
    } else {
      // Reset to default if empty
      setVerseName(verse.name || `Verse ${verse.id.slice(0, 4)}`);
    }
    setIsEditingName(false);
  };
  
  // Handle input keydown events
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setIsEditingName(false);
      setVerseName(verse.name || `Verse ${verse.id.slice(0, 4)}`);
    }
  };
  
  // Removed unused function handleAddChat
  
  const handleGenerateSystemMap = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    
    // If already generating, don't do anything
    if (isGeneratingSystemMap) return;
    
    // If we already have a system map, just add a component
    if (verse.systemMapData && verse.systemMapData.nodes.length > 0) {
      addComponent(verse.id, 'systemMap');
      return;
    }
    
    // Otherwise, generate a new system map
    setIsGeneratingSystemMap(true);
    
    // Mock data for system map (for development without API)
    const mockSystemMapData: SystemMapData = {
      nodes: [
        { id: "user1", label: "End User", type: "user", x: 500, y: 100 },
        { id: "ui1", label: "Web Frontend", type: "component", x: 300, y: 200 },
        { id: "ui2", label: "Mobile App", type: "component", x: 700, y: 200 },
        { id: "api1", label: "API Gateway", type: "service", x: 500, y: 300 },
        { id: "auth", label: "Auth Service", type: "service", x: 300, y: 400 },
        { id: "core", label: "Core Service", type: "service", x: 500, y: 400 },
        { id: "notif", label: "Notification Service", type: "service", x: 700, y: 400 },
        { id: "db1", label: "User Database", type: "database", x: 300, y: 500 },
        { id: "db2", label: "Main Database", type: "database", x: 500, y: 500 },
        { id: "ext1", label: "Payment Provider", type: "external", x: 700, y: 500 }
      ],
      edges: [
        { id: "e1", source: "user1", target: "ui1" },
        { id: "e2", source: "user1", target: "ui2" },
        { id: "e3", source: "ui1", target: "api1" },
        { id: "e4", source: "ui2", target: "api1" },
        { id: "e5", source: "api1", target: "auth", label: "authenticate" },
        { id: "e6", source: "api1", target: "core", label: "process" },
        { id: "e7", source: "api1", target: "notif", label: "notify" },
        { id: "e8", source: "auth", target: "db1" },
        { id: "e9", source: "core", target: "db2" },
        { id: "e10", source: "core", target: "ext1", label: "payments" }
      ]
    };
    
    try {
      // Filter out system messages
      const messages = verse.chatHistory.filter(msg => msg.role !== 'system');
      
      if (messages.length === 0) {
        alert('Start a conversation first to generate a system map.');
        setIsGeneratingSystemMap(false);
        return;
      }
      
      // Get API key from localStorage if available
      let apiKey = '';
      if (typeof window !== 'undefined') {
        apiKey = localStorage.getItem('apiSecret') || '';
      }
      
      // Use mock data in development to avoid API calls
      let data: SystemMapData;
      
      try {
        // Call our API to analyze the conversation
        const response = await fetch('/api/systemmap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages,
            apiKey // Include API key with the request
          }),
        });
        
        if (!response.ok) {
          data = mockSystemMapData as SystemMapData;
        } else {
          data = await response.json();
        }
      } catch {
        data = mockSystemMapData;
      }
      
      // Save the system map data to the verse
      updateSystemMapData(verse.id, data);
      
      // Add the system map component
      addComponent(verse.id, 'systemMap');
    } catch {
      alert('Error generating system map. Please try again.');
    } finally {
      setIsGeneratingSystemMap(false);
    }
  };
  
  const handleAddBoard = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    
    // If already analyzing, don't do anything
    if (isAnalyzing) return;
    
    // If we already have insights, just add a board component
    if (verse.boardCards && verse.boardCards.length > 0) {
      addComponent(verse.id, 'board');
      return;
    }
    
    // Otherwise, generate new insights
    setIsAnalyzing(true);
    
    // Mock data for development without API
    const mockInsightData: {
      elaborate: Array<{ id: string; content: string; column: 'elaborate' }>;
      problems: Array<{ id: string; content: string; column: 'problems' }>;
      solutions: Array<{ id: string; content: string; column: 'solutions' }>;
    } = {
      elaborate: [
        { id: "elab-1", content: "Explore user authentication options including OAuth and JWT", column: "elaborate" },
        { id: "elab-2", content: "Consider microservices architecture for better scalability", column: "elaborate" },
        { id: "elab-3", content: "Investigate real-time data synchronization solutions", column: "elaborate" }
      ],
      problems: [
        { id: "prob-1", content: "Backend performance bottlenecks under high load", column: "problems" },
        { id: "prob-2", content: "Mobile responsiveness issues on smaller screens", column: "problems" },
        { id: "prob-3", content: "Data consistency challenges across distributed systems", column: "problems" }
      ],
      solutions: [
        { id: "sol-1", content: "Implement caching layer with Redis", column: "solutions" },
        { id: "sol-2", content: "Adopt mobile-first design approach with Tailwind CSS", column: "solutions" },
        { id: "sol-3", content: "Use event sourcing pattern for data integrity", column: "solutions" }
      ]
    };
    
    try {
      // Filter out system messages
      const messages = verse.chatHistory.filter(msg => msg.role !== 'system');
      
      if (messages.length === 0) {
        alert('Start a conversation first to generate insights.');
        setIsAnalyzing(false);
        return;
      }
      
      // Get API key from localStorage if available
      let apiKey = '';
      if (typeof window !== 'undefined') {
        apiKey = localStorage.getItem('apiSecret') || '';
      }
      
      // Use mock data in development to avoid API calls
      let data: { elaborate: BoardCard[]; problems: BoardCard[]; solutions: BoardCard[]; };
      
      try {
        // Call our API to analyze the conversation
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            messages,
            apiKey // Include API key with the request
          }),
        });
        
        if (!response.ok) {
          const typedData = mockInsightData as { elaborate: Array<{ id: string; content: string }>; problems: Array<{ id: string; content: string }>; solutions: Array<{ id: string; content: string }> };
          data = {
            elaborate: typedData.elaborate.map(card => ({ id: card.id, content: card.content, column: 'elaborate' } as BoardCard)),
            problems: typedData.problems.map(card => ({ id: card.id, content: card.content, column: 'problems' } as BoardCard)),
            solutions: typedData.solutions.map(card => ({ id: card.id, content: card.content, column: 'solutions' } as BoardCard))
          };
        } else {
          data = await response.json();
        }
      } catch {
        data = mockInsightData;
      }
      
      // Flatten the categories into one array
      const allCards = [
        ...(data.elaborate || []),
        ...(data.problems || []),
        ...(data.solutions || []),
      ];
      
      // Save the cards to the verse
      updateBoardCards(verse.id, allCards);
      
      // Add the board component
      addComponent(verse.id, 'board');
    } catch {
      alert('Error generating insights. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Check if this verse is active
  const isActive = activeVerseId === verse.id;
  
  // Get the model name for display
  const modelName = useMemo(() => {
    const model = availableModels.find(m => m.id === verse.modelId);
    return model ? model.name : 'Unknown Model';
  }, [verse.modelId]);

  return (
    <Rnd
      position={{
        // Position elements with proper Miro-style scaling
        // The zoom factor directly applies to both position and size
        x: verse.position.x * canvasZoom + canvasPosition.x,
        y: verse.position.y * canvasZoom + canvasPosition.y
      }}
      size={{
        // Scale size directly with zoom factor
        // This ensures at 1% zoom (0.01), elements are actually 1% of their size
        width: verse.size.width * canvasZoom,
        height: verse.size.height * canvasZoom
      }}
      className={`verse bg-gray-50 dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden border-2 border-dashed  
                 transition-shadow ${isActive ? 'shadow-xl border-black dark:border-black' : 'border-gray-400 dark:border-gray-700'}`}
      style={{
        zIndex: 10 + verse.zIndex, // Ensure verses are above connection lines (z-index: 5) but maintain relative order
      }}
      enableResizing={{
        top: true, right: true, bottom: true, left: true,
        topRight: true, topLeft: true, bottomRight: true, bottomLeft: true
      }}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onClick={handleClick}
      dragHandleClassName="verse-header"
      minWidth={300}
      minHeight={200}
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
      disableDragging={false} // Allow dragging beyond parent bounds
    >
      <div className="w-full h-full flex flex-col">
        {/* Workspace header with absolute positioning to ensure it's always visible */}
        <div className="verse-header flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-800 cursor-move border-b border-gray-300 dark:border-gray-700 z-20 relative">
          <div className="text-sm font-medium flex items-center gap-1 overflow-hidden">
            {verse.parentId && (
              <span className="text-xs px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-blue-700 dark:text-blue-300 shrink-0 mr-1">
                Branch
              </span>
            )}
            <span className={`text-xs px-1 py-0.5 rounded shrink-0 mr-1 ${
              (verse.modelId || '').includes('claude') 
                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' 
                : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
            }`} title={`Using ${modelName}`}>
              {(verse.modelId || '').includes('claude') ? 'Claude' : 'GPT'}
            </span>
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={verseName}
                onChange={(e) => setVerseName(e.target.value)}
                onBlur={handleNameSave}
                onKeyDown={handleNameKeyDown}
                className="px-1 py-0.5 text-sm bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-[200px]"
                autoFocus
              />
            ) : (
              <div 
                onClick={handleNameClick}
                className="px-1 py-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-text truncate max-w-[200px]"
                title="Click to edit verse name"
              >
                {verse.name || `Verse ${verse.id.slice(0, 4)}`}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            
            <button
              type="button"
              className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900 text-green-600"
              onClick={handleSystemPromptClick}
              title="Edit system prompt"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600"
              onClick={handleBranch}
              title="Branch from this verse"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 3v12"></path>
                <circle cx="18" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <path d="M18 9a9 9 0 0 1-9 9"></path>
              </svg>
              <title>Branch verse</title>
            </button>
            <button 
              type="button"
              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500"
              onClick={handleClose}
            >
              ✕
            </button>
          </div>
        </div>
        
        {/* Content area - acts as a fixed frame that clips its contents */}
        <div className="flex-1 overflow-hidden relative mt-0">
          <div 
            ref={contentRef}
            className="h-full m-1 rounded relative overflow-hidden"
          >
            {/* Content container - simple container without transforms */}
            <div className="absolute inset-0 overflow-hidden">
              {/* Render all components */}
              {verse.components.map(component => (
                <VerseComponent
                  key={component.id}
                  verseId={verse.id}
                  component={component}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* System Prompt Editor Modal */}
      {showSystemPromptEditor && (
        <SystemPromptEditor 
          verseId={verse.id} 
          onClose={() => setShowSystemPromptEditor(false)} 
        />
      )}
      
      {/* Model Picker Modal for Branching */}
      {showModelPicker && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg w-80 max-w-full">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-lg">
                {branchMessageId ? 'Branch from Message' : 'Branch Verse'}
              </h3>
              <button 
                onClick={() => {
                  setShowModelPicker(false);
                  setBranchMessageId(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                {branchMessageId ? (
                  <>
                    <p>Branching from a specific message. Only conversation history up to this message will be included.</p>
                    <p className="mt-2">Choose which AI model to use:</p>
                  </>
                ) : (
                  <p>Choose which AI model to use for this branch:</p>
                )}
              </div>
              
              {/* Claude Models */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-purple-600 dark:text-purple-400">Claude Models</h4>
                <div className="space-y-1">
                  {availableModels
                    .filter(model => model.provider === 'anthropic')
                    .map(model => (
                      <div 
                        key={model.id}
                        onClick={() => setSelectedBranchModel(model.id)}
                        className={`p-2 rounded cursor-pointer flex items-center ${
                          selectedBranchModel === model.id 
                            ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full mr-2 ${
                          selectedBranchModel === model.id 
                            ? 'bg-purple-600 dark:bg-purple-400' 
                            : 'border border-gray-400 dark:border-gray-500'
                        }`} />
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{model.description}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
              
              {/* OpenAI Models */}
              <div>
                <h4 className="text-sm font-medium mb-2 text-blue-600 dark:text-blue-400">GPT Models</h4>
                <div className="space-y-1">
                  {availableModels
                    .filter(model => model.provider === 'openai')
                    .map(model => (
                      <div 
                        key={model.id}
                        onClick={() => setSelectedBranchModel(model.id)}
                        className={`p-2 rounded cursor-pointer flex items-center ${
                          selectedBranchModel === model.id 
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full mr-2 ${
                          selectedBranchModel === model.id 
                            ? 'bg-blue-600 dark:bg-blue-400' 
                            : 'border border-gray-400 dark:border-gray-500'
                        }`} />
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{model.description}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
              
              <div className="flex justify-end pt-3 gap-2">
                <button
                  onClick={() => {
                    setShowModelPicker(false);
                    setBranchMessageId(null);
                  }}
                  className="px-3 py-1 rounded text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateBranch(branchMessageId || undefined)}
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Create Branch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Rnd>
  );
}