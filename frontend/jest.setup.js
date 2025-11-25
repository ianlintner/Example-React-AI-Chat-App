import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

// Global React setup
global.React = require('react');

// Mock React Native completely
jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn(styles => styles),
    flatten: jest.fn(style => style),
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
    getPixelSizeForLayoutSize: jest.fn(layoutSize => layoutSize * 2),
    roundToNearestPixel: jest.fn(layoutSize => Math.round(layoutSize)),
  },

  Platform: {
    OS: 'ios',
    Version: '14.0',
    select: jest.fn(options => options.ios || options.default),
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

  // Animated API
  Animated: {
    View: 'AnimatedView',
    Text: 'AnimatedText',
    ScrollView: 'AnimatedScrollView',
    FlatList: 'AnimatedFlatList',
    Image: 'AnimatedImage',
    Value: jest.fn().mockImplementation(value => ({
      setValue: jest.fn(),
      addListener: jest.fn(() => 'listenerId'),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      stopAnimation: jest.fn(),
      resetAnimation: jest.fn(),
      interpolate: jest.fn(() => ({ interpolate: jest.fn() })),
      animate: jest.fn(),
      _value: value,
    })),
    ValueXY: jest.fn().mockImplementation(value => ({
      x: { _value: value?.x || 0 },
      y: { _value: value?.y || 0 },
      setValue: jest.fn(),
      setOffset: jest.fn(),
      flattenOffset: jest.fn(),
      extractOffset: jest.fn(),
      addListener: jest.fn(() => 'listenerId'),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      stopAnimation: jest.fn(),
      resetAnimation: jest.fn(),
      getLayout: jest.fn(() => ({ left: 0, top: 0 })),
      getTranslateTransform: jest.fn(() => []),
    })),
    timing: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    spring: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    decay: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    sequence: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    parallel: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    stagger: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    loop: jest.fn().mockImplementation(() => ({
      start: jest.fn(callback => callback && callback({ finished: true })),
      stop: jest.fn(),
      reset: jest.fn(),
    })),
    event: jest.fn(),
    createAnimatedComponent: jest.fn(Component => Component),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      poly: jest.fn(),
      sin: jest.fn(),
      circle: jest.fn(),
      exp: jest.fn(),
      elastic: jest.fn(),
      back: jest.fn(),
      bounce: jest.fn(),
      bezier: jest.fn(),
      in: jest.fn(),
      out: jest.fn(),
      inOut: jest.fn(),
    },
  },
}));

// Mock @react-native-picker/picker
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const MockPicker = ({
    children,
    onValueChange,
    selectedValue,
    style,
    testID,
    ...props
  }) => {
    return React.createElement(
      'View',
      {
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
        },
      },
      children,
    );
  };

  MockPicker.Item = ({ label, value, ...props }) => {
    return React.createElement(
      'Text',
      {
        testID: 'picker-item',
        ...props,
      },
      label,
    );
  };

  return {
    Picker: MockPicker,
  };
});

// Mock react-native-paper components
jest.mock('react-native-paper', () => {
  const React = require('react');

  const createMockComponent = (displayName, testID) => {
    const MockComponent = React.forwardRef(({ children, ...props }, ref) => {
      return React.createElement(
        'View',
        {
          ref,
          testID: testID || displayName.toLowerCase(),
          ...props,
        },
        children,
      );
    });
    MockComponent.displayName = displayName;
    return MockComponent;
  };

  const MockAvatar = createMockComponent('Avatar', 'avatar');
  MockAvatar.Icon = React.forwardRef(({ icon, size, style, ...props }, ref) => {
    return React.createElement(
      'View',
      {
        ref,
        testID: 'avatar-icon',
        style: [{ width: size || 40, height: size || 40 }, style],
        ...props,
      },
      React.createElement(
        'Text',
        { testID: 'avatar-icon-text' },
        typeof icon === 'string' ? icon : 'icon',
      ),
    );
  });
  MockAvatar.Icon.displayName = 'Avatar.Icon';

  const MockChip = React.forwardRef(
    ({ children, mode, compact, textStyle, style, ...props }, ref) => {
      return React.createElement(
        'View',
        {
          ref,
          testID: 'chip',
          style: style,
          ...props,
        },
        React.createElement(
          'Text',
          {
            testID: 'chip-text',
            style: textStyle,
          },
          children,
        ),
      );
    },
  );
  MockChip.displayName = 'Chip';

  const MockButton = React.forwardRef(({ children, ...props }, ref) => {
    return React.createElement(
      'TouchableOpacity',
      {
        ref,
        testID: 'button',
        ...props,
      },
      React.createElement('Text', { testID: 'button-text' }, children),
    );
  });
  MockButton.displayName = 'Button';

  const MockIconButton = React.forwardRef(
    (
      { icon, size, iconColor, style, onPress, disabled, testID, ...props },
      ref,
    ) => {
      return React.createElement(
        'TouchableOpacity',
        {
          ref,
          testID: testID || 'icon-button',
          style: [{ width: size || 24, height: size || 24 }, style],
          onPress: disabled ? undefined : onPress,
          disabled,
          ...props,
        },
        React.createElement(
          'Text',
          {
            testID: 'icon-button-text',
            style: { color: iconColor },
          },
          typeof icon === 'string' ? icon : 'icon',
        ),
      );
    },
  );
  MockIconButton.displayName = 'IconButton';

  const MockActivityIndicator = React.forwardRef(
    ({ size, color, ...props }, ref) => {
      return React.createElement('View', {
        ref,
        testID: 'activity-indicator',
        style: {
          width: size === 'small' ? 20 : 36,
          height: size === 'small' ? 20 : 36,
        },
        ...props,
      });
    },
  );
  MockActivityIndicator.displayName = 'ActivityIndicator';

  return {
    Avatar: MockAvatar,
    Chip: MockChip,
    Button: MockButton,
    IconButton: MockIconButton,
    ActivityIndicator: MockActivityIndicator,
    Card: createMockComponent('Card'),
    Text: createMockComponent('Text'),
    Surface: createMockComponent('Surface'),
    Appbar: {
      Header: createMockComponent('AppbarHeader'),
      Content: createMockComponent('AppbarContent'),
      Action: createMockComponent('AppbarAction'),
    },
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  useSafeAreaFrame: () => ({ width: 375, height: 667, x: 0, y: 0 }),
}));

