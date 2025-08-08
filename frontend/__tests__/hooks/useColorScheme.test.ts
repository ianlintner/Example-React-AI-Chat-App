import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from '../../hooks/useColorScheme';

// Create mock function
const mockUseColorScheme = jest.fn();

// Mock react-native's useColorScheme
jest.mock('react-native', () => ({
  useColorScheme: mockUseColorScheme,
}));

describe('useColorScheme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the color scheme from react-native', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
    expect(mockUseColorScheme).toHaveBeenCalledTimes(1);
  });

  it('should return light theme when react-native returns light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('should return null when react-native returns null', () => {
    mockUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe(null);
  });

  it('should return undefined when react-native returns undefined', () => {
    mockUseColorScheme.mockReturnValue(undefined);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe(undefined);
  });
});
