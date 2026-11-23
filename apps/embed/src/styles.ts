/** Shadow-DOM styles. Colours/fonts come from re-injected ui tokens. */
export const styles = /* css */ `
:host {
  all: initial;
  display: block;
  font-family: var(--font-sans);
  color: var(--fg);
  line-height: 1.45;
  color-scheme: dark;
}
:host([hidden]) { display: none; }
*, *::before, *::after { box-sizing: border-box; }
button, input { font: inherit; }

.root { position: fixed; z-index: 2147483000; font-size: 14px; width: 380px; height: 600px; }
.root.pos-br { right: 20px; bottom: 20px; }
.root.pos-bl { left: 20px; bottom: 20px; }
.root.pos-tr { right: 20px; top: 20px; }
.root.pos-tl { left: 20px; top: 20px; }
/* Collapsed: the root shrinks to the FAB footprint so it never blocks clicks. */
.root:not(.open) { width: 54px; height: 54px; }

.fab {
  width: 54px; height: 54px; border-radius: 9999px; border: 1px solid var(--border);
  background: var(--accent); color: var(--accent-contrast); cursor: pointer;
  display: grid; place-items: center; box-shadow: 0 10px 25px rgba(0,0,0,.45);
  transition: transform var(--duration-hover) ease;
}
.fab:hover { transform: translateY(-1px); }
.fab:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.fab svg { width: 24px; height: 24px; }

.panel {
  position: absolute; width: min(380px, calc(100vw - 40px));
  height: min(600px, calc(100vh - 100px)); background: var(--bg);
  border: 1px solid var(--border); border-radius: 14px; display: none;
  flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,.7);
  transition: opacity var(--duration-panel) ease;
}
.root.pos-br .panel { right: 0; bottom: 68px; }
.root.pos-bl .panel { left: 0; bottom: 68px; }
.root.pos-tr .panel { right: 0; top: 68px; }
.root.pos-tl .panel { left: 0; top: 68px; }
.root.open .panel { display: flex; }
.root.open .fab { display: none; }

.header {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  background: var(--surface); border-bottom: 1px solid var(--border);
}
.header .titles { flex: 1; min-width: 0; }
.header .title { font-weight: 600; font-size: 14px; color: var(--fg); }
.header .sub { font-size: 11px; color: var(--fg-muted); }
.header button {
  border: 1px solid var(--border); background: var(--surface-2); color: var(--fg);
  width: 30px; height: 30px; border-radius: 7px; cursor: pointer;
  display: grid; place-items: center;
}
.header button svg { width: 16px; height: 16px; }

.status {
  padding: 4px 12px; font-size: 11px; color: var(--fg-muted);
  background: var(--surface); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 6px; min-height: 24px;
}
.status .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fg-muted); }
.status[data-state=ready] .dot { background: var(--ok); }
.status[data-state=error] .dot { background: var(--err); }
.status .chip {
  margin-left: auto; font-family: var(--font-mono); font-size: 10px;
  color: var(--accent); font-variant-numeric: tabular-nums;
}

.messages {
  flex: 1; overflow-y: auto; padding: 12px; background: var(--bg);
  display: flex; flex-direction: column; gap: 10px;
}
.msg {
  max-width: 88%; padding: 9px 11px; border-radius: 11px; font-size: 13px;
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.msg[data-role=user] {
  align-self: flex-end; background: var(--accent); color: var(--accent-contrast);
  border-bottom-right-radius: 4px;
}
.msg[data-role=assistant] {
  align-self: flex-start; background: var(--surface); color: var(--fg);
  border: 1px solid var(--border); border-bottom-left-radius: 4px;
}
.msg .badge {
  display: inline-block; font-size: 9px; font-family: var(--font-mono);
  text-transform: uppercase; letter-spacing: .05em; color: var(--accent);
  margin-bottom: 5px;
}
.typing { align-self: flex-start; display: flex; gap: 4px; padding: 9px 11px;
  background: var(--surface); border: 1px solid var(--border); border-radius: 11px; }
.typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--fg-muted);
  animation: bounce 1.2s infinite; }
.typing span:nth-child(2) { animation-delay: .15s; }
.typing span:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%,80%,100% { transform: scale(.6); opacity:.5; } 40% { transform: scale(1); opacity:1; } }

.signin { display: flex; align-items: center; gap: 8px; padding: 7px 12px;
  border-top: 1px solid var(--border); background: var(--surface); }
.signin button { border: 1px solid var(--accent); background: transparent;
  color: var(--accent); padding: 5px 10px; border-radius: 7px; cursor: pointer; font-size: 12px; }
.signin .hint { flex: 1; font-size: 10px; color: var(--fg-muted); }
.input-row { display: flex; gap: 7px; padding: 9px; border-top: 1px solid var(--border);
  background: var(--surface); }
.input-row input { flex: 1; min-width: 0; border: 1px solid var(--border);
  border-radius: 8px; padding: 9px 10px; background: var(--bg); color: var(--fg); font-size: 13px; }
.input-row input:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
.input-row button { border: none; border-radius: 8px; padding: 0 13px; cursor: pointer;
  background: var(--accent); color: var(--accent-contrast); font-weight: 600; }
.input-row button:disabled { opacity: .4; cursor: not-allowed; }
.footer { font-size: 9px; color: var(--fg-muted); padding: 3px 8px 6px;
  text-align: center; background: var(--surface); }
.footer a { color: var(--fg-muted); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;
