import { describe, expect, it, vi } from 'vitest';
import { loadToolsConfig } from './config';
import { rollDice } from './dice';
import { createDiceTool } from './dice';
import { createGifTool } from './gif';
import { createMcpClient } from './mcp';
import { createMusicTool } from './music';
import { createYouTubeTool, parseISODuration } from './youtube';
import type { ToolDeps } from './types';

function fakeFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string | URL | Request) => {
    const key = String(url);
    const body = Object.entries(responses).find(([part]) =>
      key.includes(part),
    )?.[1];
    return {
      ok: body !== undefined,
      status: body === undefined ? 503 : 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
      text: async () => JSON.stringify(body ?? {}),
    } as Response;
  }) as unknown as typeof globalThis.fetch;
}

function deps(
  responses: Record<string, unknown>,
  env: Record<string, string> = {},
): ToolDeps {
  return {
    fetch: fakeFetch(responses),
    env: loadToolsConfig(env),
    newId: (() => {
      let n = 0;
      return () => `media_${++n}`;
    })(),
    now: () => 1_000_000,
    random: () => 0.5,
  };
}

describe('tool config', () => {
  it('has no default secrets and parses MCP URLs', () => {
    const c = loadToolsConfig({
      MCP_SERVER_URLS: 'http://127.0.0.1:9000, http://127.0.0.1:9001',
    });
    expect(c.YOUTUBE_API_KEY).toBeUndefined();
    expect(c.MCP_SERVER_URLS).toEqual([
      'http://127.0.0.1:9000',
      'http://127.0.0.1:9001',
    ]);
  });

  it('fails closed on empty or invalid values', () => {
    expect(() => loadToolsConfig({ YOUTUBE_API_KEY: '' })).toThrow(
      /YOUTUBE_API_KEY/,
    );
    expect(() =>
      loadToolsConfig({ MCP_SERVER_URLS: 'ftp://example.com' }),
    ).toThrow(/MCP_SERVER_URLS/);
  });
});

describe('youtube_search', () => {
  it('returns video attachments from a mocked search', async () => {
    const d = deps(
      {
        '/youtube/v3/search': {
          items: [
            {
              id: { videoId: 'dQw4w9WgXcQ' },
              snippet: {
                title: 'Funny sketch',
                channelTitle: 'Channel',
                thumbnails: {
                  high: { url: 'https://img.youtube.com/vi/x/hqdefault.jpg' },
                },
              },
            },
          ],
        },
        '/youtube/v3/videos': {
          items: [
            { id: 'dQw4w9WgXcQ', contentDetails: { duration: 'PT4M32S' } },
          ],
        },
      },
      { YOUTUBE_API_KEY: 'test-key' },
    );
    const out = (await createYouTubeTool(d).tool.execute!(
      { query: 'comedy', maxResults: 3 },
      {} as never,
    )) as unknown as {
      attachments: { type: string; videoId: string; duration: string }[];
    };
    expect(out.attachments).toMatchObject([
      { type: 'youtube', videoId: 'dQw4w9WgXcQ', duration: '4:32' },
    ]);
  });

  it('fails closed when no API key is configured', async () => {
    const out = (await createYouTubeTool(deps({}, {})).tool.execute!(
      { query: 'x', maxResults: 1 },
      {} as never,
    )) as unknown as { attachments: unknown[]; error: string };
    expect(out.attachments).toEqual([]);
    expect(out.error).toContain('YOUTUBE_API_KEY');
  });

  it('keeps a curated TTL pool and round-robins until stale', async () => {
    const searchFn = vi.fn(async (_url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            id: { videoId: 'aaaaaaaaaaa' },
            snippet: { title: 'A', channelTitle: 'C', thumbnails: {} },
          },
        ],
      }),
    }));
    const search = searchFn as unknown as typeof globalThis.fetch;
    const d: ToolDeps = {
      ...deps({}, { YOUTUBE_API_KEY: 'test-key' }),
      fetch: search,
      now: (() => {
        let t = 0;
        return () => (t += 60_000);
      })(),
    };
    const yt = createYouTubeTool(d);
    const first = (await yt.nextCurated()) as {
      type: string;
      videoId: string;
    } | null;
    const second = (await yt.nextCurated()) as {
      type: string;
      videoId: string;
    } | null;
    expect(first?.type).toBe('youtube');
    expect(second?.videoId).toBe(first?.videoId);
    expect(
      searchFn.mock.calls.filter(c => String(c[0]).includes('/search')),
    ).toHaveLength(1); // TTL pool reused
    yt.reset();
  });

  it('parses ISO durations', () => {
    expect(parseISODuration('PT1H2M3S')).toBe('1:02:03');
    expect(parseISODuration('PT45S')).toBe('0:45');
  });
});

