import { io, Socket } from 'socket.io-client';
import { widgetCss } from './styles';
import { chatIcon, closeIcon } from './icons';
import { AuthManager, AuthOptions, AuthSession } from './auth';

export type WidgetPosition =
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export interface ChatWidgetOptions {
  apiUrl: string;
  title?: string;
  subtitle?: string;
  position?: WidgetPosition;
  accentColor?: string;
  mode?: 'lean' | 'demo';
  openOnLoad?: boolean;
  placeholder?: string;
  footerHtml?: string | null;
  welcomeMessage?: string | null;
  /**
   * Optional OAuth2 + PKCE sign-in config. When set the widget renders a
   * sign-in upgrade banner alongside the (now always-visible) input row so
   * unauthenticated users can still chat anonymously and optionally sign in
   * to unlock the full hold-flow experience.
   */
  auth?: AuthOptions;
  /**
   * Label on the Sign-in button when auth config is supplied.
   * Default: `Sign in to chat`.
   */
  signInLabel?: string;
}

interface Attachment {
  type: 'youtube' | 'gif' | string;
  videoId?: string;
  url?: string;
  title?: string;
  altText?: string;
}

interface ServerMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  conversationId?: string;
  agentUsed?: string;
  confidence?: number;
  attachments?: Attachment[];
  isProactive?: boolean;
}

interface StreamChunk {
  id: string;
  content: string;
  conversationId: string;
  messageId: string;
  isComplete: boolean;
}

const POSITION_CLASS: Record<WidgetPosition, string> = {
  'bottom-right': 'pos-br',
  'bottom-left': 'pos-bl',
  'top-right': 'pos-tr',
  'top-left': 'pos-tl',
};

const DEFAULTS: Required<
  Omit<ChatWidgetOptions, 'apiUrl' | 'footerHtml' | 'welcomeMessage' | 'auth'>
> & {
  footerHtml: string | null;
  welcomeMessage: string | null;
} = {
  title: 'Cat-Herding Chat',
  subtitle: 'AI portfolio demo',
  position: 'bottom-right',
  accentColor: '#4f46e5',
  mode: 'lean',
  openOnLoad: false,
  placeholder: 'Ask me anything…',
  signInLabel: 'Sign in to unlock full demo',
  footerHtml:
    'Demo powered by <a href="https://github.com/ianlintner/Example-React-AI-Chat-App" target="_blank" rel="noopener">cat-herding</a>',
  welcomeMessage:
    "Hi! I'm an AI demo. Ask about the portfolio, say hi, or request a joke.",
};

export class ChatWidget {
  private readonly opts: ChatWidgetOptions &
    typeof DEFAULTS & { apiUrl: string };
  private host!: HTMLElement;
  private root!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private statusEl!: HTMLDivElement;
  /** Optional sign-in upgrade banner shown to unauthed users. */
  private signInEl: HTMLDivElement | null = null;
  private inputRowEl: HTMLFormElement | null = null;
  private typingEl: HTMLDivElement | null = null;
  private socket: Socket | null = null;
  private conversationId: string | null = null;
  private streamingMessages = new Map<string, HTMLDivElement>();
  private auth: AuthManager | null = null;

  constructor(opts: ChatWidgetOptions) {
    if (!opts || !opts.apiUrl) {
      throw new Error('CatHerdingChat: apiUrl is required');
    }
    this.opts = { ...DEFAULTS, ...opts };
    if (this.opts.auth) {
      this.auth = new AuthManager(this.opts.apiUrl, this.opts.auth);
      this.auth.onChange(session => this.onAuthChange(session));
    }
  }

  /** Whether a signed-in OAuth2 session is active. */
  isAuthenticated(): boolean {
    return !!this.auth?.isAuthenticated();
  }

  /** Clear the local session and reset the widget to the unauthenticated state. */
  signOut(): void {
    this.auth?.signOut();
  }

  mount(target: HTMLElement = document.body): void {
    this.host = document.createElement('div');
    this.host.setAttribute('data-cat-herding-chat', '');
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = widgetCss;
    shadow.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = `root ${POSITION_CLASS[this.opts.position]}`;
    this.root.style.setProperty('--ch-accent', this.opts.accentColor);
    shadow.appendChild(this.root);

    this.renderLauncher();
    this.renderPanel();

    target.appendChild(this.host);

    if (this.opts.openOnLoad) {
      this.open();
    }
  }

  destroy(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.host?.remove();
  }

  open(): void {
    this.root.classList.add('open');
    this.syncAuthGate();
    // Always connect — anonymous chat is allowed; a token is forwarded only
    // when the user has signed in.
    this.ensureConnected();
    setTimeout(() => this.inputEl?.focus(), 50);
  }

  close(): void {
    this.root.classList.remove('open');
  }

  toggle(): void {
    if (this.root.classList.contains('open')) this.close();
    else this.open();
  }

  private renderLauncher(): void {
    const btn = document.createElement('button');
    btn.className = 'fab';
    btn.setAttribute('aria-label', 'Open chat');
    btn.innerHTML = chatIcon;
    btn.addEventListener('click', () => this.open());
    this.root.appendChild(btn);
  }

