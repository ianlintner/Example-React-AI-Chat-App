import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../auth';
import userStorage from '../../storage/userStorage';

// Mock dependencies
jest.mock('../../logger');
jest.mock('../../storage/userStorage');

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
    describe('Istio Headers Authentication', () => {
      it('should authenticate user via Istio headers', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          provider: 'oauth2' as const,
          providerId: 'testuser',
          createdAt: new Date(),
        };

        mockRequest.headers = {
          'x-auth-subject': 'testuser',
          'x-auth-email': 'test@example.com',
          'x-auth-name': 'Test User',
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

      it('should create new user if not found', async () => {
        mockRequest.headers = {
          'x-auth-subject': 'newuser',
          'x-auth-email': 'newuser@example.com',
          'x-auth-name': 'New User',
          'x-auth-picture': 'https://example.com/avatar.png',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(null);
        (userStorage.createUser as jest.Mock).mockResolvedValue({
          id: 'user-new',
          email: 'newuser@example.com',
          name: 'New User',
          avatar: 'https://example.com/avatar.png',
          provider: 'oauth2',
          providerId: 'newuser',
          createdAt: new Date(),
        });

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(userStorage.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'newuser@example.com',
            name: 'New User',
            provider: 'oauth2',
            providerId: 'newuser',
            avatar: 'https://example.com/avatar.png',
          }),
        );

        expect(mockNext).toHaveBeenCalled();
      });

      it('should update existing user info if changed', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'test@example.com',
          name: 'Old Name',
          avatar: 'https://old-avatar.png',
          provider: 'oauth2' as const,
          providerId: 'testuser',
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };

        mockRequest.headers = {
          'x-auth-subject': 'testuser',
          'x-auth-email': 'test@example.com',
          'x-auth-name': 'New Name',
          'x-auth-picture': 'https://new-avatar.png',
        };

        (userStorage.getUserByProvider as jest.Mock).mockResolvedValue(
          mockUser,
        );
        (userStorage.updateUser as jest.Mock).mockResolvedValue({
          ...mockUser,
          name: 'New Name',
          avatar: 'https://new-avatar.png',
        });

        await authenticateToken(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );

        expect(userStorage.updateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'New Name',
            avatar: 'https://new-avatar.png',
          }),
        );

        expect(mockNext).toHaveBeenCalled();
      });
    });

    describe('Missing Authentication', () => {
      it('should return 401 when no auth headers provided', async () => {
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
});
