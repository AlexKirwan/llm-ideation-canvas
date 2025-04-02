'use client';

import { useRef, useEffect, useState, MouseEvent as ReactMouseEvent, useMemo, useCallback } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import Verse from '../Verse/Verse';
import { availableModels, AIModel } from '../../types';
import CanvasControls from './CanvasControls';

export default function Canvas() {
  const { 
    verses, 
    canvasView, 
    addVerse, 
    updateCanvasView, 
    setActiveVerse,
    toggleSelectMode,
    selectedModel,
    setSelectedModel
  } = useCanvasStore();
  
  // State for showing/hiding instructions
  const [showInstructions, setShowInstructions] = useState(false);
  // State for showing/hiding API secret input
  const [showApiSecret, setShowApiSecret] = useState(false);
  // State for showing/hiding model selector
  const [showModelSelector, setShowModelSelector] = useState(false);
  // State for API secret value
  const [apiSecret, setApiSecret] = useState('');
  
  // Add event listener for opening API config from chat error
  // and load API secret from localStorage when component mounts
  useEffect(() => {
    // Load API secret from localStorage
    if (typeof window !== 'undefined') {
      const savedSecret = localStorage.getItem('apiSecret');
      if (savedSecret) {
        setApiSecret(savedSecret);
        console.log('API Secret loaded from localStorage');
      }
    }
    
    const handleOpenApiConfig = () => {
      setShowApiSecret(true);
    };
    
    window.addEventListener('openApiConfig', handleOpenApiConfig);
    
    return () => {
      window.removeEventListener('openApiConfig', handleOpenApiConfig);
    };
  }, []);
  
  // Function to save API secret
  const handleSaveApiSecret = () => {
    // Save to localStorage
    if (typeof window !== 'undefined' && apiSecret) {
      localStorage.setItem('apiSecret', apiSecret);
      console.log('API Secret saved to localStorage');
    }
    setShowApiSecret(false);
  };
  
  // Completely revised zoom levels to match Miro
  // In Miro, the percentage shown is the actual scale
  // 0.01 = 1% (tiny elements), 1.0 = 100% (normal size)
  const ZOOM_LEVELS = useMemo(() => [0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 4.0], []);
  
  // Helper to find nearest zoom level (for wheel/trackpad zooming)
  const findNearestZoomLevel = useCallback((zoom: number): number => {
    // Find the closest zoom level
    let nearestZoom = ZOOM_LEVELS[0];
    let minDiff = Math.abs(zoom - ZOOM_LEVELS[0]);
    
    for (let i = 1; i < ZOOM_LEVELS.length; i++) {
      const diff = Math.abs(zoom - ZOOM_LEVELS[i]);
      if (diff < minDiff) {
        minDiff = diff;
        nearestZoom = ZOOM_LEVELS[i];
      }
    }
    
    return nearestZoom;
  }, [ZOOM_LEVELS]);
  
  // Get next zoom level (for zoom in)
  const getNextZoomLevel = useCallback((currentZoom: number): number => {
    const currentIndex = ZOOM_LEVELS.findIndex(zoom => zoom >= currentZoom);
    
    // If we're already at or beyond the max zoom, return the max
    if (currentIndex >= ZOOM_LEVELS.length - 1) {
      return ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
    }
    
    // Otherwise, return the next level
    return ZOOM_LEVELS[currentIndex + 1];
  }, [ZOOM_LEVELS]);
  
  // Get previous zoom level (for zoom out)
  const getPrevZoomLevel = useCallback((currentZoom: number): number => {
    const currentIndex = ZOOM_LEVELS.findIndex(zoom => zoom >= currentZoom);
    
    // If we're at the beginning or before the first level
    if (currentIndex <= 0) {
      return ZOOM_LEVELS[0];
    }
    
    // Otherwise, return the previous level
    return ZOOM_LEVELS[currentIndex - 1];
  }, [ZOOM_LEVELS]);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvas = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  // Improved canvas drag (panning) with more reliable target detection
  const handleMouseDown = (e: ReactMouseEvent) => {
    // If we're in select mode, don't start panning
    if (canvasView.isSelectMode) return;
    
    // Check if the click target is the canvas or one of its direct children that isn't a verse
    const target = e.target as HTMLElement;
    const isCanvasOrDirectChild = 
      target === canvasRef.current || 
      // Check if it's a direct child of canvas that's not a verse
      (target.parentElement === canvasRef.current && 
       !target.classList.contains('verse') &&
       !target.closest('.verse'));
    
    if (isCanvasOrDirectChild) {
      isDraggingCanvas.current = true;
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      
      // Apply grabbing cursor immediately
      if (canvasRef.current) {
        canvasRef.current.style.cursor = 'grabbing';
      }
      
      // Prevent default behaviors
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (isDraggingCanvas.current) {
      const deltaX = e.clientX - lastMousePosition.current.x;
      const deltaY = e.clientY - lastMousePosition.current.y;
      
      // Update the canvas position based on the drag delta
      updateCanvasView(
        canvasView.zoom, 
        { 
          x: canvasView.position.x + deltaX, 
          y: canvasView.position.y + deltaY 
        }
      );
      
      lastMousePosition.current = { x: e.clientX, y: e.clientY };
      
      // Prevent text selection during drag
      e.preventDefault();
    }
  };

  const handleMouseUp = () => {
    isDraggingCanvas.current = false;
    
    // Reset cursor
    if (canvasRef.current) {
      canvasRef.current.style.cursor = '';
    }
  };

  // Clear active verse when clicking on canvas background
  const handleClick = (e: ReactMouseEvent) => {
    const target = e.target as HTMLElement;
    const isCanvasOrDirectChild = 
      target === canvasRef.current || 
      (target.parentElement === canvasRef.current && 
       !target.classList.contains('verse') &&
       !target.closest('.verse'));
       
    if (isCanvasOrDirectChild) {
      setActiveVerse(null);
    }
  };

  // Create a new verse in a visible position within the view
  const handleAddVerse = () => {
    // Check if user email is set before allowing verses to be added
    const { userEmail } = useCanvasStore.getState();
    if (!userEmail) {
      alert('Please enter your email in the top right panel before creating verses.');
      return;
    }
    
    // Calculate center of the current view
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    
    // Convert screen center to canvas coordinates
    const centerX = (screenWidth / 2 - canvasView.position.x) / canvasView.zoom;
    const centerY = (screenHeight / 2 - canvasView.position.y) / canvasView.zoom;
    
    // Add verse at the calculated position with the current selected model
    addVerse({ x: centerX, y: centerY }, null, selectedModel.id);
  };

  useEffect(() => {
    // Add event listeners for when mouse moves outside the canvas
    const handleGlobalMouseUp = (_e: globalThis.MouseEvent) => {
      isDraggingCanvas.current = false;
      // Reset cursor
      if (canvasRef.current) {
        canvasRef.current.style.cursor = '';
      }
    };
    
    // Global mouse move handler to continue canvas drag even outside the canvas
    const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
      if (isDraggingCanvas.current) {
        const deltaX = e.clientX - lastMousePosition.current.x;
        const deltaY = e.clientY - lastMousePosition.current.y;
        
        updateCanvasView(
          canvasView.zoom, 
          { 
            x: canvasView.position.x + deltaX, 
            y: canvasView.position.y + deltaY 
          }
        );
        
        lastMousePosition.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    
    // Handle wheel events for both zooming and panning
    const handleWheel = (e: WheelEvent) => {
      // If it's a zoom gesture (ctrl/cmd + wheel)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // Determine the target zoom level based on wheel direction
        let newZoom;
        if (e.deltaY > 0) {
          // Wheel down = zoom out (show more canvas) = smaller zoom value
          newZoom = getPrevZoomLevel(canvasView.zoom); // Go toward 1%
        } else {
          // Wheel up = zoom in (show less canvas) = larger zoom value
          newZoom = getNextZoomLevel(canvasView.zoom); // Go toward 400%
        }
        
        // Skip if zoom didn't actually change
        if (newZoom === canvasView.zoom) return;
        
        // Adjust position to zoom toward cursor - this is a critical part of making zoom
        // behavior feel natural, by keeping the point under the cursor fixed during zoom
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          // Get cursor position relative to the viewport
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          // Convert cursor position to canvas coordinates (i.e., where on the virtual canvas is the cursor pointing)
          // The formula reverses the canvas-to-screen transformation
          const mouseXCanvas = (x - canvasView.position.x) / canvasView.zoom;
          const mouseYCanvas = (y - canvasView.position.y) / canvasView.zoom;
          
          // Calculate the new canvas position that will keep the point under the cursor fixed
          // This is the key equation for smooth zooming: newPos = screenPos - canvasPos * newZoom
          const newX = x - mouseXCanvas * newZoom;
          const newY = y - mouseYCanvas * newZoom;
          
          // Apply the zoom and position update
          updateCanvasView(newZoom, { x: newX, y: newY });
        } else {
          // Fallback if we can't get the canvas rect
          updateCanvasView(newZoom, canvasView.position);
        }
      } 
      // Regular wheel event (for panning with mousepad/trackpad)
      else if (!canvasView.isSelectMode) {
        // Prevent default scroll behavior when in pan mode
        e.preventDefault();
        
        // Adjust canvas position (pan)
        // With trackpads, deltaX controls horizontal and deltaY controls vertical
        updateCanvasView(
          canvasView.zoom, 
          { 
            x: canvasView.position.x - e.deltaX, 
            y: canvasView.position.y - e.deltaY 
          }
        );
      }
    };
    
    // Prevent default zoom/scroll behavior
    const preventDefaultZoom = (e: WheelEvent) => {
      // Prevent default for zooming
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
      // Prevent default for mousepad/trackpad scrolling when in pan mode
      else if (!canvasView.isSelectMode) {
        e.preventDefault();
      }
    };
    
    const currentCanvasRef = canvasRef.current;
    currentCanvasRef?.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('wheel', preventDefaultZoom, { passive: false });
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      currentCanvasRef?.removeEventListener('wheel', handleWheel);
      window.removeEventListener('wheel', preventDefaultZoom);
    };
  }, [canvasView.position, canvasView.zoom, canvasView.isSelectMode, updateCanvasView, getNextZoomLevel, getPrevZoomLevel]);

  // Compute connections only when needed - memoize to improve performance
  const connections = useMemo(() => {
    return verses.flatMap(verse => {
      // Fast array filtering only once per verse
      const children = verses.filter(child => child.parentId === verse.id);
      
      if (children.length === 0) return [];
      
      return children.map(child => {
        // Calculate center points for each verse with correct zoom scaling
        const parentCenterX = verse.position.x * canvasView.zoom + canvasView.position.x + (verse.size.width * canvasView.zoom / 2);
        const parentCenterY = verse.position.y * canvasView.zoom + canvasView.position.y + (verse.size.height * canvasView.zoom / 2);
        const childCenterX = child.position.x * canvasView.zoom + canvasView.position.x + (child.size.width * canvasView.zoom / 2);
        const childCenterY = child.position.y * canvasView.zoom + canvasView.position.y + (child.size.height * canvasView.zoom / 2);
        
        // Check if this is a message-level branch
        const isMessageBranch = !!child.branchSourceMessageId;
        
        return {
          id: `${verse.id}-${child.id}`,
          x1: parentCenterX,
          y1: parentCenterY,
          x2: childCenterX,
          y2: childCenterY,
          isMessageBranch // Flag for styling differently
        };
      });
    });
  }, [verses, canvasView.zoom, canvasView.position]);

  return (
    <div 
      ref={canvasRef}
      className="w-full h-screen bg-[#f0f0f0] overflow-hidden relative"
      style={{
        backgroundImage: 'radial-gradient(circle, #00000010 1px, transparent 1px)',
        // Grid size scales with zoom - using max to ensure dots don't disappear at very low zoom
        backgroundSize: `${Math.max(2, 20 * canvasView.zoom)}px ${Math.max(2, 20 * canvasView.zoom)}px`,
        backgroundPosition: `${canvasView.position.x % Math.max(2, 20 * canvasView.zoom)}px ${canvasView.position.y % Math.max(2, 20 * canvasView.zoom)}px`,
        cursor: isDraggingCanvas.current 
          ? 'grabbing' 
          : canvasView.isSelectMode 
            ? 'default' 
            : 'grab'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
    >
      <div className="relative w-screen h-screen">
        {/* Connection lines rendered in a separate container to ensure visibility */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          <svg className="absolute top-0 left-0 w-full h-full">
            <defs>
              <marker
                id="arrowhead"
                markerWidth={Math.max(5, 10 * canvasView.zoom)}
                markerHeight={Math.max(3.5, 7 * canvasView.zoom)}
                refX={Math.max(4.5, 9 * canvasView.zoom)}
                refY={Math.max(1.75, 3.5 * canvasView.zoom)}
                orient="auto"
              >
                <polygon points={`0 0, ${Math.max(5, 10 * canvasView.zoom)} ${Math.max(1.75, 3.5 * canvasView.zoom)}, 0 ${Math.max(3.5, 7 * canvasView.zoom)}`} fill="#3b82f6" />
              </marker>
            </defs>
            
            {/* Render the precomputed connections for better performance */}
            {connections.map(conn => (
              <line 
                key={conn.id}
                x1={conn.x1}
                y1={conn.y1}
                x2={conn.x2}
                y2={conn.y2}
                stroke={conn.isMessageBranch ? "#8b5cf6" : "#3b82f6"} // Purple for message branches, blue for verse branches
                strokeWidth={Math.max(1, 2 * canvasView.zoom)}
                strokeDasharray={conn.isMessageBranch 
                  ? `${Math.max(1, 3 * canvasView.zoom)},${Math.max(1, 3 * canvasView.zoom)}` // Shorter dashes for message branches
                  : `${Math.max(1, 5 * canvasView.zoom)},${Math.max(1, 5 * canvasView.zoom)}`} // Normal dashes for verse branches
                markerEnd="url(#arrowhead)"
              />
            ))}
          </svg>
        </div>
        
        {/* Render the verses */}
        {verses.map((verse) => (
          <Verse 
            key={verse.id} 
            verse={verse} 
            canvasPosition={canvasView.position}
            canvasZoom={canvasView.zoom}
          />
        ))}
      </div>

      {/* Add Verse Button */}
      <button
        onClick={handleAddVerse}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg z-[100] text-2xl"
        aria-label="Add verse"
      >
        +
      </button>
      
      {/* Toolbar - Top Position */}
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg z-[100] flex items-center">
        {/* Select Mode Toggle */}
        <button
          onClick={() => toggleSelectMode(!canvasView.isSelectMode)}
          className={`p-2 flex flex-col items-center justify-center ${
            canvasView.isSelectMode 
              ? 'bg-blue-100 text-blue-600' 
              : 'hover:bg-gray-100'
          }`}
          aria-label={canvasView.isSelectMode ? "Selection mode active" : "Enable selection mode"}
          title={canvasView.isSelectMode ? "Click to disable selection mode" : "Click to enable selection mode"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
            <path d="M13 13l6 6"></path>
          </svg>
          <span className="text-xs mt-1">Select</span>
        </button>
        
        {/* Hand (Pan) Tool */}
        <button
          onClick={() => toggleSelectMode(false)}
          className={`p-2 flex flex-col items-center justify-center ${
            !canvasView.isSelectMode 
              ? 'bg-blue-100 text-blue-600' 
              : 'hover:bg-gray-100'
          }`}
          aria-label={!canvasView.isSelectMode ? "Pan mode active" : "Enable pan mode"}
          title={!canvasView.isSelectMode ? "Click to disable pan mode" : "Click to enable pan mode"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path>
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
          </svg>
          <span className="text-xs mt-1">Hand</span>
        </button>
        
        {/* Information/Help Icon */}
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className={`p-2 flex flex-col items-center justify-center ${
            showInstructions 
              ? 'bg-purple-100 text-purple-600' 
              : 'hover:bg-gray-100'
          }`}
          aria-label={showInstructions ? "Hide instructions" : "Show instructions"}
          title={showInstructions ? "Hide instructions" : "Show instructions"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span className="text-xs mt-1">Help</span>
        </button>
        
        {/* API Secret Icon */}
        <button
          onClick={() => setShowApiSecret(!showApiSecret)}
          className={`p-2 flex flex-col items-center justify-center ${
            showApiSecret 
              ? 'bg-green-100 text-green-600' 
              : 'hover:bg-gray-100'
          }`}
          aria-label={showApiSecret ? "Hide API settings" : "Show API settings"}
          title={showApiSecret ? "Hide API settings" : "Configure API Secret"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
          </svg>
          <span className="text-xs mt-1">API Secret</span>
        </button>
        
        {/* Model Selector Icon */}
        <button
          onClick={() => setShowModelSelector(!showModelSelector)}
          className={`p-2 flex flex-col items-center justify-center ${
            showModelSelector 
              ? 'bg-purple-100 text-purple-600' 
              : 'hover:bg-gray-100'
          }`}
          aria-label={showModelSelector ? "Hide model selector" : "Show model selector"}
          title={showModelSelector ? "Hide model selector" : "Select AI model"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 1 1-8 0 2 2 0 1 0 4 0c0-4.4-3.6-8-8-8z"/>
          </svg>
          <span className="text-xs mt-1">AI Model</span>
        </button>
      </div>

      {/* API Secret Input Dialog */}
      {showApiSecret && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg z-[100] w-96">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-lg">Configure API Secret</h3>
            <button 
              onClick={() => setShowApiSecret(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="apiSecret" className="text-sm font-medium">
                API Secret Key
              </label>
              <input
                id="apiSecret"
                type="password"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                className="border border-gray-300 rounded p-2 w-full bg-white text-gray-900"
                placeholder="Enter the API secret..."
              />
              <div className="text-xs text-gray-500 mt-1">
                Enter the API secret provided by your administrator.
                <br />
                This must match the API_SECRET environment variable set in Vercel.
              </div>
            </div>
            <div className="flex justify-end pt-2 gap-2">
              <button
                onClick={() => setShowApiSecret(false)}
                className="px-4 py-2 rounded text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveApiSecret}
                className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Model Selector Dialog */}
      {showModelSelector && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg z-[100] w-96">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-lg">Select AI Model</h3>
            <button 
              onClick={() => setShowModelSelector(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          <div className="space-y-2">
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-1">
                Currently using: <span className="font-medium text-gray-900">{selectedModel.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                Changes apply to new conversations
              </div>
            </div>
            
            {/* Claude Models */}
            <div>
              <h4 className="text-sm font-medium mb-2 text-purple-600">Anthropic Claude Models</h4>
              <div className="space-y-1">
                {availableModels
                  .filter(model => model.provider === 'anthropic')
                  .map(model => (
                    <div 
                      key={model.id}
                      onClick={() => setSelectedModel(model)}
                      className={`p-2 rounded cursor-pointer flex items-center ${
                        selectedModel.id === model.id 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full mr-2 ${
                        selectedModel.id === model.id 
                          ? 'bg-purple-600' 
                          : 'border border-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-gray-600">{model.description}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            {/* OpenAI Models */}
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-blue-600">OpenAI GPT Models</h4>
              <div className="space-y-1">
                {availableModels
                  .filter(model => model.provider === 'openai')
                  .map(model => (
                    <div 
                      key={model.id}
                      onClick={() => setSelectedModel(model)}
                      className={`p-2 rounded cursor-pointer flex items-center ${
                        selectedModel.id === model.id 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full mr-2 ${
                        selectedModel.id === model.id 
                          ? 'bg-blue-600' 
                          : 'border border-gray-400'
                      }`} />
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-xs text-gray-600">{model.description}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
            
            <div className="flex justify-end pt-3">
              <button
                onClick={() => setShowModelSelector(false)}
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions Panel */}
      {showInstructions && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-white p-4 rounded-lg shadow-lg z-[100] max-w-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium text-lg">Canvas Controls</h3>
            <button 
              onClick={() => setShowInstructions(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 p-1 rounded text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
                  <path d="M13 13l6 6"></path>
                </svg>
              </span>
              <p><strong>Select:</strong> Choose and interact with canvas elements.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-blue-100 p-1 rounded text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"></path>
                  <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"></path>
                  <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"></path>
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path>
                </svg>
              </span>
              <p><strong>Hand:</strong> Pan the canvas by dragging.</p>
            </div>
            <ul className="text-sm space-y-1 list-disc pl-4">
        <li>Click + button to create a verse</li>
        <li>Resize verses using the corner handles</li>
        <li>Add Chat or Board components within verses</li>
        <li>Drag and resize components within verses</li>
        <li>Click branch icon to create a branched verse</li>
        <li>Click edit icon to modify system prompt</li>
        <li>Drag verse header to move</li>
        <li>Click verse to activate it</li>
        <li>Click and drag on empty canvas to pan</li>
      </ul>
          </div>
        </div>
      )}

      {/* Zoom Controls - Bottom left */}
      <div className="fixed bottom-8 left-8 flex bg-white rounded-lg shadow-lg z-50">
        <button
          onClick={() => {
            // Reset view - finds all verses and fits them in view
            if (verses.length === 0) {
              // No verses, reset to 20% zoom
              updateCanvasView(0.2, { x: 0, y: 0 });
            } else {
              // Find bounds of all verses
              const bounds = verses.reduce((acc, v) => {
                return {
                  minX: Math.min(acc.minX, v.position.x),
                  minY: Math.min(acc.minY, v.position.y),
                  maxX: Math.max(acc.maxX, v.position.x + v.size.width),
                  maxY: Math.max(acc.maxY, v.position.y + v.size.height)
                };
              }, {
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY
              });
              
              // Calculate the content width and height
              const contentWidth = bounds.maxX - bounds.minX;
              const contentHeight = bounds.maxY - bounds.minY;
              
              // Add padding (20% on each side)
              const paddingFactor = 0.4;
              const paddedWidth = contentWidth * (1 + paddingFactor);
              const paddedHeight = contentHeight * (1 + paddingFactor);
              
              // Calculate ideal zoom level to fit all content
              const zoomX = window.innerWidth / paddedWidth;
              const zoomY = window.innerHeight / paddedHeight;
              const idealZoom = Math.min(zoomX, zoomY);
              
              // Find the closest discrete zoom level
              const newZoom = findNearestZoomLevel(idealZoom);
              
              // Calculate center position
              const contentCenterX = (bounds.minX + bounds.maxX) / 2;
              const contentCenterY = (bounds.minY + bounds.maxY) / 2;
              
              // Calculate position to center verses
              const newPosX = (window.innerWidth / 2) - (contentCenterX * newZoom);
              const newPosY = (window.innerHeight / 2) - (contentCenterY * newZoom);
              
              updateCanvasView(newZoom, { x: newPosX, y: newPosY });
            }
          }}
          className="p-2 bg-yellow-100 rounded-l-lg"
        >
          🏠
        </button>
        
        <button
          onClick={() => {
            // Get next discrete zoom level (increase value = zoom in = see less canvas)
            const newZoom = getNextZoomLevel(canvasView.zoom);
            
            // When zooming via button, zoom toward center of viewport
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            
            // Convert screen center to canvas coordinates
            const canvasCenterX = (screenCenterX - canvasView.position.x) / canvasView.zoom;
            const canvasCenterY = (screenCenterY - canvasView.position.y) / canvasView.zoom;
            
            // Calculate new position to keep viewport center fixed
            const newX = screenCenterX - canvasCenterX * newZoom;
            const newY = screenCenterY - canvasCenterY * newZoom;
            
            // Apply zoom
            updateCanvasView(newZoom, { x: newX, y: newY });
          }}
          className="p-2 border-l"
        >
          +
        </button>
        
        {/* Zoom percentage indicator */}
        <div className="p-2 border-l font-medium">
          {Math.round(canvasView.zoom * 100)}%
        </div>
        
        <button
          onClick={() => {
            // Get previous discrete zoom level (decrease value = zoom out = see more canvas)
            const newZoom = getPrevZoomLevel(canvasView.zoom);
            
            // When zooming via button, zoom toward center of viewport
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            
            // Convert screen center to canvas coordinates
            const canvasCenterX = (screenCenterX - canvasView.position.x) / canvasView.zoom;
            const canvasCenterY = (screenCenterY - canvasView.position.y) / canvasView.zoom;
            
            // Calculate new position to keep viewport center fixed
            const newX = screenCenterX - canvasCenterX * newZoom;
            const newY = screenCenterY - canvasCenterY * newZoom;
            
            // Apply zoom
            updateCanvasView(newZoom, { x: newX, y: newY });
          }}
          className="p-2 border-l rounded-r-lg"
        >
          -
        </button>
      </div>
      
      {/* Firebase Canvas Controls */}
      <CanvasControls />
    </div>
  );
}