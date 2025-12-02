import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import { UserProfile } from '../../components/UserProfile';
import { authService } from '../../services/authService';

// Mock authService
jest.mock('../../services/authService', () => ({
  authService: {
    getUser: jest.fn(),
    getToken: jest.fn(),
    fetchCurrentUser: jest.fn(),
    setUser: jest.fn(),
    logout: jest.fn(),
  },
}));

// Mock window for logout redirect
global.window = {
  location: {
    href: '',
  },
} as any;

describe('UserProfile', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: 'https://github.com/avatar.png',
    provider: 'github' as const,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (authService.getToken as jest.Mock).mockResolvedValue(null);
    (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(null);
    (authService.setUser as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('should not render when no user is available', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(null);
      const view = render(<UserProfile />);

      await waitFor(() => {
        expect(view.toJSON()).toBeNull();
      });
    });

    it('should render user profile with avatar', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      render(<UserProfile />);

      expect(await screen.findByText('Test User')).toBeTruthy();
      expect(await screen.findByText('test@example.com')).toBeTruthy();
    });

    it('should render text avatar when no image available', async () => {
      const userWithoutAvatar = { ...mockUser, avatar: undefined };
      (authService.getUser as jest.Mock).mockResolvedValue(userWithoutAvatar);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(userWithoutAvatar);

      render(<UserProfile />);

      expect(await screen.findByText('Test User')).toBeTruthy();
      // Text avatar should show first two letters of name
      expect(await screen.findByText('TE')).toBeTruthy();
    });

    it('should fetch user from API if not cached', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(null);
      (authService.getToken as jest.Mock).mockResolvedValue('token123');
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      render(<UserProfile />);

      await waitFor(() => {
        expect(authService.fetchCurrentUser).toHaveBeenCalledWith('token123');
        expect(authService.setUser).toHaveBeenCalledWith(mockUser);
      });

      expect(await screen.findByText('Test User')).toBeTruthy();
    });
  });

  describe('User Avatar Display', () => {
    it('should display GitHub avatar image when available', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const { UNSAFE_getByProps } = render(<UserProfile />);

      await waitFor(() => {
        const avatarImage = UNSAFE_getByProps({
          source: { uri: 'https://github.com/avatar.png' },
        });
        expect(avatarImage).toBeTruthy();
      });
    });

    it('should display initials when avatar not available', async () => {
      const userNoAvatar = { ...mockUser, avatar: undefined };
      (authService.getUser as jest.Mock).mockResolvedValue(userNoAvatar);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(userNoAvatar);

      render(<UserProfile />);

      expect(await screen.findByText('TE')).toBeTruthy();
    });

    it('should handle single name for initials', async () => {
      const userSingleName = { ...mockUser, name: 'John', avatar: undefined };
      (authService.getUser as jest.Mock).mockResolvedValue(userSingleName);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(userSingleName);

      render(<UserProfile />);

      expect(await screen.findByText('JO')).toBeTruthy();
    });
  });

  describe('Menu Interaction', () => {
    it('should open menu when profile is clicked', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      render(<UserProfile />);

      expect(await screen.findByText('Test User')).toBeTruthy();

      const profileButton = screen.getByText('Test User').parent?.parent;
      fireEvent.press(profileButton!);

      expect(await screen.findByText('Profile Settings')).toBeTruthy();
      expect(await screen.findByText('Sign Out')).toBeTruthy();
    });

    it('should handle logout when Sign Out is clicked', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser);
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      render(<UserProfile />);

      expect(await screen.findByText('Test User')).toBeTruthy();

      // Open menu
      const profileButton = screen.getByText('Test User').parent?.parent;
      fireEvent.press(profileButton!);

      expect(await screen.findByText('Sign Out')).toBeTruthy();

      // Click logout
      const logoutButton = screen.getByText('Sign Out');
      fireEvent.press(logoutButton);

      await waitFor(() => {
        expect(authService.logout).toHaveBeenCalled();
        expect(global.window.location.href).toBe('/oauth2/sign_out');
      });
    });
  });

  describe('User Info Display', () => {
    it('should truncate long email addresses', async () => {
      const longEmailUser = {
        ...mockUser,
        email: 'verylongemailaddress@example-domain.com',
      };
      (authService.getUser as jest.Mock).mockResolvedValue(longEmailUser);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(longEmailUser);

      render(<UserProfile />);

      const emailText = await screen.findByText(
        'verylongemailaddress@example-domain.com',
      );
      expect(emailText.props.numberOfLines).toBe(1);
    });

    it('should truncate long usernames', async () => {
      const longNameUser = {
        ...mockUser,
        name: 'Very Long Username That Should Be Truncated',
      };
      (authService.getUser as jest.Mock).mockResolvedValue(longNameUser);
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(longNameUser);

      render(<UserProfile />);

      const nameText = await screen.findByText(
        'Very Long Username That Should Be Truncated',
      );
      expect(nameText.props.numberOfLines).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(null);
      (authService.getToken as jest.Mock).mockResolvedValue('token123');
      (authService.fetchCurrentUser as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const view = render(<UserProfile />);

      await waitFor(() => {
        expect(view.toJSON()).toBeNull();
      });
    });

    it('should handle missing user data gracefully', async () => {
      (authService.getUser as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const view = render(<UserProfile />);

      await waitFor(() => {
        expect(view.toJSON()).toBeNull();
      });
    });
  });
});
