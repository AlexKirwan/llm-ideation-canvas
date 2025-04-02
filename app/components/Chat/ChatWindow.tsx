import { useState, useRef, useEffect, useMemo } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import type { ChatMessage, AIModel, ModelProvider } from '../../types';
import { availableModels } from '../../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatWindowProps {
  verseId: string;
}

export default function ChatWindow({ verseId }: ChatWindowProps) {
  const { verses, addChatMessage } = useCanvasStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Find the current verse and memoize the chat history
  const verse = verses.find(v => v.id === verseId);
  const chatHistory = useMemo(() => verse?.chatHistory || [], [verse?.chatHistory]);
  
  // Handle direct branching from message
  const handleBranchClick = (messageId: string) => {
    console.log('Initiating branch from message:', messageId);
    // Create and dispatch event
    const event = new CustomEvent('branchFromMessage', {
      detail: { messageId }
    });
    document.dispatchEvent(event);
  };
  
  // Log verse and model info for debugging
  useEffect(() => {
    if (verse) {
      const modelInfo = availableModels.find(m => m.id === verse.modelId);
      console.log('Verse model:', verse.modelId);
      console.log('Model info:', modelInfo);
    }
  }, [verse]);
  
  // Get parent verse if this is a branch
  const parentVerse = verse?.parentId
    ? verses.find(v => v.id === verse.parentId)
    : null;

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim()
    };
    addChatMessage(verseId, userMessage);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Prepare messages for Claude API
      const messagesToSend = chatHistory
        .filter(msg => msg.role !== 'system') // System messages handled separately
        .map(({ role, content }) => ({ role, content }));
      
      // Add the new user message
      messagesToSend.push({
        role: 'user',
        content: userMessage.content
      });
      
      // Get the verse's system prompt
      const systemPrompt = verse?.systemPrompt || 'You are Claude, a helpful AI assistant.';
      
      // Get context from parent verse if this is a branch
      // We always include parent context to maintain conversation continuity
      let context = '';
      if (parentVerse) {
          
        // If parent has its own parent, recursively get that context too
        const getParentChain = (verseId: string): string => {
          const parent = verses.find(v => v.id === verseId);
          if (!parent) return '';
          
          // If this is a message-level branch, only include context up to that message
          let filteredHistory = parent.chatHistory.filter(msg => msg.role !== 'system');
          
          // If we branched from a specific message in this parent, limit context
          if (verse?.branchSourceMessageId && parent.id === verse.parentId) {
            const messageIndex = parent.chatHistory.findIndex(msg => msg.id === verse.branchSourceMessageId);
            if (messageIndex !== -1) {
              filteredHistory = parent.chatHistory
                .slice(0, messageIndex + 1)
                .filter(msg => msg.role !== 'system');
            }
          }
          
          const parentContext = filteredHistory
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n\n');
            
          // If this parent also has a parent, get that context too
          if (parent.parentId) {
            const grandparentContext = getParentChain(parent.parentId);
            return grandparentContext ? `${grandparentContext}\n\n${parentContext}` : parentContext;
          }
          
          return parentContext;
        };
        
        // Build context with all parent chains
        context = verse?.parentId ? getParentChain(verse.parentId) : '';
      }
      
      // Clear any previous API errors
      setApiError(null);
      
      // Get API key from localStorage if available
      let apiKey = '';
      if (typeof window !== 'undefined') {
        apiKey = localStorage.getItem('apiSecret') || '';
      }
      
      // Get verse's model ID if available
      if (!verse) throw new Error("Verse not found");
      
      // Find the model details for this verse from the availableModels array
      const verseModelId = verse.modelId;
      const modelInfo = availableModels.find(m => m.id === verseModelId);
      
      // Determine which API endpoint to use based on the verse's model provider
      let apiEndpoint = '/api/claude'; // Default fallback to Claude
      
      if (modelInfo) {
        // Use the correct endpoint based on the model's provider
        apiEndpoint = modelInfo.provider === 'anthropic' ? '/api/claude' : '/api/openai';
        console.log(`Using ${modelInfo.name} (${modelInfo.provider}) API endpoint: ${apiEndpoint}`);
      } else {
        // Log warning if model not found and use default
        console.warn(`Model with ID ${verseModelId} not found in available models, defaulting to Claude API`);
      }
      
      // Make API call to our backend route with API key
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messagesToSend,
          context,
          systemPrompt,
          apiKey, // Include the API key in the request
          model: verseModelId // Include the verse's model ID
        }),
      });
      
      if (!response.ok) {
        // Parse error response
        const errorData = await response.json();
        
        // Handle different error types
        if (response.status === 401) {
          // Authentication error - likely API key issue
          setApiError(errorData.error || 'API key error. Please check your API key in settings.');
          throw new Error('API key error');
        } else {
          // Other errors
          throw new Error(errorData.error || 'Failed to get response from Claude');
        }
      }
      
      const data = await response.json();
      
      // Add Claude's response to chat
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.content?.[0]?.text || 'Sorry, I had trouble responding.'
      };
      addChatMessage(verseId, assistantMessage);
    } catch (error) {
      console.error('Error communicating with Claude:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, there was an error communicating with Claude. Please try again.'
      };
      addChatMessage(verseId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <div className="flex flex-col h-full">
      {parentVerse && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-950 text-xs rounded">
          <p className="text-blue-600 dark:text-blue-300 font-medium">
            Branched from verse {parentVerse.id.slice(0, 4)}
          </p>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {/* Show API key error message if present */}
        {apiError && (
          <div className="mx-auto p-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg mb-2 text-xs">
            <div className="font-medium">API Key Error</div>
            <p>{apiError}</p>
            <button 
              onClick={() => {
                // Open API key configuration dialog
                const event = new CustomEvent('openApiConfig');
                window.dispatchEvent(event);
              }}
              className="mt-1 px-2 py-1 bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700 rounded-md text-xs"
            >
              Configure API Key
            </button>
          </div>
        )}
        
        {chatHistory.filter(msg => msg.role !== 'system').length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-3 text-xs">
            Start a conversation
          </div>
        ) : (
          chatHistory
            .filter(msg => msg.role !== 'system')
            .map((message, index) => (
              <div
                key={message.id || index}
                className={`p-2 rounded-lg max-w-[85%] text-xs leading-tight relative ${
                  message.role === 'user'
                    ? 'bg-blue-500 dark:bg-blue-700 ml-auto text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
                onMouseEnter={() => message.id && setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                {/* Branch button - only show on hover and for non-system messages */}
                {message.role !== 'system' && message.id && hoveredMessageId === message.id && (
                  <div className="absolute -left-7 top-1/2 transform -translate-y-1/2 flex items-center justify-center">
                    <button
                      className="p-1 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-300 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Use the dedicated handler
                        if (message.id) {
                          handleBranchClick(message.id);
                        }
                      }}
                      title="Branch from this message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3v12"></path>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                      </svg>
                    </button>
                  </div>
                )}
                
                <div className="flex flex-col w-full">
                  {message.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  ) : (
                    <div className="markdown prose-xs dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  
                  {/* Inline branch button */}
                  {message.id && (
                    <div className={`flex justify-end mt-1 ${hoveredMessageId === message.id ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
                      <button
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-700 dark:text-blue-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (message.id) {
                            handleBranchClick(message.id);
                          }
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 3v12"></path>
                          <circle cx="18" cy="6" r="3"></circle>
                          <circle cx="6" cy="18" r="3"></circle>
                          <path d="M18 9a9 9 0 0 1-9 9"></path>
                        </svg>
                        Branch
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
        )}
        {isLoading && (
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse text-xs">
            AI is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="mt-auto pt-1">
        <div className="flex items-end border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
          <textarea
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Message..."
            className="flex-1 p-2 text-xs focus:outline-none resize-none bg-transparent"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-3 py-2 text-xs text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}