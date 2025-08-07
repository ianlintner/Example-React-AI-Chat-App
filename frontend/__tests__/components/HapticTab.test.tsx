import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HapticTab } from '../../components/HapticTab';

describe('HapticTab', () => {
  const originalExpoOS = process.env.EXPO_OS;
  const mockImpactAsync = (global as any).mockImpactAsync || jest.fn();

  beforeEach(() => {
    mockImpactAsync.mockClear();
  });

  afterEach(() => {
    process.env.EXPO_OS = originalExpoOS;
  });

  it('renders correctly', () => {
    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>
        Tab Content
      </HapticTab>
    );

    expect(getByTestId('haptic-tab')).toBeTruthy();
  });

  it('passes through props to PlatformPressable', () => {
    const onPressMock = jest.fn();
    const { getByTestId } = render(
      <HapticTab 
        onPress={onPressMock}
        accessibilityLabel="Test tab"
      >
        Tab Content
      </HapticTab>
    );

    const tab = getByTestId('haptic-tab');
    expect(tab).toBeTruthy();
    expect(tab.props.accessibilityLabel).toBe('Test tab');
  });

  it('renders children correctly', () => {
    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>
        Test Content
      </HapticTab>
    );

    const hapticTab = getByTestId('haptic-tab');
    expect(hapticTab).toBeTruthy();
    // Since our mock renders children as text inside the View, we check for the component
    expect(hapticTab.children).toBeDefined();
  });

  describe('haptic feedback on iOS', () => {
    beforeEach(() => {
      process.env.EXPO_OS = 'ios';
    });

    it('triggers haptic feedback on press in', () => {
      const { getByTestId } = render(
        <HapticTab onPress={() => {}}>
          Tab Content
        </HapticTab>
      );

      const tab = getByTestId('haptic-tab');
      fireEvent(tab, 'pressIn');

      expect(mockImpactAsync).toHaveBeenCalledWith('light');
    });

    it('calls original onPressIn handler if provided', () => {
      const onPressInMock = jest.fn();
      const { getByTestId } = render(
        <HapticTab onPress={() => {}} onPressIn={onPressInMock}>
          Tab Content
        </HapticTab>
      );

      const tab = getByTestId('haptic-tab');
      fireEvent(tab, 'pressIn');

      expect(mockImpactAsync).toHaveBeenCalledWith('light');
      expect(onPressInMock).toHaveBeenCalled();
    });
  });

  describe('no haptic feedback on non-iOS platforms', () => {
    it('does not trigger haptic feedback on Android', () => {
      process.env.EXPO_OS = 'android';
      
      const { getByTestId } = render(
        <HapticTab onPress={() => {}}>
          Tab Content
        </HapticTab>
      );

      const tab = getByTestId('haptic-tab');
      fireEvent(tab, 'pressIn');

      expect(mockImpactAsync).not.toHaveBeenCalled();
    });

    it('still calls original onPressIn handler on Android', () => {
      process.env.EXPO_OS = 'android';
      
      const onPressInMock = jest.fn();
      const { getByTestId } = render(
        <HapticTab onPress={() => {}} onPressIn={onPressInMock}>
          Tab Content
        </HapticTab>
      );

      const tab = getByTestId('haptic-tab');
      fireEvent(tab, 'pressIn');

      expect(mockImpactAsync).not.toHaveBeenCalled();
      expect(onPressInMock).toHaveBeenCalled();
    });

    it('does not trigger haptic feedback when EXPO_OS is undefined', () => {
      delete process.env.EXPO_OS;
      
      const { getByTestId } = render(
        <HapticTab onPress={() => {}}>
          Tab Content
        </HapticTab>
      );

      const tab = getByTestId('haptic-tab');
      fireEvent(tab, 'pressIn');

      expect(mockImpactAsync).not.toHaveBeenCalled();
    });
  });
});
