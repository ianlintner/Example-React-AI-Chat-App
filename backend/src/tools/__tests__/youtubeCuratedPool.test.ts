/**
 * Curated YouTube pool: shared across users in the hold flow to avoid
 * burning YouTube Data API quota per connection. Serves one video at a
 * time, rotates through, refreshes on TTL expiry or exhaustion.
 */
import {
  getNextCuratedYouTubeVideo,
  __resetCuratedYouTubePoolForTests,
} from '../youtubeSearch';

type MockResponse = Partial<Response> & {
  ok: boolean;
  json: () => Promise<any>;
  status?: number;
};

const fakeFetch = (items: Array<{ id: string; title: string }>) => {
  let call = 0;
  return jest.fn<Promise<MockResponse>, [string]>(async () => {
    call++;
    if (call % 2 === 1) {
      // search.list
      return {
        ok: true,
        json: async () => ({
          items: items.map(i => ({
            id: { videoId: i.id },
            snippet: {
              title: i.title,
              channelTitle: 'ch',
              thumbnails: { default: { url: `thumb-${i.id}` } },
            },
          })),
        }),
      };
    }
    // videos.list
    return {
      ok: true,
      json: async () => ({
        items: items.map(i => ({
          id: i.id,
          contentDetails: { duration: 'PT3M20S' },
        })),
      }),
    };
  });
};

describe('youtube curated pool', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    __resetCuratedYouTubePoolForTests();
    process.env.YOUTUBE_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.YOUTUBE_API_KEY;
  });

  it('returns null when YOUTUBE_API_KEY is missing and pool is empty', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const result = await getNextCuratedYouTubeVideo();
    expect(result).toBeNull();
  });

  const makeFetchStub = (
    poolSource: () => Array<{ id: string; title: string }>,
  ): typeof fetch => {
    let call = 0;
    return (async () => {
      call++;
      const items = poolSource();
      if (call % 2 === 1) {
        return {
          ok: true,
          json: async () => ({
            items: items.map(i => ({
              id: { videoId: i.id },
              snippet: {
                title: i.title,
                channelTitle: 'ch',
                thumbnails: { default: { url: `thumb-${i.id}` } },
              },
            })),
          }),
        } as unknown as Response;
      }
      return {
        ok: true,
        json: async () => ({
          items: items.map(i => ({
            id: i.id,
            contentDetails: { duration: 'PT3M20S' },
          })),
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
  };

  it('serves videos one-at-a-time round-robin, then refreshes after exhaustion', async () => {
    const pool1 = [
      { id: 'v1', title: 'vid 1' },
      { id: 'v2', title: 'vid 2' },
      { id: 'v3', title: 'vid 3' },
    ];
    const pool2 = [
      { id: 'w1', title: 'wid 1' },
      { id: 'w2', title: 'wid 2' },
    ];

    let activePool = pool1;
    global.fetch = makeFetchStub(() => activePool);

    const a = await getNextCuratedYouTubeVideo();
    const b = await getNextCuratedYouTubeVideo();
    const c = await getNextCuratedYouTubeVideo();

    expect(a?.attachment && (a.attachment as any).videoId).toBe('v1');
    expect(b?.attachment && (b.attachment as any).videoId).toBe('v2');
    expect(c?.attachment && (c.attachment as any).videoId).toBe('v3');

    // Pool exhausted — next call should trigger a refresh.
    activePool = pool2;
    const d = await getNextCuratedYouTubeVideo();
    expect(d?.attachment && (d.attachment as any).videoId).toBe('w1');
  });

  it('mints unique attachment ids even when the same video is served twice', async () => {
    const pool = [{ id: 'x1', title: 'only one' }];
    global.fetch = makeFetchStub(() => pool);

    const first = await getNextCuratedYouTubeVideo();
    // Pool has only one item — cursor advances, so next call triggers a
    // refresh that returns the same list. Different uuid though.
    const second = await getNextCuratedYouTubeVideo();

    expect(first?.attachment?.id).toBeDefined();
    expect(second?.attachment?.id).toBeDefined();
    expect(first?.attachment?.id).not.toEqual(second?.attachment?.id);
  });
});
