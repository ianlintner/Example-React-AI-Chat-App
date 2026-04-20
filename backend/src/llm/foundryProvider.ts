import { LLMProvider, LLMStreamOptions, LLMStreamEvent } from './provider';
import { OpenAIProvider } from './openaiProvider';
import { logger } from '../logger';

export class FoundryProvider implements LLMProvider {
  readonly id = 'foundry' as const;
  private delegate: OpenAIProvider | null = null;
  private initError: string | null = null;

  constructor(private readonly endpoint: string) {}

  private async initDelegate(): Promise<OpenAIProvider> {
    if (this.delegate) {
      return this.delegate;
    }
    if (this.initError) {
      throw new Error(this.initError);
    }

    try {
      // Lazy import: avoid crashing if @azure/ai-projects or @azure/identity not installed
      const { AIProjectClient } = await import('@azure/ai-projects');
      const { DefaultAzureCredential } = await import('@azure/identity');
      const projectClient = new AIProjectClient(
        this.endpoint,
        new DefaultAzureCredential(),
      );
      // @azure/ai-projects exposes OpenAI-compatible client via getChatCompletionsClient or
      // via the 'openai' sub-namespace depending on SDK version. Use getOpenAIClient if available.
      const openaiClient: any =
        typeof (projectClient as any).getOpenAIClient === 'function'
          ? (projectClient as any).getOpenAIClient()
          : (projectClient as any).openai;

      if (!openaiClient) {
        throw new Error(
          'Cannot get OpenAI client from AIProjectClient — check @azure/ai-projects version',
        );
      }

      // Wrap using a pseudo-OpenAIProvider that delegates to the Foundry openai client
      const provider = new OpenAIProvider('foundry');
      (provider as any).client = openaiClient;
      this.delegate = provider;
      return this.delegate;
    } catch (err) {
      this.initError = (err as Error).message;
      logger.warn(`[foundry] init failed: ${this.initError}`);
      throw err;
    }
  }

  async *stream(opts: LLMStreamOptions): AsyncIterable<LLMStreamEvent> {
    try {
      const delegate = await this.initDelegate();
      yield* delegate.stream(opts);
    } catch (err) {
      yield { type: 'error', error: (err as Error).message };
    }
  }
}
