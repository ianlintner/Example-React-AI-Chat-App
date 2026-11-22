/**
 * `<agent-chat>` — Vite lib-mode custom element on the frozen /chat stream
 * contract. Shadow DOM keeps host-page CSS out; Instrument Panel tokens from
 * @agent-chat/ui are re-injected as plain CSS variables. Optional PKCE popup
 * sign-in uses the same-origin token proxy (no secret in the bundle).
 */
import type { AuthOptions, AuthSession } from './pkce';
import { AuthManager } from './auth';
import { streamChat, type ChatMessage } from './stream';
import { resolveTheme, themeCss } from './tokens';
import { styles } from './styles';
import { chatIcon, closeIcon } from './icons';

export interface AgentChatAttributes {
  'api-url': string;
  title?: string;
  subtitle?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark';
  open?: boolean;
  placeholder?: string;
  welcome?: string;
  /** JSON-encoded OAuth2 PKCE options (same shape as legacy embed auth). */
  auth?: string;
}

const DEFAULTS = {
  title: 'Agent chat',
  subtitle: 'Ask the agent anything',
  position: 'bottom-right',
  placeholder: 'Ask the agent…',
  welcome: 'Send a message to start a run.',
};

export class AgentChatElement extends HTMLElement {
  static observedAttributes = [
    'api-url',
    'title',
    'subtitle',
    'position',
    'theme',
    'open',
    'placeholder',
    'welcome',
    'auth',
  ] as const;

  private root!: HTMLDivElement;
  private messagesEl!: HTMLDivElement;
  private statusEl!: HTMLDivElement;
  private inputEl!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private abort: AbortController | null = null;
  private auth: AuthManager | null = null;
  private history: ChatMessage[] = [];
  private threadId = `thr_embed_${crypto.randomUUID()}`;

  connectedCallback(): void {
    if (!this.apiUrl) return; // Declarative upgrade: wait for api-url.
    this.teardown();
    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';
    const style = document.createElement('style');
    style.textContent =
      themeCss(resolveTheme(this.getAttribute('theme'))) + '\n' + styles;
    shadow.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = `root pos-${this.position}`;
    this.root.innerHTML = `
      <button class="fab" aria-label="Open chat">${chatIcon}</button>
      <div class="panel" role="dialog" aria-label="${this.escape(this.panelTitle)}">
        <div class="header">
          <div class="titles">
            <div class="title"></div><div class="sub"></div>
          </div>
          <button class="close" aria-label="Close chat">${closeIcon}</button>
        </div>
        <div class="status" data-state=""><span class="dot"></span><span class="label">Ready</span><span class="chip"></span></div>
        <div class="messages" aria-live="polite"></div>
        ${this.signInMarkup()}
        <form class="input-row">
          <input type="text" autocomplete="off" aria-label="Message" />
          <button type="submit" disabled>Send</button>
        </form>
        <div class="footer"><a href="https://github.com/ianlintner/Example-React-AI-Chat-App">agent-chat</a></div>
      </div>`;
    shadow.appendChild(this.root);

    this.messagesEl = this.query('.messages');
    this.statusEl = this.query('.status');
    this.inputEl = this.query('input');
    this.sendBtn = this.query('.input-row button');
    this.inputEl.placeholder = this.placeholder;
    this.query('.title').textContent = this.panelTitle;
    this.query('.sub').textContent = this.subtitle;

    this.query('.fab').addEventListener('click', () => this.open());
    this.query('.close').addEventListener('click', () => this.close());
    this.inputEl.addEventListener('input', () => {
      this.sendBtn.disabled = this.inputEl.value.trim().length === 0;
    });
    this.query('form').addEventListener('submit', event => {
      event.preventDefault();
      void this.send();
    });

    if (this.welcome) this.appendMessage('assistant', this.welcome);
    this.setupAuth();
    if (this.hasAttribute('open') || this.getAttribute('open') !== null) {
      this.open();
    }
  }

  disconnectedCallback(): void {
    this.teardown();
  }

