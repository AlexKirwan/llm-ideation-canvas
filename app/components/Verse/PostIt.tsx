'use client';

import { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { PostItData } from '../../types';

interface PostItProps {
  verseId: string;
  componentId: string;
  data?: PostItData;
}

// Predefined color options for PostIt notes
const COLOR_OPTIONS = [
  '#FFFF88', // Yellow (default)
  '#FF9999', // Red
  '#99FF99', // Green
  '#9999FF', // Blue
  '#FFCC99', // Orange
  '#CC99FF', // Purple
];

export default function PostIt({ verseId, componentId, data }: PostItProps) {
  console.log('Rendering PostIt component:', { verseId, componentId, data });
  const { updatePostItText, updatePostItColor, removeComponent } = useCanvasStore();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data?.text || '');
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update text state when data changes
  useEffect(() => {
    // Default to empty string if data is null or text is undefined
    setText(data?.text || '');
  }, [data?.text]);
  
  // Focus the textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);
  
  const handleDoubleClick = () => {
    setIsEditing(true);
  };
  
  const handleBlur = () => {
    setIsEditing(false);
    updatePostItText(verseId, componentId, text);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setText(data?.text || '');
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleBlur();
    }
  };
  
  const handleColorChange = (color: string) => {
    updatePostItColor(verseId, componentId, color);
    setShowColorPicker(false);
  };
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeComponent(verseId, componentId);
  };
  
  // ULTRA SIMPLE DEBUG VERSION
  return (
    <div 
      style={{ 
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'red',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '24px',
        fontWeight: 'bold',
        border: '5px solid black'
      }}
    >
      THIS IS A POSTIT NOTE
      <br />
      ID: {componentId}
    </div>
  );
}