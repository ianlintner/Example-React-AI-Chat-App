import {
  mediaArtifactFixture,
  mediaAttachmentsFixture,
} from '@agent-chat/contract/fixtures';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MediaArtifactPanel } from './media-artifact-panel';
import { MediaAttachmentView, MediaAttachments } from './media-attachments';
import {
  isTrustedMcpOrigin,
  MCP_APP_CSP,
  MCP_APP_SANDBOX,
  McpAppFrame,
} from './mcp-app-frame';

afterEach(() => cleanup());

const byType = (type: string) =>
  mediaAttachmentsFixture.find(a => a.type === type)!;

describe('media renderers', () => {
  it('renders all eight attachment variants without crashing', () => {
    for (const attachment of mediaAttachmentsFixture) {
      const { unmount } = render(
        <MediaAttachmentView attachment={attachment} />,
      );
      expect(screen.getByTestId('media-card')).toBeTruthy();
      unmount();
    }
  });

  it('uses a privacy-enhanced YouTube link with no tracking cookies', () => {
    render(<MediaAttachmentView attachment={byType('youtube')} />);
    const link = screen.getByTestId('youtube-embed') as HTMLAnchorElement;
    expect(link.href).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(link.rel).toContain('noopener');
  });

  it('renders dice totals with an accessible label', () => {
    render(<MediaAttachmentView attachment={byType('dice')} />);
    expect(screen.getByLabelText('Total 9')).toBeTruthy();
  });

  it('renders a validated media artifact and ignores malformed parts', () => {
    const { unmount } = render(
      <MediaArtifactPanel part={mediaArtifactFixture} />,
    );
    expect(screen.getByTestId('media-artifact')).toBeTruthy();
    expect(screen.getAllByTestId('media-card')).toHaveLength(1);
    unmount();
    render(
      <MediaArtifactPanel
        part={{
          kind: 'media',
          attachments: [{ type: 'script', url: 'javascript:alert(1)' }],
        }}
      />,
    );
    expect(screen.queryByTestId('media-artifact')).toBeNull();
  });

  it('renders an attachment list', () => {
    render(
      <MediaAttachments attachments={mediaAttachmentsFixture.slice(0, 2)} />,
    );
    expect(screen.getAllByTestId('media-card')).toHaveLength(2);
  });
});

describe('McpAppFrame sandbox', () => {
  it('never grants same-origin or top navigation', () => {
    expect(MCP_APP_SANDBOX).toContain('allow-scripts');
    expect(MCP_APP_SANDBOX).not.toContain('allow-same-origin');
    expect(MCP_APP_SANDBOX).not.toContain('allow-top-navigation');
    expect(MCP_APP_CSP).toContain("default-src 'none'");
    expect(MCP_APP_CSP).toContain("form-action 'none'");
  });

  it('sets sandbox attributes and a CSP meta in srcdoc', () => {
    render(<McpAppFrame uri='ui://tools/dice-roller' html='<p>hello</p>' />);
    const iframe = screen.getByTestId('mcp-app-iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe(MCP_APP_SANDBOX);
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(iframe.srcdoc).toContain('Content-Security-Policy');
    expect(iframe.srcdoc).toContain('hello');
  });

  it('rejects non-ui URIs', () => {
    render(<McpAppFrame uri='https://evil.test/app' html='<p>x</p>' />);
    expect(screen.getByTestId('mcp-app-unsupported')).toBeTruthy();
    expect(screen.queryByTestId('mcp-app-iframe')).toBeNull();
  });

  it('only accepts postMessage from trusted https origins', () => {
    expect(
      isTrustedMcpOrigin('https://trusted.test', ['https://trusted.test']),
    ).toBe(true);
    expect(
      isTrustedMcpOrigin('http://trusted.test', ['http://trusted.test']),
    ).toBe(false);
    expect(
      isTrustedMcpOrigin('https://evil.test', ['https://trusted.test']),
    ).toBe(false);
    expect(isTrustedMcpOrigin('not-an-origin', [])).toBe(false);
  });

  it('forwards messages only from the frame and allowed origins', () => {
    const onMessage = vi.fn();
    render(
      <McpAppFrame
        uri='ui://tools/dice-roller'
        html='<p>x</p>'
        allowedOrigins={['https://trusted.test']}
        onMessage={onMessage}
      />,
    );
    const iframe = screen.getByTestId('mcp-app-iframe') as HTMLIFrameElement;
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'ok',
        origin: 'https://trusted.test',
        source: iframe.contentWindow,
      }),
    );
    expect(onMessage).toHaveBeenCalledWith('ok');
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'evil',
        origin: 'https://evil.test',
        source: iframe.contentWindow,
      }),
    );
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});
