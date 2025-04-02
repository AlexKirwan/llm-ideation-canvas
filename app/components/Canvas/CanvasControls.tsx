'use client';

import { useState, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { v4 as uuidv4 } from 'uuid';

export default function CanvasControls() {
  const { 
    canvasId, setCanvasId, 
    loadFromFirestore, saveToFirestore,
    createNewCanvas,
    isLoading, isSaving, lastSaved,
    userEmail, setUserEmail,
    userCanvases, loadUserCanvases,
    canvasTitle, setCanvasTitle
  } = useCanvasStore();
  
  const [inputValue, setInputValue] = useState(canvasId);
  const [autoSave, setAutoSave] = useState(true);
  const [email, setEmail] = useState(userEmail || '');
  const [title, setTitle] = useState(canvasTitle || 'Untitled Canvas');
  const [showUserCanvases, setShowUserCanvases] = useState(false);
  
  // Initialize - load the canvas on first mount
  useEffect(() => {
    // If there's a canvasId in the URL, load that canvas
    const urlParams = new URLSearchParams(window.location.search);
    const canvasIdParam = urlParams.get('canvas');
    
    if (canvasIdParam) {
      loadFromFirestore(canvasIdParam);
    } else if (canvasId) {
      // Otherwise load the current canvas ID
      loadFromFirestore(canvasId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Update title in component state when store title changes
  useEffect(() => {
    setTitle(canvasTitle);
  }, [canvasTitle]);
  
  // Effect for auto-saving
  useEffect(() => {
    if (!autoSave) return;
    
    const saveInterval = setInterval(() => {
      if (!isSaving) {
        saveToFirestore();
      }
    }, 30000); // Auto-save every 30 seconds
    
    return () => clearInterval(saveInterval);
  }, [autoSave, isSaving, saveToFirestore]);
  
  // Format last saved time
  const formatTime = (date: Date | null) => {
    if (!date) return 'Never';
    // Ensure date is a Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleTimeString();
  };
  
  // Copy canvas URL to clipboard
  const copyCanvasUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('canvas', canvasId);
    navigator.clipboard.writeText(url.toString());
    alert('Canvas URL copied to clipboard!');
  };
  
  // Create a new canvas
  const handleCreateNewCanvas = () => {
    if (!userEmail) {
      return; // Button should be disabled anyway
    }
    
    // Call the store method to create a truly blank canvas
    createNewCanvas('New Canvas');
    
    // Update local state to match
    setTitle('New Canvas');
  };
  
  // Save user email and immediately load user canvases
  const saveUserEmail = () => {
    if (email.trim()) {
      // Set the email in the store
      setUserEmail(email.trim());
      
      // Load the user's canvases
      loadUserCanvases();
      
      // Also show the user canvases dropdown automatically
      setShowUserCanvases(true);
      
      // Create a new canvas if this is the first login
      if (!canvasId || canvasId === 'default-canvas') {
        createNewCanvas('New Canvas');
      }
    }
  };
  
  // Handle title update
  const updateTitle = () => {
    if (title.trim()) {
      setCanvasTitle(title.trim());
      saveToFirestore();
    }
  };
  
  return (
    <div className="fixed top-4 right-4 bg-white p-3 rounded-lg shadow-md z-50 flex flex-col gap-2 max-w-xs">
      {/* User email input */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              saveUserEmail();
            }
          }}
          className={`px-2 py-1 border rounded text-sm flex-grow ${!userEmail ? 'border-orange-400' : ''}`}
          placeholder="Enter your email to start"
        />
        <button
          onClick={saveUserEmail}
          className="px-2 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
          title="Save email and load your canvases"
        >
          Set
        </button>
      </div>
      
      {/* Email prompt message */}
      {!userEmail && (
        <div className="text-xs text-orange-500 font-medium -mt-1">
          Please enter your email to save and load canvases
        </div>
      )}
      
      {/* Canvas title input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={updateTitle}
          className="px-2 py-1 border rounded text-sm flex-grow"
          placeholder="Canvas Title"
        />
      </div>
      
      {/* Canvas ID/load section */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="px-2 py-1 border rounded text-sm flex-grow"
          placeholder="Canvas ID"
        />
        <button
          onClick={() => {
            if (inputValue.trim()) {
              loadFromFirestore(inputValue.trim());
            }
          }}
          disabled={isLoading}
          className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Load'}
        </button>
      </div>
      
      {/* Save buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => saveToFirestore()}
          disabled={isSaving || !userEmail}
          className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          title={!userEmail ? 'Enter email to enable saving' : 'Save canvas'}
        >
          {isSaving ? 'Saving...' : 'Save Now'}
        </button>
        
        <button
          onClick={handleCreateNewCanvas}
          disabled={!userEmail}
          className="px-2 py-1 bg-teal-500 text-white rounded text-sm hover:bg-teal-600 disabled:opacity-50"
          title={!userEmail ? 'Enter email to create new canvas' : 'Create a new canvas'}
        >
          New Canvas
        </button>
        
        <div className="flex items-center gap-1">
          <input
            type="checkbox"
            id="auto-save"
            checked={autoSave}
            onChange={(e) => setAutoSave(e.target.checked)}
            disabled={!userEmail}
            className={`mr-1 ${!userEmail ? 'opacity-50' : ''}`}
          />
          <label htmlFor="auto-save" className={`text-xs ${!userEmail ? 'text-gray-400' : ''}`}>Auto</label>
        </div>
      </div>
      
      {/* User canvases section */}
      {userEmail && (
        <div>
          <button 
            onClick={() => { setShowUserCanvases(!showUserCanvases); loadUserCanvases(); }}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1 w-full justify-between"
          >
            <span>My Canvases</span>
            <span>{showUserCanvases ? '▲' : '▼'}</span>
          </button>
          
          {showUserCanvases && userCanvases.length > 0 && (
            <div className="mt-2 max-h-40 overflow-y-auto border rounded p-1">
              {userCanvases.map(canvas => (
                <div 
                  key={canvas.id}
                  className="text-xs p-1 hover:bg-gray-100 cursor-pointer rounded flex justify-between"
                  onClick={() => loadFromFirestore(canvas.id)}
                >
                  <span className="font-medium truncate">{canvas.title}</span>
                  <span className="text-gray-500">{new Date(canvas.lastModified).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
          
          {showUserCanvases && userCanvases.length === 0 && (
            <div className="text-xs text-gray-500 mt-1">No canvases found for this email</div>
          )}
        </div>
      )}
      
      {/* Canvas info */}
      <div className="text-xs text-gray-500">
        <div className="flex justify-between items-center">
          <span className="truncate">
            ID: <span className="font-medium">{canvasId.substring(0, 8)}...</span>
          </span>
          <button 
            onClick={copyCanvasUrl}
            className="text-blue-500 hover:text-blue-700 ml-1"
            title="Copy canvas URL to clipboard"
            disabled={!userEmail}
          >
            🔗
          </button>
        </div>
        <div>Last saved: <span className="font-medium">{formatTime(lastSaved)}</span></div>
        {!userEmail && (
          <div className="mt-1 text-orange-500 font-medium">
            Please enter your email to enable saving
          </div>
        )}
      </div>
    </div>
  );
}