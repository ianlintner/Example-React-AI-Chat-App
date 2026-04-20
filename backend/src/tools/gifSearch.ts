import { ToolDefinition, ToolResult } from './index';
import { ragService } from '../agents/ragService';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

interface GiphySearchInput {
  query: string;
}

interface GiphyData {
  id: string;
  title: string;
  images: { original: { url: string; width: string; height: string } };
}

async function searchGiphy(query: string): Promise<ToolResult> {
  const apiKey = process.env.GIPHY_API_KEY;
  if (!apiKey) {
    throw new Error('GIPHY_API_KEY not set');
  }

  const url = `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&limit=1&rating=g&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Giphy search failed: ${res.status}`);
  }
  const data = (await res.json()) as { data: GiphyData[] };
  const gif = data.data[0];
  if (!gif) {
    throw new Error('No GIF results');
  }

  return {
    attachment: {
      id: uuidv4(),
      type: 'gif',
      url: gif.images.original.url,
      title: gif.title,
      width: parseInt(gif.images.original.width),
      height: parseInt(gif.images.original.height),
    },
  };
}

function ragFallback(query: string): ToolResult {
  const rag = ragService.searchForAgent('gif', query, true);
  return {
    attachment: {
      id: uuidv4(),
      type: 'gif',
      url:
        rag?.content ??
        'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
      title: (rag?.metadata?.alt as string) ?? query,
    },
  };
}

export const gifSearchTool: ToolDefinition = {
  name: 'gif_search',
  description: 'Search Giphy for an animated GIF matching a topic or emotion.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'What the GIF should show (e.g. "laughing cat", "celebration")',
      },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { query } = input as GiphySearchInput;
    try {
      return await searchGiphy(query);
    } catch (err) {
      logger.warn(
        { err },
        '[gif_search] Giphy unavailable, using RAG fallback',
      );
      return ragFallback(query);
    }
  },
};
