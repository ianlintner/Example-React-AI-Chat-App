import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock expo-haptics first before any imports
const mockImpactAsync = jest.fn();

// Create the mock as a default export that can be used with * as Haptics
const mockHaptics = {
  impactAsync: mockImpactAsync,
  impact: jest.fn(),
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
};

jest.mock('expo-haptics', () => mockHaptics);

import { HapticTab } from '../../components/HapticTab';

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
    // Reset environment variable
    process.env.EXPO_OS = originalEnv;
  });

  afterEach(() => {
    // Restore environment variable
    process.env.EXPO_OS = originalEnv;
  });

  it('renders correctly', () => {
    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    expect(getByTestId('platform-pressable')).toBeTruthy();
  });

  it('passes through props to PlatformPressable', () => {
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
    const { getByText } = render(
      <HapticTab onPress={() => {}}>Test Content</HapticTab>,
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('calls onPressIn handler', () => {
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
    process.env.EXPO_OS = 'ios';

    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    expect(mockImpactAsync).toHaveBeenCalledWith('light');
  });

  it('does not trigger haptic feedback on non-iOS platforms', () => {
    process.env.EXPO_OS = 'android';

    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    expect(mockImpactAsync).not.toHaveBeenCalled();
  });
});
