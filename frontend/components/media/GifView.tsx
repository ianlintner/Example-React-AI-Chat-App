import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ForestColors } from '../../constants/Colors';

interface GifViewProps {
  url: string;
  title?: string;
  width?: number;
  height?: number;
}

const GifViewInner: React.FC<GifViewProps> = ({
  url,
  title,
  width,
  height,
}) => {
  const aspectRatio = width && height ? width / height : 1.6;
  return (
    <View style={styles.container}>
      <Image
        source={{ uri: url }}
        style={[styles.gif, { aspectRatio }]}
        contentFit='cover'
        autoplay
        cachePolicy='memory-disk'
        accessibilityLabel={title ?? 'Animated GIF'}
      />
      {title && (
        <Text style={styles.caption} numberOfLines={1}>
          {title}
        </Text>
      )}
    </View>
  );
};

// Memo on src url so the <img>/Image isn't re-created on every parent
// re-render. Re-creation forces the browser to re-fetch the GIF (tens of
// times during a streaming turn with devtools "disable cache" on).
export const GifView = memo(
  GifViewInner,
  (prev, next) =>
    prev.url === next.url &&
    prev.title === next.title &&
    prev.width === next.width &&
    prev.height === next.height,
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: ForestColors.borderLight,
    backgroundColor: ForestColors.backgroundTertiary,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'flex-start',
  },
  gif: { width: '100%' },
  caption: {
    color: ForestColors.textMuted,
    fontSize: 11,
    padding: 6,
    textAlign: 'center',
  },
});
