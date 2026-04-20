import {
  LLMProvider,
  LLMStreamOptions,
  LLMStreamEvent,
  LLMTool,
} from './provider';

interface AnthropicToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: AnthropicToolInputSchema;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  partial_json?: string;
  input?: unknown;
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string; partial_json?: string };
  content_block?: AnthropicContentBlock;
  index?: number;
  message?: {
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
    };
  };
}

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  private apiKey: string;
  private baseURL?: string;

  constructor(apiKey: string, baseURL?: string) {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  private toAnthropicTools(tools: LLMTool[]): AnthropicTool[] {
    return tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: { type: 'object' as const, ...t.input_schema },
    }));
  }

  async *stream(opts: LLMStreamOptions): AsyncIterable<LLMStreamEvent> {
    // Lazy import to avoid crash when ANTHROPIC_API_KEY is absent at module load
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    // baseURL override allows pointing at Azure AI Foundry's Anthropic-compatible endpoint
    // (e.g. https://{account}.services.ai.azure.com — Foundry exposes Claude via /v1/messages)
    const client = new Anthropic(
      this.baseURL
        ? { apiKey: this.apiKey, baseURL: this.baseURL }
        : { apiKey: this.apiKey },
    );

    const systemContent = opts.cacheSystem
      ? [
          {
            type: 'text' as const,
            text: opts.system,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : opts.system;

    const messages = opts.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const stream = await client.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature,
      system: systemContent as string,
      messages,
      ...(opts.tools &&
        opts.tools.length > 0 && {
          // Cast needed because Anthropic SDK InputSchema requires 'type' but
          // we add it dynamically in toAnthropicTools.
          tools: this.toAnthropicTools(opts.tools) as any,
        }),
      stream: true,
    });

    // Accumulate tool input JSON per block index
    const toolAccumulators: Map<
      number,
      { id: string; name: string; json: string }
    > = new Map();
    const usage = { input: 0, output: 0, cacheRead: 0 };

    for await (const evt of stream as AsyncIterable<AnthropicStreamEvent>) {
      if (evt.type === 'content_block_start' && evt.content_block) {
        if (evt.content_block.type === 'tool_use') {
          toolAccumulators.set(evt.index ?? 0, {
            id: evt.content_block.id ?? '',
            name: evt.content_block.name ?? '',
            json: '',
          });
        }
      } else if (evt.type === 'content_block_delta' && evt.delta) {
        if (evt.delta.type === 'text_delta' && evt.delta.text) {
          yield { type: 'text_delta', text: evt.delta.text };
        } else if (
          evt.delta.type === 'input_json_delta' &&
          evt.delta.partial_json
        ) {
          const acc = toolAccumulators.get(evt.index ?? 0);
          if (acc) {
            acc.json += evt.delta.partial_json;
          }
        }
      } else if (evt.type === 'content_block_stop') {
        const acc = toolAccumulators.get(evt.index ?? 0);
        if (acc) {
          let input: unknown = {};
          try {
            input = JSON.parse(acc.json);
          } catch {
            /* malformed */
          }
          yield { type: 'tool_call', id: acc.id, name: acc.name, input };
          toolAccumulators.delete(evt.index ?? 0);
        }
      } else if (evt.type === 'message_delta' && (evt as any).usage) {
        const u = (evt as any).usage;
        usage.output += u.output_tokens ?? 0;
      } else if (evt.type === 'message_start' && evt.message?.usage) {
        usage.input = evt.message.usage.input_tokens;
        usage.cacheRead = evt.message.usage.cache_read_input_tokens ?? 0;
      }
    }

    yield { type: 'done', usage };
  }
}
