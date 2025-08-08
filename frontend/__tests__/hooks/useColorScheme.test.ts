import { renderHook } from '@testing-library/react-native';

// Mock react-native's useColorScheme before importing the hook
const mockUseColorScheme = jest.fn();

jest.mock('react-native', () => ({
  useColorScheme: mockUseColorScheme,
}));

// Import after mocking
import { useColorScheme } from '../../hooks/useColorScheme';

describe('useColorScheme', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export useColorScheme from react-native', () => {
    expect(typeof useColorScheme).toBe('function');
  });

  it('should return light by default in web environment (before hydration)', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    // In web environment (jsdom), the hook returns 'light' initially before hydration
    expect(result.current).toBe('light');
  });

  it('should return light when mocked to return light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    // Web version always returns 'light' initially
    expect(result.current).toBe('light');
  });

  it('should handle null values gracefully', () => {
    mockUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() => useColorScheme());

    // Web version returns 'light' even when underlying value is null (before hydration)
    expect(result.current).toBe('light');
  });
});
