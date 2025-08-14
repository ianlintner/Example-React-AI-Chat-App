import { renderHook } from '@testing-library/react-native';
import { useThemeColor } from '../../hooks/useThemeColor';

// Mock the useColorScheme hook
jest.mock('@/hooks/useColorScheme', () => ({
  useColorScheme: jest.fn(),
}));

// Mock the Colors constant
jest.mock('@/constants/Colors', () => ({
  Colors: {
    light: {
      background: '#FFFFFF',
      text: '#000000',
      tint: '#007AFF',
    },
    dark: {
      background: '#000000',
      text: '#FFFFFF',
      tint: '#007AFF',
    },
  },
}));

import { useColorScheme } from '@/hooks/useColorScheme';

const mockUseColorScheme = useColorScheme as jest.MockedFunction<
  typeof useColorScheme
>;

describe('useThemeColor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns light color when theme is light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() =>
      useThemeColor({ light: '#FFFFFF', dark: '#000000' }, 'background'),
    );

    expect(result.current).toBe('#FFFFFF');
  });

  it('returns dark color when theme is dark', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() =>
      useThemeColor({ light: '#FFFFFF', dark: '#000000' }, 'background'),
    );

    expect(result.current).toBe('#000000');
  });

  it('falls back to Colors constant when no props provided', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useThemeColor({}, 'background'));

    expect(result.current).toBe('#FFFFFF');
  });

  it('defaults to light theme when useColorScheme returns null', () => {
    mockUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() =>
      useThemeColor({ light: '#FFFFFF', dark: '#000000' }, 'background'),
    );

    expect(result.current).toBe('#FFFFFF');
  });

  it('prioritizes prop colors over Colors constant', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() =>
      useThemeColor({ light: '#FF0000' }, 'background'),
    );

    expect(result.current).toBe('#FF0000');
  });
});
