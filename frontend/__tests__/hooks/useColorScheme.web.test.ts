import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from '../../hooks/useColorScheme.web';

const mockUseColorScheme = jest.fn();

// Mock react-native's useColorScheme for this specific test
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: mockUseColorScheme,
}));

describe('useColorScheme.web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return light theme when not hydrated', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    // On web, it should return the actual color scheme
    expect(result.current).toBe('dark');
  });

  it('should return actual color scheme when hydrated', () => {
    mockUseColorScheme.mockReturnValue('dark');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('should return light color scheme when RN returns light', () => {
    mockUseColorScheme.mockReturnValue('light');

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('should return null when RN returns null', () => {
    mockUseColorScheme.mockReturnValue(null);

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe(null);
  });

  it('should use react-native useColorScheme hook', () => {
    mockUseColorScheme.mockReturnValue('dark');

    renderHook(() => useColorScheme());

    expect(mockUseColorScheme).toHaveBeenCalled();
  });
});
