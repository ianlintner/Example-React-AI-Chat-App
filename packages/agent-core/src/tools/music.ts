/** iTunes search → typed `audio` attachments with 30s previews. No key needed. */
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolDeps } from './types';

export function createMusicTool(deps: ToolDeps) {
  return tool({
    description: 'Search iTunes for music tracks with short playable previews.',
    inputSchema: z.object({
      term: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(5).default(3),
    }),
    execute: async ({ term, limit }) => {
      const url =
        `https://itunes.apple.com/search?term=${encodeURIComponent(term)}` +
        `&media=music&limit=${limit}`;
      const res = await deps.fetch(url);
      if (!res.ok)
        return {
          attachments: [],
          error: `MUSIC_SEARCH_FAILED_${res.status}`,
        } as const;
      const data = (await res.json()) as {
        results: {
          trackName: string;
          artistName: string;
          previewUrl: string;
          trackTimeMillis: number;
        }[];
      };
      const tracks = data.results.filter(t => t.previewUrl);
      if (tracks.length === 0)
        return { attachments: [], error: 'MUSIC_NO_RESULTS' } as const;
      return {
        attachments: tracks.map(t => ({
          id: deps.newId(),
          type: 'audio' as const,
          url: t.previewUrl,
          title: t.trackName,
          artist: t.artistName,
          durationSec: Math.round(t.trackTimeMillis / 1000),
        })),
      };
    },
  });
}
