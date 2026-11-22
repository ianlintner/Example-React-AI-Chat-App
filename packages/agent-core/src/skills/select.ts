/**
 * Deterministic skill selection for the mock-model trajectory test and for
 * local dev before the typed router (card 5) is live. It reads only the
 * user's latest text — tool output can never select a skill.
 */
import type { AgentUIMessage } from '@agent-chat/contract';
import type { Skill, SkillRegistry } from '../seams';

const KEYWORDS: Record<string, RegExp> = {
  youtube: /\b(youtube|video|clip|sketch|watch)\b/i,
  gif: /\b(gif|meme|reaction image)\b/i,
  music: /\b(music|song|track|playlist|recommend.*music)\b/i,
  dnd: /\b(dnd|d&d|dice|roll|rpg|attack roll)\b/i,
  joke: /\b(joke|pun|funny|one-liner)\b/i,
};

export function lastUserText(messages: AgentUIMessage[]): string {
  const last = [...messages].reverse().find(m => m.role === 'user');
  return (last?.parts ?? [])
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join(' ');
}

/** Deterministic match. Ties resolve by skill name for reproducible tests. */
export function selectSkill(
  registry: SkillRegistry,
  messages: AgentUIMessage[],
): Skill | undefined {
  const text = lastUserText(messages);
  const candidates = Object.entries(KEYWORDS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([name]) => name)
    .sort();
  for (const name of candidates) {
    const skill = registry.get(name);
    if (skill) return skill;
  }
  return undefined; // no keyword match: generic runtime instructions
}
