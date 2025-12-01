import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { UserProfile } from '../../components/UserProfile';
import { authService } from '../../services/authService';

// Mock authService
jest.mock('../../services/authService', () => ({
  authService: {
    getUser: jest.fn(),
    getToken: jest.fn(),
    fetchCurrentUser: jest.fn(),
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
  });

  describe('Rendering', () => {
    it('should not render when no user is available', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(null);
      (authService.getToken as jest.Mock).mockResolvedValue(null);

      const { container } = render(<UserProfile />);

      await waitFor(() => {
        expect(container.children.length).toBe(0);
      });
    });

    it('should render user profile with avatar', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeTruthy();
        expect(screen.getByText('test@example.com')).toBeTruthy();
      });
    });

    it('should render text avatar when no image available', async () => {
      const userWithoutAvatar = { ...mockUser, avatar: undefined };
      (authService.getUser as jest.Mock).mockResolvedValue(userWithoutAvatar);

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeTruthy();
        // Text avatar should show first two letters of name
        expect(screen.getByText('TE')).toBeTruthy();
      });
    });

    it('should fetch user from API if not cached', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(null);
      (authService.getToken as jest.Mock).mockResolvedValue('token123');
      (authService.fetchCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      render(<UserProfile />);

      await waitFor(() => {
        expect(authService.fetchCurrentUser).toHaveBeenCalledWith('token123');
        expect(screen.getByText('Test User')).toBeTruthy();
      });
    });
  });

  describe('User Avatar Display', () => {
    it('should display GitHub avatar image when available', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);

      const { UNSAFE_getByProps } = render(<UserProfile />);

      await waitFor(() => {
        const avatarImage = UNSAFE_getByProps({ source: { uri: 'https://github.com/avatar.png' } });
        expect(avatarImage).toBeTruthy();
      });
    });

    it('should display initials when avatar not available', async () => {
      const userNoAvatar = { ...mockUser, avatar: undefined };
      (authService.getUser as jest.Mock).mockResolvedValue(userNoAvatar);

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('TE')).toBeTruthy();
      });
    });

    it('should handle single name for initials', async () => {
      const userSingleName = { ...mockUser, name: 'John', avatar: undefined };
      (authService.getUser as jest.Mock).mockResolvedValue(userSingleName);

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('JO')).toBeTruthy();
      });
    });
  });

  describe('Menu Interaction', () => {
    it('should open menu when profile is clicked', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeTruthy();
      });

      const profileButton = screen.getByText('Test User').parent?.parent;
      fireEvent.press(profileButton!);

      await waitFor(() => {
        expect(screen.getByText('Profile Settings')).toBeTruthy();
        expect(screen.getByText('Sign Out')).toBeTruthy();
      });
    });

    it('should handle logout when Sign Out is clicked', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(mockUser);
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      render(<UserProfile />);

      await waitFor(() => {
        expect(screen.getByText('Test User')).toBeTruthy();
      });

      // Open menu
      const profileButton = screen.getByText('Test User').parent?.parent;
      fireEvent.press(profileButton!);

      await waitFor(() => {
        expect(screen.getByText('Sign Out')).toBeTruthy();
      });

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

      render(<UserProfile />);

      await waitFor(() => {
        const emailText = screen.getByText('verylongemailaddress@example-domain.com');
        expect(emailText.props.numberOfLines).toBe(1);
      });
    });

    it('should truncate long usernames', async () => {
      const longNameUser = {
        ...mockUser,
        name: 'Very Long Username That Should Be Truncated',
      };
      (authService.getUser as jest.Mock).mockResolvedValue(longNameUser);

      render(<UserProfile />);

      await waitFor(() => {
        const nameText = screen.getByText('Very Long Username That Should Be Truncated');
        expect(nameText.props.numberOfLines).toBe(1);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (authService.getUser as jest.Mock).mockResolvedValue(null);
      (authService.getToken as jest.Mock).mockResolvedValue('token123');
      (authService.fetchCurrentUser as jest.Mock).mockRejectedValue(
        new Error('Network error'),
      );

      const { container } = render(<UserProfile />);

      await waitFor(() => {
        expect(container.children.length).toBe(0);
      });
    });

    it('should handle missing user data gracefully', async () => {
      (authService.getUser as jest.Mock).mockRejectedValue(
        new Error('Storage error'),
      );

      const { container } = render(<UserProfile />);

      await waitFor(() => {
        expect(container.children.length).toBe(0);
      });
    });
  });
});
