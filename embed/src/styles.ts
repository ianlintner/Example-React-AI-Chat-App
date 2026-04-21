export const widgetCss = /* css */ `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #111827;
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
  background: var(--ch-accent, #4f46e5);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.fab:hover { transform: translateY(-1px); box-shadow: 0 14px 30px rgba(0, 0, 0, 0.2); }
.fab:focus-visible { outline: 3px solid rgba(79, 70, 229, 0.4); outline-offset: 2px; }
.fab svg { width: 24px; height: 24px; }

.panel {
  position: absolute;
  width: min(380px, calc(100vw - 40px));
  height: min(600px, calc(100vh - 100px));
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
  display: none;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.root.pos-br .panel { right: 0; bottom: 72px; }
.root.pos-bl .panel { left: 0; bottom: 72px; }
.root.pos-tr .panel { right: 0; top: 72px; }
.root.pos-tl .panel { left: 0; top: 72px; }
.root.open .panel { display: flex; }
.root.open .fab { display: none; }

.header {
  background: var(--ch-accent, #4f46e5);
  color: #fff;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.header .title { font-weight: 600; font-size: 15px; flex: 1; }
.header .sub { font-size: 12px; opacity: 0.85; }
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
  padding: 6px 12px;
  font-size: 11px;
  color: #6b7280;
  background: #f9fafb;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
}
.status .dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
.status.connected .dot { background: #10b981; }
.status.error .dot { background: #ef4444; }

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

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
  background: var(--ch-accent, #4f46e5);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.msg.assistant {
  align-self: flex-start;
  background: #fff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-bottom-left-radius: 4px;
}
.msg .agent-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: #eef2ff;
  color: #4338ca;
  padding: 2px 6px;
  border-radius: 999px;
  margin-bottom: 6px;
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
  background: #fff;
  border: 1px solid #e5e7eb;
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
  background: #9ca3af;
  animation: ch-bounce 1.2s infinite;
}
.typing span:nth-child(2) { animation-delay: 0.15s; }
.typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes ch-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.6; }
  40% { transform: scale(1); opacity: 1; }
}

.input-row {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
}
.input-row input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
  font-family: inherit;
  color: inherit;
}
.input-row input:focus { border-color: var(--ch-accent, #4f46e5); box-shadow: 0 0 0 3px rgba(79,70,229,0.15); }
.input-row button {
  border: none;
  background: var(--ch-accent, #4f46e5);
  color: #fff;
  padding: 0 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}
.input-row button:disabled { opacity: 0.5; cursor: not-allowed; }

.footer {
  font-size: 10px;
  color: #9ca3af;
  padding: 4px 10px 8px;
  text-align: center;
  background: #fff;
}
.footer a { color: inherit; text-decoration: none; }
.footer a:hover { text-decoration: underline; }
`;
