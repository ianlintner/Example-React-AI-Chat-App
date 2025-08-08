import OpenAI from 'openai';
import { MessageClassification, AgentType } from './types';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const CLASSIFICATION_PROMPT = `You are a message classifier that determines which type of AI agent should handle a user's message.

You must classify messages into one of these categories:
1. "website_support" - for programming, coding, software development, debugging, technical documentation, website functionality issues, browser problems, page loading issues, performance problems, technical web support
2. "joke" - for jokes, puns, humor, funny content, comedy requests, or any request for entertainment through jokes
3. "trivia" - for trivia questions, random facts, interesting knowledge, "did you know" requests, historical facts, science facts, fun facts, etc.
4. "gif" - for requests for GIFs, animated images, memes, visual entertainment, reaction images, funny pictures, visual content
5. "account_support" - for account-related issues like login problems, profile management, password resets, account security, user authentication
6. "billing_support" - for billing, payment, subscription, refund, pricing, invoice, or financial account matters
7. "operator_support" - for general customer service, complex multi-department issues, routing, or unknown problem types
8. "hold_agent" - for hold management, wait time updates, entertainment coordination during waiting periods
9. "general" - for casual conversation, general questions, creative writing, advice, entertainment, non-technical topics, etc.

Respond with a JSON object containing:
- agentType: one of the above categories
- confidence: a number between 0 and 1 indicating how confident you are
- reasoning: a brief explanation of your classification

Examples:
- "How do I fix this React component?" → website_support
- "Tell me a dad joke" → joke  
- "Tell me a random fact" → trivia
- "Show me a funny gif" → gif
- "I can't log into my account" → account_support
- "My payment failed" → billing_support
- "The website won't load" → website_support
- "I have multiple issues to resolve" → operator_support
- "How long is the wait time?" → hold_agent
- "What's the weather like today?" → general
- "Send me a reaction gif" → gif
- "I need a meme" → gif
- "Can you help me debug this Python code?" → website_support
- "I need a good pun" → joke
- "Did you know that..." → trivia
- "What should I have for lunch?" → general
- "Make me laugh with a cheesy joke" → joke
- "Show me an animated image" → gif
- "I forgot my password" → account_support
- "Cancel my subscription" → billing_support

Message to classify: "{message}"`;

export async function classifyMessage(
  message: string
): Promise<MessageClassification> {
  // Fallback classification using simple keyword matching
  const fallbackClassification = (): MessageClassification => {
    const technicalKeywords = [
      'code',
      'coding',
      'programming',
      'debug',
      'debugging',
      'syntax error',
      'runtime error',
      'compilation error',
      'bug fix',
      'fix this code',
      'help me code',
      'help me debug',
      'help me program',
      'javascript',
      'python',
      'react component',
      'react',
      'node.js',
      'nodejs',
      'css styling',
      'css',
      'html',
      'web framework',
      'framework',
      'code library',
      'programming library',
      'algorithm',
      'data structure',
      'frontend development',
      'backend development',
      'frontend',
      'backend',
      'git repository',
      'github',
      'code repository',
      'repository',
      'git commit',
      'commit',
      'typescript',
      'npm package',
      'npm install',
      'npm',
      'yarn',
      'redux',
      'axios',
      'async await',
      'promise',
      'callback function',
      'dom manipulation',
      'dom',
      'webpack',
      'babel',
      'eslint',
      'prettier',
      'jest testing',
      'unit test',
      'integration test',
      'ci/cd',
      'devops',
      'docker container',
      'kubernetes',
      'rest api',
      'api endpoint',
      'graphql',
      'websocket',
      'user authentication',
      'authentication',
      'authorization',
      'jwt token',
      'oauth',
      'regex pattern',
      'regular expression',
    ];

    const dadJokeKeywords = [
      'dad joke',
      'dad jokes',
      'pun',
      'puns',
      'joke',
      'jokes',
      'funny',
      'humor',
      'cheesy',
      'groan',
      'laugh',
      'make me laugh',
      'tell me a joke',
      'funny joke',
      'corny',
      'silly',
      'witty',
      'punchline',
      'one-liner',
      'wordplay',
      'play on words',
      'dad humor',
      'family friendly joke',
    ];

    const triviaKeywords = [
      'trivia',
      'fun fact',
      'fun facts',
      'random fact',
      'random facts',
      'did you know',
      'interesting fact',
      'fascinating fact',
      'amazing fact',
      'cool fact',
      'weird fact',
      'strange fact',
      'historical fact',
      'scientific fact',
      'world record',
      'share trivia',
      'tell me trivia',
      'give me a fact',
      'share a fact',
      'educate me with facts',
      'tell me something I don\'t know',
      'fascinating knowledge',
      'share fascinating knowledge',
      'share interesting history',
    ];

    const gifKeywords = [
      'gif',
      'gifs',
      'animated',
      'animation',
      'funny gif',
      'reaction gif',
      'meme',
      'memes',
      'funny image',
      'visual',
      'show me',
      'picture',
      'image',
      'cute gif',
      'cat gif',
      'dog gif',
      'excited gif',
      'happy gif',
      'sad gif',
      'surprised gif',
      'celebration gif',
      'party gif',
      'dance gif',
      'thumbs up',
      'applause',
      'clapping',
      'facepalm',
      'eye roll',
      'shrug',
      'giphy',
      'tenor',
      'reaction',
      'emotion',
      'feeling',
      'mood',
      'vibe',
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
        confidence: Math.min(0.95, 0.7 + gifScore * 0.15),
        reasoning: `Detected ${gifScore} GIF/visual content keywords in the message`,
      };
    }

    // Joke has second priority if detected
    if (dadJokeScore > 0) {
      return {
        agentType: 'joke',
        confidence: Math.min(0.9, 0.6 + dadJokeScore * 0.15),
        reasoning: `Detected ${dadJokeScore} joke keywords in the message`,
      };
    }

    // Technical has higher priority than trivia - route to website support
    if (technicalScore > 0) {
      return {
        agentType: 'website_support',
        confidence: Math.min(0.8, 0.5 + technicalScore * 0.1),
        reasoning: `Detected ${technicalScore} technical keywords in the message`,
      };
    }

    // Trivia has lower priority to avoid false positives
    if (triviaScore > 0) {
      return {
        agentType: 'trivia',
        confidence: Math.min(0.85, 0.55 + triviaScore * 0.1),
        reasoning: `Detected ${triviaScore} trivia keywords in the message`,
      };
    }

    // Default to general
    return {
      agentType: 'general',
      confidence: 0.5,
      reasoning: 'No specific keywords detected, classifying as general',
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
            content: CLASSIFICATION_PROMPT.replace('{message}', message),
          },
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
            reasoning: classification.reasoning,
          };
        } catch (parseError) {
          console.warn(
            'Failed to parse AI classification response:',
            parseError
          );
        }
      }
    } catch (error) {
      console.warn('AI classification failed, using fallback:', error);
    }
  }

  // Use fallback classification
  return fallbackClassification();
}
