import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Environment variables
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_SECRET = process.env.API_SECRET || '';  // The secret key users must provide

export async function POST(request: NextRequest) {
  try {
    const { messages, context, systemPrompt, apiKey, model } = await request.json();
    
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

    // Check for required fields
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    // Prepare the system prompt with context if available
    const system = context 
      ? `${systemPrompt || `You are a smart Chief Product and Technology Officer (CPTO) of a successful tech company. 
Provide thoughtful, strategic advice on product development, technology implementation, 
and technical leadership. Draw from your experience to help with technical challenges, 
product roadmaps, and business technology strategy. Be concise but insightful.

Format your responses using Markdown:
- Use **bold** for emphasis on important points
- Use *italics* for secondary emphasis
- Use \`code\` for technical terms, commands, or variable names
- Use code blocks with triple backticks for multi-line code or configuration
- Use headings (## or ###) to organize longer responses
- Use bullet lists and numbered lists for organized information
- Use > blockquotes for highlighting important insights or quotes
- If including data, use tables when appropriate
- Break complex answers into clearly labeled sections`}\n\nContext from previous conversation:\n${context}`
      : systemPrompt || `You are a smart Chief Product and Technology Officer (CPTO) of a successful tech company. 
Provide thoughtful, strategic advice on product development, technology implementation, 
and technical leadership. Draw from your experience to help with technical challenges, 
product roadmaps, and business technology strategy. Be concise but insightful.

Format your responses using Markdown:
- Use **bold** for emphasis on important points
- Use *italics* for secondary emphasis
- Use \`code\` for technical terms, commands, or variable names
- Use code blocks with triple backticks for multi-line code or configuration
- Use headings (## or ###) to organize longer responses
- Use bullet lists and numbered lists for organized information
- Use > blockquotes for highlighting important insights or quotes
- If including data, use tables when appropriate
- Break complex answers into clearly labeled sections`;

    // Create message payload for Claude
    const payload = {
      model: model || 'claude-3-opus-20240229', // Use provided model ID or default to Opus
      max_tokens: 4000,
      temperature: 0.7,
      system,
      messages,
    };
    
    console.log('Using Claude model:', model || 'claude-3-opus-20240229');

    // Make API call to Claude with user-provided API key
    try {
      const response = await anthropic.messages.create(payload);
      // Return Claude's response if successful
      return NextResponse.json(response);
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
    console.error('Error in route handler:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Error processing request';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}