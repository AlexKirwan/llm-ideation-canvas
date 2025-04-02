export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  timestamp?: number;
}

import { BoardCard } from '../components/Board';
import { SystemMapData } from '../components/SystemMap/SystemMap';

export interface VerseComponent {
  id: string;
  type: 'chat' | 'board' | 'systemMap';
  position: Position;
  size: Size;
  zIndex: number;
  data?: Record<string, unknown>; // Additional component-specific data
}

export interface Verse {
  id: string;
  name?: string; // Optional name for the verse
  position: Position;
  size: Size;
  chatHistory: ChatMessage[];
  zIndex: number;
  parentId: string | null;
  branchSourceMessageId?: string; // ID of the specific message this verse branched from
  branches: string[]; // IDs of child verses
  systemPrompt: string;
  modelId: string; // ID of the AI model used for this verse
  boardCards?: BoardCard[];
  systemMapData?: SystemMapData;
  components: VerseComponent[];
  // Deprecated: Internal view is no longer used for panning within verse
  // Kept for backward compatibility
  internalView: {
    position: Position;
  };
}

// Available AI model providers and their models
export type ModelProvider = 'anthropic' | 'openai';

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  description?: string;
}

export const availableModels: AIModel[] = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    description: 'Most powerful Claude model for complex tasks'
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    description: 'Balanced performance and speed'
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    description: 'Fastest and most compact Claude model'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Latest GPT-4 model with improved capabilities'
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Powerful GPT-4 model with high performance'
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Fast and cost-effective for simpler tasks'
  }
];

export interface CanvasState {
  verses: Verse[];
  canvasView: {
    zoom: number;
    position: Position;
    isSelectMode: boolean; // Toggle between select and pan modes
  };
  activeVerseId: string | null;
  selectedModel: AIModel; // Default selected AI model
}