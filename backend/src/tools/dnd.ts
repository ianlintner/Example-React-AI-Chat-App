import { ToolDefinition, ToolResult } from './index';
import { dndService } from '../agents/dndService';
import { v4 as uuidv4 } from 'uuid';

export const rollDiceTool: ToolDefinition = {
  name: 'roll_dice',
  description: 'Roll one or more dice and show the result as a dice card.',
  input_schema: {
    type: 'object',
    properties: {
      notation: {
        type: 'string',
        description: 'Dice notation e.g. "d20", "2d6+3", "d100"',
      },
      purpose: {
        type: 'string',
        description: 'What the roll is for, e.g. "Attack roll"',
      },
    },
    required: ['notation'],
  },
  async execute(input: unknown): Promise<ToolResult> {
    const { notation, purpose } = input as {
      notation: string;
      purpose?: string;
    };
    const result = dndService.rollDice(notation, purpose ?? '');
    return {
      attachment: {
        id: uuidv4(),
        type: 'dice',
        notation,
        rolls: result.rolls,
        total: result.total,
        purpose: purpose ?? result.description,
      },
    };
  },
};

export const generateCharacterTool: ToolDefinition = {
  name: 'generate_character',
  description:
    'Generate a random D&D character with stats, class, race, and equipment.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  async execute(_input: unknown): Promise<ToolResult> {
    const char = dndService.generateCharacter();
    return {
      attachment: {
        id: uuidv4(),
        type: 'card',
        kind: 'character',
        title: `${char.name} the ${char.race} ${char.class}`,
        fields: [
          { label: 'Level', value: String(char.level) },
          { label: 'HP', value: String(char.hitPoints) },
          { label: 'AC', value: String(char.armorClass) },
          {
            label: 'STR/DEX/CON',
            value: `${char.stats.STR}/${char.stats.DEX}/${char.stats.CON}`,
          },
          {
            label: 'INT/WIS/CHA',
            value: `${char.stats.INT}/${char.stats.WIS}/${char.stats.CHA}`,
          },
          { label: 'Equipment', value: char.equipment.slice(0, 3).join(', ') },
          { label: 'Trait', value: char.trait },
        ],
        accentColor: '#7c3aed',
      },
    };
  },
};

export const generateEncounterTool: ToolDefinition = {
  name: 'generate_encounter',
  description:
    'Generate a random D&D encounter (combat or roleplay) with setting and options.',
  input_schema: {
    type: 'object',
    properties: {},
  },
  async execute(_input: unknown): Promise<ToolResult> {
    const enc = dndService.generateEncounter();
    return {
      attachment: {
        id: uuidv4(),
        type: 'card',
        kind: 'encounter',
        title: enc.title,
        fields: [
          { label: 'Type', value: enc.type },
          { label: 'Setting', value: enc.setting },
          { label: 'Description', value: enc.description },
          ...(enc.difficulty
            ? [{ label: 'Difficulty', value: enc.difficulty }]
            : []),
          { label: 'Options', value: enc.options.join(' | ') },
        ],
        accentColor: '#b91c1c',
      },
    };
  },
};
