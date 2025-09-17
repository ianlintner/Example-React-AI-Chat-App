/**
 * engagementEvaluator.ts
 * Detects boredom or entertainment-related engagement signals from user input.
 */

export type EngagementSignal = 'BOREDOM' | 'ENTERTAINMENT_REQUEST' | null;

const boredomPatterns: RegExp[] = [
  /\b(bored|boring|nothing to do|tired of this)\b/i,
  /\b(not fun|dull|uninteresting)\b/i,
];

const entertainmentPatterns: RegExp[] = [
  /\b(play|game|fun|joke|story|fact|trivia|entertain|entertainment)\b/i,
  /\b(video|youtube|watch something|show me|tell me|make me laugh)\b/i,
];

/**
 * Evaluates a user message for engagement signals.
 * @param message - The user input string
 * @returns EngagementSignal or null if none detected
 */
export function evaluateEngagement(message: string): EngagementSignal {
  for (const pattern of boredomPatterns) {
    if (pattern.test(message)) {
      return 'BOREDOM';
    }
  }

  for (const pattern of entertainmentPatterns) {
    if (pattern.test(message)) {
      return 'ENTERTAINMENT_REQUEST';
    }
  }

  return null;
}
