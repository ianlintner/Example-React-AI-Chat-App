import { AgentType } from './types';

export interface ContentItem {
  id: string;
  type: 'joke' | 'trivia' | 'gif';
  content: string;
  category?: string;
  tags: string[];
  rating?: number; // 1-5 quality rating
  metadata?: any;
}

export interface SearchQuery {
  text: string;
  type?: 'joke' | 'trivia' | 'gif';
  category?: string;
  tags?: string[];
  limit?: number;
}

export interface SearchResult {
  item: ContentItem;
  relevanceScore: number;
}

export class RAGService {
  private contentDatabase: ContentItem[] = [];
  private readonly maxResults = 10;

  constructor() {
    this.initializeContent();
  }

  private initializeContent(): void {
    // Initialize with curated jokes
    this.contentDatabase.push(
      // Dad Jokes
      {
        id: 'joke_001',
        type: 'joke',
        content:
          "Why don't scientists trust atoms? Because they make up everything!",
        category: 'dad_joke',
        tags: ['dad', 'science', 'atoms', 'pun', 'wordplay'],
        rating: 4,
      },
      {
        id: 'joke_002',
        type: 'joke',
        content: 'What do you call a fake noodle? An impasta!',
        category: 'dad_joke',
        tags: ['dad', 'food', 'pasta', 'pun', 'wordplay'],
        rating: 4,
      },
      {
        id: 'joke_003',
        type: 'joke',
        content:
          'Why did the scarecrow win an award? Because he was outstanding in his field!',
        category: 'dad_joke',
        tags: ['dad', 'farm', 'award', 'pun', 'wordplay'],
        rating: 4,
      },
      {
        id: 'joke_004',
        type: 'joke',
        content: 'What do you call a bear with no teeth? A gummy bear!',
        category: 'dad_joke',
        tags: ['dad', 'animals', 'bear', 'teeth', 'pun'],
        rating: 4,
      },
      {
        id: 'joke_005',
        type: 'joke',
        content:
          "Why don't skeletons fight each other? They don't have the guts!",
        category: 'dad_joke',
        tags: ['dad', 'skeleton', 'fight', 'guts', 'pun'],
        rating: 4,
      },
      {
        id: 'joke_006',
        type: 'joke',
        content:
          'I told my wife she was drawing her eyebrows too high. She looked surprised!',
        category: 'dad_joke',
        tags: ['dad', 'wife', 'eyebrows', 'surprised', 'visual'],
        rating: 4,
      },
      {
        id: 'joke_007',
        type: 'joke',
        content:
          'Why do programmers prefer dark mode? Because light attracts bugs!',
        category: 'tech_joke',
        tags: ['programming', 'tech', 'dark mode', 'bugs', 'pun'],
        rating: 5,
      },
      {
        id: 'joke_008',
        type: 'joke',
        content:
          "A man walks into a library and asks for books on paranoia. The librarian whispers, 'They're right behind you!'",
        category: 'story_joke',
        tags: ['library', 'paranoia', 'books', 'whisper', 'story'],
        rating: 4,
      },
      {
        id: 'joke_009',
        type: 'joke',
        content:
          "What's the best thing about Switzerland? I don't know, but the flag is a big plus!",
        category: 'dad_joke',
        tags: ['dad', 'switzerland', 'flag', 'plus', 'pun'],
        rating: 4,
      },
      {
        id: 'joke_010',
        type: 'joke',
        content: "Why don't eggs tell jokes? They'd crack each other up!",
        category: 'dad_joke',
        tags: ['dad', 'eggs', 'crack', 'jokes', 'pun'],
        rating: 4,
      },

      // Trivia Facts
      {
        id: 'trivia_001',
        type: 'trivia',
        content:
          'Did you know that octopuses have three hearts and blue blood? Two hearts pump blood to the gills, while the third pumps blood to the rest of the body!',
        category: 'animals',
        tags: ['octopus', 'hearts', 'blood', 'marine', 'biology'],
        rating: 5,
      },
      {
        id: 'trivia_002',
        type: 'trivia',
        content:
          "Here's a mind-blowing fact: Honey never spoils! Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!",
        category: 'food',
        tags: ['honey', 'ancient', 'egypt', 'preservation', 'archaeology'],
        rating: 5,
      },
      {
        id: 'trivia_003',
        type: 'trivia',
        content:
          "Amazing fact: A single cloud can weigh over a million pounds! That's equivalent to about 100 elephants floating in the sky!",
        category: 'weather',
        tags: ['clouds', 'weight', 'elephants', 'weather', 'physics'],
        rating: 5,
      },
      {
        id: 'trivia_004',
        type: 'trivia',
        content:
          "Fascinating: Bananas are berries, but strawberries aren't! Botanically speaking, a berry must have seeds inside its flesh.",
        category: 'botany',
        tags: [
          'bananas',
          'berries',
          'strawberries',
          'botany',
          'classification',
        ],
        rating: 4,
      },
      {
        id: 'trivia_005',
        type: 'trivia',
        content:
          "Cool fact: The human brain uses about 20% of the body's total energy, despite being only 2% of body weight!",
        category: 'human_body',
        tags: ['brain', 'energy', 'body', 'metabolism', 'biology'],
        rating: 5,
      },
      {
        id: 'trivia_006',
        type: 'trivia',
        content:
          'Incredible: There are more possible games of chess than there are atoms in the observable universe! The number of possible chess games is estimated to be around 10^120.',
        category: 'mathematics',
        tags: ['chess', 'mathematics', 'universe', 'atoms', 'combinations'],
        rating: 5,
      },
      {
        id: 'trivia_007',
        type: 'trivia',
        content:
          'Did you know that dolphins have names for each other? They use unique whistle signatures to identify and call to specific individuals in their pod!',
        category: 'animals',
        tags: ['dolphins', 'communication', 'names', 'whistles', 'marine'],
        rating: 5,
      },
      {
        id: 'trivia_008',
        type: 'trivia',
        content:
          'Amazing space fact: A day on Venus is longer than its year! Venus takes 243 Earth days to rotate once but only 225 Earth days to orbit the Sun.',
        category: 'space',
        tags: ['venus', 'space', 'rotation', 'orbit', 'planets'],
        rating: 5,
      },
      {
        id: 'trivia_009',
        type: 'trivia',
        content:
          "Fascinating history: The Great Wall of China isn't visible from space with the naked eye, despite the popular myth. This misconception has been debunked by astronauts!",
        category: 'history',
        tags: ['great wall', 'china', 'space', 'myth', 'astronomy'],
        rating: 4,
      },
      {
        id: 'trivia_010',
        type: 'trivia',
        content:
          "Cool biology fact: Sharks have been around for more than 400 million years, making them older than trees! They've survived four of the 'big five' mass extinctions.",
        category: 'animals',
        tags: ['sharks', 'evolution', 'trees', 'extinction', 'prehistoric'],
        rating: 5,
      },

      // GIF URLs (from popular services)
      {
        id: 'gif_001',
        type: 'gif',
        content: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif',
        category: 'funny',
        tags: ['funny', 'laugh', 'comedy', 'silly', 'animated'],
        rating: 4,
        metadata: {
          description: 'Funny laughing reaction',
          alt: 'Person laughing hysterically',
        },
      },
      {
        id: 'gif_002',
        type: 'gif',
        content: 'https://media.giphy.com/media/3o6fJ5LANL0x31R1Ic/giphy.gif',
        category: 'excited',
        tags: ['excited', 'happy', 'celebration', 'joy', 'dance'],
        rating: 4,
        metadata: {
          description: 'Excited celebration dance',
          alt: 'Person dancing with excitement',
        },
      },
      {
        id: 'gif_003',
        type: 'gif',
        content: 'https://media.giphy.com/media/3o7abA4a0QCXtSxGN2/giphy.gif',
        category: 'cute',
        tags: ['cute', 'adorable', 'aww', 'sweet', 'animals'],
        rating: 5,
        metadata: {
          description: 'Cute animal being adorable',
          alt: 'Cute animal gif',
        },
      },
      {
        id: 'gif_004',
        type: 'gif',
        content: 'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
        category: 'applause',
        tags: [
          'applause',
          'clapping',
          'approval',
          'well done',
          'congratulations',
        ],
        rating: 4,
        metadata: {
          description: 'Applause and clapping',
          alt: 'Person clapping enthusiastically',
        },
      },
      {
        id: 'gif_005',
        type: 'gif',
        content: 'https://media.giphy.com/media/3o7absbD7PbTFQa0c8/giphy.gif',
        category: 'thumbs_up',
        tags: ['thumbs up', 'approval', 'good job', 'positive', 'agreement'],
        rating: 4,
        metadata: {
          description: 'Thumbs up approval',
          alt: 'Person giving thumbs up',
        },
      },
      {
        id: 'gif_006',
        type: 'gif',
        content: 'https://media.giphy.com/media/l0HU7yHIK6Nc3WcE0/giphy.gif',
        category: 'surprised',
        tags: ['surprised', 'shocked', 'wow', 'amazed', 'reaction'],
        rating: 4,
        metadata: {
          description: 'Surprised reaction',
          alt: 'Person looking surprised',
        },
      },
      {
        id: 'gif_007',
        type: 'gif',
        content: 'https://media.giphy.com/media/3o6fJgEOrF1lky8WFO/giphy.gif',
        category: 'party',
        tags: ['party', 'celebration', 'fun', 'dancing', 'festive'],
        rating: 4,
        metadata: {
          description: 'Party celebration',
          alt: 'Party celebration with dancing',
        },
      },
      {
        id: 'gif_008',
        type: 'gif',
        content: 'https://media.giphy.com/media/l0MYC0LajbaPoEADu/giphy.gif',
        category: 'facepalm',
        tags: ['facepalm', 'disappointed', 'frustrated', 'oh no', 'mistake'],
        rating: 4,
        metadata: {
          description: 'Facepalm reaction',
          alt: 'Person doing a facepalm',
        },
      },
      {
        id: 'gif_009',
        type: 'gif',
        content: 'https://media.giphy.com/media/3o85xIO33l7RlmLR4I/giphy.gif',
        category: 'shrug',
        tags: ['shrug', 'dunno', 'idk', 'confused', 'unsure'],
        rating: 4,
        metadata: {
          description: 'Shrugging gesture',
          alt: 'Person shrugging shoulders',
        },
      },
      {
        id: 'gif_010',
        type: 'gif',
        content: 'https://media.giphy.com/media/l0MYGb1LuZ3n7dRnO/giphy.gif',
        category: 'mind_blown',
        tags: ['mind blown', 'amazing', 'incredible', 'wow', 'astonished'],
        rating: 5,
        metadata: {
          description: 'Mind blown reaction',
          alt: 'Person with mind blown expression',
        },
      },
    );

    console.log(
      `📚 RAG Service initialized with ${this.contentDatabase.length} content items`,
    );
  }

