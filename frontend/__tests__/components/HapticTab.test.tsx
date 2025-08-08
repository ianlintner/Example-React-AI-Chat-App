import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
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

// Get the mocked functions
const mockImpactAsync = Haptics.impactAsync as jest.MockedFunction<
  typeof Haptics.impactAsync
>;

describe('HapticTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockImpactAsync.mockClear();
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

  it('triggers haptic feedback when onPressIn is called', () => {
    // Clear the mock to ensure clean state
    mockImpactAsync.mockClear();

    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>Tab Content</HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    // The component calls Haptics.impactAsync with Light feedback style
    expect(mockImpactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it('calls both haptic feedback and custom onPressIn handler', () => {
    mockImpactAsync.mockClear();
    const customOnPressIn = jest.fn();

    const { getByTestId } = render(
      <HapticTab onPress={() => {}} onPressIn={customOnPressIn}>
        Tab Content
      </HapticTab>,
    );

    const tab = getByTestId('platform-pressable');
    fireEvent(tab, 'pressIn');

    // Both haptic feedback and custom handler should be called
    expect(mockImpactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
    expect(customOnPressIn).toHaveBeenCalled();
  });
});
