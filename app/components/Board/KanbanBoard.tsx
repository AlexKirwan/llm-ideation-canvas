import { useState } from 'react';

export interface BoardCard {
  id: string;
  content: string;
  column: 'elaborate' | 'problems' | 'solutions';
}

interface KanbanBoardProps {
  cards: BoardCard[];
  onClose: () => void;
  onCardMove?: (cardId: string, newColumn: 'elaborate' | 'problems' | 'solutions') => void;
}

export default function KanbanBoard({ cards, onClose, onCardMove }: KanbanBoardProps) {
  const [draggedCard, setDraggedCard] = useState<string | null>(null);

  // Filter cards by column
  const elaborateCards = cards.filter(card => card.column === 'elaborate');
  const problemCards = cards.filter(card => card.column === 'problems');
  const solutionCards = cards.filter(card => card.column === 'solutions');

  const handleDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (column: 'elaborate' | 'problems' | 'solutions') => {
    if (draggedCard && onCardMove) {
      onCardMove(draggedCard, column);
      setDraggedCard(null);
    }
  };

  const Card = ({ card }: { card: BoardCard }) => (
    <div
      className="bg-white dark:bg-gray-800 p-3 rounded shadow mb-2 cursor-move"
      draggable
      onDragStart={() => handleDragStart(card.id)}
    >
      <p className="text-sm">{card.content}</p>
    </div>
  );

  const Column = ({ 
    title, 
    cards, 
    columnId, 
    color 
  }: { 
    title: string; 
    cards: BoardCard[]; 
    columnId: 'elaborate' | 'problems' | 'solutions';
    color: string;
  }) => (
    <div 
      className="flex-1 min-w-[250px] max-w-[350px] bg-gray-100 dark:bg-gray-900 rounded p-3"
      onDragOver={handleDragOver}
      onDrop={() => handleDrop(columnId)}
    >
      <div className={`font-bold mb-3 pb-2 border-b-2 ${color}`}>
        {title} ({cards.length})
      </div>
      <div className="space-y-2">
        {cards.map(card => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg overflow-auto">
      <div className="flex justify-between items-center p-2 border-b">
        <h2 className="text-lg font-bold">Conversation Insights</h2>
        <button 
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
          title="Close board"
        >
          ✕
        </button>
      </div>
      
      <div className="flex gap-4 overflow-x-auto p-4 flex-1">
        <Column 
          title="Elaborate" 
          cards={elaborateCards} 
          columnId="elaborate"
          color="border-purple-500"
        />
        <Column 
          title="Problems" 
          cards={problemCards} 
          columnId="problems" 
          color="border-red-500"
        />
        <Column 
          title="Solutions" 
          cards={solutionCards} 
          columnId="solutions"
          color="border-green-500" 
        />
      </div>
    </div>
  );
}