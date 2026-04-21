import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../logger';

/**
 * Token-exchange proxy for the embeddable chat widget.
 *
 * The public roauth2 server accepts PKCE-only token requests (no client
 * secret required), but does not set CORS headers permitting the chat
 * origin to POST directly from the browser. This endpoint sits same-origin
 * with the widget and forwards the code+verifier to roauth2 so the browser
 * never has to cross into the auth server.
 *
 * Security posture:
 *   - Public (no authenticateToken) — the user IS in the middle of signing in.
 *   - Tight rate limit per IP to discourage spray attacks.
 *   - `refresh_token` is stripped before returning to the browser; short-
 *     lived access tokens limit the blast radius if the bundle is XSS'd.
 */

const router = Router();

const EMBED_OAUTH2_ISSUER =
  process.env.EMBED_OAUTH2_ISSUER || 'https://roauth2.cat-herding.net';

const exchangeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ ip: req.ip }, 'Embed auth exchange rate limit exceeded');
    res.status(429).json({
      error: 'too_many_requests',
      error_description:
        'Too many sign-in attempts from this IP. Please try again later.',
    });
  },
});

interface ExchangeBody {
  code?: string;
  code_verifier?: string;
  redirect_uri?: string;
  client_id?: string;
}

router.post('/token', exchangeLimiter, async (req: Request, res: Response) => {
  const { code, code_verifier, redirect_uri, client_id } =
    (req.body as ExchangeBody) || {};

  if (!code || !code_verifier || !redirect_uri || !client_id) {
    res.status(400).json({
      error: 'invalid_request',
      error_description:
        'code, code_verifier, redirect_uri, and client_id are required',
    });
    return;
  }

  const tokenUrl = `${EMBED_OAUTH2_ISSUER.replace(/\/$/, '')}/oauth/token`;

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier,
    redirect_uri,
    client_id,
  });

  try {
    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });

    const text = await upstream.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(text);
    } catch {
      logger.warn(
        { status: upstream.status, tokenUrl },
        'Embed auth upstream returned non-JSON',
      );
      res.status(502).json({
        error: 'bad_gateway',
        error_description: 'Upstream authorization server returned non-JSON',
      });
      return;
    }

    if (!upstream.ok) {
      logger.info(
        { status: upstream.status, error: payload.error },
        'Embed auth upstream error',
      );
      res.status(upstream.status).json(payload);
      return;
    }

    // Strip long-lived refresh_token before handing back to the browser to
    // limit XSS blast radius. Users can sign in again when the access token
    // expires.
    if ('refresh_token' in payload) {
      delete payload.refresh_token;
    }

    res.json(payload);
  } catch (err) {
    logger.error({ err }, 'Embed auth exchange failed');
    res.status(502).json({
      error: 'bad_gateway',
      error_description: 'Upstream authorization server unreachable',
    });
  }
});

export default router;
