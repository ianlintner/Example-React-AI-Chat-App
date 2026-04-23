export const widgetCss = /* css */ `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #e5e7eb;
  line-height: 1.4;
}

*, *::before, *::after { box-sizing: border-box; }

.root {
  position: fixed;
  z-index: 2147483000;
  font-size: 14px;
}
.root.pos-br { right: 20px; bottom: 20px; }
.root.pos-bl { left: 20px; bottom: 20px; }
.root.pos-tr { right: 20px; top: 20px; }
.root.pos-tl { left: 20px; top: 20px; }

.fab {
  width: 56px;
  height: 56px;
  border-radius: 9999px;
  border: none;
  background: var(--ch-accent, #6366f1);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.fab:hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(99, 102, 241, 0.4); }
.fab:focus-visible { outline: 3px solid rgba(99, 102, 241, 0.5); outline-offset: 2px; }
.fab svg { width: 24px; height: 24px; }

.panel {
  position: absolute;
  width: min(380px, calc(100vw - 40px));
  height: min(600px, calc(100vh - 100px));
  background: #0f0f0f;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255,255,255,0.06);
  display: none;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.root.pos-br .panel { right: 0; bottom: 72px; }
.root.pos-bl .panel { left: 0; bottom: 72px; }
.root.pos-tr .panel { right: 0; top: 72px; }
.root.pos-tl .panel { left: 0; top: 72px; }
.root.open .panel { display: flex; }
.root.open .fab { display: none; }

.header {
  background: var(--ch-accent, #6366f1);
  color: #fff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header .title { font-weight: 600; font-size: 15px; flex: 1; }
.header .sub { font-size: 12px; opacity: 0.8; }
.header .close {
  background: transparent;
  border: none;
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header .close:hover { background: rgba(255,255,255,0.15); }
.header .close svg { width: 18px; height: 18px; }

.status {
  padding: 5px 12px;
  font-size: 11px;
  color: #6b7280;
  background: #0a0a0a;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
}
.status .dot { width: 7px; height: 7px; border-radius: 50%; background: #374151; }
.status.connected .dot { background: #10b981; }
.status.error .dot { background: #ef4444; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  background: #141414;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.messages::-webkit-scrollbar { width: 4px; }
.messages::-webkit-scrollbar-track { background: transparent; }
.messages::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

.msg {
  max-width: 85%;
  padding: 10px 12px;
  border-radius: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.45;
}
.msg.user {
  align-self: flex-end;
  background: var(--ch-accent, #6366f1);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg.assistant {
  align-self: flex-start;
  background: #1e1e1e;
  color: #e5e7eb;
  border: 1px solid #2a2a2a;
  border-bottom-left-radius: 4px;
}
.msg .agent-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  padding: 2px 7px;
  border-radius: 999px;
  margin-bottom: 6px;
  border: 1px solid rgba(99, 102, 241, 0.25);
}

.attachment {
  margin-top: 8px;
  border-radius: 8px;
  overflow: hidden;
  background: #000;
}
.attachment img { width: 100%; display: block; max-height: 240px; object-fit: cover; }
.attachment iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  display: block;
}

.typing {
  align-self: flex-start;
  background: #1e1e1e;
  border: 1px solid #2a2a2a;
  padding: 10px 12px;
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  display: flex;
  gap: 4px;
}
.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4b5563;
  animation: ch-bounce 1.2s infinite;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes ch-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* Sign-in upgrade banner — shown to unauthenticated users above the input.
   Compact so it doesn't dominate the interface. */
.signin-gate {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.08);
  border-top: 1px solid rgba(99, 102, 241, 0.2);
}
.signin-gate .signin-btn {
  border: 1px solid rgba(99, 102, 241, 0.5);
  background: transparent;
  color: #a5b4fc;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 12px;
  font-family: inherit;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease;
}
.signin-gate .signin-btn:hover {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.7);
}
.signin-gate .signin-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}
.signin-gate .signin-hint {
  flex: 1;
  font-size: 11px;
  color: #6b7280;
  min-height: 1em;
}

.input-row {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: #0f0f0f;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.input-row input {
  flex: 1;
  border: 1px solid #2a2a2a;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  color: #e5e7eb;
  background: #1a1a1a;
}
.input-row input::placeholder { color: #4b5563; }
.input-row input:focus { border-color: var(--ch-accent, #6366f1); box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
.input-row button {
  border: none;
  background: var(--ch-accent, #6366f1);
  color: #fff;
  padding: 0 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: opacity 120ms ease;
}
.input-row button:disabled { opacity: 0.4; cursor: not-allowed; }
.input-row button:not(:disabled):hover { opacity: 0.9; }

.footer {
  font-size: 10px;
  color: #374151;
  padding: 4px 10px 7px;
  text-align: center;
  background: #0f0f0f;
  border-top: 1px solid rgba(255,255,255,0.04);
}
.footer a { color: #4b5563; text-decoration: none; }
.footer a:hover { color: #6b7280; text-decoration: underline; }
`;
