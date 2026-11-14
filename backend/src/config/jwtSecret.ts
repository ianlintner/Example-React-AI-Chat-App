/**
 * JWT secret accessor. Fails closed: there is no default secret.
 * Call assertJwtSecretConfigured() at startup so a misconfigured
 * deployment crashes immediately instead of signing with a known value.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required but not set');
  }
  return secret;
}

/** Throws at startup when JWT_SECRET is missing (skipped under test). */
export function assertJwtSecretConfigured(): void {
  if (process.env.NODE_ENV === 'test') {
    return;
  }
  getJwtSecret();
}
