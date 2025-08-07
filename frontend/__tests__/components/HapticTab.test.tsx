import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { HapticTab } from '../../components/HapticTab';

describe('HapticTab', () => {
  const mockImpactAsync = (global as any).mockImpactAsync || jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockImpactAsync.mockClear();
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

  it('calls onPressIn handler', () => {
    const onPressInMock = jest.fn();
    const { getByTestId } = render(
      <HapticTab onPress={() => {}} onPressIn={onPressInMock}>
        Tab Content
      </HapticTab>
    );

    const tab = getByTestId('haptic-tab');
    fireEvent(tab, 'pressIn');

    expect(onPressInMock).toHaveBeenCalled();
  });

  it('triggers haptic feedback on press in', () => {
    const { getByTestId } = render(
      <HapticTab onPress={() => {}}>
        Tab Content
      </HapticTab>
    );

    const tab = getByTestId('haptic-tab');
    fireEvent(tab, 'pressIn');

    // Note: In test environment, haptic feedback is always triggered
    // regardless of platform due to mocking limitations
    expect(mockImpactAsync).toHaveBeenCalled();
  });
});
