'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { CanvasState, Verse, ChatMessage, AIModel, availableModels } from '../types';
// Using types directly where needed instead of imports

// 16:9 aspect ratio verse size (more like Miro frames)
// Slightly smaller dimensions for better visibility at various zoom levels
const DEFAULT_VERSE_SIZE = { width: 800, height: 450 };
const DEFAULT_CHAT_COMPONENT_SIZE = { width: 300, height: 250 };
const DEFAULT_BOARD_COMPONENT_SIZE = { width: 400, height: 300 };
const DEFAULT_SYSTEM_MAP_COMPONENT_SIZE = { width: 500, height: 400 };
const DEFAULT_SYSTEM_PROMPT = `You are a smart Chief Product and Technology Officer (CPTO) of a successful tech company. 
Provide thoughtful, strategic advice on product development, technology implementation, 
and technical leadership. Draw from your experience to help with technical challenges, 
product roadmaps, and business technology strategy. Be concise but insightful.`;

const initialState: CanvasState = {
  verses: [],
  canvasView: {
    zoom: 0.2, // Start at 20% zoom - this will be a good default view
    position: { x: 0, y: 0 },
    isSelectMode: false // Add select mode to toggle between select and pan
  },
  activeVerseId: null,
  selectedModel: availableModels[0] // Default to Claude 3 Opus
};

// Define interfaces for store
type StoreType = CanvasState & {
  addVerse: (position: { x: number; y: number }, parentId?: string | null, modelId?: string) => void;
  removeVerse: (id: string) => void;
  updateVersePosition: (id: string, position: { x: number; y: number }) => void;
  updateVerseSize: (id: string, size: { width: number; height: number }) => void;
  updateVerseName: (id: string, name: string) => void; // New function to update verse name
  updateVerseModel: (id: string, modelId: string) => void; // New function to update verse model
  setActiveVerse: (id: string | null) => void;
  setSelectedModel: (model: AIModel) => void; // New function to select the global model
  updateVerseInternalView: (id: string, position: { x: number; y: number }) => void;
  addChatMessage: (verseId: string, message: { role: 'user' | 'assistant' | 'system', content: string }) => void;
  updateCanvasView: (zoom: number, position: { x: number; y: number }) => void;
  toggleSelectMode: (isSelectMode: boolean) => void; // Toggle between select and pan modes
  branchVerse: (id: string, modelId?: string, messageId?: string) => void;
  updateSystemPrompt: (verseId: string, systemPrompt: string) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateBoardCards: (verseId: string, cards: any[]) => void;
  updateCardColumn: (verseId: string, cardId: string, newColumn: 'elaborate' | 'problems' | 'solutions') => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateSystemMapData: (verseId: string, data: any) => void;
  updateSystemMapNode: (verseId: string, nodeId: string, x: number, y: number) => void;
  updateSystemMapNodeLabel: (verseId: string, nodeId: string, label: string) => void;
  updateSystemMapEdgeLabel: (verseId: string, edgeId: string, label: string) => void;
  addComponent: (verseId: string, type: 'chat' | 'board' | 'systemMap', position?: { x: number; y: number }) => void;
  removeComponent: (verseId: string, componentId: string) => void;
  updateComponentPosition: (verseId: string, componentId: string, position: { x: number; y: number }) => void;
  updateComponentSize: (verseId: string, componentId: string, size: { width: number; height: number }) => void;
  setActiveComponent: (verseId: string, componentId: string) => void;
};

