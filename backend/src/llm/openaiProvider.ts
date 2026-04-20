import OpenAI from 'openai';
import {
  LLMProvider,
  LLMStreamOptions,
  LLMStreamEvent,
  LLMTool,
} from './provider';

function toOpenAITools(tools: LLMTool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }));
}

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai' as const;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async *stream(opts: LLMStreamOptions): AsyncIterable<LLMStreamEvent> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: opts.system },
      ...opts.messages.map((m): OpenAI.Chat.ChatCompletionMessageParam => {
        if (m.role === 'tool') {
          return {
            role: 'tool',
            content: m.content,
            tool_call_id: m.tool_call_id ?? '',
          };
        }
        if (m.role === 'assistant') {
          return { role: 'assistant', content: m.content };
        }
        return { role: 'user', content: m.content };
      }),
    ];

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: opts.model,
      messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: true,
      ...(opts.tools &&
        opts.tools.length > 0 && {
          tools: toOpenAITools(opts.tools),
          tool_choice: 'auto' as const,
        }),
    };

    const stream = await this.client.chat.completions.create(params);

    // Accumulate tool call fragments (OpenAI streams them incrementally per index)
    const toolCallAccumulators: Map<
      number,
      { id: string; name: string; args: string }
    > = new Map();
    let finishReason: string | null = null;
    let usage = { input: 0, output: 0 };

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      finishReason = chunk.choices[0]?.finish_reason ?? finishReason;

      if (delta?.content) {
        yield { type: 'text_delta', text: delta.content };
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallAccumulators.has(idx)) {
            toolCallAccumulators.set(idx, {
              id: tc.id ?? '',
              name: tc.function?.name ?? '',
              args: '',
            });
          }
          const acc = toolCallAccumulators.get(idx)!;
          if (tc.id) {
            acc.id = tc.id;
          }
          if (tc.function?.name) {
            acc.name = tc.function.name;
          }
          if (tc.function?.arguments) {
            acc.args += tc.function.arguments;
          }
        }
      }

      if (chunk.usage) {
        usage = {
          input: chunk.usage.prompt_tokens,
          output: chunk.usage.completion_tokens,
        };
      }
    }

    // Emit completed tool calls
    if (finishReason === 'tool_calls') {
      for (const [, acc] of toolCallAccumulators) {
        let input: unknown = {};
        try {
          input = JSON.parse(acc.args);
        } catch {
          /* malformed args */
        }
        yield { type: 'tool_call', id: acc.id, name: acc.name, input };
      }
    }

    yield { type: 'done', usage };
  }
}
