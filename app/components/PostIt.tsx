import React, { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import type { PostItData } from '../types';

interface PostItProps {
  verseId: string;
  componentId: string;
  data: PostItData;
}

export default function PostIt({ verseId, componentId, data }: PostItProps) {
  const { updatePostItText, updatePostItColor } = useCanvasStore();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update local state when data changes
  useEffect(() => {
    setText(data.text || '');
  }, [data.text]);
  
  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);
  
  // Handle text save
  const handleSave = () => {
    updatePostItText(verseId, componentId, text);
    setIsEditing(false);
  };
  
  // Handle text cancel
  const handleCancel = () => {
    setText(data.text || '');
    setIsEditing(false);
  };
  
  // Available PostIt colors with friendly names
  const colorOptions = [
    { name: 'Yellow', value: '#FFFF88' },
    { name: 'Blue', value: '#AADDFF' },
    { name: 'Green', value: '#AAFFAA' },
    { name: 'Pink', value: '#FFAADD' },
    { name: 'Purple', value: '#DDAAFF' },
    { name: 'Orange', value: '#FFCC88' },
  ];
  
  // Calculate text darkness for contrast
  const getTextColor = (bgColor: string) => {
    // Simple luminance calculation
    const r = parseInt(bgColor.substr(1, 2), 16);
    const g = parseInt(bgColor.substr(3, 2), 16);
    const b = parseInt(bgColor.substr(5, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };
  
  return (
    <div 
      className="w-full h-full flex flex-col rounded-sm overflow-hidden"
      style={{ 
        backgroundColor: data.color || '#FFFF88',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
      }}
    >
      {/* PostIt Header */}
      <div className="flex items-center justify-between p-1 border-b border-black/10">
        <div className="flex space-x-1">
          {/* Color picker */}
          {colorOptions.map(color => (
            <button
              key={color.value}
              className="w-4 h-4 rounded-full border border-black/10"
              style={{ backgroundColor: color.value }}
              title={color.name}
              onClick={() => updatePostItColor(verseId, componentId, color.value)}
            />
          ))}
        </div>
        
        {/* Edit/Save Controls */}
        <div className="flex space-x-1">
          {isEditing ? (
            <>
              <button 
                onClick={handleSave}
                className="text-xs p-0.5 rounded hover:bg-black/5"
                title="Save"
              >
                ✓
              </button>
              <button 
                onClick={handleCancel}
                className="text-xs p-0.5 rounded hover:bg-black/5"
                title="Cancel"
              >
                ✕
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="text-xs p-0.5 rounded hover:bg-black/5"
              title="Edit"
            >
              ✎
            </button>
          )}
        </div>
      </div>
      
      {/* PostIt Content */}
      <div className="flex-1 p-2 overflow-auto">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-full resize-none p-0 bg-transparent border-none focus:outline-none focus:ring-0"
            style={{ color: getTextColor(data.color || '#FFFF88') }}
            placeholder="Enter text here..."
          />
        ) : (
          <div 
            className="whitespace-pre-wrap text-sm"
            style={{ color: getTextColor(data.color || '#FFFF88') }}
            onClick={() => setIsEditing(true)}
          >
            {text || ''}
          </div>
        )}
      </div>
    </div>
  );
}