  // Simple text similarity scoring (can be replaced with vector embeddings)
  private calculateRelevanceScore(query: string, item: ContentItem): number {
    const queryLower = query.toLowerCase();
    const contentLower = item.content.toLowerCase();
    let score = 0;

    // Exact phrase match
    if (contentLower.includes(queryLower)) {
      score += 0.8;
    }

    // Tag matching
    const queryWords = queryLower.split(' ').filter(word => word.length > 2);
    for (const word of queryWords) {
      // Check tags
      for (const tag of item.tags) {
        if (
          tag.toLowerCase().includes(word) ||
          word.includes(tag.toLowerCase())
        ) {
          score += 0.3;
        }
      }

      // Check category
      if (
        item.category?.toLowerCase().includes(word) ||
        word.includes(item.category?.toLowerCase() || '')
      ) {
        score += 0.2;
      }

      // Check content
      if (contentLower.includes(word)) {
        score += 0.1;
      }
    }

    // Quality boost
    if (item.rating) {
      score += (item.rating / 5) * 0.1;
    }

    return Math.min(score, 1); // Cap at 1.0
  }

  // Search for relevant content
  search(query: SearchQuery): SearchResult[] {
    let filteredItems = this.contentDatabase;

    // Filter by type
    if (query.type) {
      filteredItems = filteredItems.filter(item => item.type === query.type);
    }

    // Filter by category
    if (query.category) {
      filteredItems = filteredItems.filter(
        item => item.category === query.category,
      );
    }

    // Filter by tags
    if (query.tags && query.tags.length > 0) {
      filteredItems = filteredItems.filter(item =>
        query.tags!.some(tag => item.tags.includes(tag)),
      );
    }

    // Calculate relevance scores
    const results: SearchResult[] = filteredItems
      .map(item => ({
        item,
        relevanceScore: this.calculateRelevanceScore(query.text, item),
      }))
      .filter(result => result.relevanceScore > 0.1) // Minimum relevance threshold
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
      .slice(0, query.limit || this.maxResults);

    console.log(
      `🔍 RAG Search: "${query.text}" found ${results.length} results`,
    );
    return results;
  }

