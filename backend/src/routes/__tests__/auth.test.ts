import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../auth';

describe('GET /api/auth/session', () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
  });

  afterEach(() => {
    delete process.env.LOGIN_URL;
  });

  it('returns anonymous tier + Guest user + loginUrl when no x-auth-subject header', async () => {
    const res = await request(app).get('/api/auth/session');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('anonymous');
    expect(res.body.authenticated).toBe(false);
    expect(res.body.user).toMatchObject({
      id: expect.stringMatching(/^anon_/),
      name: 'Guest',
      provider: 'anonymous',
    });
    expect(res.body.loginUrl).toBe('/oauth2/start');
    // Anon cookie should be set so subsequent calls are stable.
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(
      Array.isArray(setCookie)
        ? setCookie.join(';')
        : (setCookie as unknown as string),
    ).toMatch(/_chat_anon=/);
  });

  it('honours LOGIN_URL env override', async () => {
    process.env.LOGIN_URL = 'https://auth.example.com/login';
    const res = await request(app).get('/api/auth/session');
    expect(res.body.loginUrl).toBe('https://auth.example.com/login');
  });

  it('returns authenticated tier when Istio headers are present', async () => {
    const res = await request(app)
      .get('/api/auth/session')
      .set('x-auth-subject', 'subject-xyz')
      .set('x-auth-email', 'alice@example.com')
      .set('x-auth-name', 'Alice');

    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('authenticated');
    expect(res.body.authenticated).toBe(true);
    expect(res.body.user).toMatchObject({
      email: 'alice@example.com',
      name: 'Alice',
    });
    expect(res.body.loginUrl).toBeNull();
  });
});
