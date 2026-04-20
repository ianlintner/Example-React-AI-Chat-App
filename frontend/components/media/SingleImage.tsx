import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ForestColors } from '../../constants/Colors';

interface SingleImageProps {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

export const SingleImage: React.FC<SingleImageProps> = ({
  url,
  alt,
  width,
  height,
}) => {
  const aspectRatio = width && height ? width / height : 16 / 9;
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: url }}
        style={[styles.image, { aspectRatio }]}
        contentFit='cover'
        accessibilityLabel={alt}
      />
      {alt && (
        <Text style={styles.caption} numberOfLines={2}>
          {alt}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
    backgroundColor: ForestColors.backgroundTertiary,
  },
  image: { width: '100%' },
  caption: {
    color: ForestColors.textMuted,
    fontSize: 11,
    padding: 6,
    textAlign: 'center',
  },
});
