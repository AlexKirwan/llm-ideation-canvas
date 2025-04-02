import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import { SystemMapData, SystemMapNode, SystemMapEdge } from '../../components/SystemMap/SystemMap';

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

    // System prompt for system map analysis
    const systemPrompt = `
      You are an expert system architect and software engineer.
      Your task is to analyze a conversation and extract key components, services, databases, users, and external systems discussed.
      Then, create a system map showing how these components relate to each other.
      
      For each entity, determine:
      1. A clear, descriptive label (keep it short but clear)
      2. The type (component, service, database, user, external)
      3. Relationships between entities (what connects to what)
      
      Format your response as a JSON object with the following structure:
      {
        "nodes": [
          {
            "id": "unique-id",
            "label": "Component Name",
            "type": "component", // one of: component, service, database, user, external
            "x": 100, // initial x position (between 50-950)
            "y": 100  // initial y position (between 50-550)
          }
        ],
        "edges": [
          {
            "id": "unique-id",
            "source": "source-node-id",
            "target": "target-node-id",
            "label": "optional relationship description"
          }
        ]
      }
      
      Place nodes in a logical layout with:
      - Users at the top
      - UI components in the upper middle
      - Services in the middle
      - Databases at the bottom
      - External systems on the sides
      
      Ensure there are no node overlaps by spacing them appropriately.
      Only return the JSON object, nothing else.
    `;

    // Make API call to Claude with user-provided API key
    try {
      const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1500,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here's a conversation to analyze for a system architecture map:\n\n${conversationText}\n\nPlease extract the key components and their relationships as described.`
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
    
    // Process the response to ensure all nodes and edges have proper IDs
    const processNodes = (nodes: Partial<SystemMapNode>[]): SystemMapNode[] => {
      return nodes.map(node => ({
        id: node.id || uuidv4(),
        label: node.label || 'Unnamed Component',
        x: node.x !== undefined ? node.x : Math.floor(Math.random() * 900) + 50,
        y: node.y !== undefined ? node.y : Math.floor(Math.random() * 500) + 50,
        type: (node.type as SystemMapNode['type']) || 'component'
      }));
    };
    
    const processedNodes = processNodes(parsedContent.nodes || []);
    
    // Use a node ID lookup for faster edge processing
    const nodeIdMap = processedNodes.reduce((map, node) => {
      map[node.id] = true;
      return map;
    }, {} as Record<string, boolean>);
    
    const processEdges = (edges: Partial<SystemMapEdge>[]): SystemMapEdge[] => {
      return edges
        .filter(edge => 
          edge.source && edge.target && 
          nodeIdMap[edge.source] && nodeIdMap[edge.target]
        )
        .map(edge => ({
          id: edge.id || uuidv4(),
          source: edge.source!,
          target: edge.target!,
          label: edge.label
        }));
    };
    
    const result: SystemMapData = {
      nodes: processedNodes,
      edges: processEdges(parsedContent.edges || [])
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
    console.error('Error generating system map:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Error generating system map';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}