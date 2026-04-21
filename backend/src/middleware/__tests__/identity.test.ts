import { Request, Response, NextFunction } from 'express';
import { validate as uuidValidate } from 'uuid';
import {
  resolveIdentity,
  requireAuthenticated,
  ANON_COOKIE,
} from '../identity';
import userStorage from '../../storage/userStorage';

jest.mock('../../logger');
jest.mock('../../storage/userStorage');

describe('identity middleware', () => {
  let req: Partial<Request> & {
    cookies?: Record<string, string>;
    headers: Record<string, string | undefined>;
  };
  let res: Partial<Response> & { cookie: jest.Mock };
  let next: jest.Mock;

  beforeEach(() => {
    req = { headers: {}, cookies: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    } as unknown as Partial<Response> & { cookie: jest.Mock };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('resolveIdentity — authenticated path', () => {
    it('hydrates an existing user from Istio headers and sets tier=authenticated', async () => {
      const existing = {
        id: 'user-1',
        email: 'a@b.com',
        name: 'Alice',
        provider: 'oauth2',
        providerId: 'sub-1',
        createdAt: new Date(),
      };
      req.headers = {
        'x-auth-subject': 'sub-1',
        'x-auth-email': 'a@b.com',
        'x-auth-name': 'Alice',
      };
      (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(existing);

      await resolveIdentity(req as Request, res as Response, next);

      expect(req.tier).toBe('authenticated');
      expect(req.isAnonymous).toBe(false);
      expect(req.userId).toBe('user-1');
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('creates a new user when Istio sub is unknown', async () => {
      req.headers = {
        'x-auth-subject': 'new-sub',
        'x-auth-email': 'n@b.com',
        'x-auth-name': 'Newbie',
      };
      (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
      (userStorage.createUser as jest.Mock).mockResolvedValue({
        id: 'user-new',
        email: 'n@b.com',
        name: 'Newbie',
        provider: 'oauth2',
        providerId: 'new-sub',
        createdAt: new Date(),
      });

      await resolveIdentity(req as Request, res as Response, next);

      expect(userStorage.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: 'new-sub' }),
      );
      expect(req.tier).toBe('authenticated');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('resolveIdentity — anonymous path', () => {
    it('mints a new UUID anon id and sets the _chat_anon cookie when none present', async () => {
      await resolveIdentity(req as Request, res as Response, next);

      expect(req.tier).toBe('anonymous');
      expect(req.isAnonymous).toBe(true);
      expect(req.userId).toMatch(/^anon_/);
      expect(res.cookie).toHaveBeenCalledWith(
        ANON_COOKIE.name,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: ANON_COOKIE.maxAgeMs,
        }),
      );
      const [, id] = (res.cookie as jest.Mock).mock.calls[0];
      expect(uuidValidate(id)).toBe(true);
      expect(userStorage.createUser).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('reuses an existing valid anon cookie and refreshes expiry', async () => {
      const existingId = '123e4567-e89b-42d3-a456-426614174000';
      req.cookies = { [ANON_COOKIE.name]: existingId };

      await resolveIdentity(req as Request, res as Response, next);

      expect(req.userId).toBe(`anon_${existingId}`);
      expect(res.cookie).toHaveBeenCalledWith(
        ANON_COOKIE.name,
        existingId,
        expect.objectContaining({ maxAge: ANON_COOKIE.maxAgeMs }),
      );
    });

    it('rejects a malformed cookie value and mints a fresh id', async () => {
      req.cookies = { [ANON_COOKIE.name]: 'not-a-uuid' };

      await resolveIdentity(req as Request, res as Response, next);

      const [, id] = (res.cookie as jest.Mock).mock.calls[0];
      expect(id).not.toBe('not-a-uuid');
      expect(uuidValidate(id)).toBe(true);
      expect(req.userId).toBe(`anon_${id}`);
    });

    it('does NOT persist anon users in userStorage', async () => {
      await resolveIdentity(req as Request, res as Response, next);
      expect(userStorage.createUser).not.toHaveBeenCalled();
      expect(userStorage.updateUser).not.toHaveBeenCalled();
      expect(userStorage.getUserByProvider).not.toHaveBeenCalled();
    });
  });

  describe('requireAuthenticated', () => {
    it('passes through when tier=authenticated', () => {
      req.tier = 'authenticated';
      requireAuthenticated(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 401 when tier=anonymous', () => {
      req.tier = 'anonymous';
      requireAuthenticated(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when tier is unset', () => {
      requireAuthenticated(req as Request, res as Response, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
