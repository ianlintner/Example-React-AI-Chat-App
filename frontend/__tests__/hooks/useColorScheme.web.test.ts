import { renderHook } from '@testing-library/react-native';
import { useColorScheme } from '../../hooks/useColorScheme.web';

const mockUseColorScheme = jest.fn();
const mockUseState = jest.fn();
const mockUseEffect = jest.fn();

// Mock React hooks for this specific test file
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useEffect: mockUseEffect,
  useState: mockUseState,
}));

// Mock react-native's useColorScheme for this specific test
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: mockUseColorScheme,
}));

describe('useColorScheme.web', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockUseState.mockImplementation((initial: any) => [initial, jest.fn()]);
    mockUseEffect.mockImplementation((fn: any) => fn());
  });

  it('should return light theme when not hydrated', () => {
    mockUseColorScheme.mockReturnValue('dark');
    mockUseState.mockReturnValueOnce([false, jest.fn()]); // hasHydrated = false

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('should return actual color scheme when hydrated', () => {
    mockUseColorScheme.mockReturnValue('dark');
    mockUseState.mockReturnValueOnce([true, jest.fn()]); // hasHydrated = true

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('dark');
  });

  it('should return light color scheme when hydrated and RN returns light', () => {
    mockUseColorScheme.mockReturnValue('light');
    mockUseState.mockReturnValueOnce([true, jest.fn()]); // hasHydrated = true

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe('light');
  });

  it('should return null when hydrated and RN returns null', () => {
    mockUseColorScheme.mockReturnValue(null);
    mockUseState.mockReturnValueOnce([true, jest.fn()]); // hasHydrated = true

    const { result } = renderHook(() => useColorScheme());

    expect(result.current).toBe(null);
  });

  it('should call useEffect to set hydration state', () => {
    const setHasHydrated = jest.fn();
    mockUseState.mockReturnValueOnce([false, setHasHydrated]);
    mockUseColorScheme.mockReturnValue('dark');

    renderHook(() => useColorScheme());

    expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), []);

    // Call the useEffect callback manually to test it
    const effectCallback = mockUseEffect.mock.calls[0][0];
    effectCallback();

    expect(setHasHydrated).toHaveBeenCalledWith(true);
  });
});
