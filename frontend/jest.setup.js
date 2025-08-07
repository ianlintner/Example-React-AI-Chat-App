import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  // The mock for `call` immediately calls the callback which is incorrect
  // So we override it with a no-op
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock Expo modules
jest.mock('expo-font');
jest.mock('expo-asset');

// Create mock for expo-web-browser
const mockOpenBrowserAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: mockOpenBrowserAsync,
}));

// Make the mock available globally
global.mockOpenBrowserAsync = mockOpenBrowserAsync;

// Mock expo-router
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    Link: React.forwardRef(({ children, href, testID, onPress, ...props }, ref) => {
      return React.createElement('Text', { 
        testID: testID || 'external-link',
        href,
        onPress,
        ref,
        ...props 
      }, children);
    }),
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
  };
});

// Mock @react-navigation/bottom-tabs and @react-navigation/elements  
jest.mock('@react-navigation/elements', () => {
  const React = require('react');
  return {
    PlatformPressable: React.forwardRef(({ children, testID, onPressIn, ...props }, ref) => {
      return React.createElement('View', {
        testID: testID || 'haptic-tab',
        accessible: true,
        onPressIn: onPressIn,
        ref,
        ...props
      }, React.createElement('Text', {}, children));
    }),
  };
});

// Create a mock function that can be accessed by tests
const mockImpactAsync = jest.fn().mockResolvedValue(undefined);

// Mock Haptics - needs to be done before the component import
jest.mock('expo-haptics', () => {
  return {
    impactAsync: mockImpactAsync,
    ImpactFeedbackStyle: {
      Light: 'light',
    },
  };
});

// Make the mock available globally for tests
global.mockImpactAsync = mockImpactAsync;

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  })),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const MockIcon = ({ name, size, color, ...props }) => {
    return React.createElement('Text', props, name);
  };
  
  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
    FontAwesome: MockIcon,
    Feather: MockIcon,
  };
});

// Mock react-native modules that might cause issues
jest.mock('react-native/Libraries/LogBox/LogBox', () => ({
  ignoreLogs: jest.fn(),
  ignoreAllLogs: jest.fn(),
}));

// Suppress warnings for deprecated modules
global.__DEV__ = true;
console.warn = jest.fn();