  // Get random content of a specific type
  getRandomContent(
    type: 'joke' | 'trivia' | 'gif',
    category?: string,
  ): ContentItem | null {
    let filteredItems = this.contentDatabase.filter(item => item.type === type);

    if (category) {
      filteredItems = filteredItems.filter(item => item.category === category);
    }

    if (filteredItems.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * filteredItems.length);
    return filteredItems[randomIndex];
  }

  // Get content by ID
  getContentById(id: string): ContentItem | null {
    return this.contentDatabase.find(item => item.id === id) || null;
  }

  // Add new content (for dynamic expansion)
  addContent(item: ContentItem): void {
    // Check for duplicates
    const existing = this.contentDatabase.find(
      existing => existing.content === item.content || existing.id === item.id,
    );

    if (!existing) {
      this.contentDatabase.push(item);
      console.log(`📚 Added new ${item.type} content: ${item.id}`);
    }
  }

  // Get content statistics
  getStats(): { [type: string]: number } {
    const stats: { [type: string]: number } = {};

    for (const item of this.contentDatabase) {
      stats[item.type] = (stats[item.type] || 0) + 1;
    }

    return stats;
  }

  // Get top-rated content
  getTopRated(type?: 'joke' | 'trivia' | 'gif', limit = 5): ContentItem[] {
    let items = this.contentDatabase;

    if (type) {
      items = items.filter(item => item.type === type);
    }

    return items
      .filter(item => item.rating && item.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
  }

  // Enhanced search for entertainment agents
  searchForAgent(
    agentType: AgentType,
    query: string,
    fallbackToRandom = true,
  ): ContentItem | null {
    let contentType: 'joke' | 'trivia' | 'gif';

    switch (agentType) {
      case 'joke':
        contentType = 'joke';
        break;
      case 'trivia':
        contentType = 'trivia';
        break;
      case 'gif':
        contentType = 'gif';
        break;
      default:
        return null;
    }

    // First try to search for relevant content
    const searchResults = this.search({
      text: query,
      type: contentType,
      limit: 3,
    });

    if (searchResults.length > 0) {
      return searchResults[0].item;
    }

    // Fallback to random content if no relevant results found
    if (fallbackToRandom) {
      return this.getRandomContent(contentType);
    }

    return null;
  }
}

// Singleton instance
export const ragService = new RAGService();