  private renderPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', this.opts.title);
    this.root.appendChild(panel);

    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `
      <div style="flex:1">
        <div class="title"></div>
        <div class="sub"></div>
      </div>
      <button class="close" aria-label="Close chat">${closeIcon}</button>
    `;
    (header.querySelector('.title') as HTMLElement).textContent =
      this.opts.title;
    (header.querySelector('.sub') as HTMLElement).textContent =
      this.opts.subtitle;
    header
      .querySelector('.close')!
      .addEventListener('click', () => this.close());
    panel.appendChild(header);

    this.statusEl = document.createElement('div');
    this.statusEl.className = 'status';
    this.statusEl.innerHTML = `<span class="dot"></span><span class="text">Connecting…</span>`;
    panel.appendChild(this.statusEl);

    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'messages';
    panel.appendChild(this.messagesEl);

    if (this.opts.welcomeMessage) {
      this.appendAssistantFinal({
        id: 'welcome',
        role: 'assistant',
        content: this.opts.welcomeMessage,
      });
    }

    // Optional sign-in upgrade banner — only rendered when auth config is
    // supplied. Sits above the input row so users always see the chat input
    // first. Collapses once the user signs in.
    if (this.auth) {
      const gate = document.createElement('div');
      gate.className = 'signin-gate';
      gate.innerHTML = `
        <button class="signin-btn" type="button"></button>
        <div class="signin-hint"></div>
      `;
      const btn = gate.querySelector('.signin-btn') as HTMLButtonElement;
      btn.textContent = this.opts.signInLabel;
      btn.addEventListener('click', () => {
        this.handleSignIn();
      });
      this.signInEl = gate;
      panel.appendChild(gate);
    }

    // Input row is always rendered and always visible — chat is available
    // without sign-in; auth only upgrades the experience.
    const inputRow = document.createElement('form');
    inputRow.className = 'input-row';
    inputRow.innerHTML = `
      <input type="text" autocomplete="off" spellcheck="true" />
      <button type="submit" disabled>Send</button>
    `;
    this.inputEl = inputRow.querySelector('input')!;
    this.sendBtn = inputRow.querySelector('button')!;
    this.inputEl.placeholder = this.opts.placeholder;

    this.inputEl.addEventListener('input', () => {
      this.sendBtn.disabled = this.inputEl.value.trim().length === 0;
    });
    inputRow.addEventListener('submit', e => {
      e.preventDefault();
      this.handleSend();
    });
    this.inputRowEl = inputRow;
    panel.appendChild(inputRow);

    if (this.opts.footerHtml) {
      const footer = document.createElement('div');
      footer.className = 'footer';
      footer.innerHTML = this.opts.footerHtml;
      panel.appendChild(footer);
    }

