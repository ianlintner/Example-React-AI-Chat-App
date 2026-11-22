/**
 * YouTube search tool, ported from `backend/src/tools/youtubeSearch.ts`.
 * Keeps the curated TTL pool (2h, round-robin, single-flight refresh) to
 * avoid burning API quota. Uses an injected fetch so tests make no network
 * calls and never log an API key.
 */
import type { MediaAttachment } from '@agent-chat/contract';
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolDeps } from './types';

const CURATED_TTL_MS = 2 * 60 * 60 * 1000;
const CURATED_POOL_SIZE = 10;
const CURATED_QUERY = 'funny family friendly clean comedy sketch';
const API = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      maxres?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
}

export function parseISODuration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = Number(m[1] ?? 0);
  const mins = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h > 0
    ? `${h}:${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${mins}:${String(s).padStart(2, '0')}`;
}

function toAttachment(
  item: YouTubeItem,
  duration: string,
  id: string,
): MediaAttachment {
  return {
    id,
    type: 'youtube',
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail:
      item.snippet.thumbnails.maxres?.url ??
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.default?.url ??
      `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
    duration,
  };
}

async function fetchDurations(
  deps: ToolDeps,
  key: string,
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const url = `${API}/videos?part=contentDetails&id=${ids.join(',')}&key=${key}`;
  const res = await deps.fetch(url);
  if (!res.ok) return new Map();
  const data = (await res.json()) as {
    items: { id: string; contentDetails?: { duration?: string } }[];
  };
  return new Map(
    data.items
      .filter(v => v.id && v.contentDetails?.duration)
      .map(v => [v.id, v.contentDetails!.duration!]),
  );
}

export function createYouTubeTool(deps: ToolDeps) {
  let pool: MediaAttachment[] = [];
  let fetchedAt = 0;
  let cursor = 0;
  let inflight: Promise<void> | null = null;

  async function refresh(): Promise<void> {
    const key = deps.env.YOUTUBE_API_KEY;
    if (!key) return; // fail closed: no placeholder key
    if (inflight) return inflight;
    inflight = (async () => {
      const url =
        `${API}/search?part=snippet&q=${encodeURIComponent(CURATED_QUERY)}` +
        `&maxResults=${CURATED_POOL_SIZE}&type=video&safeSearch=strict` +
        `&videoEmbeddable=true&key=${key}`;
      const res = await deps.fetch(url);
      if (!res.ok) throw new Error(`YOUTUBE_SEARCH_FAILED_${res.status}`);
      const data = (await res.json()) as { items: YouTubeItem[] };
      const durations = await fetchDurations(
        deps,
        key,
        data.items.map(i => i.id.videoId),
      );
      pool = data.items.map(i =>
        toAttachment(
          i,
          parseISODuration(durations.get(i.id.videoId) ?? ''),
          deps.newId(),
        ),
      );
      fetchedAt = deps.now();
      cursor = 0;
    })().catch(() => {
      // Keep the old pool on refresh failure; no key value in any message.
      pool = [];
    });
    try {
      await inflight;
    } finally {
      inflight = null;
    }
  }

  /** Exported for tests: resets process-local curated pool state. */
  const reset = () => {
    pool = [];
    fetchedAt = 0;
    cursor = 0;
    inflight = null;
  };

  /** Next curated video, or null when no key / no results. */
  async function nextCurated(): Promise<MediaAttachment | null> {
    // Refresh only when the pool is empty or stale. Wrap the cursor within a
    // fresh pool so round-robin does not burn quota.
    if (pool.length === 0 || deps.now() - fetchedAt >= CURATED_TTL_MS) {
      await refresh();
    }
    if (pool.length === 0) return null;
    const item = pool[cursor % pool.length]!;
    cursor += 1;
    return { ...item, id: deps.newId() };
  }

  const search = tool({
    description:
      'Search YouTube for videos. Returns video cards with thumbnails.',
    inputSchema: z.object({
      query: z.string().min(1).max(200),
      maxResults: z.number().int().min(1).max(3).default(3),
    }),
    execute: async ({ query, maxResults }) => {
      const key = deps.env.YOUTUBE_API_KEY;
      if (!key) {
        return {
          attachments: [],
          error: 'YOUTUBE_API_KEY is not configured',
        } as const;
      }
      const url =
        `${API}/search?part=snippet&q=${encodeURIComponent(query)}` +
        `&maxResults=${maxResults}&type=video&key=${key}`;
      const res = await deps.fetch(url);
      if (!res.ok) {
        return {
          attachments: [],
          error: `YOUTUBE_SEARCH_FAILED_${res.status}`,
        } as const;
      }
      const data = (await res.json()) as { items: YouTubeItem[] };
      const durations = await fetchDurations(
        deps,
        key,
        data.items.map(i => i.id.videoId),
      );
      return {
        attachments: data.items.map(i =>
          toAttachment(
            i,
            parseISODuration(durations.get(i.id.videoId) ?? ''),
            deps.newId(),
          ),
        ),
      };
    },
  });

  return { name: 'youtube_search', tool: search, nextCurated, reset };
}

export type YouTubeTool = ReturnType<typeof createYouTubeTool>;
