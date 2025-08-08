import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { ExternalLink } from '../../components/ExternalLink';

declare const global: any;

describe('ExternalLink', () => {
  const mockOpenBrowserAsync = global.mockOpenBrowserAsync;

  beforeEach(() => {
    jest.clearAllMocks();
    if (mockOpenBrowserAsync) {
      mockOpenBrowserAsync.mockClear();
    }
  });

  it('renders correctly with children', () => {
    const { getByTestId } = render(
      <ExternalLink href="https://example.com">Visit Example</ExternalLink>,
    );

    const link = getByTestId('external-link');
    expect(link).toBeTruthy();
    expect(link.children).toContain('Visit Example');
  });

  it('renders correctly with href prop', () => {
    const { getByTestId } = render(
      <ExternalLink href="https://example.com">Visit Example</ExternalLink>,
    );

    const link = getByTestId('external-link');
    expect(link).toBeTruthy();
    expect(link.props.href).toBe('https://example.com');
  });

  it('passes through additional props', () => {
    const { getByTestId } = render(
      <ExternalLink
        href="https://example.com"
        accessibilityLabel="Custom link"
        testID="custom-link"
      >
        Visit Example
      </ExternalLink>,
    );

    const link = getByTestId('custom-link');
    expect(link).toBeTruthy();
    expect(link.props.accessibilityLabel).toBe('Custom link');
  });

  it('handles different href formats', () => {
    const { rerender, getByTestId } = render(
      <ExternalLink href="mailto:test@example.com">Send Email</ExternalLink>,
    );

    expect(getByTestId('external-link')).toBeTruthy();
    expect(getByTestId('external-link').props.href).toBe('mailto:test@example.com');

    rerender(<ExternalLink href="tel:+1234567890">Call Phone</ExternalLink>);

    expect(getByTestId('external-link').props.href).toBe('tel:+1234567890');
  });

  describe('on native platform', () => {
    beforeEach(() => {
      // Mock Platform.OS to be 'ios' (native)
      Object.defineProperty(Platform, 'OS', {
        writable: true,
        value: 'ios',
      });
    });

    it('opens browser on native when pressed and prevents default', async () => {
      const href = 'https://example.com';
      const { getByTestId } = render(<ExternalLink href={href}>Visit Example</ExternalLink>);

      const link = getByTestId('external-link');

      // Create mock event with preventDefault
      const mockEvent = {
        preventDefault: jest.fn(),
        nativeEvent: {},
        currentTarget: {},
        target: {},
      };

      // Simulate press
      fireEvent.press(link, mockEvent);

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockOpenBrowserAsync).toHaveBeenCalledWith(href);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('handles Android platform', async () => {
      Object.defineProperty(Platform, 'OS', {
        writable: true,
        value: 'android',
      });

      const href = 'https://example.com';
      const { getByTestId } = render(<ExternalLink href={href}>Visit Example</ExternalLink>);

      const link = getByTestId('external-link');

      // Create mock event with preventDefault
      const mockEvent = {
        preventDefault: jest.fn(),
        nativeEvent: {},
        currentTarget: {},
        target: {},
      };

      fireEvent.press(link, mockEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockOpenBrowserAsync).toHaveBeenCalledWith(href);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('on web platform', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        writable: true,
        value: 'web',
      });
    });

    it('does not call openBrowserAsync on web platform', async () => {
      const href = 'https://example.com';
      const { getByTestId } = render(<ExternalLink href={href}>Visit Example</ExternalLink>);

      const link = getByTestId('external-link');

      // Create mock event with preventDefault
      const mockEvent = {
        preventDefault: jest.fn(),
        nativeEvent: {},
        currentTarget: {},
        target: {},
      };

      fireEvent.press(link, mockEvent);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockOpenBrowserAsync).not.toHaveBeenCalled();
      // preventDefault should not be called on web
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });
});