// Mock react-native-markdown-display
jest.mock('react-native-markdown-display', () => {
  const React = require('react');
  return React.forwardRef(({ children, style, ...props }, ref) => {
    return React.createElement(
      'Text',
      {
        ref,
        testID: 'markdown',
        style,
        ...props,
      },
      children,
    );
  });
});

// Mock expo-web-browser
const mockOpenBrowserAsync = jest.fn();
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: mockOpenBrowserAsync,
  dismissBrowser: jest.fn(),
  maybeCompleteAuthSession: jest.fn(),
}));

// Make mockOpenBrowserAsync available globally for tests
global.mockOpenBrowserAsync = mockOpenBrowserAsync;

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'exp://localhost:19000/--/auth/callback'),
  useAuthRequest: jest.fn(() => [
    null, // request
    null, // response
    jest.fn(), // promptAsync
  ]),
  useAutoDiscovery: jest.fn(() => null),
  fetchDiscoveryAsync: jest.fn().mockResolvedValue({
    authorizationEndpoint: 'https://example.com/auth',
    tokenEndpoint: 'https://example.com/token',
    revocationEndpoint: 'https://example.com/revoke',
  }),
  AuthRequest: jest.fn(),
  AuthSessionResult: {},
  ResponseType: {
    Code: 'code',
    Token: 'token',
  },
  CodeChallengeMethod: {
    S256: 'S256',
    Plain: 'plain',
  },
  Prompt: {
    None: 'none',
    Login: 'login',
    Consent: 'consent',
    SelectAccount: 'select_account',
  },
}));

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
  __esModule: true,
  default: {
    impact: jest.fn(),
    impactAsync: jest.fn(),
    notification: jest.fn(),
    notificationAsync: jest.fn(),
    selection: jest.fn(),
    selectionAsync: jest.fn(),
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
  },
  impact: jest.fn(),
  impactAsync: jest.fn(),
  notification: jest.fn(),
  notificationAsync: jest.fn(),
  selection: jest.fn(),
  selectionAsync: jest.fn(),
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
  requireNativeModule: jest.fn(() => ({
    // Mock native module methods that expo-auth-session might need
    getStateAsync: jest.fn().mockResolvedValue(null),
    setStateAsync: jest.fn().mockResolvedValue(undefined),
  })),
  requireNativeViewManager: jest.fn(),
  EventEmitter: jest.fn(),
  Subscription: jest.fn(),
  UnavailabilityError: class UnavailabilityError extends Error {},
}));

// Mock useColorScheme hook for React Native
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => {
  return {
    __esModule: true,
    default: jest.fn(() => 'light'),
  };
});

// Mock the hooks/useColorScheme files
jest.mock('./hooks/useColorScheme', () => {
  return {
    __esModule: true,
    default: jest.fn(() => 'light'),
    useColorScheme: jest.fn(() => 'light'),
  };
});

jest.mock('./hooks/useColorScheme.web', () => {
  return {
    __esModule: true,
    default: jest.fn(() => 'light'),
    useColorScheme: jest.fn(() => 'light'),
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const mockCreateAnimatedComponent = Component => Component;

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
jest.mock('@react-navigation/elements', () => {
  const React = require('react');

  const MockPlatformPressable = React.forwardRef(
    ({ children, testID, ...props }, ref) => {
      return React.createElement(
        'TouchableOpacity',
        {
          ref,
          testID: testID || 'platform-pressable',
          ...props,
        },
        children,
      );
    },
  );
  MockPlatformPressable.displayName = 'PlatformPressable';

  return {
    PlatformPressable: MockPlatformPressable,
    Button: 'Button',
    Header: 'Header',
    HeaderButton: 'HeaderButton',
    HeaderTitle: 'HeaderTitle',
    HeaderBackground: 'HeaderBackground',
    useHeaderHeight: jest.fn(() => 0),
  };
});

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
    return React.createElement(
      'Text',
      {
        ...props,
        href,
        testID: testID || 'external-link', // Don't override testID if explicitly provided
        onPress: event => {
          if (onPress) {
            onPress(event);
          }
        },
      },
      children,
    );
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
    return React.createElement(
      'Text',
      { testID: 'redirect' },
      `Redirect to ${href}`,
    );
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
