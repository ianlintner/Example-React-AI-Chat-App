/**
 * Dark Forest Green theme for the AI chat application
 * Inspired by deep forest and woodland colors
 */

const tintColorLight = '#4a7c59';
const tintColorDark = '#4a7c59';

export const Colors = {
  light: {
    text: '#1a2e1a',
    background: '#f8faf8',
    tint: tintColorLight,
    icon: '#6b8e6b',
    tabIconDefault: '#6b8e6b',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#d4e6d4',
    background: '#1a2e1a',
    tint: tintColorDark,
    icon: '#9cb89c',
    tabIconDefault: '#7a947a',
    tabIconSelected: tintColorDark,
  },
};

// Forest Green theme color palette
export const ForestColors = {
  // Main backgrounds
  backgroundPrimary: '#1a2e1a',        // Deep forest green - main content area
  backgroundSecondary: '#162b16',      // Darker forest - sidebars, headers
  backgroundTertiary: '#0f1f0f',       // Deepest forest - modals, cards
  backgroundAccent: '#2a4a2a',         // Pine green - hover states
  
  // Text colors
  textNormal: '#d4e6d4',               // Light sage - primary text
  textMuted: '#9cb89c',                // Medium sage - secondary text
  textFaint: '#7a947a',                // Dark sage - tertiary text
  headerPrimary: '#e6f2e6',            // Lightest sage - headers
  headerSecondary: '#b8d4b8',          // Light sage - subheaders
  
  // Interactive colors
  interactiveNormal: '#9cb89c',        // Default interactive elements
  interactiveHover: '#b8d4b8',         // Hover state
  interactiveActive: '#d4e6d4',        // Active state
  interactiveMuted: '#5a7a5a',         // Muted interactive elements
  
  // Brand/accent colors
  brandPrimary: '#4a7c59',             // Forest accent - primary brand color
  brandSecondary: '#3d6b4a',           // Darker forest accent - secondary
  brandTertiary: '#5a8c69',            // Lighter forest accent - tertiary
  
  // Status colors
  success: '#7fbc7f',                  // Light forest green - success states
  warning: '#d4c759',                  // Golden amber - warning states
  error: '#c97a7a',                    // Muted red - error states
  info: '#7fa3bc',                     // Sage blue - info states
  
  // Message colors
  messageHover: 'rgba(42, 74, 42, 0.3)', // Forest green message hover
  messageFocused: 'rgba(74, 124, 89, 0.15)', // Brand color focused message
  
  // Input colors
  inputBackground: '#233e23',          // Dark forest input background
  inputPlaceholder: '#7a947a',         // Sage placeholder text
  
  // Border colors
  borderLight: '#2a4a2a',              // Pine green - light borders
  borderMedium: '#162b16',             // Dark forest - medium borders
  borderStrong: '#0a150a',             // Almost black - strong borders
  
  // Loading states
  loadingPrimary: '#4a7c59',           // Primary loading indicator
  loadingSecondary: '#5a8c69',         // Secondary loading indicator
  loadingBackground: 'rgba(74, 124, 89, 0.1)', // Loading background overlay
  
  // Legacy compatibility mappings
  brandExperiment: '#4a7c59',          // Maps to brandPrimary for compatibility
  brandExperimentHover: '#3d6b4a',     // Maps to brandSecondary for compatibility
  green: '#7fbc7f',                    // Maps to success for compatibility
  yellow: '#d4c759',                   // Maps to warning for compatibility
  red: '#c97a7a',                      // Maps to error for compatibility
};

// For backward compatibility, map old DiscordColors to ForestColors
export const DiscordColors = ForestColors;
