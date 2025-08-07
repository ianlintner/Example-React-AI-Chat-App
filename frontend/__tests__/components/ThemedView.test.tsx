import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedView } from '../../components/ThemedView';

// Mock the useThemeColor hook
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: jest.fn(() => '#FFFFFF'),
}));

describe('ThemedView', () => {
  it('renders correctly with default props', () => {
    const { toJSON } = render(<ThemedView />);
    expect(toJSON()).toBeTruthy();
  });

  it('applies custom style prop', () => {
    const customStyle = { padding: 20 };
    const { toJSON } = render(<ThemedView style={customStyle} />);
    expect(toJSON()).toBeTruthy();
  });

  it('passes through other props', () => {
    const { getByTestId } = render(<ThemedView testID="themed-view" accessible={true} />);
    expect(getByTestId('themed-view')).toBeTruthy();
  });

  it('handles light and dark color props', () => {
    const { toJSON } = render(<ThemedView lightColor="#FFFFFF" darkColor="#000000" />);
    expect(toJSON()).toBeTruthy();
  });
});
