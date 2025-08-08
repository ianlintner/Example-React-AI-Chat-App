import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

// Global React setup
global.React = require('react');

// Mock React Native completely
jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn((styles) => styles),
    flatten: jest.fn((style) => style),
    compose: jest.fn((style1, style2) => [style1, style2]),
    absoluteFill: {},
    absoluteFillObject: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
    hairlineWidth: 1,
  },

  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 667, scale: 2, fontScale: 1 })),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },

  PixelRatio: {
    get: jest.fn(() => 2),
    getFontScale: jest.fn(() => 1),
    getPixelSizeForLayoutSize: jest.fn((layoutSize) => layoutSize * 2),
    roundToNearestPixel: jest.fn((layoutSize) => Math.round(layoutSize)),
  },

  Platform: {
    OS: 'ios',
    Version: '14.0',
    select: jest.fn((options) => options.ios || options.default),
    isPad: false,
    isTesting: true,
    isTV: false,
  },

  AppState: {
    currentState: 'active',
    isAvailable: true,
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    removeEventListener: jest.fn(),
  },

  Alert: {
    alert: jest.fn(),
    prompt: jest.fn(),
  },

  // Core components - using strings for simplicity
  View: 'View',
  Text: 'Text',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  SectionList: 'SectionList',
  TouchableOpacity: 'TouchableOpacity',
  TouchableHighlight: 'TouchableHighlight',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  Image: 'Image',
  ImageBackground: 'ImageBackground',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  SafeAreaView: 'SafeAreaView',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Modal: 'Modal',
  Switch: 'Switch',
  Slider: 'Slider',
  StatusBar: 'StatusBar',
}));

// Mock @react-native-picker/picker
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const MockPicker = ({ children, onValueChange, selectedValue, style, testID, ...props }) => {
    return React.createElement('View', { 
      testID: testID || 'picker',
      style,
      ...props,
      // Simulate picker behavior
      onPress: () => {
        // Mock selecting the first item if onValueChange exists
        if (onValueChange && children && children.length > 0) {
          const firstChild = Array.isArray(children) ? children[0] : children;
          if (firstChild && firstChild.props && firstChild.props.value) {
            onValueChange(firstChild.props.value);
          }
        }
      }
    }, children);
  };
  
  MockPicker.Item = ({ label, value, ...props }) => {
    return React.createElement('Text', { 
      testID: 'picker-item',
      ...props
    }, label);
  };

  return {
    Picker: MockPicker,
  };
});

// Mock react-native-paper components
jest.mock('react-native-paper', () => ({
  Avatar: 'Avatar',
  Chip: 'Chip',
  Button: 'Button',
  Card: 'Card',
  Text: 'Text',
  Surface: 'Surface',
  Appbar: {
    Header: 'AppbarHeader',
    Content: 'AppbarContent',
    Action: 'AppbarAction',
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ width: 375, height: 667, x: 0, y: 0 }),
}));

// Mock react-native-markdown-display
jest.mock('react-native-markdown-display', () => 'Markdown');

// Mock expo-web-browser
const mockOpenBrowserAsync = jest.fn();
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: mockOpenBrowserAsync,
  dismissBrowser: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

