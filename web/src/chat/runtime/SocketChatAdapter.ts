import type {
  ChatModelAdapter,
  ChatModelRunOptions,
  ChatModelRunResult,
} from '@assistant-ui/react';
import type { SocketClient } from './socketClient';
import type { HandoffEvent, MediaAttachment } from './types';

export interface SocketChatAdapterOptions {
  conversationId: string;
  client: SocketClient;
  /** Called when the server echoes a proactive or user-authored message. */
  onServerMessage?: (msg: {
    id: string;
    role: 'user' | 'assistant';
    content: string;
  }) => void;
}

type Resolve = (r: ChatModelRunResult) => void;
type Reject = (e: unknown) => void;

/**
 * Bridges the existing socket.io event stream to assistant-ui's ChatModelAdapter contract.
 *
 * Event mapping (backend → adapter yields):
 *   stream_start        → { status: 'running' }
 *   stream_chunk        → { content: [{ type: 'text', text: cumulative }], status: 'running' }
 *   stream_complete     → { status: 'complete', metadata.custom: { agentUsed, confidence, attachments, handoff } }
 *   stream_error        → { status: 'incomplete', reason: 'error', error }
 *   abortSignal         → emits cancel_stream (backend no-op today; follow-up)
 *   handoff_event       → stored; merged into final metadata
 *   attachment          → accumulated; merged into final metadata
 */
export class SocketChatAdapter implements ChatModelAdapter {
  constructor(private readonly opts: SocketChatAdapterOptions) {}

  async run({
    messages,
    abortSignal,
  }: ChatModelRunOptions): Promise<ChatModelRunResult> {
    const { client, conversationId } = this.opts;
    const last = messages[messages.length - 1];
    const userText = this.extractText(last);

    const attachments: MediaAttachment[] = [];
    let handoff: HandoffEvent | null = null;
    let currentText = '';
    let settled = false;

    return new Promise<ChatModelRunResult>((resolve, reject) => {
      const unsubs: Array<() => void> = [];
      const cleanup = () => {
        while (unsubs.length) unsubs.pop()?.();
      };

      const finalize = (r: ChatModelRunResult, ok: boolean, err?: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (ok) (resolve as Resolve)(r);
        else (reject as Reject)(err ?? new Error('unknown error'));
      };

      unsubs.push(
        client.on('stream_start', e => {
          if (e.conversationId !== conversationId) return;
          currentText = '';
        }),
      );

      unsubs.push(
        client.on('stream_chunk', e => {
          if (e.conversationId !== conversationId) return;
          currentText = e.content;
        }),
      );

      unsubs.push(
        client.on('attachment', e => {
          if (e.conversationId !== conversationId) return;
          attachments.push(e.attachment);
        }),
      );

      unsubs.push(
        client.on('handoff_event', e => {
          if (e.conversationId !== conversationId) return;
          handoff = e;
        }),
      );

      unsubs.push(
        client.on('stream_complete', e => {
          if (e.conversationId !== conversationId) return;
          finalize(
            {
              content: [{ type: 'text', text: currentText }],
              status: { type: 'complete', reason: 'stop' },
              metadata: {
                custom: {
                  agentUsed: e.agentUsed,
                  confidence: e.confidence,
                  attachments: e.attachments ?? attachments,
                  handoff,
                },
              },
            },
            true,
          );
        }),
      );

      unsubs.push(
        client.on('stream_error', e => {
          if (e.conversationId && e.conversationId !== conversationId) return;
          finalize(
            {
              content: [{ type: 'text', text: currentText }],
              status: {
                type: 'incomplete',
                reason: 'error',
                error: { message: e.message, code: e.code ?? 'unknown' },
              },
            },
            true,
          );
        }),
      );

      const onAbort = () => {
        try {
          client.emit('cancel_stream', { conversationId, messageId: '' });
        } catch {
          // backend may not support cancel yet; no-op
        }
        finalize(
          {
            content: [{ type: 'text', text: currentText }],
            status: { type: 'incomplete', reason: 'cancelled' },
          },
          true,
        );
      };
      if (abortSignal.aborted) onAbort();
      else abortSignal.addEventListener('abort', onAbort, { once: true });

      try {
        client.emit(
          'stream_chat',
          { message: userText, conversationId },
          ack => {
            if (ack && ack.accepted === false) {
              finalize(
                {
                  content: [{ type: 'text', text: '' }],
                  status: {
                    type: 'incomplete',
                    reason: 'error',
                    error: {
                      message: ack.error ?? 'rejected',
                      code: 'REJECTED',
                    },
                  },
                },
                true,
              );
            }
          },
        );
      } catch (err) {
        finalize({} as ChatModelRunResult, false, err);
      }
    });
  }

  private extractText(
    msg: ChatModelRunOptions['messages'][number] | undefined,
  ): string {
    if (!msg) return '';
    const parts =
      (msg as unknown as { content?: Array<{ type: string; text?: string }> })
        .content ?? [];
    return parts
      .filter(p => p.type === 'text')
      .map(p => p.text ?? '')
      .join('');
  }
}
