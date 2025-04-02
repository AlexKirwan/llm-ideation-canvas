import { useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';

interface InsightsButtonProps {
  verseId: string;
}

export default function InsightsButton({ verseId }: InsightsButtonProps) {
  const { verses, updateBoardCards, addComponent } = useCanvasStore();
  const [isLoading, setIsLoading] = useState(false);
  
  const verse = verses.find(v => v.id === verseId);
  if (!verse) return null;
  
  const handleGenerateInsights = async () => {
    if (isLoading) return;
    
    // If we already have insights, add a board component
    if (verse.boardCards && verse.boardCards.length > 0) {
      addComponent(verseId, 'board');
      return;
    }
    
    // Otherwise, generate new insights
    setIsLoading(true);
    
    try {
      // Filter out system messages
      const messages = verse.chatHistory.filter(msg => msg.role !== 'system');
      
      if (messages.length === 0) {
        alert('Start a conversation first to generate insights.');
        setIsLoading(false);
        return;
      }
      
      // Call our API to analyze the conversation
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze conversation');
      }
      
      const data = await response.json();
      
      // Flatten the categories into one array
      const allCards = [
        ...(data.elaborate || []),
        ...(data.problems || []),
        ...(data.solutions || []),
      ];
      
      // Save the cards to the verse
      updateBoardCards(verseId, allCards);
      
      // Add a board component
      addComponent(verseId, 'board');
      
    } catch (error) {
      console.error('Error generating insights:', error);
      alert('Error generating insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // No longer need handleCardMove since it's handled in the board component
  
  return (
    <div>
      <button
        onClick={handleGenerateInsights}
        className={`px-3 py-1 rounded-md text-sm font-medium flex items-center ${
          isLoading 
            ? 'bg-gray-400 cursor-not-allowed' 
            : verse.boardCards && verse.boardCards.length > 0
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-purple-100 hover:bg-purple-200 text-purple-800'
        }`}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analyzing...
          </>
        ) : (
          <>
            {verse.boardCards && verse.boardCards.length > 0 ? 'View Insights' : 'Generate Insights'}
          </>
        )}
      </button>
      
      {/* Board now shown as component */}
    </div>
  );
}