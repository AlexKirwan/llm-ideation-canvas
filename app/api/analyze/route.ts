import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { BoardCard } from '../../components/Board/KanbanBoard';

// Environment variables
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_SECRET = process.env.API_SECRET || '';  // The secret key users must provide

export async function POST(request: NextRequest) {
  try {
    const { messages, apiKey } = await request.json();
    
    // Validate the API secret from user
    const userSecret = apiKey || '';
    
    // Check if the API secret is provided
    if (!userSecret || userSecret.trim() === '') {
      return NextResponse.json(
        { error: 'API secret is missing. Please provide the API secret in settings.' },
        { status: 401 }
      );
    }
    
    // Verify that the provided secret matches the environment variable
    if (userSecret !== API_SECRET) {
      return NextResponse.json(
        { error: 'Invalid API secret. Please provide the correct API secret.' },
        { status: 401 }
      );
    }
    
    // Check if the Claude API key is available in environment variables
    if (!CLAUDE_API_KEY || !CLAUDE_API_KEY.startsWith('sk-ant-')) {
      console.error('Invalid or missing Claude API key in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error. Please contact the administrator.' },
        { status: 500 }
      );
    }
    
    // Initialize Anthropic client with the Claude API key from environment variables
    const anthropic = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Valid messages array is required' },
        { status: 400 }
      );
    }

    // Create a formatted conversation history for analysis
    const conversationText = messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n\n');

    // System prompt for analysis
    const systemPrompt = `
      You are an expert conversation analyst and project manager. 
      Your task is to analyze a conversation and extract:
      
      1. Points that need ELABORATION - ideas or concepts mentioned that could be developed further
      2. PROBLEMS or challenges identified in the conversation
      3. SOLUTIONS or action items proposed
      
      For each category, extract 3-5 key points. Each point should be a clear, concise statement.
      
      Format your response as a JSON object with the following structure:
      {
        "elaborate": [{"id": "unique-id", "content": "point description", "column": "elaborate"}],
        "problems": [{"id": "unique-id", "content": "problem description", "column": "problems"}],
        "solutions": [{"id": "unique-id", "content": "solution description", "column": "solutions"}]
      }
      
      Only return the JSON object, nothing else.
    `;

    // Make API call to Claude with user-provided API key
    try {
      const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here's a conversation to analyze:\n\n${conversationText}\n\nPlease extract the key points as described.`
        }
      ]
    });

    // Parse the JSON response
    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';
    let parsedContent;
    
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      console.error('Failed to parse Claude response as JSON:', error);
      // Try to extract JSON if Claude added extra text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse response as JSON');
      }
    }
    
    // Ensure all items have proper structure
    const processCards = (cards: { id?: string; content: string; column: 'elaborate' | 'problems' | 'solutions' }[]): BoardCard[] => {
      return cards.map(card => ({
        id: card.id || uuidv4(),
        content: card.content,
        column: card.column
      }));
    };
    
    const result = {
      elaborate: processCards(parsedContent.elaborate || []),
      problems: processCards(parsedContent.problems || []),
      solutions: processCards(parsedContent.solutions || [])
    };

    return NextResponse.json(result);
    
    } catch (anthropicError) {
      console.error('Error from Claude API:', anthropicError);
      
      // Check for authentication errors specifically
      if (anthropicError instanceof Error) {
        const errorMessage = anthropicError.message || '';
        
        // Handle common auth errors
        if (errorMessage.includes('401') || 
            errorMessage.includes('auth') || 
            errorMessage.includes('key') ||
            errorMessage.includes('invalid')) {
          return NextResponse.json(
            { error: 'Invalid API key or authentication failed. Please check your API key.' },
            { status: 401 }
          );
        }
        
        // Rate limit errors
        if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          return NextResponse.json(
            { error: 'Rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
        }
      }
      
      // General error fallback
      return NextResponse.json(
        { error: 'Error communicating with Claude API' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error analyzing conversation:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Error analyzing conversation';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}