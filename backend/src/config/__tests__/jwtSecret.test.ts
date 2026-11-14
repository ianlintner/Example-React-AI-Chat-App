import { getJwtSecret, assertJwtSecretConfigured } from '../jwtSecret';

describe('jwtSecret', () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    }
  });

  it('returns the configured secret', () => {
    process.env.JWT_SECRET = 'configured-secret';
    expect(getJwtSecret()).toBe('configured-secret');
  });

  it('throws when JWT_SECRET is missing (no default fallback)', () => {
    delete process.env.JWT_SECRET;
    expect(() => getJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it('startup assertion throws outside test when missing', () => {
    delete process.env.JWT_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    expect(() => assertJwtSecretConfigured()).toThrow(/JWT_SECRET/);
  });

  it('startup assertion is skipped under test', () => {
    delete process.env.JWT_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    expect(() => assertJwtSecretConfigured()).not.toThrow();
  });
});
