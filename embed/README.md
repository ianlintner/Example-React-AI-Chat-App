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
| `auth`           | `AuthOptions`                                                  | _none_ (anon)         | OAuth2 + PKCE sign-in config. When set, the widget renders a Sign-in button and forwards the access token on the socket. |
| `signInLabel`    | `string`                                                       | `'Sign in to chat'`   | Label on the Sign-in button when `auth` is set.                                                                          |

`CatHerdingChat.init()` returns the `ChatWidget` instance. The widget also exposes `open()`, `close()`, `toggle()`, `destroy()`, `isAuthenticated()`, and `signOut()` methods.

## OAuth2 sign-in (optional)

The widget ships a built-in PKCE flow for gated deployments. Portfolio pages stay static — all auth code lives inside the widget.

```html
<script src="https://chat.cat-herding.net/embed/cat-herding-chat.js" defer></script>
<script>
  window.addEventListener('load', () => {
    window.CatHerdingChat.init({
      apiUrl: 'https://chat.cat-herding.net',
      mode: 'lean',
      auth: {
        type: 'oauth2',
        issuer: 'https://roauth2.cat-herding.net',
        clientId: '<your-registered-public-client-id>',
        scopes: 'openid profile email',
        tokenStorage: 'session', // 'memory' | 'session' | 'local'
      },
    });
  });
</script>
```

### How the flow works

1. Panel opens → widget shows a **Sign in to chat** button (input row is hidden).
2. Click → popup opens at the issuer's `authorization_endpoint` with a PKCE challenge + random `state`.
3. User signs in at the auth server → redirect to `https://chat.cat-herding.net/embed/callback.html?code=…&state=…`.
4. Callback page `postMessage`s the `{code, state}` back to the opener and closes itself.
5. Widget verifies `state`, POSTs `{code, code_verifier, …}` to `<apiUrl>/api/auth/embed/token` (a same-origin proxy; avoids the roauth2 CORS gap).
6. Proxy forwards to `/oauth/token` and strips `refresh_token` before returning — short-lived access tokens only.
7. Widget forwards `access_token` on the Socket.IO handshake (`socket.auth.token`).

### `AuthOptions`

| Field          | Type                               | Default                         | Notes                                                                                   |
| -------------- | ---------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------- |
| `type`         | `'oauth2'`                         | required                        | Discriminator.                                                                          |
| `issuer`       | `string`                           | required                        | OIDC issuer URL. Discovery fetched from `<issuer>/.well-known/openid-configuration`.    |
| `clientId`     | `string`                           | required                        | Public client id. Must be registered with a redirect of `<apiUrl>/embed/callback.html`. |
| `scopes`       | `string`                           | `'openid profile email'`        | Space-separated scopes.                                                                 |
| `redirectUri`  | `string`                           | `<apiUrl>/embed/callback.html`  | Override only if you need a non-standard callback.                                      |
| `tokenStorage` | `'memory' \| 'session' \| 'local'` | `'session'`                     | Where the access token is persisted.                                                    |
| `exchangeUrl`  | `string`                           | `<apiUrl>/api/auth/embed/token` | Override the same-origin token-exchange proxy path.                                     |

### Registering a public PKCE client

Point the client registration at the widget-owned callback URL so you don't have to re-register per embed host:

- `redirect_uris`: `https://chat.cat-herding.net/embed/callback.html` (prod), optionally `http://localhost:5199/embed/callback.html` + `http://localhost:5001/embed/callback.html` for dev.
- `grant_types`: `authorization_code` (optionally `refresh_token`).
- `scope`: `openid profile email`.

### Security notes

- The widget never ships a client secret. PKCE + server-side token exchange proxy means the public JS bundle holds only the client id.
- `refresh_token` is stripped before it reaches the browser. Users sign in again when the access token expires.
- The token-exchange proxy is rate-limited per IP (30 / 5 min).
- `sessionStorage` is the default — cleared on tab close and scoped to the chat origin.

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
