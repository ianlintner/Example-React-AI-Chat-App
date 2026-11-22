/**
 * Skill loader: progressive disclosure over SKILL.md files.
 * Frontmatter is read at startup (name/description/tier/tools); the body is
 * loaded only when a selected skill's instructions() is awaited.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { Skill, SkillRegistry } from '../seams';

const frontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'invalid skill name'),
  description: z.string().min(1).max(500),
  defaultTier: z.enum(['fast', 'deep', 'research']).default('fast'),
  allowedTools: z
    .array(
      z
        .string()
        .min(1)
        .max(120)
        .regex(/^[a-z0-9][a-z0-9._:-]*$/, 'invalid tool name'),
    )
    .default([]),
});

export interface ParsedSkill {
  meta: z.infer<typeof frontmatterSchema>;
  body: string;
}

/** Parse a SKILL.md. Throws with the file path on malformed frontmatter. */
export async function parseSkillFile(file: string): Promise<ParsedSkill> {
  const text = await readFile(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match)
    throw new Error(`Invalid SKILL.md frontmatter: ${path.basename(file)}`);
  const meta = parseFrontmatter(match[1]!);
  return { meta, body: match[2]!.trim() };
}

/** Tiny YAML subset (scalar + inline list) — no YAML dependency needed. */
export function parseFrontmatter(
  raw: string,
): z.infer<typeof frontmatterSchema> {
  const values: Record<string, string | string[]> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      values[key] = value
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else {
      values[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  return frontmatterSchema.parse(values);
}

/** Load all SKILL.md files from a directory (one subdir per skill). */
export async function loadSkills(dir: string): Promise<SkillRegistry> {
  const entries = await readdir(dir, { withFileTypes: true });
  const skills = new Map<string, Skill>();
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(dir, entry.name, 'SKILL.md');
    let parsed: ParsedSkill;
    try {
      parsed = await parseSkillFile(file);
    } catch {
      continue; // a broken skill never breaks boot
    }
    if (parsed.meta.name !== entry.name) continue; // directory/name must match
    skills.set(parsed.meta.name, {
      name: parsed.meta.name,
      description: parsed.meta.description,
      defaultTier: parsed.meta.defaultTier,
      allowedTools: parsed.meta.allowedTools,
      // Progressive disclosure: body is read only when the skill is selected.
      instructions: () => readFile(file, 'utf8').then(t => t.trim()),
    });
  }
  return {
    list: () => [...skills.values()],
    get: name => skills.get(name),
  };
}

/** Empty registry for tests and for a server with no skills directory. */
export function emptySkillRegistry(): SkillRegistry {
  const skills = new Map<string, Skill>();
  return { list: () => [...skills.values()], get: name => skills.get(name) };
}
