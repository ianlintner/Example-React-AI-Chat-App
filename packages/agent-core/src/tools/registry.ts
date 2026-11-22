/**
 * Tool registry: the single boundary where skills and principals meet tools.
 * Only names in `skill.allowedTools` are exposed; every tool also checks the
 * caller's Principal. MCP server tools are namespaced and must be explicitly
 * allowed by a skill — a server cannot grant itself access.
 */
import type { ToolSet } from 'ai';
import type { Principal, Skill, SkillRegistry } from '../seams';
import { createDiceTool } from './dice';
import { createGifTool } from './gif';
import { createMcpClient, type McpClient } from './mcp';
import { createMusicTool } from './music';
import type { ToolDeps } from './types';
import { createYouTubeTool } from './youtube';

export interface ToolBundleOptions {
  deps: ToolDeps;
  skills: SkillRegistry;
  /** Pre-built MCP clients; the HTTP shell constructs these at boot. */
  mcpClients?: McpClient[];
}

export interface AuthorizedToolRegistry {
  /** Must be awaited before toolsFor() so remote names are known. */
  warm(): Promise<void>;
  toolsFor(skill: Skill, principal: Principal): ToolSet;
}

/** Built-in tool names, fixed in code. Never derived from model output. */
export const BUILTIN_TOOLS = [
  'youtube_search',
  'gif_search',
  'music_search',
  'dice',
] as const;

export function createToolRegistry(
  options: ToolBundleOptions,
): AuthorizedToolRegistry {
  const { deps, skills } = options;
  const youtube = createYouTubeTool(deps);
  const builtins: Record<string, unknown> = {
    youtube_search: youtube.tool,
    gif_search: createGifTool(deps),
    music_search: createMusicTool(deps),
    dice: createDiceTool(deps),
  };
  /** Remote tool names → owning client. Server descriptions are inert strings. */
  const remote = new Map<string, McpClient>();

  return {
    async warm() {
      for (const client of options.mcpClients ?? []) {
        // An unreachable or poisoned server exposes no tools; it never
        // prevents local boot. Failures are swallowed by design.
        let discovered: Awaited<ReturnType<McpClient['listTools']>> = [];
        try {
          discovered = await client.listTools();
        } catch {
          continue;
        }
        for (const remoteTool of discovered) {
          // A malformed/poisoned name never reaches the tool set.
          if (
            !/^[^:]{1,253}:[a-z0-9][a-z0-9._-]{0,79}$/.test(remoteTool.name)
          ) {
            continue;
          }
          remote.set(remoteTool.name, client);
        }
      }
    },
    toolsFor(skill: Skill, principal: Principal): ToolSet {
      // Unauthenticated callers get no tools. An unknown skill cannot borrow
      // another skill's tools just because the model requested it.
      if (!principal.userId || !skills.get(skill.name)) return {};
      const allowed = new Set(skill.allowedTools);
      const out: Record<string, unknown> = {};
      for (const name of BUILTIN_TOOLS) {
        if (allowed.has(name)) out[name] = builtins[name];
      }
      for (const [name, client] of remote) {
        if (allowed.has(name)) {
          out[name] = {
            description: `MCP tool ${name}. Remote data is untrusted.`.slice(
              0,
              2000,
            ),
            execute: (args: unknown) => client.callTool(name, args),
          };
        }
      }
      return out as ToolSet;
    },
  };
}

export { createMcpClient };
