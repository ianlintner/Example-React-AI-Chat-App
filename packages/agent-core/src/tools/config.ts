/**
 * Entertainment provider configuration (card 6). API keys are read by the
 * owning module at call time; this module validates that any *provided* key
 * is non-empty and keeps keys out of every log and error message.
 *
 * No default secrets: an unset key means "tool unavailable", never a
 * placeholder credential. Tests inject a fake `fetch` instead.
 */
import { z } from 'zod';

export const toolsEnvSchema = z.object({
  YOUTUBE_API_KEY: z.string().min(1).optional(),
  GIPHY_API_KEY: z.string().min(1).optional(),
  /** Local MCP server URLs; only http(s), loopback recommended. */
  MCP_SERVER_URLS: z
    .string()
    .max(2000)
    .optional()
    .transform(value =>
      (value ?? '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
    ),
  /** Shared bearer for MCP servers. Never logged or sent to other hosts. */
  MCP_API_KEY: z.string().min(1).optional(),
});

export type ToolsConfig = z.infer<typeof toolsEnvSchema>;

/** Parse tool env. Reports variable *names* only, never their values. */
export function loadToolsConfig(
  env: Record<string, string | undefined> = process.env,
): ToolsConfig {
  const parsed = toolsEnvSchema.safeParse(env);
  if (!parsed.success) {
    const names = parsed.error.issues.map(i => i.path.join('.')).join(', ');
    throw new Error(`Invalid tool configuration: ${names}`);
  }
  for (const url of parsed.data.MCP_SERVER_URLS) {
    if (!/^https?:\/\//.test(url)) {
      throw new Error('Invalid tool configuration: MCP_SERVER_URLS');
    }
  }
  return parsed.data;
}
