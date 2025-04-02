import { useState, useEffect, useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';

interface SystemPromptEditorProps {
  verseId: string;
  onClose: () => void;
}

export default function SystemPromptEditor({ verseId, onClose }: SystemPromptEditorProps) {
  const { verses, updateSystemPrompt } = useCanvasStore();
  const verse = verses.find(v => v.id === verseId);
  const [prompt, setPrompt] = useState(verse?.systemPrompt || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Focus textarea when modal opens
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(prompt.length, prompt.length);
    }
  }, [prompt.length]);
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  };
  
  const handleSave = () => {
    if (verse) {
      updateSystemPrompt(verseId, prompt);
      onClose();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Close on escape
    if (e.key === 'Escape') {
      onClose();
    }
    
    // Save on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSave();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <h2 className="text-lg font-bold mb-4">Edit System Prompt</h2>
        
        <p className="text-sm text-gray-600 mb-2">
          The system prompt defines Claude&apos;s behavior and capabilities in this verse.
        </p>
        
        <p className="text-sm text-gray-600 mb-4">
          Note: Claude can use markdown formatting in responses (headings, lists, code blocks, etc).
        </p>
        
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleChange}
          className="flex-1 min-h-[200px] p-3 border rounded-md dark:bg-gray-900 dark:border-gray-700 mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter system instructions for Claude..."
        />
        
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}