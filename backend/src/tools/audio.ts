import { ToolDefinition, ToolResult } from './index';
import { logger } from '../logger';
import { v4 as uuidv4 } from 'uuid';
import { instrumentedFetch } from '../metrics/fetch';

interface PlayAudioInput {
  url: string;
  title: string;
  artist?: string;
  durationSec?: number;
}

interface MusicSearchInput {
  term: string;
  limit?: number;
}

interface iTunesTrack {
  trackName: string;
  artistName: string;
  previewUrl: string;
  trackTimeMillis: number;
}

export const playAudioTool: ToolDefinition = {
  name: 'play_audio',
  description:
    'Present an audio player with a direct URL to an audio file (MP3 or similar).',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Direct URL to the audio file' },
      title: { type: 'string', description: 'Track title' },
      artist: { type: 'string', description: 'Artist name' },
      durationSec: { type: 'number', description: 'Duration in seconds' },
    },
    required: ['url', 'title'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { url, title, artist, durationSec } = input as PlayAudioInput;
    return {
      attachment: {
        id: uuidv4(),
        type: 'audio',
        url,
        title,
        artist,
        durationSec,
      },
    };
  },
};

export const musicSearchTool: ToolDefinition = {
  name: 'music_search',
  description:
    'Search iTunes for music tracks with 30-second preview URLs. Returns playable audio cards.',
  input_schema: {
    type: 'object',
    properties: {
      term: {
        type: 'string',
        description: 'Artist name, song title, or genre to search',
      },
      limit: {
        type: 'number',
        description: 'Number of results (1-5)',
        default: 3,
      },
    },
    required: ['term'],
  },
  async execute(input: unknown): Promise<ToolResult[]> {
    const { term, limit = 3 } = input as MusicSearchInput;
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=${Math.min(limit, 5)}`;
      const res = await instrumentedFetch('itunes', url);
      if (!res.ok) {
        throw new Error(`iTunes search failed: ${res.status}`);
      }
      const data = (await res.json()) as { results: iTunesTrack[] };
      const tracks = data.results.filter(t => t.previewUrl);
      if (tracks.length === 0) {
        throw new Error('No preview tracks found');
      }
      return tracks.map(t => ({
        attachment: {
          id: uuidv4(),
          type: 'audio' as const,
          url: t.previewUrl,
          title: t.trackName,
          artist: t.artistName,
          durationSec: Math.round(t.trackTimeMillis / 1000),
        },
      }));
    } catch (err) {
      logger.warn({ err }, '[music_search] iTunes unavailable');
      return [
        {
          attachment: {
            id: uuidv4(),
            type: 'audio',
            url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            title: `Music: ${term}`,
            artist: 'Various Artists',
          },
        },
      ];
    }
  },
};