    this.syncAuthGate();
  }

  private setStatus(
    state: 'connecting' | 'connected' | 'error',
    text: string,
  ): void {
    this.statusEl.classList.remove('connected', 'error');
    if (state !== 'connecting') this.statusEl.classList.add(state);
    const t = this.statusEl.querySelector('.text') as HTMLElement;
    t.textContent = text;
  }

  private ensureConnected(): void {
    if (this.socket?.connected || this.socket?.active) return;

    const query: Record<string, string> = {};
    if (this.opts.mode === 'lean') query.mode = 'lean';

    const session = this.auth?.getSession();
    const authPayload: { token?: string } = {};
    if (session?.accessToken) authPayload.token = session.accessToken;

    this.setStatus('connecting', 'Connecting…');

    this.socket = io(this.opts.apiUrl, {
      path: '/api/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      query,
      auth: authPayload,
      reconnectionAttempts: 5,
      timeout: 15000,
    });

    this.socket.on('connect', () => {
      this.setStatus('connected', 'Connected');
    });
    this.socket.on('disconnect', reason => {
      this.setStatus('error', `Disconnected (${reason})`);
    });
    this.socket.on('connect_error', err => {
      this.setStatus('error', `Connection error: ${err.message}`);
    });

    this.socket.on('stream_start', (data: { messageId: string }) => {
      this.removeTyping();
      const el = this.createAssistantBubble('');
      this.streamingMessages.set(data.messageId, el);
    });

    this.socket.on('stream_chunk', (chunk: StreamChunk) => {
      const el = this.streamingMessages.get(chunk.messageId);
      if (el) {
        this.setAssistantText(el, chunk.content);
        this.scrollToBottom();
      }
    });

    this.socket.on(
      'stream_complete',
      (data: {
        messageId: string;
        conversationId: string;
        agentUsed?: string;
      }) => {
        if (data.conversationId) this.conversationId = data.conversationId;
        const el = this.streamingMessages.get(data.messageId);
        if (el && data.agentUsed) this.applyAgentBadge(el, data.agentUsed);
        this.streamingMessages.delete(data.messageId);
        this.sendBtn.disabled = this.inputEl.value.trim().length === 0;
      },
    );

    this.socket.on(
      'stream_error',
      (err: { message: string; code?: string }) => {
        this.removeTyping();
        if (err.code === 'CONVERSATION_NOT_FOUND') {
          this.conversationId = null;
        }
        this.appendAssistantFinal({
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, something went wrong: ${err.message}`,
        });
        this.sendBtn.disabled = this.inputEl.value.trim().length === 0;
      },
    );

    this.socket.on('proactive_message', (data: { message: ServerMessage }) => {
      this.removeTyping();
      this.appendAssistantFinal(data.message);
    });

    this.socket.on(
      'attachment',
      (data: { messageId: string; attachment: Attachment }) => {
        const el = this.streamingMessages.get(data.messageId);
        if (el) this.appendAttachment(el, data.attachment);
      },
    );

    this.socket.on(
      'handoff_event',
      (evt: { toAgent: string; message: string }) => {
        this.appendAssistantFinal({
          id: `handoff-${Date.now()}`,
          role: 'assistant',
          content: evt.message || `Transferring you to ${evt.toAgent}…`,
          agentUsed: evt.toAgent,
        });
      },
    );
  }

  private async handleSignIn(): Promise<void> {
    if (!this.auth || !this.signInEl) return;
    const btn = this.signInEl.querySelector('.signin-btn') as HTMLButtonElement;
    const hint = this.signInEl.querySelector('.signin-hint') as HTMLElement;
    btn.disabled = true;
    hint.textContent = 'Opening sign-in window…';
    try {
      await this.auth.signIn();
      hint.textContent = '';
    } catch (err) {
      hint.textContent =
        err instanceof Error
          ? err.message
          : 'Sign-in failed. Please try again.';
      btn.disabled = false;
    }
  }

  private onAuthChange(session: AuthSession | null): void {
    this.syncAuthGate();
    if (session) {
      // Reconnect with the new access token on the Socket.IO handshake.
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      this.ensureConnected();
      setTimeout(() => this.inputEl?.focus(), 50);
    } else if (this.socket) {
      // Signed out — reconnect anonymously so chat remains available.
      this.socket.disconnect();
      this.socket = null;
      this.ensureConnected();
    }
  }

  private syncAuthGate(): void {
    if (!this.auth || !this.signInEl) return;
    const authed = this.auth.isAuthenticated();
    // Hide the sign-in banner once authenticated; always keep input row visible.
    this.signInEl.style.display = authed ? 'none' : 'flex';
  }

  private handleSend(): void {
    const text = this.inputEl.value.trim();
    if (!text || !this.socket) return;
    this.ensureConnected();

    this.appendUserMessage(text);
    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.showTyping();

    this.socket.emit('stream_chat', {
      message: text,
      conversationId: this.conversationId || undefined,
    });
  }

  private appendUserMessage(text: string): void {
    const el = document.createElement('div');
    el.className = 'msg user';
    el.textContent = text;
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
  }

  private createAssistantBubble(initial: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'msg assistant';
    const body = document.createElement('div');
    body.className = 'body';
    body.textContent = initial;
    el.appendChild(body);
    this.messagesEl.appendChild(el);
    this.scrollToBottom();
    return el;
  }

  private setAssistantText(el: HTMLDivElement, text: string): void {
    const body = el.querySelector('.body') as HTMLElement | null;
    if (body) body.textContent = text;
  }

  private applyAgentBadge(el: HTMLDivElement, agent: string): void {
    if (el.querySelector('.agent-badge')) return;
    const badge = document.createElement('span');
    badge.className = 'agent-badge';
    badge.textContent = agent.replace(/_/g, ' ');
    el.insertBefore(badge, el.firstChild);
  }

  private appendAssistantFinal(msg: ServerMessage): void {
    const el = this.createAssistantBubble(msg.content || '');
    if (msg.agentUsed) this.applyAgentBadge(el, msg.agentUsed);
    if (msg.attachments?.length) {
      for (const a of msg.attachments) this.appendAttachment(el, a);
    }
  }

  private appendAttachment(el: HTMLDivElement, attachment: Attachment): void {
    const wrap = document.createElement('div');
    wrap.className = 'attachment';

    if (attachment.type === 'youtube' && attachment.videoId) {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(attachment.videoId)}`;
      iframe.setAttribute(
        'allow',
        'accelerometer; encrypted-media; picture-in-picture',
      );
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      wrap.appendChild(iframe);
    } else if (attachment.type === 'gif' && attachment.url) {
      const img = document.createElement('img');
      img.src = attachment.url;
      img.alt = attachment.altText || attachment.title || 'gif';
      img.loading = 'lazy';
      wrap.appendChild(img);
    } else if (attachment.url) {
      const a = document.createElement('a');
      a.href = attachment.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = attachment.title || attachment.url;
      wrap.appendChild(a);
    } else {
      return;
    }

    el.appendChild(wrap);
    this.scrollToBottom();
  }

  private showTyping(): void {
    this.removeTyping();
    const el = document.createElement('div');
    el.className = 'typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    this.messagesEl.appendChild(el);
    this.typingEl = el;
    this.scrollToBottom();
  }

  private removeTyping(): void {
    this.typingEl?.remove();
    this.typingEl = null;
  }

  private scrollToBottom(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
