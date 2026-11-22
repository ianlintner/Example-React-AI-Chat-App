/**
 * Minimal stateless MCP client (2026-07-28 revision) for the local dev stack.
 *
 * Security: a server's tool list cannot grant new capabilities. Every remote
 * tool is a plain data tool registered under a namespaced name and is gated
 * by the caller's Skill.allowedTools. No server text is treated as instruction.
 */
import { z } from 'zod';

const toolName = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'invalid MCP tool name');

const toolDescriptionSchema = z.object({
  name: toolName,
  description: z.string().max(2000).default(''),
  inputSchema: z.record(z.string(), z.unknown()).default({}),
});

export interface RemoteTool {
  server: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpAppResource {
  uri: string;
  mimeType: string;
  text: string;
}

export interface McpClientOptions {
  fetch: typeof globalThis.fetch;
  /** Full base URL of one MCP server. */
  url: string;
  /** Optional bearer token; never logged. */
  apiKey?: string;
  timeoutMs?: number;
}

/** JSON-RPC 2.0 over streamable HTTP; response may be JSON or SSE. */
export function createMcpClient(options: McpClientOptions) {
  const { fetch: doFetch, url, apiKey, timeoutMs = 10_000 } = options;
  let nextId = 1;

  async function rpc(method: string, params: unknown = {}): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          'mcp-protocol-version': '2026-07-28',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: nextId++,
          method,
          params,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`MCP_HTTP_${res.status}`);
      const contentType = res.headers.get('content-type') ?? '';
      const body = contentType.includes('text/event-stream')
        ? await readSse(res)
        : await res.text();
      const parsed = JSON.parse(body) as {
        result?: unknown;
        error?: { message?: string };
      };
      if (parsed.error) throw new Error('MCP_RPC_ERROR');
      return parsed.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async function readSse(res: Response): Promise<string> {
    const text = await res.text();
    const lines = text
      .split('\n')
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim());
    const last = lines.at(-1);
    if (!last) throw new Error('MCP_EMPTY_SSE');
    return last;
  }

  async function listTools(): Promise<RemoteTool[]> {
    const result = (await rpc('tools/list')) as { tools?: unknown };
    if (!Array.isArray(result?.tools)) return [];
    const server = new URL(url).hostname;
    // Validate each entry independently: one poisoned tool cannot erase the rest.
    return result.tools.flatMap(value => {
      const parsed = toolDescriptionSchema.safeParse(value);
      if (!parsed.success) return [];
      return [
        {
          server,
          name: `${server}:${parsed.data.name}`,
          description: parsed.data.description,
          inputSchema: parsed.data.inputSchema,
        },
      ];
    });
  }

  async function callTool(name: string, args: unknown): Promise<unknown> {
    if (!/^[^:]{1,253}:[a-z0-9][a-z0-9._-]{0,79}$/.test(name)) {
      throw new Error('MCP_INVALID_TOOL_NAME');
    }
    const local = name.slice(name.indexOf(':') + 1);
    return rpc('tools/call', { name: local, arguments: args });
  }

  /** MCP Apps resources: only `ui://` URIs may be rendered in a sandbox. */
  async function readAppResource(uri: string): Promise<McpAppResource> {
    if (!/^ui:\/\/[a-z0-9][a-z0-9._/-]{0,199}$/i.test(uri)) {
      throw new Error('MCP_INVALID_APP_URI');
    }
    const result = (await rpc('resources/read', { uri })) as {
      contents?: { uri: string; mimeType?: string; text?: string }[];
    };
    const content = result?.contents?.[0];
    if (!content || content.uri !== uri)
      throw new Error('MCP_RESOURCE_MISMATCH');
    return {
      uri,
      mimeType: content.mimeType ?? 'text/html',
      text: (content.text ?? '').slice(0, 200_000),
    };
  }

  return { listTools, callTool, readAppResource };
}

export type McpClient = ReturnType<typeof createMcpClient>;
