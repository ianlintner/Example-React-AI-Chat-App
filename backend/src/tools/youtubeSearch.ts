import { ToolDefinition, ToolResult } from './index';
import { ragService } from '../agents/ragService';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';

interface YouTubeSearchInput {
  query: string;
  maxResults?: number;
}

interface YouTubeSearchItem {
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

interface YouTubeVideosItem {
  id: string;
  contentDetails: { duration: string };
}

function parseISODuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) {
    return '';
  }
  const h = parseInt(match[1] ?? '0');
  const m = parseInt(match[2] ?? '0');
  const s = parseInt(match[3] ?? '0');
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function searchYouTube(
  query: string,
  maxResults = 3,
): Promise<ToolResult[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY not set');
  }

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=video&key=${apiKey}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`YouTube search failed: ${searchRes.status}`);
  }
  const searchData = (await searchRes.json()) as { items: YouTubeSearchItem[] };

  const videoIds = searchData.items.map(i => i.id.videoId).join(',');
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
  const videosRes = await fetch(videosUrl);
  const videosData = videosRes.ok
    ? ((await videosRes.json()) as { items: YouTubeVideosItem[] })
    : { items: [] };
  const durationMap = new Map(
    videosData.items.map(v => [v.id, v.contentDetails.duration]),
  );

  return searchData.items.map(item => ({
    attachment: {
      id: uuidv4(),
      type: 'youtube' as const,
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail:
        item.snippet.thumbnails.maxres?.url ??
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.default?.url ??
        `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
      duration: parseISODuration(durationMap.get(item.id.videoId) ?? ''),
    },
  }));
}

// -------------------------------------------------------------------------
// Curated pool for hold/customer-service proactive messages.
//
// Hold flow fires a proactive YouTube video for *every* new connection.
// Going to the YouTube Data API per user burns quota. Instead we keep a
// small pool of family-friendly/safe-searched videos in-memory, refresh
// them every ~2h, and hand out one video at a time (round-robin) until
// the pool is exhausted, at which point we refresh.
//
// This pool is intentionally scoped to the process — restarts or HPA
// scale-outs naturally refill from the API on first use.
// -------------------------------------------------------------------------

const CURATED_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const CURATED_POOL_SIZE = 10;
const CURATED_QUERY = 'funny family friendly clean comedy sketch';

interface CuratedAttachment {
  videoId: string;
  title: string;
  channel?: string;
  thumbnail: string;
  duration?: string;
}

let curatedPool: CuratedAttachment[] = [];
let curatedPoolFetchedAt = 0;
let curatedPoolCursor = 0;
let curatedPoolInflight: Promise<void> | null = null;

async function fetchCuratedPool(): Promise<void> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    logger.warn('[youtube_curated] YOUTUBE_API_KEY not set; pool unavailable');
    return;
  }
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet` +
    `&q=${encodeURIComponent(CURATED_QUERY)}` +
    `&maxResults=${CURATED_POOL_SIZE}` +
    `&type=video&safeSearch=strict&videoEmbeddable=true` +
    `&key=${apiKey}`;
  const res = await fetch(searchUrl);
  if (!res.ok) {
    throw new Error(`YouTube curated search failed: ${res.status}`);
  }
  const data = (await res.json()) as { items: YouTubeSearchItem[] };

  const videoIds = data.items.map(i => i.id.videoId).join(',');
  const videosRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`,
  );
  const videosData = videosRes.ok
    ? ((await videosRes.json()) as { items: YouTubeVideosItem[] })
    : { items: [] };
  const durationMap = new Map(
    videosData.items.map(v => [v.id, v.contentDetails.duration]),
  );

  curatedPool = data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail:
      item.snippet.thumbnails.maxres?.url ??
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.default?.url ??
      `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
    duration: parseISODuration(durationMap.get(item.id.videoId) ?? ''),
  }));
  curatedPoolFetchedAt = Date.now();
  curatedPoolCursor = 0;
  logger.info(
    { size: curatedPool.length },
    '[youtube_curated] pool refreshed',
  );
}

async function refreshCuratedPoolOnce(): Promise<void> {
  if (curatedPoolInflight) {
    return curatedPoolInflight;
  }
  curatedPoolInflight = fetchCuratedPool().catch(err => {
    logger.warn({ err }, '[youtube_curated] refresh failed');
  });
  try {
    await curatedPoolInflight;
  } finally {
    curatedPoolInflight = null;
  }
}

function isCuratedPoolFresh(): boolean {
  return (
    curatedPool.length > 0 &&
    Date.now() - curatedPoolFetchedAt < CURATED_TTL_MS
  );
}

/**
 * Returns the next curated video as a ToolResult, refreshing the pool
 * when it's empty, stale, or fully cycled through. Returns null if the
 * pool can't be built (e.g. no API key) so callers can fall back.
 *
 * Each call returns a freshly-id'd attachment so React keys stay unique
 * even when multiple users are served the same underlying video.
 */
export async function getNextCuratedYouTubeVideo(): Promise<ToolResult | null> {
  if (!isCuratedPoolFresh() || curatedPoolCursor >= curatedPool.length) {
    await refreshCuratedPoolOnce();
  }
  if (curatedPool.length === 0) {
    return null;
  }
  const v = curatedPool[curatedPoolCursor % curatedPool.length];
  curatedPoolCursor++;
  return {
    attachment: {
      id: uuidv4(),
      type: 'youtube' as const,
      videoId: v.videoId,
      title: v.title,
      channel: v.channel,
      thumbnail: v.thumbnail,
      duration: v.duration,
    },
  };
}

// Test hook — resets the in-memory pool so unit tests don't bleed state.
export function __resetCuratedYouTubePoolForTests(): void {
  curatedPool = [];
  curatedPoolFetchedAt = 0;
  curatedPoolCursor = 0;
  curatedPoolInflight = null;
}

function ragFallback(query: string): ToolResult {
  const rag = ragService.searchForAgent('youtube_guru', query, true);
  const videoId = (rag?.metadata?.videoId as string) ?? 'dQw4w9WgXcQ';
  return {
    attachment: {
      id: uuidv4(),
      type: 'youtube',
      videoId,
      title: (rag?.metadata?.title as string) ?? 'Suggested Video',
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    },
  };
}

export const youtubeSearchTool: ToolDefinition = {
  name: 'youtube_search',
  description:
    'Search YouTube for videos matching a query. Returns video cards with thumbnail and playback link.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for YouTube' },
      maxResults: {
        type: 'number',
        description: 'Number of results to return (1-3). Default 3.',
        default: 3,
      },
    },
    required: ['query'],
  },
  async execute(input: unknown): Promise<ToolResult[]> {
    const { query, maxResults = 3 } = input as YouTubeSearchInput;
    try {
      return await searchYouTube(query, Math.min(maxResults, 3));
    } catch (err) {
      logger.warn(
        { err },
        '[youtube_search] API unavailable, using RAG fallback',
      );
      return [ragFallback(query)];
    }
  },
};
