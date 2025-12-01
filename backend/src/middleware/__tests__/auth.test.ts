import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../auth';
import userStorage from '../../storage/userStorage';

// Mock dependencies
jest.mock('../../logger');
jest.mock('../../storage/userStorage');

// Mock fetch for GitHub API calls
global.fetch = jest.fn();

describe('Auth Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    describe('OAuth2 Proxy Headers Authentication', () => {
      it('should authenticate user via oauth2-proxy headers', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'github' as const,
          providerId: 'testuser',
          createdAt: new Date(),
        };

        mockRequest.headers = {
          'x-auth-request-email': 'test@example.com',
          'x-auth-request-user': 'testuser',
          'x-auth-request-preferred-username': 'Test User',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (userStorage.updateUser as jest.Mock).mockResolvedValue(mockUser);

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(mockRequest.user).toEqual(mockUser);
        expect(mockRequest.userId).toBe('user-123');
        expect(mockNext).toHaveBeenCalled();
        expect(mockResponse.status).not.toHaveBeenCalled();
      });

      it('should fetch GitHub avatar for new users', async () => {
        const mockGitHubResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ avatar_url: 'https://github.com/avatar.png' }),
        };

        (global.fetch as jest.Mock).mockResolvedValue(mockGitHubResponse);

        mockRequest.headers = {
          'x-auth-request-email': 'newuser@example.com',
          'x-auth-request-user': 'newuser',
          'x-auth-request-access-token': 'github_token_123',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
        (userStorage.createUser as jest.Mock).mockResolvedValue({
          id: 'user-new',
          email: 'newuser@example.com',
          name: 'newuser',
          avatar: 'https://github.com/avatar.png',
          provider: 'github',
          providerId: 'newuser',
          createdAt: new Date(),
        });

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.github.com/users/newuser',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'token github_token_123',
            }),
          }),
        );

        expect(userStorage.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            avatar: 'https://github.com/avatar.png',
          }),
        );

        expect(mockNext).toHaveBeenCalled();
      });

      it('should update existing user avatar if changed', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          avatar: 'https://old-avatar.png',
          provider: 'github' as const,
          providerId: 'testuser',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };

        const mockGitHubResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ avatar_url: 'https://new-avatar.png' }),
        };

        (global.fetch as jest.Mock).mockResolvedValue(mockGitHubResponse);

        mockRequest.headers = {
          'x-auth-request-email': 'test@example.com',
          'x-auth-request-user': 'testuser',
          'x-auth-request-access-token': 'github_token_123',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (userStorage.updateUser as jest.Mock).mockResolvedValue({
          ...mockUser,
          avatar: 'https://new-avatar.png',
        });

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(userStorage.updateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            avatar: 'https://new-avatar.png',
          }),
        );

        expect(mockNext).toHaveBeenCalled();
      });

      it('should handle GitHub API failure gracefully', async () => {
        const mockGitHubResponse = {
          ok: false,
          status: 404,
        };

        (global.fetch as jest.Mock).mockResolvedValue(mockGitHubResponse);

        mockRequest.headers = {
          'x-auth-request-email': 'test@example.com',
          'x-auth-request-user': 'testuser',
          'x-auth-request-access-token': 'github_token_123',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
        (userStorage.createUser as jest.Mock).mockResolvedValue({
          id: 'user-new',
          email: 'test@example.com',
          name: 'testuser',
          avatar: undefined,
          provider: 'github',
          providerId: 'testuser',
          createdAt: new Date(),
        });

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(userStorage.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            avatar: undefined,
          }),
        );

        expect(mockNext).toHaveBeenCalled();
      });

      it('should support Google provider', async () => {
        mockRequest.headers = {
          'x-auth-request-email': 'google@example.com',
          'x-auth-request-user': 'googleuser',
          'x-auth-request-provider': 'google',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
        (userStorage.createUser as jest.Mock).mockResolvedValue({
          id: 'user-google',
          email: 'google@example.com',
          name: 'googleuser',
          provider: 'google',
          providerId: 'googleuser',
          createdAt: new Date(),
        });

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(userStorage.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'google',
          }),
        );

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Missing Authentication', () => {
      it('should return 401 when no auth headers or token provided', async () => {
        mockRequest.headers = {};

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({
          error: 'Authentication required',
        });
        expect(mockNext).not.toHaveBeenCalled();
      });
    });
  });

  describe('GitHub Profile Fetching', () => {
    it('should include proper headers in GitHub API request', async () => {
      const mockGitHubResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ avatar_url: 'https://avatar.png' }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockGitHubResponse);

      mockRequest.headers = {
        'x-auth-request-email': 'test@example.com',
        'x-auth-request-user': 'testuser',
        'x-auth-request-access-token': 'token123',
      };

      (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
      (userStorage.createUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'testuser',
        avatar: 'https://avatar.png',
        provider: 'github',
        providerId: 'testuser',
        createdAt: new Date(),
      });

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/users/testuser',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Chat-App',
            Authorization: 'token token123',
          },
        },
      );
    });

    it('should work without access token', async () => {
      const mockGitHubResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ avatar_url: 'https://avatar.png' }),
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockGitHubResponse);

      mockRequest.headers = {
        'x-auth-request-email': 'test@example.com',
        'x-auth-request-user': 'testuser',
      };

      (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
      (userStorage.createUser as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'testuser',
        avatar: 'https://avatar.png',
        provider: 'github',
        providerId: 'testuser',
        createdAt: new Date(),
      });

      await authenticateToken(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/users/testuser',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-Chat-App',
          },
        },
      );
    });
  });
});
