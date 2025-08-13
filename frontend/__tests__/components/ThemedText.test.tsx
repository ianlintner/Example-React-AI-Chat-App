import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemedText } from '../../components/ThemedText';

describe('ThemedText', () => {
  it('renders correctly with default props', () => {
    const { getByText } = render(<ThemedText>Hello World</ThemedText>);

    expect(getByText('Hello World')).toBeTruthy();
  });

  it('applies custom style prop', () => {
    const customStyle = { fontSize: 20 };
    const { getByText } = render(
      <ThemedText style={customStyle}>Styled Text</ThemedText>,
    );

    const textElement = getByText('Styled Text');
    expect(textElement).toBeTruthy();
  });

  it('applies theme-based styling', () => {
    const { getByText } = render(
      <ThemedText type='title'>Title Text</ThemedText>,
    );

    expect(getByText('Title Text')).toBeTruthy();
  });

  it('handles different text types', () => {
    const textTypes = [
      'default',
      'title',
      'defaultSemiBold',
      'subtitle',
      'link',
    ] as const;

    textTypes.forEach(type => {
      const { getByText } = render(
        <ThemedText type={type}>{`${type} text`}</ThemedText>,
      );

      expect(getByText(`${type} text`)).toBeTruthy();
    });
  });
});
