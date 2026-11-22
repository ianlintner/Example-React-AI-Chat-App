/**
 * MCP Apps host. Remote `ui://` HTML is rendered in a sandboxed iframe with
 * strict CSP. It receives no same-origin access, no cookies, no top-navigation
 * and no arbitrary JS. Messages are postMessage-only with origin allow-listing.
 */
import { useEffect, useRef, useState } from 'react';

export const MCP_APP_SANDBOX =
  'allow-scripts allow-forms allow-popups-to-escape-sandbox';
// Deliberately NO `allow-same-origin` (would defeat the sandbox) and NO
// `allow-top-navigation` (would let remote UI navigate the chat app).
export const MCP_APP_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: data:; font-src https:; connect-src https:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'";

/** Only https origins from this allow-list may send messages to the host. */
export function isTrustedMcpOrigin(
  origin: string,
  allowed: readonly string[],
): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && allowed.includes(url.origin);
  } catch {
    return false;
  }
}

export interface McpAppFrameProps {
  /** `ui://...` resource URI shown in the caption. */
  uri: string;
  /** Trusted HTML returned by the MCP server's resources/read. */
  html: string;
  /** HTTPS origins allowed to post messages back. */
  allowedOrigins?: readonly string[];
  title?: string;
  onMessage?: (data: unknown) => void;
}

export function McpAppFrame({
  uri,
  html,
  allowedOrigins = [],
  title = 'MCP App',
  onMessage,
}: McpAppFrameProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!/^ui:\/\/[a-z0-9][a-z0-9._/-]{0,199}$/i.test(uri)) {
      setUnsupported(true);
      return;
    }
    if (!/^https?:\/\//.test(location.href)) {
      // srcdoc in a file:// page can lose its opaque origin; fail closed.
      setUnsupported(true);
    }
  }, [uri]);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (!isTrustedMcpOrigin(event.origin, allowedOrigins)) return;
      if (frame.current && event.source !== frame.current.contentWindow) return;
      onMessage?.(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [allowedOrigins, onMessage]);

  if (unsupported) {
    return (
      <p data-testid='mcp-app-unsupported'>This MCP App cannot be displayed.</p>
    );
  }

  const document = `<!doctype html><meta http-equiv="Content-Security-Policy" content="${MCP_APP_CSP}">${html}`;
  return (
    <figure
      data-testid='mcp-app-frame'
      className='rounded-lg border border-white/10 bg-[#0B0D0F]'
    >
      <figcaption className='flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs text-white/60'>
        <span className='inline-block h-2 w-2 rounded-full bg-[#F5A524]' />
        {title} · <code className='truncate'>{uri}</code>
      </figcaption>
      <iframe
        ref={frame}
        data-testid='mcp-app-iframe'
        title={title}
        sandbox={MCP_APP_SANDBOX}
        referrerPolicy='no-referrer'
        srcDoc={document}
        className='h-80 w-full border-0 bg-white'
      />
    </figure>
  );
}
