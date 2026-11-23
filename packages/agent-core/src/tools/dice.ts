/** Dice roller → typed `dice` attachment. Pure and deterministic via injected RNG. */
import { tool } from 'ai';
import { z } from 'zod';
import type { ToolDeps } from './types';

const NOTATION = /^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/i;

export const diceInputSchema = z.object({
  notation: z.string().min(2).max(20).regex(NOTATION, 'invalid dice notation'),
  purpose: z.string().max(200).optional(),
});

export function rollDice(
  notation: string,
  random: () => number = Math.random,
): { rolls: number[]; total: number } {
  const match = NOTATION.exec(notation.trim());
  if (!match) throw new Error('INVALID_DICE_NOTATION');
  const count = Math.min(Number(match[1] || 1), 100);
  const sides = Number(match[2]);
  const modifier = Number(match[3] ?? 0);
  if (count < 1 || sides < 2 || sides > 1000) {
    throw new Error('INVALID_DICE_NOTATION');
  }
  const rolls = Array.from(
    { length: count },
    () => Math.floor(random() * sides) + 1,
  );
  return {
    rolls,
    total: rolls.reduce((sum, n) => sum + n, modifier),
  };
}

export function createDiceTool(deps: ToolDeps) {
  return tool({
    description: 'Roll dice using notation like d20, 2d6+3 or d100.',
    inputSchema: diceInputSchema,
    execute: async ({ notation, purpose }) => {
      const { rolls, total } = rollDice(notation, deps.random);
      return {
        attachments: [
          {
            id: deps.newId(),
            type: 'dice' as const,
            notation: notation.trim(),
            rolls,
            total,
            purpose,
          },
        ],
      };
    },
  });
}