// Export the store hook
export const useCanvasStore = create<StoreType>()(
  persist(
    (set) => ({
      ...initialState,
      
      addVerse: (position, parentId = null, modelId) => set((state) => {
        console.log("Store: Adding verse at", position);
        const maxZIndex = state.verses.reduce((max, v) => Math.max(max, v.zIndex), 0);
        const verseId = uuidv4();

        const currentZoom = state.canvasView.zoom;
        const adjustedSize = {
          width: DEFAULT_VERSE_SIZE.width / currentZoom,
          height: DEFAULT_VERSE_SIZE.height / currentZoom
        };
        
        // Use specified model ID or default to the currently selected model
        const useModelId = modelId || state.selectedModel.id;
        
        // Create a default chat component
        const chatComponentId = uuidv4();
        
        const newVerse: Verse = {
          id: verseId,
          name: `Verse ${verseId.slice(0, 4)}`, // Default name using short ID
          position,
          size: adjustedSize,
          chatHistory: [],
          zIndex: maxZIndex + 1,
          parentId: parentId,
          branches: [],
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          modelId: useModelId || availableModels[0].id, // Ensure we always have a model ID
          // Deprecated: internalView is no longer used but kept for backward compatibility
          internalView: {
            position: { x: 0, y: 0 }
          },
          components: [
            {
              id: chatComponentId,
              type: 'chat',
              position: { x: 20, y: 20 },
              size: DEFAULT_CHAT_COMPONENT_SIZE,
              zIndex: 1
            }
          ]
        };
        
        // If this is a child verse, update the parent's branches array
        const updatedVerses = parentId 
          ? state.verses.map(v => 
              v.id === parentId 
                ? { ...v, branches: [...v.branches, newVerse.id] } 
                : v
            )
          : state.verses;
        
        return {
          verses: [...updatedVerses, newVerse],
          activeVerseId: newVerse.id
        };
      }),
      
      // Create a branch from an existing verse
      branchVerse: (id, modelId, messageId) => set((state) => {
        console.log('Branching verse with model ID:', modelId, 'from message:', messageId);
        const parentVerse = state.verses.find(v => v.id === id);
        if (!parentVerse) return state;
        
        // Get current zoom level for properly sized new verse
        const currentZoom = state.canvasView.zoom;
        
        // Scale the verse size inversely with zoom
        // This ensures a consistent on-screen size regardless of zoom level
        const adjustedSize = {
          width: DEFAULT_VERSE_SIZE.width / currentZoom,
          height: DEFAULT_VERSE_SIZE.height / currentZoom
        };
        
        // Create branch position with clear visual separation from parent
        // Position to the right with more space to clearly show the connection line
        const branchPosition = {
          x: parentVerse.position.x + parentVerse.size.width + 300,
          y: parentVerse.position.y + 100
        };
        
        // Use specified model ID, parent's model ID, or default to the currently selected model
        const useModelId = modelId || parentVerse.modelId || state.selectedModel.id;
        
        // Create appropriate system message based on branch type
        const systemContent = messageId 
          ? `This is a branched conversation from a specific message. The context from the parent conversation up to that message will be included in your requests.`
          : `This is a branched conversation. The context from the parent conversation will be included in your requests.`;
          
        const systemMessage: ChatMessage = {
          role: 'system',
          content: systemContent,
          id: uuidv4(),
          timestamp: Date.now()
        };
        
        const maxZIndex = state.verses.reduce((max, v) => Math.max(max, v.zIndex), 0);
        const verseId = uuidv4();
        const chatComponentId = uuidv4();
        
        // Create name based on branch type
        let branchName = '';
        if (messageId) {
          // Find the message we're branching from to include in the name
          const sourceMessage = parentVerse.chatHistory.find(msg => msg.id === messageId);
          const messagePreview = sourceMessage 
            ? sourceMessage.content.substring(0, 20) + (sourceMessage.content.length > 20 ? '...' : '')
            : 'specific message';
            
          branchName = `Branch from "${messagePreview}" (${parentVerse.name || parentVerse.id.slice(0, 4)})`;
        } else {
          branchName = `Branch ${verseId.slice(0, 4)} (from ${parentVerse.name || parentVerse.id.slice(0, 4)})`;
        }
        
        // Both verse-level and message-level branches start with just the system message
        // The context is passed separately in the API calls, but not displayed in the UI
        const initialChatHistory: ChatMessage[] = [systemMessage];
        
        const newVerse: Verse = {
          id: verseId,
          name: branchName,
          position: branchPosition,
          size: adjustedSize,
          // Initialize with appropriate chat history based on branch type
          chatHistory: initialChatHistory,
          zIndex: maxZIndex + 1,
          parentId: parentVerse.id,
          branchSourceMessageId: messageId, // Store the source message ID if provided
          branches: [],
          systemPrompt: parentVerse.systemPrompt,
          modelId: useModelId,
          // Deprecated: internalView is no longer used but kept for backward compatibility
          internalView: {
            position: { x: 0, y: 0 }
          },
          components: [
            {
              id: chatComponentId,
              type: 'chat',
              position: { x: 20, y: 20 },
              size: DEFAULT_CHAT_COMPONENT_SIZE,
              zIndex: 1
            }
          ]
        };
        
        // Update parent's branches array
        const updatedVerses = state.verses.map(v => 
          v.id === id 
            ? { ...v, branches: [...v.branches, newVerse.id] } 
            : v
        );
        
        return {
          verses: [...updatedVerses, newVerse],
          activeVerseId: newVerse.id
        };
      }),
      
      removeVerse: (id) => set((state) => {
        const verseToRemove = state.verses.find(v => v.id === id);
        if (!verseToRemove) return state;
        
        // We need to update any parent verse to remove this ID from its branches
        let updatedVerses = state.verses.map(v => 
          v.id === verseToRemove.parentId 
            ? { ...v, branches: v.branches.filter(branchId => branchId !== id) } 
            : v
        );
        
        // Remove the verse
        updatedVerses = updatedVerses.filter(v => v.id !== id);
        
        return {
          verses: updatedVerses,
          activeVerseId: state.activeVerseId === id ? null : state.activeVerseId
        };
      }),
      
      updateVersePosition: (id, position) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === id ? { ...verse, position } : verse
        )
      })),
      
      setActiveVerse: (id) => set((state) => {
        // If already active, just return current state
        if (id === state.activeVerseId) return { activeVerseId: id };
        
        // Otherwise, update z-indices and set active
        const maxZIndex = state.verses.reduce((max, v) => Math.max(max, v.zIndex), 0);
        
        return {
          verses: state.verses.map(verse => 
            verse.id === id 
              ? { ...verse, zIndex: maxZIndex + 1 } 
              : verse
          ),
          activeVerseId: id
        };
      }),
      
      addChatMessage: (verseId, message) => set((state) => {
        // Add timestamp and unique ID to the message
        const messageWithMeta = {
          ...message,
          id: uuidv4(),
          timestamp: Date.now()
        };
        
        return {
          verses: state.verses.map(verse => 
            verse.id === verseId 
              ? { ...verse, chatHistory: [...verse.chatHistory, messageWithMeta] } 
              : verse
          )
        };
      }),
      
      updateCanvasView: (zoom, position) => set((state) => ({
        canvasView: { ...state.canvasView, zoom, position }
      })),
      
      // Toggle between select and pan modes
      toggleSelectMode: (isSelectMode) => set((state) => ({
        canvasView: { ...state.canvasView, isSelectMode }
      })),
      
      // Set the selected AI model
      setSelectedModel: (model) => set(() => ({
        selectedModel: model
      })),
      
      // This function is deprecated as we've removed internal panning
      // Keeping it as a no-op for backward compatibility
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      updateVerseInternalView: (_id, _position) => set((state) => {
        console.log('updateVerseInternalView is deprecated - verse internal panning has been removed');
        return state; // No-op, returns state unchanged
      }),
      
      // Update system prompt for a verse
      updateSystemPrompt: (verseId, systemPrompt) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === verseId 
            ? { ...verse, systemPrompt } 
            : verse
        )
      })),
      
      // Update board cards for a verse
      updateBoardCards: (verseId, cards) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === verseId 
            ? { ...verse, boardCards: cards } 
            : verse
        )
      })),
      
      // Toggle board visibility - we don't need this anymore since we use components
      /*toggleBoard: (verseId: string) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === verseId 
            ? { ...verse } 
            : verse
        )
      })),*/
      
      // Update a card's column
      updateCardColumn: (verseId, cardId, newColumn) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse || !verse.boardCards) return state;
        
        const updatedCards = verse.boardCards.map(card => 
          card.id === cardId 
            ? { ...card, column: newColumn } 
            : card
        );
        
        return {
          verses: state.verses.map(v => 
            v.id === verseId 
              ? { ...v, boardCards: updatedCards } 
              : v
          )
        };
      }),
      
      // Update system map data
      updateSystemMapData: (verseId, data) => set((state) => {
        // Make sure we have properly typed data
        const typedData = {
          nodes: data.nodes || [],
          edges: data.edges || []
        };
        
        return {
          ...state,
          verses: state.verses.map(verse => 
            verse.id === verseId 
              ? { ...verse, systemMapData: typedData } 
              : verse
          )
        };
      }),
      
      // Update system map node position
      updateSystemMapNode: (verseId, nodeId, x, y) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse || !verse.systemMapData) return state;
        
        const updatedNodes = verse.systemMapData.nodes.map(node => 
          node.id === nodeId 
            ? { ...node, x, y } 
            : node
        );
        
        // Create a properly typed updated verse object
        const updatedVerses = state.verses.map(v => {
          if (v.id !== verseId) return v;
          
          return {
            ...v,
            systemMapData: {
              nodes: updatedNodes,
              edges: v.systemMapData?.edges || [] // Ensure edges is always defined
            }
          };
        });
        
        return {
          ...state,
          verses: updatedVerses
        };
      }),
      
      // Update system map node label
      updateSystemMapNodeLabel: (verseId, nodeId, label) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse || !verse.systemMapData) return state;
        
        const updatedNodes = verse.systemMapData.nodes.map(node => 
          node.id === nodeId 
            ? { ...node, label } 
            : node
        );
        
        // Create a properly typed updated verse object
        const updatedVerses = state.verses.map(v => {
          if (v.id !== verseId) return v;
          
          return {
            ...v,
            systemMapData: {
              nodes: updatedNodes,
              edges: v.systemMapData?.edges || [] // Ensure edges is always defined
            }
          };
        });
        
        return {
          ...state,
          verses: updatedVerses
        };
      }),
      
      // Update system map edge label
      updateSystemMapEdgeLabel: (verseId, edgeId, label) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse || !verse.systemMapData) return state;
        
        const updatedEdges = verse.systemMapData.edges.map(edge => 
          edge.id === edgeId 
            ? { ...edge, label } 
            : edge
        );
        
        // Create a properly typed updated verse object
        const updatedVerses = state.verses.map(v => {
          if (v.id !== verseId) return v;
          
          return {
            ...v,
            systemMapData: {
              nodes: v.systemMapData?.nodes || [],
              edges: updatedEdges
            }
          };
        });
        
        return {
          ...state,
          verses: updatedVerses
        };
      }),
      
      // Update verse size
      updateVerseSize: (id, size) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === id ? { ...verse, size } : verse
        )
      })),
      
      // Update the name of a verse
      updateVerseName: (id, name) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === id ? { ...verse, name } : verse
        )
      })),
      
      // Update the model of a verse
      updateVerseModel: (id, modelId) => set((state) => ({
        verses: state.verses.map(verse => 
          verse.id === id ? { ...verse, modelId } : verse
        )
      })),
      
      // Add a new component to a verse
      addComponent: (verseId, type, position) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse) return state;
        
        // Find highest z-index
        const maxZIndex = verse.components.reduce(
          (max, comp) => Math.max(max, comp.zIndex), 
          0
        );
        
        // Default positions if not provided
        const defaultPosition = { 
          x: verse.size.width / 4, 
          y: verse.size.height / 4 
        };
        
        // Determine component size based on type
        let componentSize;
        switch (type) {
          case 'chat':
            componentSize = DEFAULT_CHAT_COMPONENT_SIZE;
            break;
          case 'board':
            componentSize = DEFAULT_BOARD_COMPONENT_SIZE;
            break;
          case 'systemMap':
            componentSize = DEFAULT_SYSTEM_MAP_COMPONENT_SIZE;
            break;
          default:
            componentSize = DEFAULT_CHAT_COMPONENT_SIZE;
        }
        
        // Create new component
        const newComponent = {
          id: uuidv4(),
          type,
          position: position || defaultPosition,
          size: componentSize,
          zIndex: maxZIndex + 1
        };
        
        return {
          verses: state.verses.map(v => 
            v.id === verseId 
              ? { ...v, components: [...v.components, newComponent] } 
              : v
          )
        };
      }),
      
      // Remove a component from a verse
      removeComponent: (verseId, componentId) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse) return state;
        
        // Don't remove if it's the last component
        if (verse.components.length <= 1) return state;
        
        return {
          verses: state.verses.map(v => 
            v.id === verseId 
              ? { 
                  ...v, 
                  components: v.components.filter(comp => comp.id !== componentId) 
                } 
              : v
          )
        };
      }),
      
      // Update a component's position in a verse
      updateComponentPosition: (verseId, componentId, position) => set((state) => {
        return {
          verses: state.verses.map(v => 
            v.id === verseId 
              ? { 
                  ...v, 
                  components: v.components.map(comp =>
                    comp.id === componentId 
                      ? { ...comp, position } 
                      : comp
                  ) 
                } 
              : v
          )
        };
      }),
      
      // Update a component's size in a verse
      updateComponentSize: (verseId, componentId, size) => set((state) => {
        return {
          verses: state.verses.map(v => 
            v.id === verseId 
              ? { 
                  ...v, 
                  components: v.components.map(comp =>
                    comp.id === componentId 
                      ? { ...comp, size } 
                      : comp
                  ) 
                } 
              : v
          )
        };
      }),
      
      // Set a component as active in a verse (bring to front)
      setActiveComponent: (verseId, componentId) => set((state) => {
        const verse = state.verses.find(v => v.id === verseId);
        if (!verse) return state;
        
        // Find highest z-index
        const maxZIndex = verse.components.reduce(
          (max, comp) => Math.max(max, comp.zIndex), 
          0
        );
        
        return {
          verses: state.verses.map(v => 
            v.id === verseId 
              ? { 
                  ...v, 
                  components: v.components.map(comp =>
                    comp.id === componentId 
                      ? { ...comp, zIndex: maxZIndex + 1 } 
                      : comp
                  ) 
                } 
              : v
          )
        };
      })
    }),
    {
      name: 'canvas-storage'
    }
  )
);