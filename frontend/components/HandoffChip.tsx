import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { DiscordColors } from '../constants/Colors';

interface HandoffChipProps {
  message: string;
}

export function HandoffChip({ message }: HandoffChipProps) {
  return (
    <View style={styles.container} accessibilityRole='alert'>
      <ActivityIndicator size='small' color={DiscordColors.brandPrimary} />
      <Text style={styles.text} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: DiscordColors.backgroundSecondary,
    borderWidth: 1,
    borderColor: DiscordColors.brandPrimary,
  },
  text: {
    marginLeft: 8,
    color: DiscordColors.textNormal,
    fontSize: 13,
    fontStyle: 'italic',
    flexShrink: 1,
  },
});
