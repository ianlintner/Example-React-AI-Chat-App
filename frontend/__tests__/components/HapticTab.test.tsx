import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

// Get the mocked functions
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

// Mock @react-navigation/elements with proper Text handling
jest.mock('@react-navigation/elements', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');

  const MockPlatformPressable = React.forwardRef((props: any, ref: any) => {
    const { children, testID, onPressIn, ...otherProps } = props;

    // Handle string children by wrapping in Text
    const renderChildren = () => {
      if (typeof children === 'string') {
        return React.createElement(Text, {}, children);
      }
      return children;
    };

    return React.createElement(
      TouchableOpacity,
      {
        ref,
        testID: testID || 'platform-pressable',
        onPressIn,
        ...otherProps,
      },
      renderChildren(),
    );
  });

  MockPlatformPressable.displayName = 'PlatformPressable';

  return {
    PlatformPressable: MockPlatformPressable,
  };
});

describe('HapticTab', () => {
  const originalEnv = process.env.EXPO_OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockImpactAsync.mockClear();
    // Clear module cache to allow re-importing with new env vars
    jest.resetModules();
  });

  afterEach(() => {
    // Restore environment variable
    process.env.EXPO_OS = originalEnv;
  });

  it('renders correctly', () => {
    const { HapticTab } = require('../../components/HapticTab');
    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    expect(getByTestId('platform-pressable')).toBeTruthy();
  });

  it('passes through props to PlatformPressable', () => {
    const { HapticTab } = require('../../components/HapticTab');
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <HapticTab onPress={onPressMock} accessibilityLabel='Test tab'>
        Tab Content
      </HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    expect(tab).toBeTruthy();
    expect(tab.props.accessibilityLabel).toBe('Test tab');
  });

  it('renders children correctly', () => {
    const { HapticTab } = require('../../components/HapticTab');
    const { getByText } = render(
      <HapticTab onPress={() => {}}>Test Content</HapticTab>,
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('calls onPressIn handler', () => {
    const { HapticTab } = require('../../components/HapticTab');
    const onPressInMock = jest.fn();
    const { getByTestId } = render(
      <HapticTab onPress={() => {}} onPressIn={onPressInMock}>
        Tab Content
      </HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    expect(onPressInMock).toHaveBeenCalled();
  });

  it('triggers haptic feedback on iOS', () => {
    // Set environment variable before requiring
    Object.defineProperty(process.env, 'EXPO_OS', {
      value: 'ios',
      configurable: true,
    });

    // Delete from require cache to force re-evaluation
    delete require.cache[require.resolve('../../components/HapticTab')];
    const { HapticTab } = require('../../components/HapticTab');

    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    expect(mockImpactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it('does not trigger haptic feedback on non-iOS platforms', () => {
    // Set environment variable before requiring
    Object.defineProperty(process.env, 'EXPO_OS', {
      value: 'android',
      configurable: true,
    });

    // Delete from require cache to force re-evaluation
    delete require.cache[require.resolve('../../components/HapticTab')];
    const { HapticTab } = require('../../components/HapticTab');

    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    expect(mockImpactAsync).not.toHaveBeenCalled();
  });
});
