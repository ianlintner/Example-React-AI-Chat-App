# Cat-Herding Chat Embed

Embeddable, drop-in floating chat widget backed by the Cat-Herding AI demo backend. Intended for sites such as `portfolio.cat-herding.net` that want a chat bubble in the corner without pulling in the full React Native / Expo SPA.

## Install on a host page

Add the script tag and call `init()`:

```html
<script src="https://chat.cat-herding.net/embed/cat-herding-chat.js" defer></script>
<script>
  window.addEventListener('load', () => {
    window.CatHerdingChat.init({
      apiUrl: 'https://chat.cat-herding.net',
      title: 'Ask about my portfolio',
      subtitle: 'AI demo',
      position: 'bottom-right',
      accentColor: '#4f46e5',
      mode: 'lean',
    });
  });
</script>
```

### Content Security Policy

If the host page enforces a CSP, allow:

- `script-src https://chat.cat-herding.net`
- `connect-src https://chat.cat-herding.net wss://chat.cat-herding.net`
- `frame-src https://www.youtube-nocookie.com` (only if you want YouTube attachments to render)
- `img-src data: https:` (for inbound GIF attachments)

## Options

| Option           | Type                                                           | Default               | Description                                                                                                              |
| ---------------- | -------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apiUrl`         | `string` (required)                                            | —                     | Origin of the chat backend, e.g. `https://chat.cat-herding.net`.                                                         |
| `mode`           | `'lean' \| 'demo'`                                             | `'lean'`              | `'lean'` skips the demo hold-flow auto-bootstrap (no unsolicited joke/GIF). `'demo'` opts into the full demo experience. |
| `title`          | `string`                                                       | `'Cat-Herding Chat'`  | Header title.                                                                                                            |
| `subtitle`       | `string`                                                       | `'AI portfolio demo'` | Header subtitle.                                                                                                         |
| `position`       | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'`      | Screen corner for the launcher.                                                                                          |
| `accentColor`    | `string`                                                       | `'#4f46e5'`           | Button / header / user bubble color.                                                                                     |
| `openOnLoad`     | `boolean`                                                      | `false`               | Open the panel immediately.                                                                                              |
| `placeholder`    | `string`                                                       | `'Ask me anything…'`  | Text for the input placeholder.                                                                                          |
| `welcomeMessage` | `string \| null`                                               | short welcome         | First bubble shown. Pass `null` to omit.                                                                                 |
| `footerHtml`     | `string \| null`                                               | link to repo          | HTML rendered in the footer. Pass `null` to omit.                                                                        |

`CatHerdingChat.init()` returns the `ChatWidget` instance. The widget also exposes `open()`, `close()`, `toggle()`, and `destroy()` methods.

## Isolation

The widget mounts inside a Shadow DOM so host-page CSS does not bleed in and widget styles do not bleed out. It does not load any global fonts; it inherits the system font stack.

## Auth

The widget connects anonymously to `wss://$apiUrl/api/socket.io`. The backend's Socket.IO path is wired to accept anonymous connections; no login flow is needed on the host site.

## Development

```bash
cd embed
npm install
npm run dev          # starts Vite dev server at http://localhost:5199/demo/
# ensure backend is running separately: cd backend && npm run dev
```

## Build

```bash
npm run build
# outputs: dist/cat-herding-chat.js + dist/cat-herding-chat.css + sourcemap
```

The Docker build copies `dist/` into `dist/backend/public/embed/` so the bundle is served at `https://chat.cat-herding.net/embed/cat-herding-chat.js`.
