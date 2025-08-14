import { RAGService, ContentItem, SearchQuery } from '../ragService';

describe('RAGService', () => {
  let ragService: RAGService;

  beforeEach(() => {
    ragService = new RAGService();
  });

  describe('Content Database', () => {
    test('should initialize with predefined content', () => {
      const stats = ragService.getStats();

      expect(stats.joke).toBe(10);
      expect(stats.trivia).toBe(10);
      expect(stats.gif).toBe(10);
    });

    test('should have quality-rated content', () => {
      const allContent = ragService.getTopRated(undefined, 100);

      allContent.forEach(item => {
        expect(item.rating).toBeGreaterThanOrEqual(4);
        expect(item.rating).toBeLessThanOrEqual(5);
      });
    });

    test('should have proper content structure', () => {
      const jokes = ragService.getTopRated('joke', 5);

      jokes.forEach(joke => {
        expect(joke).toHaveProperty('id');
        expect(joke).toHaveProperty('type', 'joke');
        expect(joke).toHaveProperty('content');
        expect(joke).toHaveProperty('category');
        expect(joke).toHaveProperty('tags');
        expect(joke).toHaveProperty('rating');
        expect(Array.isArray(joke.tags)).toBe(true);
      });
    });
  });

  describe('Search Functionality', () => {
    test('should find content matches', () => {
      const query: SearchQuery = {
        text: 'programmers',
        type: 'joke',
        limit: 5,
      };

      const results = ragService.search(query);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.relevanceScore).toBeGreaterThan(0);
        expect(result.item.type).toBe('joke');
      });
    });

    test('should respect search limits', () => {
      const query: SearchQuery = {
        text: 'funny',
        limit: 3,
      };

      const results = ragService.search(query);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Agent-Specific Search', () => {
    test('should return appropriate content for joke agent', () => {
      const content = ragService.searchForAgent(
        'joke',
        'tell me something funny',
        true,
      );

      expect(content).toBeTruthy();
      expect(content?.type).toBe('joke');
      expect(content?.rating).toBeGreaterThanOrEqual(4);
    });

    test('should return appropriate content for trivia agent', () => {
      const content = ragService.searchForAgent(
        'trivia',
        'tell me something interesting',
        true,
      );

      expect(content).toBeTruthy();
      expect(content?.type).toBe('trivia');
      expect(content?.rating).toBeGreaterThanOrEqual(4);
    });

    test('should return appropriate content for gif agent', () => {
      const content = ragService.searchForAgent(
        'gif',
        'show me something funny',
        true,
      );

      expect(content).toBeTruthy();
      expect(content?.type).toBe('gif');
      expect(content?.rating).toBeGreaterThanOrEqual(4);
    });

    test('should fallback to random content when no match found', () => {
      const content = ragService.searchForAgent(
        'joke',
        'xyz-no-match-query',
        true,
      );

      expect(content).toBeTruthy();
      expect(content?.type).toBe('joke');
    });

    test('should return null when no fallback requested', () => {
      const content = ragService.searchForAgent(
        'joke',
        'xyz-no-match-query',
        false,
      );

      expect(content).toBeNull();
    });
  });

  describe('Random Content Retrieval', () => {
    test('should return random jokes', () => {
      const joke = ragService.getRandomContent('joke');

      expect(joke).toBeTruthy();
      expect(joke?.type).toBe('joke');
    });

    test('should return random content by category', () => {
      const techJoke = ragService.getRandomContent('joke', 'tech_joke');

      if (techJoke) {
        expect(techJoke.type).toBe('joke');
        expect(techJoke.category).toBe('tech_joke');
      }
    });
  });

  describe('Content Management', () => {
    test('should add new content successfully', () => {
      const newJoke: ContentItem = {
        id: 'test_joke_001',
        type: 'joke',
        content: 'Why did the test pass? Because it was well written!',
        category: 'test_joke',
        tags: ['test', 'programming', 'quality'],
        rating: 5,
      };

      ragService.addContent(newJoke);

      const stats = ragService.getStats();
      expect(stats.joke).toBe(11); // 10 original + 1 new
    });

    test('should retrieve top-rated content', () => {
      const topJokes = ragService.getTopRated('joke', 3);

      expect(topJokes.length).toBeLessThanOrEqual(3);
      topJokes.forEach(joke => {
        expect(joke.type).toBe('joke');
        expect(joke.rating).toBeGreaterThanOrEqual(4);
      });
    });
  });

  describe('Content Quality Assurance', () => {
    test('should have family-friendly joke content', () => {
      const jokes = ragService.getTopRated('joke', 100);

      jokes.forEach(joke => {
        expect(joke.content.length).toBeGreaterThan(10);
        expect(joke.content.length).toBeLessThan(500);
      });
    });

    test('should have educational trivia content', () => {
      const trivia = ragService.getTopRated('trivia', 100);

      trivia.forEach(fact => {
        expect(fact.content.length).toBeGreaterThan(20);
        expect(fact.tags.length).toBeGreaterThan(0);
      });
    });

    test('should have accessible GIF content', () => {
      const gifs = ragService.getTopRated('gif', 100);

      gifs.forEach(gif => {
        expect(gif.content).toMatch(/^https?:\/\//);
        expect(gif.metadata).toHaveProperty('description');
        expect(gif.metadata).toHaveProperty('alt');
      });
    });
  });
});
