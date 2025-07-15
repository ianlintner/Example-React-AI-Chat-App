import OpenAI from 'openai';
import { MessageClassification, AgentType } from './types';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

const CLASSIFICATION_PROMPT = `You are a message classifier that determines which type of AI agent should handle a user's message.

You must classify messages into one of four categories:
1. "technical" - for programming, coding, software development, debugging, technical documentation, system administration, databases, APIs, frameworks, libraries, algorithms, data structures, etc.
2. "dad_joke" - for dad jokes, puns, groan-worthy humor, family-friendly jokes, or explicit requests for dad jokes
3. "trivia" - for trivia questions, random facts, interesting knowledge, "did you know" requests, historical facts, science facts, fun facts, etc.
4. "general" - for casual conversation, general questions, creative writing, advice, entertainment, non-technical topics, etc.

Respond with a JSON object containing:
- agentType: "technical", "dad_joke", "trivia", or "general"
- confidence: a number between 0 and 1 indicating how confident you are
- reasoning: a brief explanation of your classification

Examples:
- "How do I fix this React component?" → technical
- "Tell me a dad joke" → dad_joke
- "Tell me a random fact" → trivia
- "What's the weather like today?" → general
- "Can you help me debug this Python code?" → technical
- "I need a good pun" → dad_joke
- "Did you know that..." → trivia
- "What should I have for lunch?" → general
- "Make me laugh with a cheesy joke" → dad_joke
- "What's the best way to handle state in React?" → technical
- "Share some interesting trivia" → trivia
- "Fun facts about space" → trivia

Message to classify: "{message}"`;

export async function classifyMessage(message: string): Promise<MessageClassification> {
  // Fallback classification using simple keyword matching
  const fallbackClassification = (): MessageClassification => {
    const technicalKeywords = [
      'code', 'programming', 'debug', 'error', 'bug', 'api', 'database', 'sql',
      'javascript', 'python', 'react', 'node', 'css', 'html', 'function',
      'variable', 'array', 'object', 'class', 'method', 'framework', 'library',
      'algorithm', 'data structure', 'server', 'client', 'frontend', 'backend',
      'deployment', 'git', 'github', 'repository', 'commit', 'merge', 'branch',
      'typescript', 'npm', 'yarn', 'package', 'dependency', 'import', 'export',
      'component', 'props', 'state', 'hook', 'redux', 'axios', 'fetch', 'async',
      'await', 'promise', 'callback', 'event', 'listener', 'dom', 'element',
      'selector', 'query', 'database', 'schema', 'table', 'index', 'join',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'cloud', 'microservice',
      'rest', 'graphql', 'websocket', 'http', 'https', 'ssl', 'tls', 'cors',
      'authentication', 'authorization', 'jwt', 'oauth', 'session', 'cookie',
      'webpack', 'babel', 'eslint', 'prettier', 'jest', 'testing', 'unit test',
      'integration test', 'ci/cd', 'devops', 'linux', 'unix', 'bash', 'shell',
      'terminal', 'command line', 'regex', 'json', 'xml', 'yaml', 'markdown'
    ];

    const dadJokeKeywords = [
      'dad joke', 'dad jokes', 'pun', 'puns', 'joke', 'jokes', 'funny',
      'humor', 'cheesy', 'groan', 'laugh', 'make me laugh', 'tell me a joke',
      'funny joke', 'corny', 'silly', 'witty', 'punchline', 'one-liner',
      'wordplay', 'play on words', 'dad humor', 'family friendly joke'
    ];

    const triviaKeywords = [
      'trivia', 'fact', 'facts', 'fun fact', 'fun facts', 'random fact',
      'random facts', 'did you know', 'interesting fact', 'tell me about',
      'what is', 'history', 'science', 'nature', 'space', 'animals',
      'geography', 'culture', 'amazing', 'fascinating', 'incredible',
      'knowledge', 'learn', 'discovery', 'invention', 'record', 'world record',
      'ancient', 'historical', 'scientific', 'curiosity', 'wonder', 'mystery',
      'phenomenon', 'unusual', 'weird', 'strange', 'bizarre', 'cool fact',
      'share knowledge', 'tell me something', 'educate me', 'information'
    ];

    const gifKeywords = [
      'gif', 'gifs', 'animated', 'animation', 'funny gif', 'reaction gif',
      'meme', 'memes', 'funny image', 'visual', 'show me', 'picture',
      'image', 'cute gif', 'cat gif', 'dog gif', 'excited gif', 'happy gif',
      'sad gif', 'surprised gif', 'celebration gif', 'party gif', 'dance gif',
      'thumbs up', 'applause', 'clapping', 'facepalm', 'eye roll', 'shrug',
      'giphy', 'tenor', 'reaction', 'emotion', 'feeling', 'mood', 'vibe'
    ];

    const lowerMessage = message.toLowerCase();
    
    const technicalScore = technicalKeywords.reduce((score, keyword) => {
      return score + (lowerMessage.includes(keyword) ? 1 : 0);
    }, 0);

    const dadJokeScore = dadJokeKeywords.reduce((score, keyword) => {
      return score + (lowerMessage.includes(keyword) ? 1 : 0);
    }, 0);

    const triviaScore = triviaKeywords.reduce((score, keyword) => {
      return score + (lowerMessage.includes(keyword) ? 1 : 0);
    }, 0);

    const gifScore = gifKeywords.reduce((score, keyword) => {
      return score + (lowerMessage.includes(keyword) ? 1 : 0);
    }, 0);

    // GIF has highest priority if detected
    if (gifScore > 0) {
      return {
        agentType: 'gif',
        confidence: Math.min(0.95, 0.7 + (gifScore * 0.15)),
        reasoning: `Detected ${gifScore} GIF/visual content keywords in the message`
      };
    }

    // Dad joke has second priority if detected
    if (dadJokeScore > 0) {
      return {
        agentType: 'dad_joke',
        confidence: Math.min(0.9, 0.6 + (dadJokeScore * 0.15)),
        reasoning: `Detected ${dadJokeScore} dad joke keywords in the message`
      };
    }

    // Trivia second priority
    if (triviaScore > 0) {
      return {
        agentType: 'trivia',
        confidence: Math.min(0.85, 0.55 + (triviaScore * 0.1)),
        reasoning: `Detected ${triviaScore} trivia keywords in the message`
      };
    }

    // Technical third priority
    if (technicalScore > 0) {
      return {
        agentType: 'technical',
        confidence: Math.min(0.8, 0.5 + (technicalScore * 0.1)),
        reasoning: `Detected ${technicalScore} technical keywords in the message`
      };
    }

    // Default to general
    return {
      agentType: 'general',
      confidence: 0.5,
      reasoning: 'No specific keywords detected, classifying as general'
    };
  };

  // Try AI classification first
  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: CLASSIFICATION_PROMPT.replace('{message}', message)
          }
        ],
        max_tokens: 200,
        temperature: 0.1,
      });

      const response = completion.choices[0]?.message?.content;
      if (response) {
        try {
          const classification = JSON.parse(response);
          return {
            agentType: classification.agentType,
            confidence: classification.confidence,
            reasoning: classification.reasoning
          };
        } catch (parseError) {
          console.warn('Failed to parse AI classification response:', parseError);
        }
      }
    } catch (error) {
      console.warn('AI classification failed, using fallback:', error);
    }
  }

  // Use fallback classification
  return fallbackClassification();
}
