import request from 'supertest';
import express from 'express';
import embedAuthRouter from '../embedAuth';

describe('Embed Auth Token Exchange', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/embed', embedAuthRouter);

  const origFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = origFetch;
    jest.resetAllMocks();
  });

  const mkResponse = (status: number, body: unknown) =>
    ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    }) as unknown as Response;

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/embed/token').send({
      code: 'x',
      // code_verifier, redirect_uri, client_id missing
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards valid exchanges to the issuer and strips refresh_token', async () => {
    fetchMock.mockResolvedValue(
      mkResponse(200, {
        access_token: 'abc.def.ghi',
        id_token: 'id.jwt.here',
        refresh_token: 'long-lived-secret',
        expires_in: 1800,
        token_type: 'Bearer',
      }),
    );

    const res = await request(app).post('/api/auth/embed/token').send({
      code: 'authcode',
      code_verifier: 'verifier-xyz',
      redirect_uri: 'https://chat.cat-herding.net/embed/callback.html',
      client_id: 'client-foo',
    });

    expect(res.status).toBe(200);
    expect(res.body.access_token).toBe('abc.def.ghi');
    expect(res.body.refresh_token).toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/oauth\/token$/);
    expect((init as RequestInit).method).toBe('POST');
    const body = String((init as RequestInit).body || '');
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('code=authcode');
    expect(body).toContain('code_verifier=verifier-xyz');
    expect(body).toContain('client_id=client-foo');
  });

  it('propagates upstream error status and body', async () => {
    fetchMock.mockResolvedValue(
      mkResponse(400, {
        error: 'invalid_grant',
        error_description: 'Code expired',
      }),
    );

    const res = await request(app).post('/api/auth/embed/token').send({
      code: 'bad',
      code_verifier: 'v',
      redirect_uri: 'https://chat.cat-herding.net/embed/callback.html',
      client_id: 'client-foo',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_grant');
    expect(res.body.error_description).toBe('Code expired');
  });

  it('returns 502 when the upstream is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).post('/api/auth/embed/token').send({
      code: 'x',
      code_verifier: 'v',
      redirect_uri: 'https://chat.cat-herding.net/embed/callback.html',
      client_id: 'client-foo',
    });

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('bad_gateway');
  });
});
