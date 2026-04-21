import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ConnectionStatus, ServerToClientEvents } from './types';

export interface SocketClientOptions {
  /** Absolute or relative origin. Defaults to current window origin. */
  origin?: string;
  /** Socket.IO path. Matches backend: /api/socket.io. */
  path?: string;
  /** Optional bearer token injected as `authorization` query/header. */
  token?: string;
  /** Send cookies for oauth2-proxy flows. Default true. */
  withCredentials?: boolean;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type StatusListener = (status: ConnectionStatus) => void;

/**
 * Thin typed wrapper around socket.io-client.
 * Mirrors the auth + reconnection semantics of the legacy frontend/services/socketService.ts,
 * but typed and without the RN/Expo baggage.
 */
export class SocketClient {
  private socket: TypedSocket | null = null;
  private statusListeners = new Set<StatusListener>();
  private _status: ConnectionStatus = 'idle';

  constructor(private readonly opts: SocketClientOptions = {}) {}

  get status(): ConnectionStatus {
    return this._status;
  }

  get raw(): TypedSocket | null {
    return this.socket;
  }

  onStatus(l: StatusListener): () => void {
    this.statusListeners.add(l);
    l(this._status);
    return () => this.statusListeners.delete(l);
  }

  connect(): TypedSocket {
    if (this.socket) return this.socket;

    const origin = this.opts.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
    const path = this.opts.path ?? '/api/socket.io';
    const auth: Record<string, string> = {};
    if (this.opts.token) auth.token = this.opts.token;

    this.setStatus('connecting');

    const s = io(origin, {
      path,
      transports: ['websocket', 'polling'],
      withCredentials: this.opts.withCredentials ?? true,
      timeout: 20000,
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      auth,
    }) as TypedSocket;

    s.on('connect', () => this.setStatus('connected'));
    s.on('disconnect', () => this.setStatus('offline'));
    s.io.on('reconnect_attempt', () => this.setStatus('reconnecting'));
    s.io.on('reconnect', () => this.setStatus('connected'));
    s.io.on('error', (err) => {
      console.warn('[socket] error', err);
    });

    this.socket = s;
    return s;
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('idle');
  }

  emit<E extends keyof ClientToServerEvents>(event: E, ...args: Parameters<ClientToServerEvents[E]>): void {
    if (!this.socket) throw new Error('SocketClient: emit() before connect()');
    (this.socket.emit as (e: E, ...a: Parameters<ClientToServerEvents[E]>) => void)(event, ...args);
  }

  on<E extends keyof ServerToClientEvents>(event: E, listener: ServerToClientEvents[E]): () => void {
    if (!this.socket) throw new Error('SocketClient: on() before connect()');
    (this.socket.on as unknown as (e: E, l: ServerToClientEvents[E]) => unknown)(event, listener);
    return () => {
      if (!this.socket) return;
      (this.socket.off as unknown as (e: E, l: ServerToClientEvents[E]) => unknown)(event, listener);
    };
  }

  private setStatus(s: ConnectionStatus) {
    if (this._status === s) return;
    this._status = s;
    for (const l of this.statusListeners) l(s);
  }
}

let shared: SocketClient | null = null;
export function getSocketClient(opts?: SocketClientOptions): SocketClient {
  if (!shared) shared = new SocketClient(opts);
  return shared;
}