describe('gif_search', () => {
  it('returns a gif attachment and fails closed without a key', async () => {
    const withKey = createGifTool(
      deps(
        {
          '/v1/gifs/search': {
            data: [
              {
                id: 'g1',
                title: 'Yay',
                images: {
                  original: {
                    url: 'https://media.giphy.com/media/g1/giphy.gif',
                    width: '480',
                    height: '270',
                  },
                },
              },
            ],
          },
        },
        { GIPHY_API_KEY: 'test-key' },
      ),
    );
    const out = (await withKey.execute!({ query: 'yay' }, {} as never)) as {
      attachments: { type: string; width: number }[];
    };
    expect(out.attachments[0]).toMatchObject({ type: 'gif', width: 480 });
    const noKey = await createGifTool(deps({}, {})).execute!(
      { query: 'x' },
      {} as never,
    );
    expect(noKey).toMatchObject({
      attachments: [],
      error: 'GIPHY_API_KEY is not configured',
    });
  });
});

describe('music_search', () => {
  it('returns playable audio attachments', async () => {
    const tool = createMusicTool(
      deps({
        '/search': {
          results: [
            {
              trackName: 'Song',
              artistName: 'Artist',
              previewUrl: 'https://audio.example.com/preview.mp3',
              trackTimeMillis: 30_000,
            },
          ],
        },
      }),
    );
    const out = (await tool.execute!(
      { term: 'jazz', limit: 3 },
      {} as never,
    )) as {
      attachments: { type: string; title: string; durationSec: number }[];
    };
    expect(out.attachments[0]).toMatchObject({
      type: 'audio',
      title: 'Song',
      durationSec: 30,
    });
  });
});

describe('dice', () => {
  it('rolls deterministic results with an injected RNG', async () => {
    const tool = createDiceTool(deps({}));
    const out = (await tool.execute!(
      { notation: '2d6+3', purpose: 'attack' },
      {} as never,
    )) as {
      attachments: { rolls: number[]; total: number }[];
    };
    expect(out.attachments[0]).toMatchObject({ rolls: [4, 4], total: 11 });
    expect(() => rollDice('drop table')).toThrow(/INVALID_DICE_NOTATION/);
  });
});

describe('MCP client', () => {
  it('rejects non-ui:// app resources and malformed tool names', async () => {
    const client = createMcpClient({
      fetch: fakeFetch({}),
      url: 'http://127.0.0.1:9000/mcp',
    });
    await expect(
      client.readAppResource('https://evil.test/app'),
    ).rejects.toThrow(/MCP_INVALID_APP_URI/);
    await expect(client.callTool('not namespaced', {})).rejects.toThrow(
      /MCP_INVALID_TOOL_NAME/,
    );
  });

  it('exposes only well-formed remote tools', async () => {
    const client = createMcpClient({
      fetch: fakeFetch({
        '/mcp': {
          jsonrpc: '2.0',
          result: {
            tools: [
              { name: 'safe_tool', description: 'ok', inputSchema: {} },
              { name: 'BAD NAME!', description: 'poison', inputSchema: {} },
            ],
          },
        },
      }),
      url: 'http://127.0.0.1:9000/mcp',
    });
    expect(await client.listTools()).toHaveLength(1);
  });
});