// Make mockOpenBrowserAsync available globally for tests
global.mockOpenBrowserAsync = mockOpenBrowserAsync;

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      name: 'Test App',
      version: '1.0.0',
    },
    manifest: {
      name: 'Test App',
      version: '1.0.0',
    },
  },
  Constants: {
    expoConfig: {
      name: 'Test App',
      version: '1.0.0',
    },
    manifest: {
      name: 'Test App',
      version: '1.0.0',
    },
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impact: jest.fn(),
  notification: jest.fn(),
  selection: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

// Mock expo-modules-core
jest.mock('expo-modules-core', () => ({
  NativeModulesProxy: {},
}));

// Mock useColorScheme hook for React Native
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => {
  return {
    __esModule: true,
    default: jest.fn(() => 'light'),
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const mockCreateAnimatedComponent = (Component) => Component;
  
  return {
    default: {
      createAnimatedComponent: mockCreateAnimatedComponent,
      Value: jest.fn(),
      event: jest.fn(),
      add: jest.fn(),
      eq: jest.fn(),
      set: jest.fn(),
      cond: jest.fn(),
      interpolate: jest.fn(),
      View: 'ReanimatedView',
      Extrapolate: { CLAMP: jest.fn() },
      Transition: {
        Together: 'Together',
        Out: 'Out',
        In: 'In',
      },
      Easing: {
        in: jest.fn(),
        out: jest.fn(),
        inOut: jest.fn(),
      },
    },
    createAnimatedComponent: mockCreateAnimatedComponent,
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    useAnimatedGestureHandler: jest.fn(),
    runOnJS: jest.fn(),
    withSpring: jest.fn(),
    withTiming: jest.fn(),
    withRepeat: jest.fn(),
    withSequence: jest.fn(),
    Extrapolate: { CLAMP: jest.fn() },
  };
});

// Mock @react-navigation/elements
jest.mock('@react-navigation/elements', () => ({
  PlatformPressable: 'PlatformPressable',
  Button: 'Button',
  Header: 'Header',
  HeaderButton: 'HeaderButton',
  HeaderTitle: 'HeaderTitle',
  HeaderBackground: 'HeaderBackground',
  useHeaderHeight: jest.fn(() => 0),
}));

// Mock @react-navigation/native-stack
jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(() => ({
    Navigator: 'StackNavigator',
    Screen: 'StackScreen',
  })),
  NativeStackScreenProps: jest.fn(),
}));

// Mock @react-navigation/native
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }) => children,
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setParams: jest.fn(),
  })),
  useRoute: jest.fn(() => ({
    params: {},
    key: 'test',
    name: 'test',
  })),
  useFocusEffect: jest.fn(),
  useIsFocused: jest.fn(() => true),
  CommonActions: {
    navigate: jest.fn(),
    reset: jest.fn(),
    goBack: jest.fn(),
    setParams: jest.fn(),
  },
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  Link: ({ children, href, testID, onPress, ...props }) => {
    const React = require('react');
    return React.createElement('Text', { 
      ...props, 
      href, 
      testID: testID || 'external-link', // Don't override testID if explicitly provided
      onPress: (event) => {
        if (onPress) {
          onPress(event);
        }
      }
    }, children);
  },
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  })),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  Redirect: ({ href }) => {
    const React = require('react');
    return React.createElement('Text', { testID: 'redirect' }, `Redirect to ${href}`);
  },
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
  },
  Stack: {
    Screen: ({ children, ...props }) => {
      const React = require('react');
      return React.createElement('View', props, children);
    },
  },
  Tabs: {
    Screen: ({ children, ...props }) => {
      const React = require('react');
      return React.createElement('View', props, children);
    },
  },
  Slot: ({ children }) => children,
  SplashScreen: {
    hideAsync: jest.fn(),
    preventAutoHideAsync: jest.fn(),
  },
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  getAllKeys: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock react-native-vector-icons
jest.mock('react-native-vector-icons/MaterialIcons', () => 'MaterialIcon');
jest.mock('react-native-vector-icons/FontAwesome', () => 'FontAwesomeIcon');
jest.mock('react-native-vector-icons/Ionicons', () => 'IoniconsIcon');

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: 'GHTouchableOpacity',
  TouchableHighlight: 'GHTouchableHighlight',
  TouchableWithoutFeedback: 'GHTouchableWithoutFeedback',
  ScrollView: 'GHScrollView',
  FlatList: 'GHFlatList',
  PanGestureHandler: 'PanGestureHandler',
  TapGestureHandler: 'TapGestureHandler',
  State: {
    BEGAN: 'BEGAN',
    ACTIVE: 'ACTIVE',
    END: 'END',
    CANCELLED: 'CANCELLED',
    FAILED: 'FAILED',
    UNDETERMINED: 'UNDETERMINED',
  },
  Directions: {
    RIGHT: 'RIGHT',
    LEFT: 'LEFT',
    UP: 'UP',
    DOWN: 'DOWN',
  },
}));

// Suppress React warnings during tests
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') ||
        args[0].includes('act(') ||
        args[0].includes('ReactDOMTestUtils.act') ||
        args[0].includes('Warning: validateDOMNesting') ||
        args[0].includes('Warning: React does not recognize'))
    ) {
      return;
    }
    originalWarn(...args);
  };

  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') ||
        args[0].includes('act(') ||
        args[0].includes('ReactDOMTestUtils.act') ||
        args[0].includes('Error fetching') ||
        args[0].includes('Network error'))
    ) {
      return;
    }
    originalError(...args);
  };
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
});
