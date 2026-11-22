/** Giphy search → typed `gif` attachment. API key from env, fail closed. */
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolDeps } from './types';

export function createGifTool(deps: ToolDeps) {
  return tool({
    description:
      'Search Giphy for an animated GIF matching a topic or emotion.',
    inputSchema: z.object({ query: z.string().min(1).max(200) }),
    execute: async ({ query }) => {
      const key = deps.env.GIPHY_API_KEY;
      if (!key)
        return {
          attachments: [],
          error: 'GIPHY_API_KEY is not configured',
        } as const;
      const url =
        `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}` +
        `&limit=1&rating=g&api_key=${key}`;
      const res = await deps.fetch(url);
      if (!res.ok)
        return {
          attachments: [],
          error: `GIPHY_SEARCH_FAILED_${res.status}`,
        } as const;
      const data = (await res.json()) as {
        data: {
          id: string;
          title: string;
          images: { original: { url: string; width: string; height: string } };
        }[];
      };
      const gif = data.data[0];
      if (!gif) return { attachments: [], error: 'GIPHY_NO_RESULTS' } as const;
      return {
        attachments: [
          {
            id: deps.newId(),
            type: 'gif' as const,
            url: gif.images.original.url,
            title: gif.title,
            width: Number.parseInt(gif.images.original.width, 10),
            height: Number.parseInt(gif.images.original.height, 10),
          },
        ],
      };
    },
  });
}