  private teardown(): void {
    this.abort?.abort();
    this.abort = null;
    this.auth?.dispose();
    this.auth = null;
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) return;
    if (name === 'api-url' && !this.apiUrl) {
      this.teardown();
      this.shadowRoot && (this.shadowRoot.innerHTML = '');
      return;
    }
    if (!this.apiUrl) return; // Other attributes before api-url: just wait.
    this.connectedCallback();
  }

  /** Programmatic entry point used by the demo and e2e. */
  open(): void {
    this.root.classList.add('open');
    this.setStatus('Ready');
    setTimeout(() => this.inputEl?.focus(), 0);
  }

  close(): void {
    this.root.classList.remove('open');
  }

  /** Expose the token to the stream layer when signed in (future auth gate). */
  get accessToken(): string | undefined {
    return this.auth?.getSession()?.accessToken;
  }

  private get apiUrl(): string {
    return this.getAttribute('api-url')?.replace(/\/$/, '') ?? '';
  }
  private get panelTitle(): string {
    return this.getAttribute('title') ?? DEFAULTS.title;
  }
  private get subtitle(): string {
    return this.getAttribute('subtitle') ?? DEFAULTS.subtitle;
  }
  private get position(): string {
    const value = this.getAttribute('position') ?? DEFAULTS.position;
    const short: Record<string, string> = {
      'bottom-right': 'br',
      'bottom-left': 'bl',
      'top-right': 'tr',
      'top-left': 'tl',
      br: 'br',
      bl: 'bl',
      tr: 'tr',
      tl: 'tl',
    };
    return short[value] ?? 'br';
  }
  private get placeholder(): string {
    return this.getAttribute('placeholder') ?? DEFAULTS.placeholder;
  }
  private get welcome(): string {
    return this.getAttribute('welcome') ?? DEFAULTS.welcome;
  }

  private query<T extends Element = HTMLElement>(selector: string): T {
    const el = this.shadowRoot!.querySelector<T>(selector);
    if (!el) throw new Error(`<agent-chat> missing element: ${selector}`);
    return el;
  }

  private escape(value: string): string {
    return value.replace(
      /[&<>"']/g,
      c =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c]!,
    );
  }

  private setStatus(label: string, state = '', chip = ''): void {
    this.statusEl.dataset.state = state;
    this.query('.status .label').textContent = label;
    this.query('.status .chip').textContent = chip;
  }

  private appendMessage(role: 'user' | 'assistant', text: string): HTMLElement {
    const msg = document.createElement('div');
    msg.className = 'msg';
    msg.dataset.role = role;
    msg.dataset.testid = `msg-${role}`;
    msg.textContent = text;
    this.messagesEl.appendChild(msg);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return msg;
  }

  private async send(): Promise<void> {
    const text = this.inputEl.value.trim();
    if (!text || this.abort) return;
    this.abort = new AbortController();
    const signal = this.abort.signal;
    try {
      await this.runTurn(text, signal);
    } catch (error) {
      this.setStatus(
        error instanceof Error ? error.message : 'Request failed',
        'error',
      );
    } finally {
      this.abort = null;
      this.sendBtn.disabled = this.inputEl.value.trim().length === 0;
    }
  }

  /** One user turn: only commits history/status when the stream succeeds. */
  private async runTurn(text: string, signal: AbortSignal): Promise<void> {
    this.appendMessage('user', text);
    const reply = this.appendMessage('assistant', '');
    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.setStatus('Streaming…', 'ready');
    this.history.push({
      id: `msg_${crypto.randomUUID()}`,
      role: 'user',
      parts: [{ type: 'text', text }],
    });
    let assistantId = `msg_${crypto.randomUUID()}`;
    const result = await streamChat(
      this.apiUrl,
      this.threadId,
      this.history,
      signal,
      {
        onStart: id => (assistantId = id),
        onDelta: delta => {
          reply.textContent = (reply.textContent ?? '') + delta;
          this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
        },
        onDecision: label => this.setStatus('Streaming…', 'ready', label),
      },
    );
    if (!result.ok) {
      // Roll back both local history and the empty assistant bubble so a
      // failed turn is never replayed on the next request.
      this.history.pop();
      reply.remove();
      this.inputEl.value = text;
      this.setStatus(result.reason, 'error');
      return;
    }
    this.history.push({
      id: assistantId,
      role: 'assistant',
      parts: [{ type: 'text', text: reply.textContent ?? '' }],
    });
    this.setStatus('Ready', 'ready');
  }

  private setupAuth(): void {
    const raw = this.getAttribute('auth');
    if (!raw) return;
    let options: AuthOptions;
    try {
      options = JSON.parse(raw) as AuthOptions;
    } catch {
      this.setStatus('Invalid auth configuration', 'error');
      return;
    }
    if (options.type !== 'oauth2' || !options.issuer || !options.clientId) {
      this.setStatus('Invalid auth configuration', 'error');
      return;
    }
    this.auth = new AuthManager(this.apiUrl, options);
    const gate = this.query('.signin');
    gate.hidden = false;
    const button = this.query<HTMLButtonElement>('.signin button');
    const hint = this.query('.signin .hint');
    this.auth.onChange((session: AuthSession | null) => {
      gate.hidden = !!session;
      hint.textContent = '';
    });
    button.addEventListener('click', async () => {
      button.disabled = true;
      hint.textContent = 'Opening sign-in window…';
      try {
        await this.auth!.signIn(url =>
          window.open(url, 'agent-chat-oauth', 'width=520,height=680'),
        );
      } catch (error) {
        hint.textContent =
          error instanceof Error ? error.message : 'Sign-in failed';
        button.disabled = false;
      }
    });
  }

  private signInMarkup(): string {
    return `<div class="signin" hidden><button type="button">Sign in</button><span class="hint"></span></div>`;
  }
}

export function defineAgentChat(tag = 'agent-chat'): void {
  if (!customElements.get(tag)) customElements.define(tag, AgentChatElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'agent-chat': AgentChatElement;
  }
}
